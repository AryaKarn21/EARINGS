const router = require("express").Router();
const { prisma } = require("../db/prisma");
const { productOut, productsOut, pickProductInput } = require("../db/serialize");
const { recommend } = require("../services/recommendationEngine");
const { getPersonalizationContext } = require("../services/personalizationContext");
const { isVerifiedPurchase, recomputeProductRating, assertValidReviewInput } = require("../services/reviewService");
const { requireAuth, requireRole } = require("../middleware/auth");
const auditLog = require("../services/auditLog");
const { parseQuery, buildTsQuery } = require("../services/searchQueryParser");
const ah = require("../utils/asyncHandler");

const SORTS = {
  priceLow: { price: "asc" },
  priceHigh: { price: "desc" },
  rating: { rating: "desc" },
  popular: { reviews: "desc" },
  newest: { createdAt: "desc" },
};

const SEARCH_IMPRESSION_CAP = 20; // see ProductSearchImpression comment in schema.prisma

function ownerKey(req) {
  return req.user?.id || req.headers["x-guest-id"] || "guest";
}

// GET /api/products?productType=&category=&material=&color=&style=&occasion=&minPrice=&maxPrice=&rating=&sort=&q=
//
// Phase 2 search: when `q` is present it's run through parseQuery() first
// (src/services/searchQueryParser.js) to pull out structured attributes —
// "gold earrings for wedding under $50" becomes color=Gold, occasion=Wedding,
// productType=earrings, maxPrice=50, with nothing left over. Explicit query
// params always win over anything parsed from `q` (a shopper who typed a
// sentence AND clicked a filter chip meant the chip). Whatever text is left
// after extraction is ranked via real Postgres full-text search
// (Product.searchVector, a generated tsvector column — see
// prisma/fts_migration.sql) rather than the old ILIKE scan.
//
// The old ILIKE-across-4-fields behaviour is kept as a safety net, not
// removed: if a query has leftover text that full-text search can't match
// (different tokenization, e.g. a partial word), whatever it would have
// matched before still gets included, just ranked below genuine full-text
// hits. This is deliberate — Phase 2 is additive to search quality, not a
// replacement that could regress recall on a query that worked before.
router.get("/", ah(async (req, res) => {
  const { productType, category, material, color, style, occasion, minPrice, maxPrice, rating, sort, q } = req.query;

  const parsed = q ? parseQuery(q) : { filters: {}, remainingText: "" };

  // Explicit params win over parsed ones on conflict.
  const eff = {
    productType: productType || parsed.filters.productType,
    category: category || parsed.filters.category,
    material: material || parsed.filters.material,
    color: color || parsed.filters.color,
    style: style || parsed.filters.style,
    occasion: occasion || parsed.filters.occasion,
    minPrice: minPrice ?? parsed.filters.minPrice,
    maxPrice: maxPrice ?? parsed.filters.maxPrice,
    rating,
    // faceShape from the parser has no dedicated column filter (matching
    // faceShapeMatch is inherently fuzzy — a product doesn't strictly
    // belong or not belong to a face shape), so it's folded into full-text
    // ranking instead: appended to remainingText so it still influences
    // relevance via the searchVector's faceShapeMatch component, rather
    // than being silently dropped.
  };
  let remainingText = parsed.remainingText || "";
  if (parsed.filters.faceShape) remainingText = `${remainingText} ${parsed.filters.faceShape}`.trim();

  const where = {};
  if (eff.productType) where.productType = eff.productType;
  if (eff.category) where.category = eff.category;
  if (eff.material) where.material = { equals: eff.material, mode: "insensitive" };
  if (eff.color) where.color = { equals: eff.color, mode: "insensitive" };
  if (eff.style) where.style = { equals: eff.style, mode: "insensitive" };
  if (eff.rating) where.rating = { gte: Number(eff.rating) };
  if (eff.minPrice || eff.maxPrice) {
    where.price = {
      ...(eff.minPrice && { gte: Number(eff.minPrice) }),
      ...(eff.maxPrice && { lte: Number(eff.maxPrice) }),
    };
  }

  let candidates = await prisma.product.findMany({
    where,
    ...(SORTS[sort] && { orderBy: SORTS[sort] }),
  });

  // occasion stays a post-fetch JS filter (see original comment) — a text[]
  // column, and Prisma's array `has` has no case-insensitive mode.
  if (eff.occasion) {
    const needle = String(eff.occasion).toLowerCase();
    candidates = candidates.filter(p => p.occasion.some(o => o.toLowerCase() === needle));
  }

  let results = candidates;
  let relevanceById = null;

  if (q) {
    const tsQuery = buildTsQuery(remainingText);
    relevanceById = new Map();

    if (tsQuery && candidates.length) {
      const ranked = await prisma.$queryRawUnsafe(
        `SELECT id, ts_rank("searchVector", to_tsquery('english', $1)) AS rank
         FROM "Product"
         WHERE id = ANY($2::text[]) AND "searchVector" @@ to_tsquery('english', $1)
         ORDER BY rank DESC`,
        tsQuery,
        candidates.map(c => c.id),
      );
      ranked.forEach(r => relevanceById.set(r.id, Number(r.rank)));
    }

    // Safety net: the pre-Phase-2 ILIKE scan, scoped to the same structural
    // candidates, using the ORIGINAL query text (not remainingText) — this
    // guarantees anything that matched before Phase 2 still matches now.
    // Anything already found via full-text search is left with its real
    // rank; anything ILIKE-only catches gets a token relevance score so it
    // sorts after genuine full-text matches but still appears.
    const needle = String(q).toLowerCase();
    for (const c of candidates) {
      if (relevanceById.has(c.id)) continue;
      const hay = `${c.name} ${c.material || ""} ${c.style || ""} ${c.color || ""}`.toLowerCase();
      if (hay.includes(needle)) relevanceById.set(c.id, 0.0001);
    }

    // A `q` was given. If any text was left after structured-attribute
    // extraction, prefer only products that actually matched that text (via
    // full-text search or the ILIKE safety net above) — same filtering
    // behaviour as before Phase 2. Exception: if the parser DID extract at
    // least one real structured filter (color/style/occasion/price/
    // productType/category) and applying the leftover text would zero out
    // every one of those matches (e.g. "traditional earrings for festive
    // outfit" — style=Traditional and occasion=Festive are real, well-
    // matched filters, but the leftover word "outfit" doesn't literally
    // appear in any product's indexed text), fall back to the structural
    // candidate set instead of returning nothing — leftover filler text
    // shouldn't be able to erase a legitimate structured match.
    //
    // This exception does NOT apply when the parser recognised nothing at
    // all (a plain arbitrary keyword with no structured filters) — that
    // case must stay a hard filter exactly like the old ILIKE behaviour, or
    // a typo/unknown word would return the entire catalogue instead of a
    // (correct) empty result.
    const hasStructuredFilters = Object.keys(parsed.filters).length > 0;
    if (remainingText.trim()) {
      const textFiltered = candidates.filter(c => relevanceById.has(c.id));
      const shouldFallBack = hasStructuredFilters && textFiltered.length === 0 && candidates.length > 0;
      results = shouldFallBack ? candidates : textFiltered;
    } else {
      results = candidates;
    }

    if (!sort) {
      results = [...results].sort((a, b) => (relevanceById.get(b.id) || 0) - (relevanceById.get(a.id) || 0));
    }
  }

  // Search-activity trend signal: log which products actually surfaced for
  // a real query, capped so a broad query doesn't write hundreds of rows.
  if (q && results.length) {
    await prisma.productSearchImpression.createMany({
      data: results.slice(0, SEARCH_IMPRESSION_CAP).map(p => ({ productId: p.id, query: String(q).slice(0, 200) })),
    });
  }

  const out = productsOut(results);
  if (q) out.forEach((p, i) => { p.relevanceScore = relevanceById.get(results[i].id) ?? 1; });

  res.json({ count: out.length, results: out, ...(q && { parsedQuery: parsed.extracted }) });
}));

// ---------------------------------------------------------------- discovery
// Mounted before /:id — Express matches routes in order, and these are
// static paths that would otherwise be swallowed by the dynamic /:id route
// below (and then 500 when a non-uuid string hits a uuid-typed lookup).

const DEFAULT_DISCOVERY_LIMIT = 20;

function discoveryWhere(req) {
  const where = {};
  if (req.query.productType) where.productType = req.query.productType;
  return where;
}

// GET /api/products/trending?productType=&limit=
// GET /api/products/trending?productType=&limit=
router.get("/trending", ah(async (req, res) => {
  const limit = Number(req.query.limit) || DEFAULT_DISCOVERY_LIMIT;
  // Same "requires real engagement" gate as the Trending Now tag in
  // discoveryTags.js — trendScore alone isn't a safe filter here because a
  // well-rated product with zero interaction still has trendScore > 0 (see
  // ratingWeight's comment in trendService.js). This inspects the actual
  // decayed counts inside trendScoreBreakdown via a raw JSONB predicate
  // rather than duplicating that logic in JS after the fact.
  const rows = await prisma.$queryRawUnsafe(`
    SELECT id FROM "Product"
    WHERE "trendScore" > 0
      ${req.query.productType ? `AND "productType" = $2` : ""}
      AND "trendScoreBreakdown" IS NOT NULL
      AND (
        (("trendScoreBreakdown"->'views'->>'total')::int > 0) OR
        (("trendScoreBreakdown"->'cartAdds'->>'total')::int > 0) OR
        (("trendScoreBreakdown"->'wishlistAdds'->>'total')::int > 0) OR
        (("trendScoreBreakdown"->'tryOns'->>'total')::int > 0) OR
        (("trendScoreBreakdown"->'purchases'->>'total')::int > 0) OR
        (("trendScoreBreakdown"->'searchImpressions'->>'total')::int > 0)
      )
    ORDER BY "trendScore" DESC
    LIMIT $1
  `, limit, ...(req.query.productType ? [req.query.productType] : []));

  const byId = new Map((await prisma.product.findMany({ where: { id: { in: rows.map(r => r.id) } } })).map(p => [p.id, p]));
  const results = rows.map(r => byId.get(r.id)).filter(Boolean);
  res.json({ count: results.length, results: productsOut(results) });
}));

// GET /api/products/new-arrivals?productType=&limit=
router.get("/new-arrivals", ah(async (req, res) => {
  const limit = Number(req.query.limit) || DEFAULT_DISCOVERY_LIMIT;
  const { NEW_ARRIVAL_DAYS } = require("../services/discoveryTags");
  const results = await prisma.product.findMany({
    where: { ...discoveryWhere(req), createdAt: { gte: new Date(Date.now() - NEW_ARRIVAL_DAYS * 86400000) } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  res.json({ count: results.length, results: productsOut(results) });
}));

// GET /api/products/best-rated?productType=&limit=
router.get("/best-rated", ah(async (req, res) => {
  const limit = Number(req.query.limit) || DEFAULT_DISCOVERY_LIMIT;
  const { BEST_RATED_MIN_RATING, BEST_RATED_MIN_REVIEWS } = require("../services/discoveryTags");
  const results = await prisma.product.findMany({
    where: { ...discoveryWhere(req), rating: { gte: BEST_RATED_MIN_RATING }, reviews: { gte: BEST_RATED_MIN_REVIEWS } },
    orderBy: [{ rating: "desc" }, { reviews: "desc" }],
    take: limit,
  });
  res.json({ count: results.length, results: productsOut(results) });
}));

// GET /api/products/most-loved?productType=&limit=
// Live groupBy on WishlistItem rather than the cached trendScore breakdown —
// this endpoint answers "who's wishlisted right now", not a decayed proxy
// for it, and a groupBy over a few thousand rows is cheap enough to run
// per-request without a cache.
router.get("/most-loved", ah(async (req, res) => {
  const limit = Number(req.query.limit) || DEFAULT_DISCOVERY_LIMIT;
  const grouped = await prisma.wishlistItem.groupBy({
    by: ["productId"],
    _count: { productId: true },
    orderBy: { _count: { productId: "desc" } },
    take: limit * 3, // over-fetch before the productType filter narrows it
  });
  if (!grouped.length) return res.json({ count: 0, results: [] });

  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map(g => g.productId) }, ...discoveryWhere(req) },
  });
  const byId = new Map(products.map(p => [p.id, p]));
  const ordered = grouped.map(g => byId.get(g.productId)).filter(Boolean).slice(0, limit);
  res.json({ count: ordered.length, results: productsOut(ordered) });
}));

// GET /api/products/demand?productType=&limit=
// Transparency endpoint: the raw signal breakdown behind trendScore, for
// admin/debugging use (and the future BI dashboard) — not meant for the
// storefront itself.
router.get("/demand", ah(async (req, res) => {
  const limit = Number(req.query.limit) || DEFAULT_DISCOVERY_LIMIT;
  const results = await prisma.product.findMany({
    where: discoveryWhere(req),
    orderBy: { trendScore: "desc" },
    take: limit,
    select: {
      id: true, name: true, productType: true, category: true,
      trendScore: true, trendScorePrevious: true, trendScoreBreakdown: true, trendScoreComputedAt: true,
    },
  });
  res.json({ count: results.length, results });
}));

// GET /api/products/recommended  (also accepts the same body as
// POST /recommendations/for-me — see that route for the full personalised
// version; this GET variant is the storefront's no-preferences-yet default,
// blending trend score with rating so "recommended" isn't just "trending"
// restated under a different name).
router.get("/recommended", ah(async (req, res) => {
  const limit = Number(req.query.limit) || DEFAULT_DISCOVERY_LIMIT;
  const candidates = await prisma.product.findMany({
    where: { ...discoveryWhere(req), trendScore: { gt: 0 } },
    take: limit * 3,
    orderBy: { trendScore: "desc" },
  });
  const pool = candidates.length ? candidates : await prisma.product.findMany({ where: discoveryWhere(req), orderBy: { rating: "desc" }, take: limit * 3 });
  const ranked = [...pool]
    .sort((a, b) => (b.trendScore * 0.7 + b.rating * 6) - (a.trendScore * 0.7 + a.rating * 6))
    .slice(0, limit);
  res.json({ count: ranked.length, results: productsOut(ranked) });
}));

router.get("/:id", ah(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  await prisma.productView.create({ data: { productId: product.id, ownerKey: ownerKey(req) } });
  res.json(productOut(product));
}));

const REVIEW_SORTS = {
  recent: { createdAt: "desc" },
  highest: [{ rating: "desc" }, { createdAt: "desc" }],
  lowest: [{ rating: "asc" }, { createdAt: "desc" }],
  helpful: [{ helpfulCount: "desc" }, { createdAt: "desc" }],
};

// GET /api/products/:id/reviews?sort=recent|highest|lowest|helpful&verifiedOnly=true
//
// Returns both the review list and the aggregate stats a product page needs
// (average rating, total, rating distribution, verified count, photo
// count) in one call, computed from the SAME query — not two separate
// round trips that could disagree with each other under concurrent writes.
// Only Approved reviews are ever included here; Flagged/Rejected reviews
// are invisible to this endpoint regardless of sort or filter.
router.get("/:id/reviews", ah(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  const where = { productId: product.id, moderationStatus: "Approved" };
  if (req.query.verifiedOnly === "true") where.verifiedPurchase = true;

  const sortKey = REVIEW_SORTS[req.query.sort] ? req.query.sort : "recent";
  const reviews = await prisma.review.findMany({ where, orderBy: REVIEW_SORTS[sortKey] });

  // Distribution and photo count are computed over ALL approved reviews for
  // this product, not just the (possibly verifiedOnly-filtered) list above —
  // "5 stars: 12" on a product page means 12 total, not 12-among-verified.
  const allApproved = req.query.verifiedOnly === "true"
    ? await prisma.review.findMany({ where: { productId: product.id, moderationStatus: "Approved" }, select: { rating: true, verifiedPurchase: true, images: true } })
    : reviews;

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let photoCount = 0;
  let verifiedCount = 0;
  for (const r of allApproved) {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    if (r.verifiedPurchase) verifiedCount++;
    if (r.images?.length) photoCount += r.images.length;
  }
  const total = allApproved.length;
  const average = total ? Math.round((allApproved.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10 : 0;

  // Let the viewer know which reviews they've already marked helpful, so
  // the frontend can disable/toggle that button correctly without a
  // separate round trip per review.
  const key = ownerKey(req);
  const myVotes = reviews.length
    ? new Set((await prisma.reviewHelpfulVote.findMany({
        where: { ownerKey: key, reviewId: { in: reviews.map(r => r.id) } },
        select: { reviewId: true },
      })).map(v => v.reviewId))
    : new Set();

  res.json({
    average,
    total,
    distribution,
    verifiedCount,
    photoCount,
    sort: sortKey,
    reviews: reviews.map(r => ({ ...r, helpfulByMe: myVotes.has(r.id) })),
  });
}));

// POST /api/products/:id/reviews  { rating, title?, comment?, images? }
// One review per product per person (see Review's @@unique in
// schema.prisma) — a second attempt gets a 409, not a silent overwrite; use
// PUT /api/reviews/:id to edit an existing review instead.
router.post("/:id/reviews", ah(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id }, select: { id: true, name: true } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  assertValidReviewInput(req.body || {});
  const key = ownerKey(req);

  const existing = await prisma.review.findUnique({ where: { productId_ownerKey: { productId: product.id, ownerKey: key } } });
  if (existing) return res.status(409).json({ error: "You've already reviewed this product. Edit your existing review instead." });

  const orderId = req.body.orderId || null;
  const verifiedPurchase = await isVerifiedPurchase(key, product.id, orderId);

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        productId: product.id,
        orderId: orderId || undefined,
        ownerKey: key,
        rating: Number(req.body.rating),
        title: req.body.title ?? null,
        comment: req.body.comment ?? null,
        images: Array.isArray(req.body.images) ? req.body.images.slice(0, 10) : [],
        verifiedPurchase,
      },
    });

    if (orderId && verifiedPurchase) {
      await tx.orderItem.updateMany({
        where: { orderId, productId: product.id },
        data: { isReviewed: true },
      });
    }

    await recomputeProductRating(tx, product.id);
    return created;
  });

  const { createNotification } = require("../services/notificationService");
  await createNotification({
    targetRole: "SUPER_ADMIN",
    category: "NEW_REVIEW",
    title: `New Review for ${product.name}: ${req.body.rating}★`,
    message: `${req.user?.name || key} rated "${product.name}" ${req.body.rating}/5 stars${verifiedPurchase ? " (Verified Purchase)" : ""}.`,
    link: "/superadmin/reviews",
    metadata: { reviewId: review.id, productId: product.id, rating: review.rating, verifiedPurchase },
  });

  res.status(201).json({ ...review, helpfulByMe: false });
}));

// POST/PUT/DELETE below: product catalogue management, PRODUCT_MANAGER and
// above. Previously unauthenticated entirely — RBAC closes that gap here,
// same as orders.js's status route and reviews.js's moderate route.
const PRODUCT_ADMIN_ROLES = ["PRODUCT_MANAGER", "ADMIN", "SUPER_ADMIN"];

router.post("/", requireAuth, requireRole(...PRODUCT_ADMIN_ROLES), ah(async (req, res) => {
  const product = await prisma.product.create({ data: pickProductInput(req.body) });
  await auditLog.record({
    actorOwnerKey: req.user.id, actorRole: req.user.role,
    action: "product.create", targetType: "Product", targetId: product.id, after: product,
  });
  res.status(201).json(productOut(product));
}));

router.put("/:id", requireAuth, requireRole(...PRODUCT_ADMIN_ROLES), ah(async (req, res) => {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Product not found" });

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: pickProductInput(req.body, { partial: true }),
  });

  await auditLog.record({
    actorOwnerKey: req.user.id, actorRole: req.user.role,
    action: "product.update", targetType: "Product", targetId: product.id,
    before: existing, after: product,
  });

  res.json(productOut(product));
}));

router.delete("/:id", requireAuth, requireRole(...PRODUCT_ADMIN_ROLES), ah(async (req, res) => {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Product not found" });

  await prisma.product.delete({ where: { id: req.params.id } });

  await auditLog.record({
    actorOwnerKey: req.user.id, actorRole: req.user.role,
    action: "product.delete", targetType: "Product", targetId: req.params.id, before: existing,
  });

  res.status(204).end();
}));

// POST /api/products/recommendations/for-me
// Body (all optional): { faceShape, style, occasion, color, minPrice,
// maxPrice, wishlist: [ids], viewed: [ids] } — explicit stated preferences,
// e.g. from a quiz. These are UNIONED with the requester's real wishlist,
// cart, and order history (see services/personalizationContext.js), not
// replaced by it — a client-supplied "viewed" list still counts even though
// the backend now also has its own sources of truth for wishlist/cart/
// purchases. Products already in the requester's cart or already purchased
// are excluded from the candidate pool entirely: recommending something
// someone already owns or is about to buy isn't a useful recommendation,
// even if it would otherwise score well.
router.post("/recommendations/for-me", ah(async (req, res) => {
  const limit = Number(req.query.limit) || 10;
  const key = ownerKey(req);
  const body = req.body || {};

  const context = await getPersonalizationContext(key);
  const excludeIds = new Set([...context.cartIds, ...context.purchasedIds]);

  const prefs = {
    faceShape: body.faceShape,
    style: body.style,
    occasion: body.occasion,
    color: body.color,
    minPrice: body.minPrice,
    maxPrice: body.maxPrice,
    wishlist: [...new Set([...(body.wishlist || []), ...context.wishlistIds])],
    viewed: body.viewed || [],
    affinity: context.affinity,
  };

  const products = await prisma.product.findMany({ where: { id: { notIn: [...excludeIds] } } });
  const results = recommend(productsOut(products), prefs, limit);

  if (results.length) {
    await prisma.aIRecommendation.createMany({
      data: results.map(r => ({
        productId: r.product.id,
        ownerKey: key,
        score: r.score,
        prefs,
        reasons: r.reasons,
      })),
    });
  }
  res.json(results);
}));

module.exports = router;

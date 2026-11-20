const router = require("express").Router();
const { prisma } = require("../db/prisma");
const { productOut } = require("../db/serialize");
const { requireAuth, requireRole } = require("../middleware/auth");
const ah = require("../utils/asyncHandler");

// Every route in this file was previously reachable by anyone, logged in or
// not — try-on conversion rates and face-shape popularity are business
// data, not something to leave world-readable. ADMIN and SUPER_ADMIN only;
// analytics doesn't need the narrower operational roles (PRODUCT_MANAGER,
// ORDER_MANAGER, CUSTOMER_SUPPORT) the way day-to-day catalogue/order/
// review actions do.
router.use(requireAuth, requireRole("ADMIN", "SUPER_ADMIN"));

// Mongo's $group/$sort/$limit pipeline maps directly onto Prisma's groupBy.
router.get("/most-tried-on", ah(async (_req, res) => {
  const grouped = await prisma.tryOnSession.groupBy({
    by: ["productId"],
    _count: { productId: true },
    orderBy: { _count: { productId: "desc" } },
    take: 6,
  });
  if (!grouped.length) return res.json([]);

  // One findMany instead of the old N findById calls, then re-ordered to
  // match the aggregation's ranking.
  const products = await prisma.product.findMany({ where: { id: { in: grouped.map(g => g.productId) } } });
  const byId = new Map(products.map(p => [p.id, p]));

  res.json(
    grouped
      .filter(g => byId.has(g.productId))
      .map(g => ({ product: productOut(byId.get(g.productId)), tryOns: g._count.productId }))
  );
}));

router.get("/conversion", ah(async (_req, res) => {
  const [total, converted, purchased] = await prisma.$transaction([
    prisma.tryOnSession.count(),
    prisma.tryOnSession.count({ where: { converted: true } }),
    prisma.order.count(),
  ]);
  res.json({
    tryOnToCartRate: total ? Number((converted / total * 100).toFixed(1)) : 0,
    tryOnToPurchaseRate: total ? Number((purchased / total * 100).toFixed(1)) : 0,
    totalTryOns: total,
  });
}));

router.get("/face-shape-popularity", ah(async (_req, res) => {
  const recs = await prisma.aIRecommendation.findMany({
    select: { product: { select: { faceShapeMatch: true } } },
  });
  const counts = {};
  recs.forEach(r => { r.product?.faceShapeMatch?.forEach(f => { counts[f] = (counts[f] || 0) + 1; }); });
  res.json(counts);
}));

// ================================================================
// Phase 6 — Business Intelligence Dashboard
//
// Everything below is a real aggregate query against Order/OrderItem/
// Product/User/Review — the same tables every other route in this app
// reads and writes. Nothing here is sampled, estimated, or backfilled with
// placeholder numbers: a fresh install with no orders yet correctly returns
// zeros and empty series, not a demo-friendly fake chart.
// ================================================================

const PERIOD_TRUNC = { daily: "day", weekly: "week", monthly: "month" };

// GET /api/admin/analytics/revenue?period=daily|weekly|monthly&days=30
// Time-series revenue, order count, and average order value, bucketed by
// real order creation dates. Cancelled orders are excluded from revenue —
// an order that was cancelled never became real revenue.
router.get("/revenue", ah(async (req, res) => {
  const period = PERIOD_TRUNC[req.query.period] ? req.query.period : "daily";
  const days = Math.min(Number(req.query.days) || 30, 365);
  const trunc = PERIOD_TRUNC[period];

  const rows = await prisma.$queryRawUnsafe(`
    SELECT date_trunc('${trunc}', "createdAt") AS bucket,
           COUNT(*)::int AS "orderCount",
           COALESCE(SUM("total"), 0)::float AS revenue,
           COALESCE(AVG("total"), 0)::float AS "avgOrderValue"
    FROM "Order"
    WHERE "status" != 'Cancelled' AND "createdAt" > now() - interval '${days} days'
    GROUP BY bucket
    ORDER BY bucket ASC
  `);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orderCount, 0);

  res.json({
    period, days,
    totalRevenue,
    totalOrders,
    avgOrderValue: totalOrders ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
    series: rows.map(r => ({ date: r.bucket, orderCount: r.orderCount, revenue: r.revenue, avgOrderValue: Math.round(r.avgOrderValue * 100) / 100 })),
  });
}));

// GET /api/admin/analytics/demand-overview?productType=
// Catalog-wide demand, complementing the per-product breakdown at
// GET /api/products/demand (Phase 1). Reads Product.trendScore /
// trendScoreBreakdown — the same cached values `npm run recalc-trends`
// writes — rather than recomputing decay math for every dashboard load.
// A product with trendScoreBreakdown still null (recalc-trends hasn't run
// since it was created) is correctly excluded from the signal totals below
// rather than treated as zero engagement, which would be misleading.
router.get("/demand-overview", ah(async (req, res) => {
  const where = req.query.productType ? { productType: req.query.productType } : {};

  const [byType, topProducts, signalTotals] = await Promise.all([
    prisma.product.groupBy({ by: ["productType"], where, _avg: { trendScore: true }, _count: { _all: true } }),
    prisma.product.findMany({
      where: { ...where, trendScore: { gt: 0 } },
      orderBy: { trendScore: "desc" },
      take: 10,
      select: { id: true, name: true, productType: true, category: true, trendScore: true },
    }),
    prisma.$queryRawUnsafe(`
      SELECT
        COALESCE(SUM(("trendScoreBreakdown"->'views'->>'total')::int), 0)::int AS views,
        COALESCE(SUM(("trendScoreBreakdown"->'cartAdds'->>'total')::int), 0)::int AS "cartAdds",
        COALESCE(SUM(("trendScoreBreakdown"->'wishlistAdds'->>'total')::int), 0)::int AS "wishlistAdds",
        COALESCE(SUM(("trendScoreBreakdown"->'purchases'->>'total')::int), 0)::int AS purchases,
        COALESCE(SUM(("trendScoreBreakdown"->'tryOns'->>'total')::int), 0)::int AS "tryOns"
      FROM "Product"
      WHERE "trendScoreBreakdown" IS NOT NULL
      ${req.query.productType ? `AND "productType" = '${String(req.query.productType).replace(/'/g, "''")}'` : ""}
    `),
  ]);

  res.json({
    byProductType: byType.map(t => ({
      productType: t.productType,
      productCount: t._count._all,
      avgTrendScore: Math.round((t._avg.trendScore || 0) * 100) / 100,
    })),
    topProducts,
    // null (not 0) when no product has been scored yet at all — distinct
    // from "scored, and every signal happens to be zero."
    signalTotals: signalTotals[0]?.views != null ? signalTotals[0] : null,
  });
}));

// GET /api/admin/analytics/customers
// New signups over time, repeat-purchase rate, top customers by spend, and
// average customer lifetime value — all from real Order/User rows.
// "Customer" here means any distinct ownerKey with at least one order,
// guest checkouts included (this app allows guest orders — see
// routes/orders.js), not only registered accounts.
router.get("/customers", ah(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 90, 365);

  const [signupSeries, spendByOwner] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT date_trunc('week', "createdAt") AS bucket, COUNT(*)::int AS signups
      FROM "User"
      WHERE "role" = 'CUSTOMER' AND "createdAt" > now() - interval '${days} days'
      GROUP BY bucket ORDER BY bucket ASC
    `),
    prisma.$queryRawUnsafe(`
      SELECT "ownerKey", COUNT(*)::int AS "orderCount", COALESCE(SUM("total"), 0)::float AS "totalSpend"
      FROM "Order"
      WHERE "status" != 'Cancelled'
      GROUP BY "ownerKey"
    `),
  ]);

  const totalCustomers = spendByOwner.length;
  const repeatCustomers = spendByOwner.filter(o => o.orderCount > 1).length;
  const totalSpend = spendByOwner.reduce((s, o) => s + o.totalSpend, 0);

  const topSpenders = [...spendByOwner].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 10);
  const users = await prisma.user.findMany({
    where: { id: { in: topSpenders.map(s => s.ownerKey) } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map(u => [u.id, u]));

  res.json({
    signupSeries: signupSeries.map(r => ({ week: r.bucket, signups: r.signups })),
    totalCustomers,
    repeatPurchaseRate: totalCustomers ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0,
    avgLifetimeValue: totalCustomers ? Math.round((totalSpend / totalCustomers) * 100) / 100 : 0,
    // A guest checkout's ownerKey is an X-Guest-Id string, not a User row —
    // shown as "Guest" rather than silently dropped, since guest revenue is
    // still real revenue.
    topCustomers: topSpenders.map(s => ({
      ownerKey: s.ownerKey,
      name: userById.get(s.ownerKey)?.name || "Guest",
      email: userById.get(s.ownerKey)?.email || null,
      orderCount: s.orderCount,
      totalSpend: s.totalSpend,
    })),
  });
}));

// GET /api/admin/analytics/product-performance?productType=
// Top sellers by revenue and by units (these can rank differently — a
// cheap product can outsell an expensive one in units without matching it
// in revenue), category revenue breakdown, and a "high interest, low
// conversion" flag: products with real view activity but zero purchases,
// worth a merchandiser's attention (price, photos, description) more than
// a product nobody's looking at in the first place.
router.get("/product-performance", ah(async (req, res) => {
  const typeFilter = req.query.productType
    ? `AND p."productType" = '${String(req.query.productType).replace(/'/g, "''")}'`
    : "";

  const [byRevenue, byUnits, byCategory, lowConversion] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT oi."productId", p."name", p."productType",
             SUM(oi."price" * oi."qty")::float AS revenue, SUM(oi."qty")::int AS units
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId" AND o."status" != 'Cancelled'
      JOIN "Product" p ON p."id" = oi."productId"
      WHERE 1=1 ${typeFilter}
      GROUP BY oi."productId", p."name", p."productType"
      ORDER BY revenue DESC LIMIT 10
    `),
    prisma.$queryRawUnsafe(`
      SELECT oi."productId", p."name", p."productType",
             SUM(oi."qty")::int AS units, SUM(oi."price" * oi."qty")::float AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId" AND o."status" != 'Cancelled'
      JOIN "Product" p ON p."id" = oi."productId"
      WHERE 1=1 ${typeFilter}
      GROUP BY oi."productId", p."name", p."productType"
      ORDER BY units DESC LIMIT 10
    `),
    prisma.$queryRawUnsafe(`
      SELECT p."productType", SUM(oi."price" * oi."qty")::float AS revenue, SUM(oi."qty")::int AS units
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId" AND o."status" != 'Cancelled'
      JOIN "Product" p ON p."id" = oi."productId"
      GROUP BY p."productType"
      ORDER BY revenue DESC
    `),
    prisma.$queryRawUnsafe(`
      SELECT "id", "name", "productType",
             ("trendScoreBreakdown"->'views'->>'total')::int AS views,
             ("trendScoreBreakdown"->'purchases'->>'total')::int AS purchases
      FROM "Product"
      WHERE "trendScoreBreakdown" IS NOT NULL
        AND ("trendScoreBreakdown"->'views'->>'total')::int >= 5
        AND ("trendScoreBreakdown"->'purchases'->>'total')::int = 0
        ${typeFilter.replace('p."productType"', '"productType"')}
      ORDER BY ("trendScoreBreakdown"->'views'->>'total')::int DESC
      LIMIT 10
    `),
  ]);

  res.json({ topByRevenue: byRevenue, topByUnits: byUnits, byCategory, highInterestLowConversion: lowConversion });
}));

// GET /api/admin/analytics/tryon-funnel?productId=&days=30
//
// Phase 8: real conversion analytics from the actual event stream
// (TryOnEvent), not the coarse single `converted` boolean the older
// /conversion endpoint above uses. Each stage's count is real distinct
// sessions/owners that reached that event type — not a fabricated
// drop-off curve. A fresh install with no try-on activity yet correctly
// returns zeros for every stage.
router.get("/tryon-funnel", ah(async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 365);
  const where = req.query.productId ? `AND "productId" = '${String(req.query.productId).replace(/'/g, "''")}'` : "";

  const rows = await prisma.$queryRawUnsafe(`
    SELECT "eventType", COUNT(*)::int AS "eventCount",
           COUNT(DISTINCT "ownerKey")::int AS "distinctOwners"
    FROM "TryOnEvent"
    WHERE "createdAt" > now() - interval '${days} days' ${where}
    GROUP BY "eventType"
  `);

  const byType = Object.fromEntries(rows.map(r => [r.eventType, { eventCount: r.eventCount, distinctOwners: r.distinctOwners }]));
  const stageOrder = ["opened", "started", "screenshot", "wishlist", "add_to_cart", "checkout", "purchase"];
  const opened = byType.opened?.distinctOwners || 0;

  res.json({
    days,
    stages: stageOrder.map(stage => ({
      stage,
      distinctOwners: byType[stage]?.distinctOwners || 0,
      eventCount: byType[stage]?.eventCount || 0,
      // Rate relative to "opened" — the top of this funnel. 0 (not
      // undefined/NaN) when nothing has happened yet, so the response
      // shape is stable regardless of how much real data exists.
      conversionFromOpened: opened ? Math.round(((byType[stage]?.distinctOwners || 0) / opened) * 1000) / 10 : 0,
    })),
    productChangeCount: byType.product_changed?.eventCount || 0,
  });
}));

module.exports = router;

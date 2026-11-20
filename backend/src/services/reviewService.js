/**
 * Phase 4 — reviews & ratings.
 *
 * Two things live here that must NOT be trusted from client input or left
 * to routes to reimplement inconsistently: whether a review counts as a
 * verified purchase, and how Product.rating/reviews get recomputed.
 */
const { prisma } = require("../db/prisma");

// Once a review on a product crosses this many reports, it's automatically
// hidden from public listing/rating (moderationStatus -> Flagged) pending an
// admin decision (PATCH /api/reviews/:id/moderate). Small on purpose — this
// is a starter catalogue, not a high-traffic marketplace; tune upward once
// real report volume shows this is too sensitive.
const REPORT_FLAG_THRESHOLD = 3;

const RATING_MIN = 1;
const RATING_MAX = 5;
const TITLE_MAX_LEN = 120;
const COMMENT_MAX_LEN = 2000;

/**
 * True only if the given owner has a real order containing this product
 * that has been successfully Delivered.
 * Only customers with an eligible delivered purchase can submit a verified purchase review.
 */
async function isVerifiedPurchase(ownerKey, productId, orderId = null) {
  const where = {
    productId,
    order: {
      ownerKey,
      status: "Delivered",
      ...(orderId ? { id: orderId } : {}),
    },
  };
  const count = await prisma.orderItem.count({ where });
  return count > 0;
}

/**
 * Recomputes Product.rating (average) and Product.reviews (count) from
 * real, currently-visible (Approved) Review rows for one product, and
 * writes them in the same transaction as whatever review change triggered
 * this — "update product rating/count safely and consistently," per the
 * spec. Call this after every create/update/delete/moderate on a review.
 *
 * Deliberately scoped to ONE product, not a blanket recompute of the whole
 * catalogue: seeded products keep their catalogue-provided starting
 * rating/reviews values until someone actually reviews them, at which point
 * real review data takes over completely for that product. Nothing here
 * blends fake starting numbers with real ones — once real reviews exist for
 * a product, the seed value is fully superseded, not averaged in.
 */
async function recomputeProductRating(tx, productId) {
  const agg = await tx.review.aggregate({
    where: { productId, moderationStatus: "Approved" },
    _avg: { rating: true },
    _count: { _all: true },
  });

  // No approved reviews (none yet, or all rejected/flagged) — leave the
  // product's existing rating/reviews value alone rather than zeroing it
  // out. A product that has never been reviewed keeps its catalogue
  // starting value; that's a real product attribute, not a fabricated one.
  if (agg._count._all === 0) return;

  await tx.product.update({
    where: { id: productId },
    data: {
      rating: Math.round(agg._avg.rating * 10) / 10,
      reviews: agg._count._all,
    },
  });
}

function assertValidReviewInput({ rating, title, comment }, { partial = false } = {}) {
  if (!partial || rating !== undefined) {
    const r = Number(rating);
    if (!Number.isInteger(r) || r < RATING_MIN || r > RATING_MAX) {
      const err = new Error(`rating must be an integer from ${RATING_MIN} to ${RATING_MAX}`);
      err.status = 400;
      throw err;
    }
  }
  if (title !== undefined && title !== null && String(title).length > TITLE_MAX_LEN) {
    const err = new Error(`title must be ${TITLE_MAX_LEN} characters or fewer`);
    err.status = 400;
    throw err;
  }
  if (comment !== undefined && comment !== null && String(comment).length > COMMENT_MAX_LEN) {
    const err = new Error(`comment must be ${COMMENT_MAX_LEN} characters or fewer`);
    err.status = 400;
    throw err;
  }
}

module.exports = {
  isVerifiedPurchase,
  recomputeProductRating,
  assertValidReviewInput,
  REPORT_FLAG_THRESHOLD,
  RATING_MIN,
  RATING_MAX,
  TITLE_MAX_LEN,
  COMMENT_MAX_LEN,
};

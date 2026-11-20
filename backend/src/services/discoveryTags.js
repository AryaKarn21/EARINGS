/**
 * Phase 1 — dynamic discovery tags.
 *
 * Every tag here is either:
 *   (a) derived from the cached trendScore/trendScoreBreakdown that
 *       trendService.recalculate() writes (real usage signals), or
 *   (b) a deterministic mapping from the product's own category/style/
 *       occasion fields (no scoring involved — "Festive" just means the
 *       product lists "Festive" as an occasion).
 *
 * Nothing here is a permanent, manually-set label except isEditorsPick,
 * which is explicitly an admin curation flag, not a signal — see the
 * comment on that column in schema.prisma.
 *
 * A product with no signals yet (trendScoreBreakdown is null — true for
 * every product immediately after seeding, before recalcTrends has run even
 * once) simply gets none of the activity-based tags. That's correct, not a
 * bug: there is no honest "Trending Now" claim to make about a product with
 * zero real views.
 */

const NEW_ARRIVAL_DAYS = 14;
const TRENDING_PERCENTILE = 85; // top 15% of the whole catalogue by blended trend score
const MOST_LOVED_PERCENTILE = 85; // top 15% by decayed wishlist adds
const MOST_PURCHASED_PERCENTILE = 85; // top 15% by decayed purchases
const POPULAR_WEEK_PERCENTILE = 85; // top 15% by raw last-7-day activity
const RISING_FAST_GROWTH = 0.4; // score grew 40%+ since the previous recalculation run
const BEST_RATED_MIN_RATING = 4.7;
const BEST_RATED_MIN_REVIEWS = 20;

function daysSince(date) {
  return (Date.now() - new Date(date).getTime()) / 86400000;
}

function deriveTags(product) {
  const tags = [];
  const b = product.trendScoreBreakdown;

  if (product.isEditorsPick) tags.push("Editor's Pick");
  if (daysSince(product.createdAt) <= NEW_ARRIVAL_DAYS) tags.push("Just Added");

  if (product.rating >= BEST_RATED_MIN_RATING && product.reviews >= BEST_RATED_MIN_REVIEWS) {
    tags.push("Best Rated");
  }

  // Everything past this point needs a completed trend calculation run.
  if (b) {
    // Percentile rank alone isn't enough: with ratingWeight now small but
    // nonzero (see trendService.js), a product can still edge into a high
    // percentile purely by having a good rating and near-empty engagement
    // from everyone else. "Trending Now" specifically claims *activity*, so
    // it additionally requires at least one real interaction of some kind —
    // a view, cart add, wishlist add, try-on, purchase, or search hit. Rating
    // alone never qualifies a product for this tag.
    const hasRealEngagement =
      b.views.total > 0 || b.cartAdds.total > 0 || b.wishlistAdds.total > 0 ||
      b.tryOns.total > 0 || b.purchases.total > 0 || b.searchImpressions.total > 0;
    if (hasRealEngagement && product.trendScore > 0 && b.percentile >= TRENDING_PERCENTILE) {
      tags.push("Trending Now");
    }
    if (b.wishlistPercentile >= MOST_LOVED_PERCENTILE && b.wishlistAdds.total > 0) tags.push("Most Loved");
    if (b.purchasePercentile >= MOST_PURCHASED_PERCENTILE && b.purchases.total > 0) tags.push("Most Purchased");
    if (b.popularity7dPercentile >= POPULAR_WEEK_PERCENTILE) tags.push("Popular This Week");

    // Needs a *previous* run to compare against — the very first
    // recalculation after seeding has trendScorePrevious = 0 for everyone,
    // so nothing qualifies yet. That's intentional: "rising" requires two
    // points in time, and faking a baseline would make this signal fake.
    if (product.trendScorePrevious > 0) {
      const growth = (product.trendScore - product.trendScorePrevious) / product.trendScorePrevious;
      if (growth >= RISING_FAST_GROWTH) tags.push("Rising Fast");
    }
  }

  // Category-mapped tags — deterministic, not scored.
  const occasion = (product.occasion || []).map(o => o.toLowerCase());
  const style = (product.style || "").toLowerCase();
  const category = (product.category || "").toLowerCase();

  if (occasion.includes("festive")) tags.push("Festive");
  if (occasion.includes("wedding") || category.includes("bridal")) tags.push("Bridal");
  if (occasion.includes("party")) tags.push("Party Wear");
  if (occasion.includes("everyday")) tags.push("Everyday");
  if (style === "minimal") tags.push("Minimal");
  if (style === "traditional") tags.push("Traditional");
  if (style === "bold" || category.includes("statement")) tags.push("Statement");

  return [...new Set(tags)];
}

module.exports = {
  deriveTags,
  NEW_ARRIVAL_DAYS,
  TRENDING_PERCENTILE,
  MOST_LOVED_PERCENTILE,
  MOST_PURCHASED_PERCENTILE,
  POPULAR_WEEK_PERCENTILE,
  RISING_FAST_GROWTH,
  BEST_RATED_MIN_RATING,
  BEST_RATED_MIN_REVIEWS,
};

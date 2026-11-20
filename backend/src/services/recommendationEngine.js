/**
 * Phase 3 — AI Earring Stylist v2.
 *
 * Extends the original pure-function scoring engine rather than replacing
 * it: `score()` and `recommend()` keep the same signatures existing callers
 * already use, so routes/stylist.js and routes/products.js needed no
 * breaking changes. What changed is what `prefs` can carry and how the
 * score is built.
 *
 * SIGNALS CONSIDERED (per the spec): face shape, preferred color, preferred
 * style, occasion, budget, viewed products, wishlist, cart activity,
 * previous purchases, product popularity, product rating, product trend
 * score. Cart/purchase history isn't passed as raw arrays the caller has to
 * assemble — see services/personalizationContext.js, which turns real
 * order/cart/wishlist rows into the `affinity` shape this file consumes.
 *
 * EVERY SCORE IS EXPLAINED. `reasons` is never empty — if nothing else
 * fired, the honest fallback reason (popularity/rating) is used, matching
 * the original engine's behaviour. This is also persisted (see
 * AIRecommendation.reasons in schema.prisma) so "why was I shown this" is
 * answerable later, not just at response time.
 *
 * CALIBRATION NOTE (learned the hard way in Phase 1's trend scoring): the
 * popularity/rating/trend component is intentionally small relative to real
 * personalization signals. It's Phase 1's exact mistake to avoid repeating —
 * if a static, always-positive signal like "this product has decent
 * reviews" were weighted heavily, every product would look "recommended for
 * you" a little, which isn't a personalized recommendation at all. It only
 * dominates the ranking in the genuine fallback case: no preferences, no
 * history, nothing personal to go on.
 *
 * NO MEDICAL OR SCIENTIFIC CLAIMS. Face-shape reasoning is phrased as a
 * style opinion ("a popular choice for X face shapes," "may complement"),
 * never as a measurement, diagnosis, or guarantee. This engine has no
 * information about the person's actual face — see routes/stylist.js
 * face-shape endpoint, which is a separate (currently mocked, pending
 * Phase 7) concern from this scoring logic.
 */

const WEIGHTS = {
  face: 22,
  style: 18,
  occasion: 18,
  color: 12,
  budget: 8,
  wishlist: 6,
  viewed: 4,
  // Affinity: how strongly a product's own attributes match the pattern in
  // someone's cart/wishlist/purchase history (see personalizationContext.js).
  // Capped modestly per attribute so a long history doesn't overwhelm
  // explicitly stated preferences from a quiz.
  affinityColor: 6,
  affinityStyle: 6,
  affinityOccasion: 6,
  // Always-on but small — see calibration note above.
  rating: 5,
  trend: 5,
  reviews: 3,
};

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

/**
 * @param {object} product a full product row (needs color/style/occasion/
 *   faceShapeMatch/price/rating/reviews/trendScore)
 * @param {object} prefs
 * @param {string} [prefs.faceShape]
 * @param {string} [prefs.style]
 * @param {string} [prefs.occasion]
 * @param {string} [prefs.color]
 * @param {number} [prefs.minPrice]
 * @param {number} [prefs.maxPrice]
 * @param {string[]} [prefs.wishlist] product ids
 * @param {string[]} [prefs.viewed] product ids
 * @param {{colors:object, styles:object, occasions:object}} [prefs.affinity]
 *   from personalizationContext.buildAffinity — counts, not raw history
 */
function score(product, prefs = {}) {
  let s = 0;
  const reasons = [];
  let personalizedSignalFired = false;

  if (prefs.faceShape && product.faceShapeMatch?.includes(prefs.faceShape)) {
    s += WEIGHTS.face;
    personalizedSignalFired = true;
    // Style opinion, not a measurement or guarantee — see file header.
    reasons.push(`A popular choice for a ${prefs.faceShape.toLowerCase()} face shape.`);
  }
  if (prefs.style && product.style?.toLowerCase() === prefs.style.toLowerCase()) {
    s += WEIGHTS.style;
    personalizedSignalFired = true;
    reasons.push(`Matches your preferred ${product.style.toLowerCase()} style.`);
  }
  if (prefs.occasion && product.occasion?.some(o => o.toLowerCase() === prefs.occasion.toLowerCase())) {
    s += WEIGHTS.occasion;
    personalizedSignalFired = true;
    reasons.push(`Suitable for ${prefs.occasion.toLowerCase()} occasions.`);
  }
  if (prefs.color && product.color?.toLowerCase().includes(prefs.color.toLowerCase())) {
    s += WEIGHTS.color;
    personalizedSignalFired = true;
    reasons.push(`Comes in your preferred ${product.color.toLowerCase()}.`);
  }

  // Budget: a soft preference, not a hard filter — hard price filtering
  // already exists via GET /api/products?minPrice=&maxPrice=. Being outside
  // range costs nothing here; being inside earns a small bonus.
  if ((prefs.minPrice != null || prefs.maxPrice != null)) {
    const withinMin = prefs.minPrice == null || product.price >= Number(prefs.minPrice);
    const withinMax = prefs.maxPrice == null || product.price <= Number(prefs.maxPrice);
    if (withinMin && withinMax) {
      s += WEIGHTS.budget;
      personalizedSignalFired = true;
      reasons.push("Within your budget.");
    }
  }

  if (prefs.wishlist?.includes(product.id)) {
    s += WEIGHTS.wishlist;
    personalizedSignalFired = true;
    reasons.push("Already on your wishlist.");
  }
  if (prefs.viewed?.includes(product.id)) {
    s += WEIGHTS.viewed;
    personalizedSignalFired = true;
    reasons.push("Similar to something you viewed recently.");
  }

  // Affinity from real cart/wishlist/purchase history — see file header and
  // personalizationContext.js. Normalized against the person's own total
  // signal count so someone with a long history doesn't get a raw count
  // that dwarfs everything else; this just answers "does this product's
  // color/style/occasion look like a pattern in what they've engaged with."
  if (prefs.affinity) {
    const { colors = {}, styles = {}, occasions = {} } = prefs.affinity;
    const totalColor = Object.values(colors).reduce((a, b) => a + b, 0);
    const totalStyle = Object.values(styles).reduce((a, b) => a + b, 0);
    const totalOccasion = Object.values(occasions).reduce((a, b) => a + b, 0);

    if (product.color && totalColor > 0 && colors[product.color]) {
      s += WEIGHTS.affinityColor * clamp01(colors[product.color] / totalColor);
      personalizedSignalFired = true;
      reasons.push(`Similar in tone to pieces you've saved or bought before.`);
    }
    if (product.style && totalStyle > 0 && styles[product.style]) {
      s += WEIGHTS.affinityStyle * clamp01(styles[product.style] / totalStyle);
      personalizedSignalFired = true;
      reasons.push(`Matches the style of pieces you already own or like.`);
    }
    if (totalOccasion > 0 && product.occasion?.some(o => occasions[o])) {
      const best = Math.max(...product.occasion.map(o => occasions[o] || 0));
      s += WEIGHTS.affinityOccasion * clamp01(best / totalOccasion);
      personalizedSignalFired = true;
      reasons.push("Fits the occasions you usually shop for.");
    }
  }

  // Popularity / rating / trend — always contributes a little (real
  // signals, not fabricated), but capped low. See calibration note in the
  // file header for why this must never dominate when real personalization
  // signals are present.
  const ratingBonus = product.rating > 3 ? (product.rating - 3) * (WEIGHTS.rating / 2) : 0;
  const reviewsBonus = Math.min(WEIGHTS.reviews, Math.log10((product.reviews || 0) + 1) * 1.5);
  // trendScore has no fixed ceiling (see trendService.js), so it's scaled
  // relative to a generous reference point rather than assumed to be 0-100.
  const trendBonus = Math.min(WEIGHTS.trend, ((product.trendScore || 0) / 20) * WEIGHTS.trend);
  s += ratingBonus + reviewsBonus + trendBonus;

  if (!personalizedSignalFired) {
    // True fallback: nothing personal to go on, matching the original
    // engine's behaviour exactly. Reasons stay honest about that.
    if (product.rating >= 4.6) reasons.push("Highly rated by customers.");
    else reasons.push("Popular with shoppers like you.");
    if (product.trendScore > 0) reasons.push("Trending right now.");
  }

  return {
    score: Math.min(100, Math.max(8, Math.round(s))),
    reasons: reasons.length ? reasons : ["A versatile piece that pairs well with most looks."],
  };
}

function recommend(products, prefs = {}, limit = 10) {
  return products
    .map(product => ({ product, ...score(product, prefs) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { score, recommend, WEIGHTS };

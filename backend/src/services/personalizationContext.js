/**
 * Phase 3 — real personalization context for recommendations.
 *
 * The pre-Phase-3 `/recommendations/for-me` endpoint trusted whatever
 * `wishlist`/`viewed` arrays the frontend happened to pass in the request
 * body. That's fragile (easy for a client to under-report) and leaves two
 * signals your spec explicitly asked for — cart activity and previous
 * purchases — with no source at all. This module looks up the requester's
 * *real* wishlist, cart, and order history directly from the database by
 * ownerKey (the same guest-id-or-user-id pattern every other route in this
 * app already uses), so recommendations are grounded in what actually
 * happened, not what a client claims happened.
 */
const { prisma } = require("../db/prisma");

/**
 * Turns a list of product rows into counts per color/style/occasion —
 * how strongly a person's history leans toward each attribute value. This
 * is the "previous purchases" / "cart activity" signal from the spec: not
 * "you bought exactly this product before" (recommending an exact repurchase
 * of a single earring is rarely useful) but "you tend to choose Gold,
 * Minimal, Everyday pieces," which meaningfully informs *new* suggestions.
 */
function buildAffinity(products) {
  const colors = {};
  const styles = {};
  const occasions = {};
  for (const p of products) {
    if (p.color) colors[p.color] = (colors[p.color] || 0) + 1;
    if (p.style) styles[p.style] = (styles[p.style] || 0) + 1;
    for (const o of p.occasion || []) occasions[o] = (occasions[o] || 0) + 1;
  }
  return { colors, styles, occasions };
}

/**
 * @param {string} ownerKey same value routes/cart.js, routes/wishlist.js,
 *   routes/orders.js already use — a user id (from a JWT) or a guest id
 *   (from X-Guest-Id).
 * @returns real wishlist/cart/purchased product ids and objects, plus a
 *   derived affinity map, ready to merge into recommendationEngine prefs.
 */
async function getPersonalizationContext(ownerKey) {
  const [wishlistItems, cartItems, orderItems] = await Promise.all([
    prisma.wishlistItem.findMany({ where: { wishlistOwnerKey: ownerKey }, include: { product: true } }),
    prisma.cartItem.findMany({ where: { cartOwnerKey: ownerKey }, include: { product: true } }),
    // OrderItem->Product is deliberately not a foreign key (see schema.prisma —
    // a purchased product may since have been deleted), so purchased
    // products are looked up by id separately rather than via `include`,
    // and missing ones are silently skipped rather than erroring.
    prisma.orderItem.findMany({ where: { order: { ownerKey } }, select: { productId: true } }),
  ]);

  const wishlistProducts = wishlistItems.map(i => i.product).filter(Boolean);
  const cartProducts = cartItems.map(i => i.product).filter(Boolean);

  const purchasedIds = [...new Set(orderItems.map(i => i.productId))];
  const purchasedProducts = purchasedIds.length
    ? await prisma.product.findMany({ where: { id: { in: purchasedIds } } })
    : [];

  return {
    wishlistIds: wishlistProducts.map(p => p.id),
    cartIds: cartProducts.map(p => p.id),
    purchasedIds: purchasedProducts.map(p => p.id),
    affinity: buildAffinity([...wishlistProducts, ...cartProducts, ...purchasedProducts]),
  };
}

module.exports = { getPersonalizationContext, buildAffinity };

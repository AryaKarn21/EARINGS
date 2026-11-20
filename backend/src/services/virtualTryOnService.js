/**
 * Server-side half of virtual try-on.
 *
 * Phase 8: `estimateLandmarks()` — the fixed-coordinate stub your spec
 * explicitly named for removal ("Do not use fixed fake coordinates as the
 * production implementation") — is gone entirely, not deprecated or kept as
 * a fallback. Real ear detection now runs client-side, the same
 * architecture Phase 7 used for face-shape detection: frontend/src/
 * services/earTracking.js runs MediaPipe in the browser (the camera feed
 * never leaves the device for this), and this module's job is what's left
 * on the server — session lifecycle and the real event stream — not
 * pretending to run computer vision it never actually ran.
 */
const { prisma } = require("../db/prisma");

const VALID_EVENT_TYPES = ["opened", "started", "product_changed", "screenshot", "wishlist", "add_to_cart", "checkout", "purchase"];

function startSession({ ownerKey, productId, mode }) {
  return prisma.tryOnSession.create({ data: { ownerKey: ownerKey || "guest", productId, mode } });
}

// Prisma throws P2025 when the row doesn't exist (and P2023 on a malformed
// uuid) where Mongo's findByIdAndUpdate simply resolved to null — so the
// swallow-and-return-null contract the route depends on is preserved here.
function markConverted(sessionId) {
  return prisma.tryOnSession
    .update({ where: { id: sessionId }, data: { converted: true } })
    .catch(() => null);
}

/**
 * Real event logging, not a placeholder. `sessionId` is optional — see the
 * TryOnEvent model's comment in schema.prisma for why "opened" can precede
 * a session existing at all.
 */
function logEvent({ sessionId, ownerKey, productId, eventType, metadata }) {
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    const err = new Error(`eventType must be one of ${VALID_EVENT_TYPES.join(", ")}`);
    err.status = 400;
    throw err;
  }
  return prisma.tryOnEvent.create({
    data: { sessionId: sessionId || null, ownerKey: ownerKey || "guest", productId, eventType, metadata },
  });
}

module.exports = { startSession, markConverted, logEvent, VALID_EVENT_TYPES };

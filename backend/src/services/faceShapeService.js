/**
 * Phase 7 — server-side half of face-shape detection.
 *
 * Detection itself runs client-side (frontend/src/services/faceShapeDetection.js)
 * since that's where the camera/photo is. This module is the backend's
 * side of the same "isolate the CV boundary" principle the spec asked
 * for: routes/stylist.js never trusts a client-reported face shape blindly
 * — it comes through here first. If a future provider is server-side
 * instead (an image upload processed by a vendor API), only this file and
 * the route that calls it change; nothing about the request/response
 * contract elsewhere in the app needs to.
 */
const { prisma } = require("../db/prisma");

const VALID_SHAPES = ["Oval", "Round", "Square", "Heart", "Long", "Diamond"];

/**
 * Real validation, not a formality: a request claiming an impossible
 * confidence, an unknown shape name, or a shape with no supporting
 * confidence is rejected with a 400 rather than silently logged as if it
 * were trustworthy client input.
 */
function assertValidDetection({ faceShape, confidence }) {
  if (!VALID_SHAPES.includes(faceShape)) {
    const err = new Error(`faceShape must be one of ${VALID_SHAPES.join(", ")}`);
    err.status = 400;
    throw err;
  }
  const c = Number(confidence);
  if (!Number.isFinite(c) || c < 0 || c > 1) {
    const err = new Error("confidence must be a number between 0 and 1");
    err.status = 400;
    throw err;
  }
}

/**
 * Persists a real detection event and returns the same shape the frontend
 * sent, so a POST is idempotent-feeling from the caller's perspective (you
 * get back what you validated, not a re-derived value).
 */
async function recordDetection({ ownerKey, faceShape, confidence, source }) {
  assertValidDetection({ faceShape, confidence });
  await prisma.faceShapeDetection.create({
    data: { ownerKey, faceShape, confidence, source: source || "mediapipe-client" },
  });
  return { faceShape, confidence };
}

module.exports = { recordDetection, assertValidDetection, VALID_SHAPES };

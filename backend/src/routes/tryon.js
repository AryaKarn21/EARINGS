const router = require("express").Router();
const { prisma } = require("../db/prisma");
const tryOnService = require("../services/virtualTryOnService");
const { tryOnSessionOut } = require("../db/serialize");
const ah = require("../utils/asyncHandler");

const MODES = ["camera", "upload"];

function ownerKey(req) {
  return req.user?.id || req.headers["x-guest-id"] || "guest";
}

router.post("/sessions", ah(async (req, res) => {
  const { productId, mode } = req.body;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  // `mode` was a Mongoose enum with required:true; Postgres has a real enum
  // type, so an unknown value is checked here to keep returning a 400 rather
  // than a raw driver error.
  if (!MODES.includes(mode)) return res.status(400).json({ error: `mode must be one of ${MODES.join(", ")}` });

  const session = await tryOnService.startSession({ ownerKey: req.user?.id || req.headers["x-guest-id"], productId, mode });
  res.status(201).json(tryOnSessionOut(session));
}));

router.post("/sessions/:id/convert", ah(async (req, res) => {
  const session = await tryOnService.markConverted(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(tryOnSessionOut(session));
}));

// POST /api/tryon/events  { sessionId?, productId, eventType, metadata? }
//
// Phase 8: the real event stream — opened, started, product_changed,
// screenshot, wishlist, add_to_cart, checkout, purchase — that
// GET /api/admin/analytics/tryon-funnel (below) aggregates into real
// conversion analytics. sessionId is optional (see TryOnEvent's schema
// comment: "opened" can happen before a session exists yet).
router.post("/events", ah(async (req, res) => {
  const { sessionId, productId, eventType, metadata } = req.body || {};
  if (!productId) return res.status(400).json({ error: "productId is required" });

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  const event = await tryOnService.logEvent({ sessionId, ownerKey: ownerKey(req), productId, eventType, metadata });
  res.status(201).json(event);
}));

module.exports = router;

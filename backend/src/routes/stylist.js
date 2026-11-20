const router = require("express").Router();
const { prisma } = require("../db/prisma");
const { productsOut } = require("../db/serialize");
const { recommend } = require("../services/recommendationEngine");
const { getPersonalizationContext } = require("../services/personalizationContext");
const { recordDetection, VALID_SHAPES } = require("../services/faceShapeService");
const ah = require("../utils/asyncHandler");

const FACE_SHAPES = VALID_SHAPES; // single source of truth — see faceShapeService.js

function ownerKey(req) {
  return req.user?.id || req.headers["x-guest-id"] || "guest";
}

// POST /api/stylist/quiz  { occasion, style, color, faceShape, minPrice, maxPrice }
// Same personalization wiring as POST /api/products/recommendations/for-me
// (see that route and services/personalizationContext.js) — the quiz
// answers are explicit stated preferences, unioned with real wishlist/cart/
// purchase history rather than scored in isolation from it.
router.post("/quiz", ah(async (req, res) => {
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
    wishlist: context.wishlistIds,
    affinity: context.affinity,
  };

  const products = await prisma.product.findMany({ where: { id: { notIn: [...excludeIds] } } });
  const results = recommend(productsOut(products), prefs, 4);

  if (results.length) {
    await prisma.aIRecommendation.createMany({
      data: results.map(r => ({ productId: r.product.id, ownerKey: key, score: r.score, prefs, reasons: r.reasons })),
    });
  }

  res.json({ prefs, matches: results });
}));

// POST /api/stylist/face-shape  { faceShape, confidence, source? }
//
// Phase 7: this used to be `setTimeout(() => random shape)` — pure mock
// behaviour, explicitly called out in the spec to remove. Real face
// detection now happens in the browser (frontend/src/services/
// faceShapeDetection.js, MediaPipe Face Landmarker — the camera/photo never
// leaves the client for this step). This endpoint's job changed to match:
// it validates and logs a real, already-computed result rather than
// generating one. A request with an unknown face shape or an out-of-range
// confidence is rejected with 400, not silently accepted — see
// services/faceShapeService.js#assertValidDetection.
router.post("/face-shape", ah(async (req, res) => {
  const { faceShape, confidence, source } = req.body || {};
  const result = await recordDetection({ ownerKey: ownerKey(req), faceShape, confidence, source });
  res.json(result);
}));

// POST /api/stylist/outfit-match  { desc, color, style, confidence?, reason?, source? }
//
// Replaces the old `palettes[Math.floor(Math.random() * palettes.length)]`
// mock entirely. Real analysis now happens in the browser (frontend/src/
// services/outfitColorAnalysis.js — genuine canvas-based dominant-color
// extraction from the actual uploaded photo, the same "CV runs where the
// photo is, isolated behind a service boundary" architecture Phase 7 used
// for face-shape detection), or from the manual color picker the frontend
// shows when extraction is ambiguous. Either way, this endpoint's job is to
// validate what it's handed and turn it into real product matches — it
// never generates the color/style itself.
const VALID_OUTFIT_COLORS = ["Gold", "Silver", "Rose Gold", "Pearl", "Diamond"];
const VALID_OUTFIT_STYLES = ["Minimal", "Elegant", "Traditional", "Bold"];

router.post("/outfit-match", ah(async (req, res) => {
  const { desc, color, style, confidence, reason, source } = req.body || {};

  if (!VALID_OUTFIT_COLORS.includes(color)) {
    return res.status(400).json({ error: `color must be one of ${VALID_OUTFIT_COLORS.join(", ")}` });
  }
  if (!VALID_OUTFIT_STYLES.includes(style)) {
    return res.status(400).json({ error: `style must be one of ${VALID_OUTFIT_STYLES.join(", ")}` });
  }

  const analysis = {
    desc: desc || "your outfit",
    color,
    style,
    reason: reason || null,
    confidence: confidence != null ? Number(confidence) : null,
    source: source === "manual" ? "manual" : "color-extraction",
  };

  const products = await prisma.product.findMany();
  const matches = recommend(productsOut(products), { color: analysis.color, style: analysis.style }, 3);
  res.json({ analysis, matches });
}));

module.exports = router;

const router = require("express").Router();
const { prisma } = require("../db/prisma");
const { recomputeProductRating, assertValidReviewInput, REPORT_FLAG_THRESHOLD } = require("../services/reviewService");
const { requireAuth, requireRole } = require("../middleware/auth");
const auditLog = require("../services/auditLog");
const ah = require("../utils/asyncHandler");

function ownerKey(req) {
  return req.user?.id || req.headers["x-guest-id"] || "guest";
}

const MODERATION_STATUSES = ["Approved", "Flagged", "Rejected"];

// PUT /api/reviews/:id  { rating?, title?, comment?, images? }
// Only the review's own author can edit it. verifiedPurchase is
// deliberately NOT re-derived here — it reflects whether the purchase was
// verified at the time of writing, which doesn't change based on later
// edits to the text.
router.put("/:id", ah(async (req, res) => {
  const key = ownerKey(req);
  const existing = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Review not found" });
  if (existing.ownerKey !== key) return res.status(403).json({ error: "You can only edit your own review" });

  assertValidReviewInput(req.body || {}, { partial: true });

  const data = {};
  if (req.body.rating !== undefined) data.rating = Number(req.body.rating);
  if (req.body.title !== undefined) data.title = req.body.title;
  if (req.body.comment !== undefined) data.comment = req.body.comment;
  if (req.body.images !== undefined) data.images = Array.isArray(req.body.images) ? req.body.images.slice(0, 10) : [];

  const review = await prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({ where: { id: existing.id }, data });
    if (data.rating !== undefined) await recomputeProductRating(tx, existing.productId);
    return updated;
  });

  res.json(review);
}));

// DELETE /api/reviews/:id — only the review's own author.
router.delete("/:id", ah(async (req, res) => {
  const key = ownerKey(req);
  const existing = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Review not found" });
  if (existing.ownerKey !== key) return res.status(403).json({ error: "You can only delete your own review" });

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: existing.id } });
    await recomputeProductRating(tx, existing.productId);
  });

  res.status(204).end();
}));

// POST /api/reviews/:id/helpful — idempotent per person (see
// ReviewHelpfulVote's unique constraint). Voting again is a no-op, not an
// error, so a client doesn't need to track vote state perfectly to avoid a
// 409 on a double-click.
router.post("/:id/helpful", ah(async (req, res) => {
  const key = ownerKey(req);
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!review) return res.status(404).json({ error: "Review not found" });

  const updated = await prisma.$transaction(async (tx) => {
    const vote = await tx.reviewHelpfulVote.upsert({
      where: { reviewId_ownerKey: { reviewId: review.id, ownerKey: key } },
      create: { reviewId: review.id, ownerKey: key },
      update: {},
    });
    // Recompute from the real vote table rather than incrementing blindly —
    // upsert's `update: {}` means a repeat call changes nothing, so a naive
    // increment would still be correct here, but counting the real rows is
    // one query and can never drift from the source of truth.
    const count = await tx.reviewHelpfulVote.count({ where: { reviewId: review.id } });
    return tx.review.update({ where: { id: review.id }, data: { helpfulCount: count } });
  });

  res.json({ ...updated, helpfulByMe: true });
}));

// DELETE /api/reviews/:id/helpful — remove your own helpful vote.
router.delete("/:id/helpful", ah(async (req, res) => {
  const key = ownerKey(req);
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!review) return res.status(404).json({ error: "Review not found" });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.reviewHelpfulVote.deleteMany({ where: { reviewId: review.id, ownerKey: key } });
    const count = await tx.reviewHelpfulVote.count({ where: { reviewId: review.id } });
    return tx.review.update({ where: { id: review.id }, data: { helpfulCount: count } });
  });

  res.json({ ...updated, helpfulByMe: false });
}));

// POST /api/reviews/:id/report  { reason? } — idempotent per person, same
// reasoning as /helpful. Auto-flags the review (hiding it from public
// listing/rating) once REPORT_FLAG_THRESHOLD distinct reports accumulate;
// an admin resolves it via PATCH .../moderate.
router.post("/:id/report", ah(async (req, res) => {
  const key = ownerKey(req);
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!review) return res.status(404).json({ error: "Review not found" });

  const result = await prisma.$transaction(async (tx) => {
    await tx.reviewReport.upsert({
      where: { reviewId_ownerKey: { reviewId: review.id, ownerKey: key } },
      create: { reviewId: review.id, ownerKey: key, reason: req.body?.reason ?? null },
      update: {},
    });
    const count = await tx.reviewReport.count({ where: { reviewId: review.id } });

    const data = { reportCount: count };
    // Only auto-flag forward, never un-flag here — an admin explicitly
    // approving a previously-flagged review is the only path back to
    // Approved (see PATCH .../moderate below), so a report count that later
    // drops (if reports were ever removable, which they currently aren't)
    // can't silently re-show something a moderator already hid.
    if (count >= REPORT_FLAG_THRESHOLD && review.moderationStatus === "Approved") {
      data.moderationStatus = "Flagged";
    }
    const updated = await tx.review.update({ where: { id: review.id }, data });
    if (data.moderationStatus === "Flagged") await recomputeProductRating(tx, review.productId);
    return updated;
  });

  res.json(result);
}));

// PATCH /api/reviews/:id/moderate  { status: "Approved"|"Flagged"|"Rejected" }
// Admin action. NOTE: like every other admin-facing route in this app today
// (product/category CRUD, order status), this has no auth check yet — that
// gap is closed uniformly for all admin routes at once in the RBAC phase,
// not patched one route at a time here.
// PATCH /api/reviews/:id/moderate  { status: "Approved"|"Flagged"|"Rejected" }
// CUSTOMER_SUPPORT and above — the one route-level TODO from Phase 4's
// report ("no auth on the moderate endpoint yet") is closed here.
router.patch("/:id/moderate", requireAuth, requireRole("CUSTOMER_SUPPORT", "ADMIN", "SUPER_ADMIN"), ah(async (req, res) => {
  if (!MODERATION_STATUSES.includes(req.body?.status)) {
    return res.status(400).json({ error: `status must be one of ${MODERATION_STATUSES.join(", ")}` });
  }
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!review) return res.status(404).json({ error: "Review not found" });

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.review.update({ where: { id: review.id }, data: { moderationStatus: req.body.status } });
    await recomputeProductRating(tx, review.productId);
    return u;
  });

  await auditLog.record({
    actorOwnerKey: req.user.id, actorRole: req.user.role,
    action: "review.moderate", targetType: "Review", targetId: review.id,
    before: { moderationStatus: review.moderationStatus }, after: { moderationStatus: updated.moderationStatus },
  });

  res.json(updated);
}));

module.exports = router;

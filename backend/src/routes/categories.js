const router = require("express").Router();
const { prisma } = require("../db/prisma");
const { pickCategoryInput } = require("../db/serialize");
const { requireAuth, requireRole } = require("../middleware/auth");
const auditLog = require("../services/auditLog");
const ah = require("../utils/asyncHandler");

const CATEGORY_ADMIN_ROLES = ["PRODUCT_MANAGER", "ADMIN", "SUPER_ADMIN"];

// GET /api/categories?productType=
router.get("/", ah(async (req, res) => {
  const { productType } = req.query;
  const categories = await prisma.category.findMany({
    ...(productType && { where: { productType } }),
  });

  // The old version fired one countDocuments() per category. A single
  // groupBy does the same job in one round trip and returns identical
  // numbers, including the zeroes for categories with no products.
  const counts = await prisma.product.groupBy({ by: ["category"], _count: { _all: true } });
  const countBySlug = Object.fromEntries(counts.map(c => [c.category, c._count._all]));

  res.json(categories.map(c => ({ id: c.slug, name: c.name, productType: c.productType, productCount: countBySlug[c.slug] || 0 })));
}));

router.post("/", requireAuth, requireRole(...CATEGORY_ADMIN_ROLES), ah(async (req, res) => {
  const category = await prisma.category.create({ data: pickCategoryInput(req.body) });
  await auditLog.record({
    actorOwnerKey: req.user.id, actorRole: req.user.role,
    action: "category.create", targetType: "Category", targetId: category.slug, after: category,
  });
  res.status(201).json(category);
}));

router.put("/:slug", requireAuth, requireRole(...CATEGORY_ADMIN_ROLES), ah(async (req, res) => {
  const existing = await prisma.category.findUnique({ where: { slug: req.params.slug } });
  if (!existing) return res.status(404).json({ error: "Category not found" });

  const category = await prisma.category.update({
    where: { slug: req.params.slug },
    data: pickCategoryInput(req.body, { partial: true }),
  });

  await auditLog.record({
    actorOwnerKey: req.user.id, actorRole: req.user.role,
    action: "category.update", targetType: "Category", targetId: category.slug,
    before: existing, after: category,
  });

  res.json(category);
}));

router.delete("/:slug", requireAuth, requireRole(...CATEGORY_ADMIN_ROLES), ah(async (req, res) => {
  // deleteMany rather than delete: it's a no-op on a missing slug, matching
  // Mongo's deleteOne, which also never threw on "nothing matched".
  const existing = await prisma.category.findUnique({ where: { slug: req.params.slug } });
  await prisma.category.deleteMany({ where: { slug: req.params.slug } });

  if (existing) {
    await auditLog.record({
      actorOwnerKey: req.user.id, actorRole: req.user.role,
      action: "category.delete", targetType: "Category", targetId: req.params.slug, before: existing,
    });
  }

  res.status(204).end();
}));

module.exports = router;

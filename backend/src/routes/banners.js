const router = require("express").Router();
const { prisma } = require("../db/prisma");
const ah = require("../utils/asyncHandler");

// Public route to get active banners for the storefront
router.get("/", ah(async (_req, res) => {
  const banners = await prisma.banner.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
  });
  res.json(banners);
}));

module.exports = router;

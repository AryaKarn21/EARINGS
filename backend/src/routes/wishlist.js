const router = require("express").Router();
const { prisma } = require("../db/prisma");
const { productsOut } = require("../db/serialize");
const ah = require("../utils/asyncHandler");

function ownerKey(req) { return req.user?.id || req.headers["x-guest-id"] || "anonymous"; }

// GET returns fully populated products; POST/DELETE returned the raw ObjectId
// array before, which serialised as a list of id strings. Both shapes are
// preserved exactly.
async function productIds(key) {
  const items = await prisma.wishlistItem.findMany({
    where: { wishlistOwnerKey: key },
    orderBy: { createdAt: "asc" },
    select: { productId: true },
  });
  return items.map(i => i.productId);
}

router.get("/", ah(async (req, res) => {
  const items = await prisma.wishlistItem.findMany({
    where: { wishlistOwnerKey: ownerKey(req) },
    orderBy: { createdAt: "asc" },
    include: { product: true },
  });
  res.json(productsOut(items.map(i => i.product).filter(Boolean)));
}));

router.post("/:productId", ah(async (req, res) => {
  const key = ownerKey(req);
  const { productId } = req.params;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  await prisma.$transaction([
    prisma.wishlist.upsert({ where: { ownerKey: key }, create: { ownerKey: key }, update: {} }),
    // upsert with an empty update is the relational equivalent of the old
    // "push only if not already present" check.
    prisma.wishlistItem.upsert({
      where: { wishlistOwnerKey_productId: { wishlistOwnerKey: key, productId } },
      create: { wishlistOwnerKey: key, productId },
      update: {},
    }),
  ]);

  res.status(201).json(await productIds(key));
}));

router.delete("/:productId", ah(async (req, res) => {
  const key = ownerKey(req);
  await prisma.wishlistItem.deleteMany({ where: { wishlistOwnerKey: key, productId: req.params.productId } });
  res.json(await productIds(key));
}));

module.exports = router;

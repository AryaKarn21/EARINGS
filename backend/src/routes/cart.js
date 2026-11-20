const router = require("express").Router();
const { prisma } = require("../db/prisma");
const { productOut } = require("../db/serialize");
const ah = require("../utils/asyncHandler");

function ownerKey(req) { return req.user?.id || req.headers["x-guest-id"] || "anonymous"; }

// Mongo stored cart lines as an embedded array and `.populate("items.product")`
// filled each one in. Here they're rows in cart_item joined to product, but
// the JSON handed back is byte-for-byte the same: [{ productId, qty, product }].
const CART_INCLUDE = { items: { include: { product: true }, orderBy: { createdAt: "asc" } } };

function hydrate(cart) {
  if (!cart) return [];
  return cart.items
    .filter(i => i.product)
    .map(i => ({ productId: i.productId, qty: i.qty, product: productOut(i.product) }));
}

function loadCart(key) {
  return prisma.cart.findUnique({ where: { ownerKey: key }, include: CART_INCLUDE });
}

router.get("/", ah(async (req, res) => {
  res.json(hydrate(await loadCart(ownerKey(req))));
}));

router.post("/items", ah(async (req, res) => {
  const { productId, qty = 1 } = req.body;
  const key = ownerKey(req);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  // One transaction so a brand-new cart and its first line can't half-commit.
  await prisma.$transaction([
    prisma.cart.upsert({ where: { ownerKey: key }, create: { ownerKey: key }, update: {} }),
    prisma.cartItem.upsert({
      where: { cartOwnerKey_productId: { cartOwnerKey: key, productId } },
      create: { cartOwnerKey: key, productId, qty: Number(qty) || 1 },
      update: { qty: { increment: Number(qty) || 1 } }, // same as the old `existing.qty += qty`
    }),
  ]);

  res.status(201).json(hydrate(await loadCart(key)));
}));

router.put("/items/:productId", ah(async (req, res) => {
  const key = ownerKey(req);
  const item = await prisma.cartItem.findUnique({
    where: { cartOwnerKey_productId: { cartOwnerKey: key, productId: req.params.productId } },
  });
  if (!item) return res.status(404).json({ error: "Item not in cart" });

  await prisma.cartItem.update({
    where: { id: item.id },
    data: { qty: Math.max(1, Number(req.body.qty) || 1) },
  });
  res.json(hydrate(await loadCart(key)));
}));

router.delete("/items/:productId", ah(async (req, res) => {
  const key = ownerKey(req);
  const cart = await loadCart(key);
  if (!cart) return res.json([]);

  await prisma.cartItem.deleteMany({ where: { cartOwnerKey: key, productId: req.params.productId } });
  res.json(hydrate(await loadCart(key)));
}));

module.exports = router;

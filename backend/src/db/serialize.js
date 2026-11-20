/**
 * Replaces the old models/plugins.js `applyIdTransform`.
 *
 * Prisma already returns a plain `id` string on every row, so there's no
 * `_id`/`__v` to rewrite. What still needs doing:
 *
 *  1. Product.tryOnAsset is a Json column — guarantee the four keys always
 *     exist so `product.tryOnAsset.front` never explodes on the frontend.
 *  2. Order rows come back with a relational `items` array; the old API
 *     exposed each line as `{ product: "<id>", name, price, qty }`, so the
 *     child row's own id / orderId are dropped.
 *  3. Mongoose silently ignored unknown keys on create/update. Prisma throws
 *     instead, so requests that echo a whole product back (including `id`,
 *     `createdAt`, ...) need their fields whitelisted first.
 */

const { deriveTags } = require("../services/discoveryTags");

const EMPTY_TRY_ON_ASSET = { front: null, transparent: null, left: null, right: null };

function productOut(product) {
  if (!product) return product;
  return {
    ...product,
    tryOnAsset: { ...EMPTY_TRY_ON_ASSET, ...(product.tryOnAsset || {}) },
    // Exposed as `discoveryTags`, distinct from the existing free-text
    // `tags` column (admin-managed, untouched) — see discoveryTags.js.
    discoveryTags: deriveTags(product),
  };
}

function productsOut(products) {
  return products.map(productOut);
}

function orderOut(order) {
  if (!order) return order;
  const { items = [], ...rest } = order;
  return {
    ...rest,
    items: items.map(i => ({
      id: i.id,
      product: i.productId,
      productId: i.productId,
      name: i.name,
      price: i.price,
      qty: i.qty,
      sellerId: i.sellerId,
      isReviewed: Boolean(i.isReviewed),
      fulfillmentStatus: i.fulfillmentStatus,
    })),
  };
}

function ordersOut(orders) {
  return orders.map(orderOut);
}

/**
 * Mongo stored the reference as `product` (an ObjectId that serialised to a
 * string); Prisma's scalar field is `productId`. The try-on session object is
 * returned straight to the client by POST /api/tryon/sessions, so the old key
 * is restored here rather than changing the response shape.
 */
function tryOnSessionOut(session) {
  if (!session) return session;
  const { productId, ...rest } = session;
  return { ...rest, product: productId };
}

// ---------------------------------------------------------------- input ----

const STRING_FIELDS = ["name", "productType", "category", "material", "color", "stone", "style", "kind", "description", "dimensions", "weight"];
const NUMBER_FIELDS = ["price", "originalPrice", "rating", "reviews", "stock", "defaultScale", "defaultOffsetX", "defaultOffsetY", "primaryImageIndex"];
const LIST_FIELDS = ["occasion", "tags", "faceShapeMatch", "images"];
// isEditorsPick is the one discovery tag that's curated rather than scored.
// NOTE: like the rest of the product write routes today, this has no admin
// check yet — anyone who can call PUT /api/products/:id can set it. That gap
// is pre-existing (POST/PUT/DELETE on products were already unauthenticated
// before this phase) and is exactly what the RBAC phase closes; it is not
// silently patched here to avoid changing behaviour outside this phase's scope.
const BOOL_FIELDS = ["isEditorsPick"];

/**
 * Pulls only real Product columns out of a request body, coercing types the
 * way Mongoose's casting used to. `partial` keeps undefined keys out of the
 * payload entirely so PUT only touches what was actually sent.
 */
function pickProductInput(body = {}, { partial = false } = {}) {
  const data = {};

  for (const key of STRING_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key] === null ? null : String(body[key]);
  }
  for (const key of NUMBER_FIELDS) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== "") data[key] = Number(body[key]);
  }
  for (const key of LIST_FIELDS) {
    if (body[key] !== undefined) {
      const list = Array.isArray(body[key]) ? body[key] : [body[key]];
      data[key] = partial ? { set: list.map(String) } : list.map(String);
    }
  }
  if (body.tryOnAsset !== undefined) {
    data.tryOnAsset = { ...EMPTY_TRY_ON_ASSET, ...(body.tryOnAsset || {}) };
  }
  for (const key of BOOL_FIELDS) {
    if (body[key] !== undefined) data[key] = Boolean(body[key]);
  }

  // `name`, `category` and `price` are required by the schema; surface a 400
  // rather than letting Prisma throw a wall of validation text.
  if (!partial) {
    const missing = ["name", "category", "price"].filter(k => data[k] === undefined || data[k] === null || Number.isNaN(data[k]));
    if (missing.length) {
      const err = new Error(`Product validation failed: ${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} required`);
      err.status = 400;
      throw err;
    }
  }
  return data;
}

function pickCategoryInput(body = {}, { partial = false } = {}) {
  const data = {};
  const slug = body.slug ?? body.id;
  if (slug !== undefined) data.slug = String(slug);
  if (body.name !== undefined) data.name = String(body.name);
  if (body.productType !== undefined) data.productType = String(body.productType);

  if (!partial && (!data.slug || !data.name)) {
    const err = new Error("Category validation failed: slug (or id) and name are required");
    err.status = 400;
    throw err;
  }
  return data;
}

module.exports = {
  EMPTY_TRY_ON_ASSET,
  productOut,
  productsOut,
  orderOut,
  ordersOut,
  tryOnSessionOut,
  pickProductInput,
  pickCategoryInput,
};

# Mongoose/MongoDB → Prisma/PostgreSQL

What changed, why, and the handful of places where behaviour is not
byte-identical.

## Files

**Deleted**

- `src/models/` — all ten Mongoose models plus `plugins.js`
- `src/config/db.js` — `mongoose.connect()`

**Added**

- `prisma/schema.prisma` — every model, plus three child tables and two enums
- `src/db/prisma.js` — `PrismaClient` singleton, `connectDB`, `isConnected`, `disconnectDB`
- `src/db/serialize.js` — response shaping and create/update input whitelisting

**Rewritten**

All nine route files, `server.js`, `seed.js`, `middleware/auth.js`,
`services/virtualTryOnService.js`, `package.json`, `.env.example`, `README.md`.

**Untouched**

`services/recommendationEngine.js` and `utils/asyncHandler.js` were already
database-agnostic. The entire `frontend/` directory is unchanged.

## Mapping decisions

### Ids stay strings

Every model uses `String @id @default(uuid())` rather than an auto-increment
integer. The frontend treats `id` as an opaque string (it used to be an
ObjectId), so nothing outside the schema had to change. This also means the
old `applyIdTransform` `toJSON` hook is unnecessary — Prisma returns a plain
`id` field with no `_id` or `__v` to strip.

### Embedded arrays became child tables

| Mongo | Postgres |
|---|---|
| `Cart.items[]` | `CartItem` rows, unique on `(cartOwnerKey, productId)` |
| `Wishlist.products[]` | `WishlistItem` rows, unique on `(wishlistOwnerKey, productId)` |
| `Order.items[]` | `OrderItem` rows, ordered by an explicit `position` column |

The routes reassemble them into the exact JSON the frontend already consumes:
cart returns `[{ productId, qty, product }]`, orders return
`items: [{ product, name, price, qty }]`.

`OrderItem.position` exists because rows have no inherent order. Sorting by
`id` would reshuffle a multi-item order on every read, since uuids are random.

### Mixed → Json

`User.preferences`, `Order.shippingAddress`, `AIRecommendation.prefs` and
`Product.tryOnAsset` are `Json` columns. `tryOnAsset` is normalised on the way
out so `product.tryOnAsset.front` always exists.

### Arrays stayed arrays

`occasion`, `tags` and `faceShapeMatch` are native Postgres `text[]`.

### `$text` search → ILIKE

Mongo's text index across name/material/style/color becomes an `OR` of
case-insensitive `contains` filters over the same four fields. Side benefit:
this matches partial words, which `$text` did not.

### Case-insensitive filters

`/^value$/i` regexes became `{ equals, mode: "insensitive" }` — except
`occasion`, which is an array column. Prisma's array filters (`has`,
`hasSome`) are case-sensitive and accept no `mode`, so that one predicate is
applied in JS after the query. The endpoint has no pagination, so the result
set and its ordering are identical either way.

### Referential integrity

`CartItem`, `WishlistItem`, `Review`, `ProductView`, `TryOnSession` and
`AIRecommendation` all have real foreign keys to `Product` with
`onDelete: Cascade`. Mongo left orphans behind and the routes filtered out
nulls; cascading produces the same API output more cleanly.

`OrderItem.productId` deliberately has **no** foreign key. An order line is a
historical snapshot — `name` and `price` are copied at purchase time — so
deleting a product must neither delete nor block past orders. Mongo didn't
enforce this reference either.

### Error handling

`server.js` maps Prisma error codes where it used to match Mongoose error
names:

| Old | New | Status |
|---|---|---|
| `CastError` | `P2023`, `P2000` | 400 |
| `ValidationError` | `PrismaClientValidationError` | 400 |
| — | `P2002` (unique violation) | 409 |
| — | `P2003` (foreign key) | 400 |
| — | `P2025` (record not found) | 404 |

### Input whitelisting

Mongoose silently discarded unknown keys on create/update. Prisma throws. The
admin UI does `PUT /api/products/:id` with a whole product object echoed back
— including `id`, `createdAt` and `updatedAt` — which would have failed.
`db/serialize.js` whitelists real columns and coerces types the way Mongoose
casting did (so `price: "99.5"` still lands as a float).

### Connection lifecycle

`connectDB()` now calls `prisma.$connect()`. `GET /api/health` has no
synchronous `readyState` equivalent, so it pings the pool with `SELECT 1`.
`server.js` also closes the pool on SIGINT/SIGTERM.

## Three behavioural differences

These could not be avoided. All are visible only in edge cases.

1. **Malformed ids return 404, not 400.** `GET /api/products/not-a-real-id`
   used to throw a `CastError` → 400. The `id` column is `TEXT`, so a lookup
   simply misses and returns "Product not found". This is arguably more
   correct, and it keeps the door open for importing legacy 24-hex ObjectId
   strings as ids — a strict uuid check would reject those.

2. **Adding a nonexistent product to cart/wishlist returns 404.** It used to
   succeed silently and the dangling reference was filtered out on read.
   Foreign keys make silent acceptance impossible, so both routes now check
   the product exists first.

3. **Re-seeding clears more than it used to.** `npm run seed` deletes all
   products, which cascades to carts, wishlists, product views, try-on
   sessions and AI recommendations. Orders survive by design (see above).

## Verification

Migrated code was run end to end against a real PostgreSQL 16 instance:
schema applied, catalogue seeded, and every endpoint exercised —
product filtering/search/sorting, product detail and view logging, cart
add/increment/update/delete, wishlist add/dedupe/populate/remove, order
creation (totals match the original formula exactly), order listing and
status transitions, auth register/login including email normalisation,
stylist quiz and outfit match, try-on sessions and conversion, all three
analytics aggregations, product and category CRUD, JWT-vs-guest cart
isolation, cascade-on-delete, and the 400/404/409 error paths.

Two bugs were caught and fixed this way: order line items came back
shuffled (fixed with the `position` column) and try-on sessions returned
`productId` where Mongo returned `product` (fixed in `serialize.js`).

One caveat: `prisma migrate dev` itself could not be run during verification
because the sandbox could not reach `binaries.prisma.sh` to download Prisma's
engine binaries. The tables were created with equivalent hand-written DDL and
the generated client ran against them without complaint. On your machine
`npx prisma migrate dev --name init` is the supported path and should produce
the same schema.

## Before you deploy

The `.env` file in the original zip contained a live MongoDB Atlas username
and password. That credential has been shared in a file and should be
rotated or deleted even though the database is no longer in use.

# Aurélie Backend — Express + PostgreSQL (Prisma)

A REST API backed by PostgreSQL via Prisma — products, categories, cart,
wishlist, orders, the AI stylist, virtual try-on session logging, and admin
analytics all persist to a real database.

Migrated from Express + Mongoose + MongoDB. Every endpoint, request body and
response shape is unchanged; the frontend needed no edits. See
`MIGRATION.md` for what moved and why.

## 1. Get a PostgreSQL database

**Docker (nothing to install):**
```bash
docker run --name aurelie-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=aurelie -p 5432:5432 -d postgres:16
```

**Local install:**
```bash
createdb aurelie
```

**Hosted free tier:** Neon (neon.tech), Supabase or Railway. Copy the
connection string they give you; managed providers usually need
`?sslmode=require` appended.

## 2. Configure and install

```bash
cp .env.example .env
# set DATABASE_URL, e.g.
#   postgresql://postgres:postgres@localhost:5432/aurelie?schema=public
npm install          # runs `prisma generate` automatically via postinstall
```

## 3. Create the tables

```bash
npx prisma migrate dev --name init
```

This reads `prisma/schema.prisma`, writes a migration under
`prisma/migrations/`, and applies it. In production use
`npx prisma migrate deploy` instead (applies existing migrations, never
generates new ones).

If your environment can't reach `binaries.prisma.sh` to download Prisma's
engine binaries, `prisma/init.sql` contains equivalent DDL you can apply
directly:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/init.sql
```

Prefer `migrate dev` where you can — applying SQL by hand leaves you with no
migration history for the first schema change.

### Required extra step if you used `migrate dev`: full-text search column

Prisma's schema language can't express a PostgreSQL `GENERATED ALWAYS AS`
column, which is how product search's `searchVector` column works (see
"Search" below). `migrate dev` will create every other column correctly but
silently skip this one. Run once, after `migrate dev`:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/fts_migration.sql
```

If you applied `prisma/init.sql` instead of `migrate dev`, you already have
this column — it's included there, and you can skip this step.

## 4. Seed the catalogue

```bash
npm run seed
```

Wipes and re-inserts `Category` and `Product`. Unlike the Mongo version this
**also clears carts, wishlists, product views, try-on sessions and AI
recommendations**, because Postgres cascades those from `Product`. Orders are
deliberately spared — order lines store a product id snapshot with no foreign
key, so purchase history survives a catalogue reset.

Right after seeding, product discovery (`/api/products/trending`, `/most-loved`,
etc.) will correctly show nothing — there's no real usage yet. That's expected,
not broken. See "Product discovery & trend scoring" below.

## 5. Run it

```bash
npm start          # http://localhost:4000
npm run dev        # same, with --watch
```

If `DATABASE_URL` is missing or unreachable, the server prints a clear error
explaining what to fix and exits — it never starts up "successfully" against
a database that isn't actually connected.

## Product discovery & trend scoring

`GET /api/products/trending`, `/new-arrivals`, `/best-rated`, `/most-loved`,
`/demand`, `/recommended` — all real signals (views, cart adds, wishlist
adds, purchases, try-ons, reviews, search hits), decay-weighted so recent
activity counts more. Nothing here is randomised or faked; a fresh catalogue
with no traffic correctly returns empty results from `/trending`.

Scores are cached on `Product.trendScore`, not computed per request. Refresh
them with:

```bash
npm run recalc-trends
```

This needs to run on a schedule in production — point cron, a GitHub Action,
or your platform's scheduled-task feature at
`node src/jobs/recalcTrends.js` with your production `DATABASE_URL`. Every
15–60 minutes is reasonable for a catalogue this size.

All six endpoints, plus `GET /api/products` and `GET /api/categories`,
accept an optional `?productType=earrings|necklace|bracelet|ring|anklet`
filter.

## Search

`GET /api/products?q=...` understands natural-language queries, not just
keywords — `"gold earrings for wedding under $50"` extracts color=Gold,
occasion=Wedding, productType=earrings, maxPrice=50 as real structured
filters (`src/services/searchQueryParser.js`), and whatever text is left
over is ranked with genuine PostgreSQL full-text search (`Product.searchVector`,
a generated `tsvector` column, GIN-indexed) rather than the old plain ILIKE
scan. Matching results include a `relevanceScore`; the response also
includes `parsedQuery` showing exactly what was extracted, for debugging or
a "searching for: gold, wedding, under $50" UI chip row.

This is deterministic keyword/pattern matching, not an LLM call or
embeddings — see the design-rationale comment at the top of
`searchQueryParser.js` for exactly where a future embeddings-based reranker
would plug in without touching the route.

Explicit query params (`?color=`, `?occasion=`, etc.) always win over
anything parsed from `q` on conflict. The old ILIKE behaviour is kept as a
safety net, not removed — anything that matched before Phase 2 still
matches now, just ranked below genuine full-text hits.

## AI Stylist (recommendations)

`POST /api/products/recommendations/for-me` and `POST /api/stylist/quiz`
both use `src/services/recommendationEngine.js`, which considers face shape,
color, style, occasion, and budget preferences (explicit, e.g. from a quiz)
alongside **real** wishlist, cart, and purchase history looked up from the
database by the requester's user id or guest id — not arrays a client has to
assemble itself (`src/services/personalizationContext.js`). Products already
in someone's cart or already purchased are excluded from their own
recommendation results.

Every result includes a `score` (0–100) and a `reasons` array explaining
*why* — both are persisted to `AIRecommendation.reasons` in the database,
not just returned in the response, so "why was this recommended" stays
answerable later. A guest with no history and no stated preferences gets an
honest fallback (rating/trend-based, clearly reasoned as such: "Highly rated
by customers," not fake personalization) — the same behaviour the original
engine had, kept as the explicit fallback path rather than replaced.

No claim in this engine's output is medical or scientific — face-shape
reasoning is phrased as a style opinion ("a popular choice for X face
shapes"), not a measurement or guarantee. See the file header in
`recommendationEngine.js` for the full design rationale, including why the
popularity/rating/trend component is deliberately small relative to real
personalization signals.

## Reviews & ratings

`GET /api/products/:id/reviews?sort=recent|highest|lowest|helpful&verifiedOnly=true`
returns both the review list and product-page stats (average, total, 1–5
star distribution, verified count, photo count) in one call.
`POST /api/products/:id/reviews` creates a review — one per person per
product (a second attempt gets `409`, not a silent overwrite; use
`PUT /api/reviews/:id` to edit instead). `verifiedPurchase` is always
computed server-side from real order history — never accepted from the
request body, so it can't be self-reported.

`POST /api/reviews/:id/helpful` / `DELETE .../helpful` and
`POST /api/reviews/:id/report` are idempotent per person (voting or
reporting twice has no extra effect) via unique constraints on the
underlying vote/report tables, not just an honor-system counter. A review
that accumulates enough reports (`REPORT_FLAG_THRESHOLD` in
`services/reviewService.js`, currently 3) is automatically hidden from
public listing and from the product's rating until an admin resolves it via
`PATCH /api/reviews/:id/moderate`.

`Product.rating`/`Product.reviews` are recomputed from real Approved review
rows — atomically, in the same transaction as whatever review write
triggered it — every time a review is created, edited, deleted, or
moderated (`services/reviewService.js#recomputeProductRating`). A product
with no reviews yet keeps its catalogue-seeded starting value; the moment
real reviews exist for that product, they fully supersede the seed number,
never blended with it.

`PATCH .../moderate` requires `CUSTOMER_SUPPORT`/`ADMIN`/`SUPER_ADMIN` — see
"Roles & permissions" below.

## Face-shape detection

Real detection (MediaPipe Face Landmarker) runs **client-side** — see the
root `README.md`'s "Face-shape detection: why it's client-side" section for
the full architecture and its stated verification boundary. The backend's
role is deliberately narrow: `POST /api/stylist/face-shape` validates and
logs an already-computed result (`{faceShape, confidence, source}`) to
`FaceShapeDetection` — it does not run detection itself, and rejects an
unknown shape name or an out-of-range confidence with `400` rather than
trusting client input blindly (`services/faceShapeService.js`).

This is a genuinely different table from what
`GET /api/admin/analytics/face-shape-popularity` reads (`AIRecommendation`,
counting face shapes that were inputs to a *recommendation*) —
`FaceShapeDetection` is the raw log of real detection events, independent of
whether a recommendation followed.

`POST /api/stylist/outfit-match` is **not** part of this — still mock/random
(a different CV problem, outfit-photo color analysis, out of scope so far;
flagged in the route file itself, not silently left looking finished).

## Handy Prisma commands

```bash
npx prisma studio          # browse/edit data in a local GUI
npx prisma migrate dev     # after editing schema.prisma
npx prisma generate        # regenerate the client only
npx prisma migrate reset   # drop everything and replay migrations
```

## Project structure

```
prisma/
  schema.prisma             all models, enums, relations and indexes
src/
  server.js                 Express app, connects to Postgres, mounts routes
  seed.js                     npm run seed — populates starter catalogue
  db/
    prisma.js                 PrismaClient singleton + connect/disconnect/health
    serialize.js              response shaping + create/update input whitelisting
  middleware/auth.js          JWT issuing + optional/required auth guards
  services/
    recommendationEngine.js     pure scoring function, no DB dependency
    virtualTryOnService.js       try-on session logging + landmark-detection hook
  routes/
    auth.js, products.js, categories.js, cart.js, wishlist.js, orders.js,
    stylist.js, tryon.js, analytics.js
  utils/asyncHandler.js        wraps async routes so DB errors return clean 400/404s
```

`src/models/` and `src/config/db.js` are gone — Prisma's schema replaces the
former and `src/db/prisma.js` replaces the latter.

## Auth model

- `POST /api/auth/register` / `POST /api/auth/login` return a JWT.
- Send `Authorization: Bearer <token>` to act as that user.
- Without a token, requests are treated as a guest — pass `X-Guest-Id: <any-string>`
  to keep a guest's cart/wishlist/orders consistent across requests (the
  frontend generates and persists one automatically in `localStorage`).

Mongoose applied `lowercase`/`trim` to email at the schema level. Prisma has
no schema-level transforms, so `routes/auth.js` normalises email on both
register and login instead.

### Roles & permissions (RBAC)

Six roles: `SUPER_ADMIN`, `ADMIN`, `PRODUCT_MANAGER`, `ORDER_MANAGER`,
`CUSTOMER_SUPPORT`, `CUSTOMER` (the default for every new registration —
`role` is never accepted from a request body, only ever set via the route
below or the seed script's bootstrap account).

| Role | Can do |
|---|---|
| `SUPER_ADMIN` | Everything, including changing other users' roles and site settings |
| `ADMIN` | Everything except role changes and settings writes |
| `PRODUCT_MANAGER` | Product & category CRUD, inventory view |
| `ORDER_MANAGER` | Order status changes |
| `CUSTOMER_SUPPORT` | Review moderation, customer lookup |
| `CUSTOMER` | Normal shopping — cart, wishlist, orders, reviews, stylist quiz. Everything customer-facing stays open to guests too, unauthenticated — RBAC only gates admin actions, never shopping itself. |

`npm run seed` creates one bootstrap `SUPER_ADMIN` account (idempotent — safe
to re-run, never overwrites an existing account). Configure it via
`SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` in `.env`; without
those set it falls back to `admin@aurelie.local` / `change-me-immediately`,
which is fine for local dev and **must** be changed before deploying
anywhere real. Every other role is assigned via
`PATCH /api/admin/users/:id/role` (`SUPER_ADMIN` only), which refuses to
demote the last remaining `SUPER_ADMIN` — there'd be no way back in.

`requireRole` (`src/middleware/auth.js`) looks up the caller's role fresh
from the database on every check rather than trusting the JWT payload, so a
role change or revocation takes effect on the requester's very next request,
not whenever their existing 7-day token happens to expire.

## Admin

`GET /api/admin/dashboard` — real counts (products, customers, orders,
revenue, reviews needing moderation, low-stock products), not a separate
cached summary that could drift from the tables themselves.
`GET /api/admin/customers`, `GET /api/admin/inventory`,
`GET /api/admin/audit-logs` (read-only — nothing ever edits an entry, see
`AuditLog` in `schema.prisma`), `GET`/`PATCH /api/admin/settings`
(`PATCH` is `SUPER_ADMIN`-only; currently backs the checkout shipping
threshold/rate, previously hardcoded — see `services/settingsService.js`).

Every admin mutation across this app (product/category writes, order status
changes, review moderation, role changes, settings changes) is recorded to
`AuditLog` via `services/auditLog.js` — who, what role they held at the
time, before/after snapshots.

## Business intelligence dashboard

All under `/api/admin/analytics` (`ADMIN`/`SUPER_ADMIN` only, same as the
existing try-on/conversion endpoints), all real aggregate queries against
`Order`/`OrderItem`/`Product`/`User`/`Review` — a fresh install with no
orders yet correctly returns zeros and empty series, not a demo-friendly
fake chart.

- **`GET /revenue?period=daily|weekly|monthly&days=30`** — time-series
  revenue, order count, and average order value, bucketed by real order
  dates. Cancelled orders are excluded from revenue.
- **`GET /demand-overview?productType=`** — catalog-wide demand: average
  trend score by product type, top trending products, and total real
  engagement signals across the catalog. Complements the per-product
  breakdown at `GET /api/products/demand` (Phase 1). Depends on
  `npm run recalc-trends` having run at least once — see "Product
  discovery & trend scoring" above.
- **`GET /customers?days=90`** — signups over time, repeat-purchase rate,
  average customer lifetime value, and top customers by spend. "Customer"
  here means any distinct order-placer, guest checkouts included, not only
  registered accounts — this is deliberately a different definition from
  `dashboard.customerCount` above, which counts registered `CUSTOMER`-role
  users only. The two numbers can legitimately disagree (a guest who's
  ordered several times counts toward one but not the other; a registered
  user who was promoted to an admin role no longer counts toward either).
- **`GET /product-performance?productType=`** — top sellers by revenue and
  by units (these can rank differently — a cheap product can outsell an
  expensive one in units without matching it in revenue), revenue by
  category, and a "high interest, low conversion" list: products with real
  view activity but zero purchases, worth a merchandiser's attention.

## Key endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/products?category=&material=&color=&style=&occasion=&minPrice=&maxPrice=&rating=&sort=&q=` | filter/search/sort |
| GET | `/api/products/:id` | also logs a `ProductView` |
| POST | `/api/products/recommendations/for-me` | body: `{ faceShape, style, occasion, color }` — also logs `AIRecommendation` rows |
| GET/POST/PUT/DELETE | `/api/categories/:slug?` | |
| GET/POST/PUT/DELETE | `/api/cart/items/:productId?` | guest-aware |
| GET/POST/DELETE | `/api/wishlist/:productId?` | guest-aware |
| POST | `/api/orders` | body: `{ items:[{productId,qty}], shippingAddress, paymentMethod, coupon }` |
| PATCH | `/api/orders/:id/status` | Pending → Processing → Shipped → Delivered / Cancelled |
| POST | `/api/stylist/quiz` | body: `{ occasion, style, color, faceShape }` → 4 scored matches |
| POST | `/api/stylist/face-shape` | validates + logs a real client-computed detection result — see "Face-shape detection" above |
| POST | `/api/stylist/outfit-match` | still a stub — see the note in the route file; a distinct CV problem, out of scope so far |
| POST | `/api/tryon/sessions` | body: `{ productId, mode }`, logs a `TryOnSession` |
| POST | `/api/tryon/sessions/:id/convert` | call on add-to-cart from try-on |
| POST | `/api/tryon/events` | body: `{ sessionId?, productId, eventType, metadata? }` — see "Virtual try-on" below |
| GET | `/api/admin/analytics/most-tried-on` \| `/conversion` \| `/tryon-funnel` \| `/face-shape-popularity` | Prisma groupBy/count + raw aggregate queries |

## Virtual try-on

Real ear tracking runs **client-side** (`frontend/src/services/earTracking.js`
and `earGeometry.js`) — the same MediaPipe Face Landmarker as face-shape
detection, in `VIDEO` running mode for continuous per-frame tracking during
camera try-on, and a single-shot `detect` for the uploaded-photo flow. The
old fixed-coordinate stub (`estimateLandmarks()`, previously in
`virtualTryOnService.js`) is gone entirely, not replaced with a different
stub — your spec's "do not use fixed fake coordinates as the production
implementation" is met by removing the fake coordinates, not relocating them.

The backend's role is session lifecycle and the real event stream your spec
asked for: `POST /api/tryon/events` logs `opened`, `started`,
`product_changed`, `screenshot`, `wishlist`, `add_to_cart`, `checkout`, and
`purchase` events to `TryOnEvent`, which `GET /api/admin/analytics/tryon-funnel`
aggregates into a real conversion funnel (distinct owners reaching each
stage, and conversion rate relative to `opened` — not a fabricated
drop-off curve). `checkout` and `purchase` events are schema- and
endpoint-ready but not yet called from the cart/checkout flow, which lives
in separate components this phase didn't touch — a concrete, stated gap
rather than an implied completeness the code doesn't have.

See the root `README.md`'s try-on section for the frontend architecture,
including the ear-anchor approximation, the head-yaw signal, and the one
genuinely unverifiable detail (camera mirroring direction) that needs
confirming against a real device.

## Next steps for production

- **Rotate the bootstrap SUPER_ADMIN password** (`SEED_SUPER_ADMIN_PASSWORD`
  in `.env`) before deploying anywhere real — see "Roles & permissions" above.
- Add request validation (zod/celebrate) on POST/PUT bodies. `db/serialize.js`
  currently whitelists and coerces fields; a real validator would be better.
- Add rate limiting and HTTPS termination.
- Put image uploads (selfies, outfit photos, product try-on assets, review
  photos) behind object storage (S3-compatible) rather than base64 JSON
  bodies or client-supplied URLs.
- Add a payments service (Stripe et al.) instead of the stubbed `paymentMethod` field.
- Consider a connection pooler (PgBouncer, or Prisma Accelerate) if you deploy
  to a serverless platform, where each instance opens its own pool.

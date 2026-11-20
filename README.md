# Aurélie — Full-Stack Earring Storefront (Frontend + Backend + PostgreSQL)

```
aurelie-fullstack/
  backend/    Express API + PostgreSQL (Prisma) — see backend/README.md
  frontend/   Vite + React app — every page fetches from the backend via src/api.js
```

Nothing in this app uses mock/local/fake data for its core functionality.
Products, cart, wishlist, orders, reviews, AI-stylist recommendations, trend
scoring, and admin analytics all round-trip through the backend, which
persists everything to PostgreSQL. The one exception, clearly flagged where
it lives: `POST /api/stylist/outfit-match` (outfit-photo color analysis)
still returns a random palette — a distinct computer-vision problem from
face-shape detection, out of scope for the phases built so far. See
`backend/src/routes/stylist.js` for the in-code note.

## Run it

### 1. Backend — set up PostgreSQL, then start the API

```bash
cd backend
cp .env.example .env      # set DATABASE_URL, and SEED_SUPER_ADMIN_* — see backend/README.md
npm install
npx prisma migrate dev --name init   # creates the tables
# If you used migrate dev (not init.sql), also run the one-time full-text
# search column migration — see backend/README.md's "Search" section:
psql "$DATABASE_URL" -f prisma/fts_migration.sql
npm run seed                          # starter catalogue + bootstrap SUPER_ADMIN
npm start                              # http://localhost:4000
```

Fastest way to get a database if you don't have one:

```bash
docker run --name aurelie-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=aurelie -p 5432:5432 -d postgres:16
```

Neon, Supabase and Railway free tiers work too — paste their connection
string into `DATABASE_URL` (they usually need `?sslmode=require`).

### 2. Frontend

**Development (hot reload, two servers):**
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173, proxies /api to :4000
```

**Production-style (one server, one port):**
```bash
cd frontend && npm install && npm run build   # writes frontend/dist
cd ../backend && npm start                     # serves API + built app on :4000
```

The Express server detects `frontend/dist` and serves the built app directly
(with SPA fallback routing) from the same port as the API.

## What's wired together

| Frontend feature | Backend endpoint | Postgres table(s) |
|---|---|---|
| Home / Collection browsing, filters, sort | `GET /api/products`, `GET /api/categories` | `Product`, `Category` |
| Natural-language search ("gold earrings for wedding under $50") | `GET /api/products?q=` | `Product.searchVector` (full-text) |
| Trending / New Arrivals / Best Rated rails | `GET /api/products/trending`, `/new-arrivals`, `/best-rated` | `Product` (cached `trendScore`) |
| Product detail, "why we recommend this" | `GET /api/products/:id`, `POST /api/products/recommendations/for-me` | `Product`, `ProductView`, `AIRecommendation` |
| Cart drawer & checkout | `/api/cart/items`, `POST /api/orders` | `Cart`, `CartItem`, `Order`, `OrderItem` |
| Wishlist heart icon everywhere | `/api/wishlist/:productId` | `Wishlist`, `WishlistItem` |
| Product reviews (write, edit, vote helpful, report) | `/api/products/:id/reviews`, `/api/reviews/:id/*` | `Review`, `ReviewHelpfulVote`, `ReviewReport` |
| AI Stylist quiz | `POST /api/stylist/quiz` | `AIRecommendation` (with persisted `reasons`) |
| **Face-shape detection (real, client-side)** | Detection: MediaPipe, in-browser, no image ever sent to the server. Logging only: `POST /api/stylist/face-shape` | `FaceShapeDetection` |
| Outfit Match | `POST /api/stylist/outfit-match` | — (still mock — see note above) |
| **Virtual Try-On (real, client-side tracking)** | Tracking: MediaPipe, in-browser, real-time. Events: `POST /api/tryon/sessions`, `/api/tryon/events` | `TryOnSession`, `TryOnEvent` |
| Admin: products, categories, orders, reviews, RBAC, dashboard, audit log, settings | `/api/products`, `/api/categories`, `/api/orders/:id/status`, `/api/reviews/:id/moderate`, `/api/admin/*` | see `backend/README.md`'s Admin/RBAC sections |
| Admin BI dashboard (revenue, demand, customers, product performance) | `/api/admin/analytics/*` | real aggregates over `Order`, `OrderItem`, `Product`, `User`, `Review` |

Guests are tracked via an `X-Guest-Id` header the frontend generates once and
stores in `localStorage`, so cart/wishlist/orders/reviews persist across a
session without requiring login. `POST /api/auth/register` and `/login`
issue a JWT; every account starts as `CUSTOMER` — see `backend/README.md`'s
"Roles & permissions" for how the six-role RBAC system works.

## Face-shape detection: why it's client-side

`frontend/src/services/faceShapeDetection.js` runs MediaPipe Face Landmarker
**in the browser** — the photo never leaves the user's device for this
feature. This was a deliberate architecture choice, not the only option:

- **Free, no API key** — nothing to leak from frontend code, no per-request
  cost, no vendor account needed.
- **The CV provider is isolated behind one module** (per this project's own
  spec): every call site talks to `detectFaceShape()`, never to MediaPipe
  directly, so swapping to a different provider later — a different model,
  or a server-side vendor API — means rewriting one file, not hunting
  through the app.
- **Code-split out of the main bundle**: `@mediapipe/tasks-vision` (~150KB)
  only loads when someone actually opens the AI Stylist's face-shape step
  (`import()` inside `handleSelfie`, not a top-level import), verified by
  checking the built output produces a separate chunk rather than bloating
  every page load.
- Classification is real geometry (landmark ratios → shape, with documented
  thresholds and a genuine confidence margin) — not an LLM call, not random.
  See the file's own header comments for exactly how, including a stated,
  tested limitation (Round vs. Square needs jaw-angularity data this method
  doesn't have) rather than a false claim of perfect accuracy.

**Verification boundary, stated plainly**: the classification math was
tested against six hand-built synthetic landmark geometries (one per face
shape) and correctly classified all six once each used realistic,
textbook-distinct proportions — that's real, repeatable verification. What
could **not** be verified in this environment is an actual browser running
actual MediaPipe against an actual camera or real face photos, since that
needs a browser and a webcam, neither of which exist in the sandbox this was
built in. Test against real photos in a real browser before relying on this
for production styling advice.

## Virtual try-on: real-time tracking architecture

`frontend/src/services/earTracking.js` and `earGeometry.js` replace the old
fixed-coordinate stub (`{ left: { xPct: 0.335, ... } }`, previously in the
backend's `virtualTryOnService.js`) with real, continuous tracking — the
spec's explicit instruction ("do not use fixed fake coordinates as the
production implementation") is met by removing the fake coordinates
entirely, not relocating them behind a different name.

**Architecture**: the same MediaPipe Face Landmarker as face-shape
detection, in `VIDEO` running mode for the live camera (`detectForVideo` in
a `requestAnimationFrame` loop) and a single-shot detection for uploaded
photos — both feeding the same pure geometry functions in `earGeometry.js`,
so a photo and a camera frame produce anchors identically, just once instead
of continuously.

**What's real and tested without needing a browser**: `earGeometry.js`'s
math (ear anchor position, head-yaw estimate, scale-relative-to-baseline)
is pure — no MediaPipe, no DOM — and was verified with synthetic landmark
data covering front-facing, turned-left, turned-right, and extreme-rotation
cases before being wired into the live tracking loop. This caught two real
issues during development: the head-yaw formula's sign convention was
initially documented backwards from what the (correct, internally
consistent) math actually produced — the code comment was wrong, not the
formula, fixed once the synthetic tests exposed the mismatch; and an early
version of the "load MediaPipe only when needed" dynamic import used the
wrong relative path, caught immediately by the real production build
failing outright, not by inspection.

**Head rotation** uses a landmark z-depth asymmetry proxy, not MediaPipe's
`facialTransformationMatrixes` output — that field is real and documented,
but its exact row-major-vs-column-major memory layout is a convention the
TypeScript types don't encode, and getting it wrong would silently produce
a plausible-looking but incorrect rotation. The z-depth approach uses only
fields already confirmed real in the face-shape work (`NormalizedLandmark.z`)
and is independently testable, which the matrix approach isn't without a
real device.

**One detail flagged as genuinely unverifiable here, not glossed over**:
whether the browser's raw camera feed is already mirrored before MediaPipe
sees it varies by browser/platform, and no amount of reasoning in this
environment can settle it — only a real device can. `earGeometry.js`'s
`computeEarAnchors` takes a `mirrorX` parameter specifically so this is a
one-line fix (in `earTracking.js`'s two call sites) if the earring lands on
the wrong on-screen ear when tested for real, rather than something
requiring code archaeology to locate.

**New features**: a "Save Photo" button composites the actual rendered
earring SVGs (via a `forwardRef` on `EarringArt`) onto a canvas at the exact
on-screen position, rotation, and scale the person sees — matching the
displayed `object-cover` crop, not the source video's native resolution —
and triggers a real download. A wishlist button was added alongside "Add to
Cart" directly in the try-on modal.

**Event stream**: `opened`, `started`, `product_changed`, `screenshot`,
`wishlist`, and `add_to_cart` are logged from the try-on modal itself via
`POST /api/tryon/events`. `checkout` and `purchase` are schema- and
endpoint-ready (`TryOnEvent`, same table) but not yet called from the
cart/checkout flow — those live in separate components this phase didn't
touch, and wiring them is a concrete next step, not an implied gap. See
`backend/README.md`'s "Virtual try-on" section for the funnel analytics
endpoint this event stream feeds.

**Verification boundary, same as face-shape detection**: no browser, no
camera, no real face exists in the environment this was built in. The pure
geometry is genuinely tested; the full pipeline — camera permission →
MediaPipe loading → live tracking → on-screen rendering — has not run
end to end. Test on a real device before relying on this for the shipped
product, starting with the mirroring direction above.

## Migration history

This project started as a MongoDB/Mongoose app and was migrated to
PostgreSQL/Prisma, then extended through several phases (product discovery &
trend scoring, semantic search, explainable AI recommendations, a full
review system, RBAC, a BI dashboard, and real face-shape detection). See
`backend/MIGRATION.md` for the Mongo→Postgres migration specifically, and
`backend/README.md` for how each later feature works.

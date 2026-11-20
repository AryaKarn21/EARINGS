-- Aurélie — PostgreSQL schema, equivalent to prisma/schema.prisma.
--
-- OPTIONAL. The supported path is:
--     npx prisma migrate dev --name init
-- which generates a tracked migration under prisma/migrations/.
--
-- This file is here as a fallback for two cases:
--   1. You want to eyeball the exact DDL before running anything.
--   2. Your environment can't download Prisma's engine binaries (the
--      migrate/generate CLI needs them; the client at runtime does too).
--
-- Apply with:
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/init.sql
--
-- Note: applying this by hand leaves prisma/migrations/ empty, so Prisma has
-- no migration history to reason about. Use `prisma migrate dev` instead if
-- you can — you'll want the history the first time you change the schema.

CREATE TYPE "OrderStatus" AS ENUM ('Pending','Processing','Shipped','Delivered','Cancelled');
CREATE TYPE "TryOnMode" AS ENUM ('camera','upload');

-- Postgres's own to_tsvector(regconfig, text) is marked STABLE, not
-- IMMUTABLE (the configuration is looked up by name, and in principle could
-- change) — but a GENERATED ALWAYS AS ... STORED column requires an
-- IMMUTABLE expression. Wrapping it in a same-behavior SQL function
-- explicitly marked IMMUTABLE is the standard, widely-used workaround: the
-- built-in "english" config is a compiled-in default that doesn't change at
-- runtime, so this is safe in practice even though Postgres can't verify
-- that automatically. Without this wrapper, CREATE TABLE below fails with
-- "generation expression is not immutable".
CREATE FUNCTION immutable_to_tsvector(config text, txt text) RETURNS tsvector AS $$
  SELECT to_tsvector(config::regconfig, txt);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- array_to_string(text[], text) is also STABLE, not IMMUTABLE, for the same
-- kind of reason — same fix.
CREATE FUNCTION immutable_array_to_string(arr text[], sep text) RETURNS text AS $$
  SELECT array_to_string(arr, sep);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;


CREATE TABLE "Product" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL,
  "productType" TEXT NOT NULL DEFAULT 'earrings',
  "category" TEXT NOT NULL,
  "material" TEXT, "color" TEXT, "stone" TEXT DEFAULT '—', "style" TEXT,
  "occasion" TEXT[] DEFAULT ARRAY[]::TEXT[], "price" DOUBLE PRECISION NOT NULL,
  "originalPrice" DOUBLE PRECISION, "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
  "reviews" INTEGER NOT NULL DEFAULT 0, "stock" INTEGER NOT NULL DEFAULT 10,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[], "kind" TEXT NOT NULL DEFAULT 'stud',
  "faceShapeMatch" TEXT[] DEFAULT ARRAY[]::TEXT[], "description" TEXT,
  "dimensions" TEXT NOT NULL DEFAULT '2.2cm x 0.8cm', "weight" TEXT NOT NULL DEFAULT '3.1g',
  "tryOnAsset" JSONB NOT NULL DEFAULT '{"front":null,"transparent":null,"left":null,"right":null}',
  -- Real catalog photography (admin-pasted URLs — see
  -- prisma/product_images_migration.sql for the standalone version of just
  -- these two columns, for an existing database).
  "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "primaryImageIndex" INTEGER NOT NULL DEFAULT 0,
  "defaultScale" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "defaultOffsetX" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "defaultOffsetY" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trendScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trendScorePrevious" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trendScoreBreakdown" JSONB,
  "trendScoreComputedAt" TIMESTAMP(3),
  "isEditorsPick" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  -- Phase 2: full-text search. See prisma/fts_migration.sql for the
  -- standalone version of this column + index, for anyone using
  -- `prisma migrate dev` instead of this file.
  "searchVector" tsvector GENERATED ALWAYS AS (
    setweight(immutable_to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(immutable_to_tsvector('english',
      coalesce("category", '') || ' ' || coalesce("productType", '') || ' ' ||
      coalesce("material", '') || ' ' || coalesce("color", '') || ' ' ||
      coalesce("style", '') || ' ' || coalesce("kind", '')
    ), 'B') ||
    setweight(immutable_to_tsvector('english',
      coalesce("description", '') || ' ' ||
      immutable_array_to_string("occasion", ' ') || ' ' ||
      immutable_array_to_string("tags", ' ') || ' ' ||
      immutable_array_to_string("faceShapeMatch", ' ')
    ), 'C')
  ) STORED
);
CREATE INDEX "Product_category_idx" ON "Product"("category");
CREATE INDEX "Product_productType_idx" ON "Product"("productType");
CREATE INDEX "Product_productType_category_idx" ON "Product"("productType","category");
CREATE INDEX "Product_price_idx" ON "Product"("price");
CREATE INDEX "Product_rating_idx" ON "Product"("rating");
CREATE INDEX "Product_searchVector_idx" ON "Product" USING GIN ("searchVector");

CREATE TABLE "Category" ("id" TEXT PRIMARY KEY, "slug" TEXT NOT NULL, "name" TEXT NOT NULL,
  "productType" TEXT NOT NULL DEFAULT 'earrings',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_productType_idx" ON "Category"("productType");

CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN','ADMIN','PRODUCT_MANAGER','ORDER_MANAGER','CUSTOMER_SUPPORT','CUSTOMER');

CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL, "preferences" JSONB,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");

CREATE TABLE "Cart" ("ownerKey" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);

CREATE TABLE "CartItem" ("id" TEXT PRIMARY KEY, "cartOwnerKey" TEXT NOT NULL,
  "productId" TEXT NOT NULL, "qty" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartItem_cartOwnerKey_fkey" FOREIGN KEY ("cartOwnerKey") REFERENCES "Cart"("ownerKey") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "CartItem_cartOwnerKey_productId_key" ON "CartItem"("cartOwnerKey","productId");
CREATE INDEX "CartItem_cartOwnerKey_idx" ON "CartItem"("cartOwnerKey");
CREATE INDEX "CartItem_productId_createdAt_idx" ON "CartItem"("productId","createdAt");

CREATE TABLE "Wishlist" ("ownerKey" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);

CREATE TABLE "WishlistItem" ("id" TEXT PRIMARY KEY, "wishlistOwnerKey" TEXT NOT NULL,
  "productId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WishlistItem_wishlistOwnerKey_fkey" FOREIGN KEY ("wishlistOwnerKey") REFERENCES "Wishlist"("ownerKey") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "WishlistItem_wishlistOwnerKey_productId_key" ON "WishlistItem"("wishlistOwnerKey","productId");
CREATE INDEX "WishlistItem_wishlistOwnerKey_idx" ON "WishlistItem"("wishlistOwnerKey");
CREATE INDEX "WishlistItem_productId_createdAt_idx" ON "WishlistItem"("productId","createdAt");

CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "ownerKey" TEXT NOT NULL,
  "subtotal" DOUBLE PRECISION, "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "shipping" DOUBLE PRECISION NOT NULL DEFAULT 0, "total" DOUBLE PRECISION,
  "shippingAddress" JSONB, "paymentMethod" TEXT,
  "status" "OrderStatus" NOT NULL DEFAULT 'Pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "Order_ownerKey_idx" ON "Order"("ownerKey");

CREATE TABLE "OrderItem" ("id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL, "name" TEXT, "price" DOUBLE PRECISION, "qty" INTEGER,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_createdAt_idx" ON "OrderItem"("productId","createdAt");

CREATE TYPE "ReviewModerationStatus" AS ENUM ('Approved','Flagged','Rejected');

CREATE TABLE "Review" ("id" TEXT PRIMARY KEY, "productId" TEXT NOT NULL, "ownerKey" TEXT NOT NULL,
  "rating" INTEGER NOT NULL, "title" TEXT, "comment" TEXT,
  "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
  "helpfulCount" INTEGER NOT NULL DEFAULT 0,
  "reportCount" INTEGER NOT NULL DEFAULT 0,
  "moderationStatus" "ReviewModerationStatus" NOT NULL DEFAULT 'Approved',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "Review_productId_ownerKey_key" ON "Review"("productId","ownerKey");
CREATE INDEX "Review_productId_idx" ON "Review"("productId");
CREATE INDEX "Review_productId_createdAt_idx" ON "Review"("productId","createdAt");
CREATE INDEX "Review_productId_moderationStatus_idx" ON "Review"("productId","moderationStatus");

CREATE TABLE "ReviewHelpfulVote" ("id" TEXT PRIMARY KEY, "reviewId" TEXT NOT NULL, "ownerKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewHelpfulVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "ReviewHelpfulVote_reviewId_ownerKey_key" ON "ReviewHelpfulVote"("reviewId","ownerKey");
CREATE INDEX "ReviewHelpfulVote_reviewId_idx" ON "ReviewHelpfulVote"("reviewId");

CREATE TABLE "ReviewReport" ("id" TEXT PRIMARY KEY, "reviewId" TEXT NOT NULL, "ownerKey" TEXT NOT NULL,
  "reason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "ReviewReport_reviewId_ownerKey_key" ON "ReviewReport"("reviewId","ownerKey");
CREATE INDEX "ReviewReport_reviewId_idx" ON "ReviewReport"("reviewId");

CREATE TABLE "AIRecommendation" ("id" TEXT PRIMARY KEY, "ownerKey" TEXT NOT NULL DEFAULT 'guest',
  "productId" TEXT NOT NULL, "score" DOUBLE PRECISION, "prefs" JSONB, "reasons" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIRecommendation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "AIRecommendation_productId_idx" ON "AIRecommendation"("productId");

CREATE TABLE "TryOnSession" ("id" TEXT PRIMARY KEY, "ownerKey" TEXT NOT NULL DEFAULT 'guest',
  "productId" TEXT NOT NULL, "mode" "TryOnMode" NOT NULL, "converted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TryOnSession_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "TryOnSession_productId_idx" ON "TryOnSession"("productId");
CREATE INDEX "TryOnSession_productId_createdAt_idx" ON "TryOnSession"("productId","createdAt");

CREATE TYPE "TryOnEventType" AS ENUM ('opened','started','product_changed','screenshot','wishlist','add_to_cart','checkout','purchase');

CREATE TABLE "TryOnEvent" ("id" TEXT PRIMARY KEY, "sessionId" TEXT, "ownerKey" TEXT NOT NULL DEFAULT 'guest',
  "productId" TEXT NOT NULL, "eventType" "TryOnEventType" NOT NULL, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TryOnEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TryOnSession"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TryOnEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "TryOnEvent_sessionId_idx" ON "TryOnEvent"("sessionId");
CREATE INDEX "TryOnEvent_productId_eventType_idx" ON "TryOnEvent"("productId","eventType");
CREATE INDEX "TryOnEvent_createdAt_idx" ON "TryOnEvent"("createdAt");

CREATE TABLE "ProductView" ("id" TEXT PRIMARY KEY, "ownerKey" TEXT NOT NULL DEFAULT 'guest',
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductView_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "ProductView_productId_idx" ON "ProductView"("productId");
CREATE INDEX "ProductView_productId_createdAt_idx" ON "ProductView"("productId","createdAt");

CREATE TABLE "ProductSearchImpression" ("id" TEXT PRIMARY KEY, "productId" TEXT NOT NULL,
  "query" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductSearchImpression_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "ProductSearchImpression_productId_createdAt_idx" ON "ProductSearchImpression"("productId","createdAt");

CREATE TABLE "AuditLog" ("id" TEXT PRIMARY KEY,
  "actorOwnerKey" TEXT NOT NULL, "actorRole" "UserRole" NOT NULL,
  "action" TEXT NOT NULL, "targetType" TEXT NOT NULL, "targetId" TEXT NOT NULL,
  "before" JSONB, "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType","targetId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_actorOwnerKey_idx" ON "AuditLog"("actorOwnerKey");

CREATE TABLE "SiteSetting" ("key" TEXT PRIMARY KEY, "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL, "updatedBy" TEXT);

CREATE TABLE "FaceShapeDetection" ("id" TEXT PRIMARY KEY, "ownerKey" TEXT NOT NULL DEFAULT 'guest',
  "faceShape" TEXT NOT NULL, "confidence" DOUBLE PRECISION NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'mediapipe-client',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "FaceShapeDetection_ownerKey_idx" ON "FaceShapeDetection"("ownerKey");
CREATE INDEX "FaceShapeDetection_createdAt_idx" ON "FaceShapeDetection"("createdAt");

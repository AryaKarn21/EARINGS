-- Product catalog photography — standalone migration snippet, for an
-- EXISTING database that already has a "Product" table with data in it
-- (i.e. you are not starting from prisma/init.sql on a fresh database).
--
-- Prefer `npx prisma migrate dev --name add_product_images` where you can —
-- it does exactly this, generates a timestamped migration file under
-- prisma/migrations/, and keeps schema.prisma and the database in sync.
-- Only run this file by hand if `migrate dev` isn't available to you (e.g. a
-- hosted provider that doesn't grant your app user permission to create a
-- shadow database).
--
-- Apply with:
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/product_images_migration.sql
--
-- Safe to re-run: both statements are guarded with IF NOT EXISTS. Additive
-- only — no existing column, row, or product image is touched. Every
-- existing product gets images = '{}' and primaryImageIndex = 0, which the
-- frontend already treats as "no photo yet, show the EarringArt
-- illustration" (see frontend/src/ui.jsx's ProductImage component) — never
-- a fabricated photo.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "primaryImageIndex" INTEGER NOT NULL DEFAULT 0;

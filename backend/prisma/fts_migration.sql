-- Phase 2 — full-text search column, as a standalone snippet.
--
-- Run this once, manually, AFTER `npx prisma migrate dev`. Prisma's schema
-- language cannot express a PostgreSQL GENERATED ALWAYS AS ... STORED
-- column, so `migrate dev` will create every other column correctly but
-- skip this one — schema.prisma declares it as Unsupported("tsvector")
-- specifically so Prisma knows it exists and won't try to drop it as
-- unrecognised drift, but creating it is still a manual step.
--
-- If you applied prisma/init.sql instead of `migrate dev`, you already have
-- this — it's included there. Only run this file if you used `migrate dev`.
--
-- Apply with:
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/fts_migration.sql

-- Same IMMUTABLE-wrapper requirement as prisma/init.sql — Postgres's
-- to_tsvector(regconfig, text) is STABLE, and a GENERATED column needs
-- IMMUTABLE. Skip creating this if init.sql already did (function names are
-- database-wide, not per-table).
CREATE OR REPLACE FUNCTION immutable_to_tsvector(config text, txt text) RETURNS tsvector AS $$
  SELECT to_tsvector(config::regconfig, txt);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

CREATE OR REPLACE FUNCTION immutable_array_to_string(arr text[], sep text) RETURNS text AS $$
  SELECT array_to_string(arr, sep);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
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
  ) STORED;

CREATE INDEX IF NOT EXISTS "Product_searchVector_idx" ON "Product" USING GIN ("searchVector");

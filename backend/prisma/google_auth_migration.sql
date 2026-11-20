-- Google Sign-In — standalone migration snippet, for an EXISTING database
-- that already has a "User" table with data in it (i.e. you are not
-- starting from prisma/init.sql on a fresh database).
--
-- Prefer `npx prisma migrate dev --name add_google_auth` where you can —
-- it does exactly this, generates a timestamped migration file under
-- prisma/migrations/, and keeps schema.prisma and the database in sync.
-- Only run this file by hand if `migrate dev` isn't available to you
-- (e.g. a hosted provider that doesn't grant your app user permission to
-- create a shadow database).
--
-- Apply with:
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/google_auth_migration.sql
--
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / guarded).
-- Existing rows are untouched — passwordHash keeps its current value for
-- every existing user; googleId is NULL for all of them until they sign in
-- with Google (case 2 in routes/auth.js's POST /google links it then).

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'User_googleId_key') THEN
    CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
  END IF;
END $$;
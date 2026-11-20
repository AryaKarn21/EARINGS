const { PrismaClient } = require("@prisma/client");

/**
 * One PrismaClient for the whole process. Prisma manages its own connection
 * pool, so creating a second client would just double the open connections.
 *
 * Replaces the old `mongoose.connect()` in config/db.js. Where do you get a
 * DATABASE_URL?
 *
 *   Local Postgres:
 *     createdb aurelie
 *     DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aurelie?schema=public"
 *
 *   Docker (no install):
 *     docker run --name aurelie-pg -e POSTGRES_PASSWORD=postgres \
 *       -e POSTGRES_DB=aurelie -p 5432:5432 -d postgres:16
 *
 *   Hosted free tiers: Neon (neon.tech), Supabase, Railway — copy the
 *   connection string they give you straight into backend/.env.
 */
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
});

async function connectDB() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "\nMissing DATABASE_URL.\n" +
      "Create backend/.env (copy backend/.env.example) and set DATABASE_URL to a\n" +
      "PostgreSQL connection string, e.g.\n" +
      "  postgresql://postgres:postgres@localhost:5432/aurelie?schema=public\n" +
      "then run `npx prisma migrate dev` and restart.\n"
    );
    process.exit(1);
  }
  try {
    await prisma.$connect();
    const [{ db }] = await prisma.$queryRaw`SELECT current_database() AS db`;
    console.log(`PostgreSQL connected -> ${db}`);
  } catch (err) {
    console.error("PostgreSQL connection failed:", err.message);
    console.error(
      "Double-check DATABASE_URL in backend/.env, that the server is running and\n" +
      "reachable, and that you've applied migrations with `npx prisma migrate dev`."
    );
    process.exit(1);
  }
}

/** Cheap liveness probe for GET /api/health. */
async function isConnected() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function disconnectDB() {
  await prisma.$disconnect();
}

module.exports = { prisma, connectDB, disconnectDB, isConnected };

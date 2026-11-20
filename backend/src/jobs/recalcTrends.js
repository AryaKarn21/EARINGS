/**
 * Recomputes Product.trendScore for the whole catalogue and exits.
 *
 * Run manually:      npm run recalc-trends
 * Run on a schedule:  point any scheduler (cron, a platform's scheduled-job
 *                      feature, GitHub Actions on a cron trigger, etc.) at
 *                      `node src/jobs/recalcTrends.js` with the same
 *                      DATABASE_URL the app uses. Every 15–60 minutes is
 *                      reasonable for a catalogue this size; there's no
 *                      persistent scheduler running inside this app process,
 *                      by design — a crashed long-lived cron-in-Node process
 *                      silently stops scoring everything, whereas a
 *                      short-lived job that fails loudly on its own schedule
 *                      is easier to notice and restart.
 */
require("dotenv").config();
const { connectDB, disconnectDB } = require("../db/prisma");
const trendService = require("../services/trendService");

async function main() {
  await connectDB();
  const startedAt = Date.now();
  const summary = await trendService.recalculate();
  const ms = Date.now() - startedAt;
  console.log(`Recalculated trend scores for ${summary.productsScored} products in ${ms}ms (top score: ${summary.topScore.toFixed(2)}).`);
  await disconnectDB();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Trend recalculation failed:", err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});

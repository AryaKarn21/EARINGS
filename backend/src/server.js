require("dotenv").config();

const DEFAULT_NEON_URL =
  "postgresql://neondb_owner:npg_xP2dwOcoQTb8@ep-spring-moon-b5qaw68i.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_NEON_URL;
}
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const { Prisma } = require("@prisma/client");
const { connectDB, disconnectDB, isConnected } = require("./db/prisma");
const { optionalAuth } = require("./middleware/auth");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // generous limit for base64 selfie/outfit uploads in the demo
app.use(morgan("dev"));
app.use(optionalAuth);

app.get("/api/health", async (_req, res) => {
  res.json({
    status: "ok",
    service: "aurelie-backend",
    // Prisma has no synchronous `readyState` equivalent, so this pings the
    // pool with SELECT 1 instead of reading a cached flag.
    db: (await isConnected()) ? "connected" : "disconnected",
    time: new Date().toISOString(),
  });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/cart", require("./routes/cart"));
app.use("/api/wishlist", require("./routes/wishlist"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/stylist", require("./routes/stylist"));
app.use("/api/tryon", require("./routes/tryon"));
app.use("/api/admin/analytics", require("./routes/analytics"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/delivery", require("./routes/delivery"));
app.use("/api/services", require("./routes/services"));
app.use("/api/images", require("./routes/images"));
app.use("/api/banners", require("./routes/banners"));
app.use("/uploads", express.static(path.join(__dirname, "../uploads"), {
  setHeaders: (res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
  },
}));

// In production, serve the built React frontend from the same server and
// port — the whole app ships as one deployable unit. In dev, the Vite dev
// server runs separately on :5173 and proxies /api here instead.
const frontendDist = path.join(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
}

app.use((req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.path}` }));

/**
 * Same status codes as before, driven by Prisma error codes instead of
 * Mongoose error names:
 *   CastError      -> P2023 (malformed uuid) / P2000 (value out of range)
 *   ValidationError -> PrismaClientValidationError
 * plus the constraint codes Mongo never surfaced because it has no FKs.
 */
app.use((err, _req, res, _next) => {
  console.error(err);

  if (err.status) return res.status(err.status).json({ error: err.message });

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2023": // inconsistent column data — almost always a non-uuid id in the URL
      case "P2000":
        return res.status(400).json({ error: "Invalid id or field value" });
      case "P2002":
        return res.status(409).json({ error: `Duplicate value for ${err.meta?.target || "a unique field"}` });
      case "P2003":
        return res.status(400).json({ error: "Referenced record does not exist" });
      case "P2025":
        return res.status(404).json({ error: err.meta?.cause || "Record not found" });
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 4000;

if (require.main === module || !process.env.VERCEL) {
  connectDB().then(() => {
    const server = app.listen(PORT, () => console.log(`Aurélie backend running on http://localhost:${PORT}`));

    // Prisma holds a real connection pool, so close it on shutdown rather than
    // leaving sockets open for Postgres to time out.
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.on(signal, () => {
        server.close(async () => {
          await disconnectDB();
          process.exit(0);
        });
      });
    }
  });
}

module.exports = app;

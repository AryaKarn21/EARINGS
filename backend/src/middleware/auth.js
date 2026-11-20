const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "aurelie-demo-secret";

// `user.id` is now a Prisma uuid string rather than a Mongo ObjectId, so the
// `.toString()` that used to be needed on `_id` is gone. The token payload
// shape is unchanged, which means tokens issued by the Mongo version still
// verify — they just point at ids that no longer exist after migrating.
function sign(user) {
  return jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: "7d" });
}

// Attaches req.user if a valid token is present; does NOT reject the
// request when absent, since browsing/guest carts are allowed.
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), SECRET);
      req.user = { id: payload.sub, email: payload.email };
    } catch { /* ignore invalid token, treat as guest */ }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  next();
}

/**
 * Phase 5 — RBAC. Deliberately does NOT read role from the JWT payload,
 * even though that would save a database query. A JWT is valid for 7 days
 * (see `sign` above); if role lived in the token, revoking someone's admin
 * access would have no effect until their existing token expired. Looking
 * the role up fresh on every role-gated request costs one indexed query
 * (User.role has an index) but means a role change or account deactivation
 * takes effect on the very next request, not up to a week later. Ordinary
 * routes that don't check roles never pay this cost — only routes that call
 * requireRole(...) do.
 *
 * Usage: router.patch("/:id", requireAuth, requireRole("ADMIN","SUPER_ADMIN"), ...)
 * requireAuth must run first so req.user.id is populated.
 */
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });

    const { prisma } = require("../db/prisma"); // required lazily to avoid a require cycle with db/prisma.js
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
    if (!user) return res.status(401).json({ error: "Account no longer exists" });

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: `Requires one of: ${allowedRoles.join(", ")}` });
    }
    req.user.role = user.role; // available to the route handler and audit logging without a second lookup
    next();
  };
}

module.exports = { sign, optionalAuth, requireAuth, requireRole, SECRET };

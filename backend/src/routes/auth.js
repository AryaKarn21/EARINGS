const router = require("express").Router();
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { OAuth2Client } = require("google-auth-library");
const { prisma } = require("../db/prisma");
const { sign } = require("../middleware/auth");
const ah = require("../utils/asyncHandler");

// 10 attempts per 15 minutes per IP — blunt but effective against password
// guessing; register shares the limiter since account enumeration via mass
// registration attempts is the same class of abuse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});

// Mongoose applied `lowercase: true, trim: true` to email on save. Prisma has
// no schema-level transforms, so normalisation happens here instead — it has
// to run on both register and login or the unique index stops matching.
const normaliseEmail = (email) => String(email || "").trim().toLowerCase();

// Same client id the frontend loads Google Identity Services with
// (VITE_GOOGLE_CLIENT_ID) — passed here as the expected audience so a token
// minted for a different Google OAuth client can never be replayed against
// this API. No client secret involved: verifying an ID token is a public-key
// signature check against Google's own JWKS, not an OAuth code exchange.
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/register", authLimiter, ah(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "name, email and password are required" });

  const existing = await prisma.user.findUnique({ where: { email: normaliseEmail(email) } });
  if (existing) return res.status(409).json({ error: "Email already registered" });

  // `data` below explicitly lists only name/email/passwordHash — never
  // `...req.body` — specifically so a request body containing
  // `"role": "SUPER_ADMIN"` has no effect. Every new account starts as
  // CUSTOMER (the schema default); the only way to become anything else is
  // PATCH /api/admin/users/:id/role, which is itself SUPER_ADMIN-gated.
  const user = await prisma.user.create({
    data: { name, email: normaliseEmail(email), passwordHash: await bcrypt.hash(password, 10) },
  });
  res.status(201).json({ token: sign(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

router.post("/login", authLimiter, ah(async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: normaliseEmail(email) } });
  // `user.passwordHash` is null for a Google-only account (never set a
  // password) — checked explicitly rather than letting bcrypt.compare see a
  // null hash, since that's an account-does-not-support-this-method case,
  // not a wrong-password case, though both return the same generic error
  // to the client so a login attempt can't be used to probe which accounts
  // exist or how they authenticate.
  if (!user || !user.passwordHash || !(await bcrypt.compare(String(password || ""), user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  res.json({ token: sign(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

router.post("/google", ah(async (req, res) => {
  const { credential } = req.body;
  if (!credential || typeof credential !== "string") {
    return res.status(400).json({ error: "Missing Google credential" });
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    // Fails loudly in server logs (500, via asyncHandler → server.js's error
    // handler) rather than silently verifying against `undefined` as the
    // audience, which would reject every real token anyway but with a
    // confusing error.
    throw Object.assign(new Error("Google sign-in is not configured on this server"), { status: 500 });
  }

  // verifyIdToken does the entire ID-token contract in one call: checks the
  // signature against Google's published JWKS, confirms `aud` matches
  // GOOGLE_CLIENT_ID, confirms `iss` is accounts.google.com /
  // https://accounts.google.com, and confirms the token isn't expired.
  // Anything wrong with any of those throws, caught below as one generic
  // "invalid or expired" response — the client doesn't need to know which
  // check failed, and the failure reason isn't logged raw (see catch).
  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
  } catch {
    return res.status(401).json({ error: "Invalid or expired Google credential" });
  }

  const payload = ticket.getPayload();
  // Everything from here on is read from `payload` — the verified claims —
  // never from req.body. A request body can say anything; only the
  // signed-and-verified token content is trusted for identity.
  if (!payload || !payload.email) {
    return res.status(401).json({ error: "Google account has no verified email" });
  }
  if (!payload.email_verified) {
    return res.status(401).json({ error: "Google account email is not verified" });
  }

  const googleId = payload.sub;
  const email = normaliseEmail(payload.email);
  const name = payload.name || email.split("@")[0];

  // CASE 1 — googleId already on file: this Google account has signed in
  // before. Look up by googleId first (not email) since it's the stable
  // identifier; a Google account's email can change, googleId can't.
  let user = await prisma.user.findUnique({ where: { googleId } });

  if (!user) {
    // CASE 2 — no googleId match, but an account with this verified email
    // already exists (they registered with email/password, or with a
    // different Google session pre-linking). Link this Google id to that
    // existing account instead of creating a duplicate. Every field left
    // out of this `data` object — role and passwordHash above all — is
    // deliberately left out: linking a Google sign-in must never change
    // what an account already is.
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { googleId },
      });
    } else {
      // CASE 3 — brand new person. Exactly the same whitelist discipline as
      // /register above: `data` names only the fields Google verified plus
      // a hardcoded role. No `...req.body`, no `...payload` spread — so a
      // forged extra claim (or a future change to what Google puts in the
      // token) can't slip a `role` or `passwordHash` field through.
      user = await prisma.user.create({
        data: { name, email, googleId, passwordHash: null, role: "CUSTOMER" },
      });
    }
  }

  res.json({ token: sign(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

const { requireAuth } = require("../middleware/auth");
router.get("/me", requireAuth, ah(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      preferences: true,
      createdAt: true,
      sellerProfile: true,
      deliveryProfile: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ user });
}));

module.exports = router;
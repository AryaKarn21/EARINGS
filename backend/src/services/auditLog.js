/**
 * Phase 5 — audit logging. One function, called from routes after a
 * successful admin mutation. No route ever reads-then-writes this directly,
 * so every audit entry has the same shape regardless of which route
 * produced it.
 *
 * Deliberately fire-and-forget-resistant but not silent: awaited by
 * callers (so a logging failure surfaces rather than vanishing), but never
 * allowed to block the admin action itself from having already succeeded —
 * routes call this AFTER the real database write commits, not as part of
 * the same transaction, so a logging hiccup can't roll back a legitimate
 * product update. (An audit log that could prevent real work from
 * completing would itself become an outage vector.)
 */
const { prisma } = require("../db/prisma");

/**
 * @param {object} params
 * @param {string} params.actorOwnerKey
 * @param {string} params.actorRole one of the UserRole enum values
 * @param {string} params.action e.g. "product.update"
 * @param {string} params.targetType e.g. "Product"
 * @param {string} params.targetId
 * @param {object} [params.before]
 * @param {object} [params.after]
 */
function record({ actorOwnerKey, actorRole, action, targetType, targetId, before, after }) {
  return prisma.auditLog.create({
    data: { actorOwnerKey, actorRole, action, targetType, targetId: String(targetId), before, after },
  });
}

module.exports = { record };

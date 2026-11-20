const { prisma } = require("../db/prisma");

/**
 * Creates an in-app notification in Neon PostgreSQL.
 * Supports targeted user or targetRole (e.g. SUPER_ADMIN, SELLER, DELIVERY_BOY).
 */
async function createNotification({
  userId = null,
  targetRole = null,
  category = "SYSTEM_ALERT",
  title,
  message,
  link = null,
  metadata = null,
}) {
  if (!title || !message) return null;

  try {
    const notification = await prisma.notification.create({
      data: {
        userId: userId || undefined,
        targetRole: targetRole || undefined,
        category,
        title,
        message,
        link: link || undefined,
        metadata: metadata ? metadata : undefined,
      },
    });
    return notification;
  } catch (err) {
    console.error("Failed to create notification:", err.message);
    return null;
  }
}

/**
 * Fetches notifications for a user based on their ID and active Role.
 */
async function getNotifications({ userId, role, limit = 50, unreadOnly = false }) {
  const roleConditions = [];
  if (role) {
    roleConditions.push({ targetRole: role });
    if (role === "SUPER_ADMIN") {
      roleConditions.push({ targetRole: "ADMIN" });
    }
  }

  const userConditions = [];
  if (userId) {
    userConditions.push({ userId });
  }

  const orClauses = [...userConditions, ...roleConditions];
  if (!orClauses.length) return { notifications: [], unreadCount: 0 };

  const baseWhere = { OR: orClauses };
  const queryWhere = unreadOnly ? { ...baseWhere, isRead: false } : baseWhere;

  const [notifications, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where: queryWhere,
      orderBy: { createdAt: "desc" },
      take: Math.min(Number(limit) || 50, 100),
    }),
    prisma.notification.count({
      where: { ...baseWhere, isRead: false },
    }),
  ]);

  return { notifications, unreadCount };
}

/**
 * Marks a notification as read.
 */
async function markNotificationAsRead(id, { userId, role }) {
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) return null;

  // Verify ownership or role
  const isOwner = existing.userId && existing.userId === userId;
  const isRoleMatch = existing.targetRole && (existing.targetRole === role || (role === "SUPER_ADMIN" && existing.targetRole === "ADMIN"));
  
  if (!isOwner && !isRoleMatch && role !== "SUPER_ADMIN") {
    const err = new Error("Not authorized to modify this notification");
    err.status = 403;
    throw err;
  }

  return prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
}

/**
 * Marks all notifications for the user / role as read.
 */
async function markAllNotificationsAsRead({ userId, role }) {
  const roleConditions = [];
  if (role) {
    roleConditions.push({ targetRole: role });
    if (role === "SUPER_ADMIN") roleConditions.push({ targetRole: "ADMIN" });
  }
  const userConditions = userId ? [{ userId }] : [];
  const orClauses = [...userConditions, ...roleConditions];
  if (!orClauses.length) return { count: 0 };

  const result = await prisma.notification.updateMany({
    where: {
      OR: orClauses,
      isRead: false,
    },
    data: { isRead: true },
  });

  return result;
}

module.exports = {
  createNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};

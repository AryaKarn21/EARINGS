const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("../services/notificationService");
const ah = require("../utils/asyncHandler");

// GET /api/notifications?unreadOnly=false&limit=50
router.get("/", requireAuth, ah(async (req, res) => {
  const { unreadOnly, limit } = req.query;
  const result = await getNotifications({
    userId: req.user.id,
    role: req.user.role,
    unreadOnly: unreadOnly === "true",
    limit: limit ? Number(limit) : 50,
  });
  res.json(result);
}));

// GET /api/notifications/unread-count
router.get("/unread-count", requireAuth, ah(async (req, res) => {
  const result = await getNotifications({
    userId: req.user.id,
    role: req.user.role,
    limit: 1,
  });
  res.json({ unreadCount: result.unreadCount });
}));

// PATCH /api/notifications/:id/read
router.patch("/:id/read", requireAuth, ah(async (req, res) => {
  const updated = await markNotificationAsRead(req.params.id, {
    userId: req.user.id,
    role: req.user.role,
  });
  if (!updated) return res.status(404).json({ error: "Notification not found" });
  res.json(updated);
}));

// POST /api/notifications/mark-all-read
router.post("/mark-all-read", requireAuth, ah(async (req, res) => {
  const result = await markAllNotificationsAsRead({
    userId: req.user.id,
    role: req.user.role,
  });
  res.json({ success: true, count: result.count });
}));

module.exports = router;

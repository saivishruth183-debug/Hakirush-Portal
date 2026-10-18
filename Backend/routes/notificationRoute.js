import express from "express";
import Notification from "../models/Notification.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { asyncHandler, notFound } from "../middleware/errorHandler.js";
import { requireObjectId, parsePagination } from "../utils/validate.js";
import { registerPushToken, unregisterPushToken } from "../services/pushNotificationService.js";

const router = express.Router();

// Recipient filter (existing semantics): admin => data.adminId, employee => data.userId.
// Clients have no notifications. Ids may have been stored as ObjectId or string.
const recipientFilter = (user) => {
  const ids = [user._id, String(user._id)];
  if (user.role === "admin") return { "data.adminId": { $in: ids } };
  if (user.role === "employee") return { "data.userId": { $in: ids } };
  return null;
};

// GET /api/notifications — own notifications, newest first. Bounded: default and max 100
// per page (?page=&limit=); the web bell reads the first page.
router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 100, maxLimit: 100 });
    const filter = recipientFilter(req.user);
    if (!filter) return res.json({ success: true, notifications: [], page, limit, hasMore: false, unseenCount: 0 });

    const [items, unseenCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit + 1).lean(),
      Notification.countDocuments({ ...filter, seen: false }),
    ]);
    const hasMore = items.length > limit;
    res.json({ success: true, notifications: items.slice(0, limit), page, limit, hasMore, unseenCount });
  })
);

// PATCH /api/notifications/seen-all — marks all of the caller's notifications seen.
router.patch(
  "/seen-all",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const filter = recipientFilter(req.user);
    if (!filter) return res.json({ success: true, modified: 0 });
    const result = await Notification.updateMany({ ...filter, seen: false }, { $set: { seen: true } });
    res.json({ success: true, modified: result.modifiedCount || 0 });
  })
);

// PATCH /api/notifications/:id/seen — recipient only; anyone else gets 404.
router.patch(
  "/:id/seen",
  authMiddleware,
  asyncHandler(async (req, res) => {
    requireObjectId(req.params.id, "notification id");
    const filter = recipientFilter(req.user);
    if (!filter) throw notFound("Notification not found");
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, ...filter },
      { $set: { seen: true } },
      { new: true }
    );
    if (!updated) throw notFound("Notification not found");
    res.json({ success: true });
  })
);

// POST /api/notifications/push-token — register an Expo/FCM push token
router.post(
  "/push-token",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { token, platform } = req.body || {};
    if (!token) return res.status(400).json({ success: false, error: "Push token is required" });
    const record = await registerPushToken({ userId: req.user._id, token, platform });
    res.json({ success: true, registered: Boolean(record) });
  })
);

// DELETE /api/notifications/push-token — unregister on logout
router.delete(
  "/push-token",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { token } = req.body || {};
    if (token) {
      await unregisterPushToken({ userId: req.user._id, token });
    }
    res.json({ success: true });
  })
);

export default router;

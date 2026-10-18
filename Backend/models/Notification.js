import mongoose from "mongoose";

// Recipient is stored inside `data`: `data.adminId` for admin notifications,
// `data.userId` (User._id) for employee notifications.
const notificationSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g., 'leave-request'
  message: { type: String, required: true },
  data: { type: Object, default: {} }, // extra info (employee, leaveId, etc)
  seen: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ "data.userId": 1, createdAt: -1 });
notificationSchema.index({ "data.adminId": 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);

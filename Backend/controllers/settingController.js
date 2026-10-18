import bcrypt from "bcrypt";
import User from "../models/User.js";
import { asyncHandler, badRequest, notFound } from "../middleware/errorHandler.js";
import { revokeAllForUser } from "../services/sessionService.js";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt only uses the first 72 bytes

export const validateNewPassword = (value, field = "newPassword") => {
  if (typeof value !== "string" || !value) throw badRequest(`${field} is required`);
  if (value.length < PASSWORD_MIN_LENGTH) {
    throw badRequest(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`, "VALIDATION_ERROR", { field });
  }
  if (Buffer.byteLength(value, "utf8") > PASSWORD_MAX_LENGTH) {
    throw badRequest(`Password must be at most ${PASSWORD_MAX_LENGTH} bytes`, "VALIDATION_ERROR", { field });
  }
  return value;
};

/**
 * PUT /api/setting/change-password
 * Target is always the authenticated user; any body.userId is ignored.
 * The request body is never logged.
 */
const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body || {};

  if (typeof oldPassword !== "string" || !oldPassword) throw badRequest("oldPassword is required");
  validateNewPassword(newPassword);
  if (confirmPassword !== undefined && confirmPassword !== newPassword) {
    throw badRequest("New password and confirmation don't match", "VALIDATION_ERROR", { field: "confirmPassword" });
  }
  if (newPassword === oldPassword) {
    throw badRequest("New password must be different from the current password", "VALIDATION_ERROR", { field: "newPassword" });
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!user) throw notFound("User not found");

  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    throw badRequest("Wrong old password", "VALIDATION_ERROR", { field: "oldPassword" });
  }

  const hashPassword = await bcrypt.hash(newPassword, 10);
  // Password + tokenVersion in one write: every previously issued token becomes invalid.
  await User.updateOne({ _id: user._id }, { $set: { password: hashPassword }, $inc: { tokenVersion: 1 } });
  await revokeAllForUser(user._id, "password_change");

  return res.status(200).json({ success: true, reauthRequired: true });
});

export { changePassword };

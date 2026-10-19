import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import PasswordReset from "../models/PasswordReset.js";
import Client from "../models/Client.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import { validateNewPassword } from "./settingController.js";
import { asyncHandler, badRequest, notFound, ApiError } from "../middleware/errorHandler.js";
import {
  signWebToken,
  createMobileSession,
  rotateRefreshToken,
  logoutRefreshToken,
  revokeAllSessions,
  revokeAllForUser,
  hashToken,
} from "../services/sessionService.js";
import { sendPasswordChangedEmail, sendPasswordResetOtpEmail } from "../services/emailService.js";

// Used to keep the unknown-email path as slow as the wrong-password path.
const DUMMY_HASH = bcrypt.hashSync("hakirush-timing-equalizer", 10);

const invalidCredentials = () => new ApiError(401, "Invalid email or password", "INVALID_CREDENTIALS");

const readCredentials = (body) => {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) throw badRequest("Email and password are required");
  if (email.length > 254 || password.length > 200) throw invalidCredentials();
  return { email, password };
};

// Uniform 401 for unknown email and wrong password; inactive status is only
// revealed after the correct password was supplied.
const authenticate = async (body) => {
  const { email, password } = readCredentials(body);
  const user = await User.findOne({ email }).select("+password");
  const ok = await bcrypt.compare(password, user?.password || DUMMY_HASH);
  if (!user || !ok) throw invalidCredentials();
  if (user.isActive === false) throw new ApiError(403, "Account is deactivated", "ACCOUNT_INACTIVE");
  return user;
};

/** SessionUser per docs/mobile/API_CONTRACT.md */
export const buildSessionUser = async (userDoc) => {
  const u = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  const sessionUser = {
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    profileImage: u.profileImage || "",
    isActive: u.isActive !== false,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };

  if (u.role === "employee" || u.role === "admin") {
    const employee = await Employee.findOne({ userId: u._id })
      .select("employeeId designation department")
      .lean();
    if (employee) {
      const dept = employee.department
        ? await Department.findById(employee.department).select("dep_name").lean()
        : null;
      sessionUser.employeeId = employee.employeeId;
      sessionUser.designation = employee.designation;
      sessionUser.employeeRecordId = employee._id;
      sessionUser.departmentId = dept ? dept._id : null;
      sessionUser.departmentName = dept ? dept.dep_name : null;
      
      // Determine if they manage ANY department
      const managedDept = await Department.findOne({ managerEmployeeId: employee._id }).lean();
      sessionUser.isManager = !!managedDept;
    } else if (u.role === "employee") {
      sessionUser.employeeId = null;
      sessionUser.designation = null;
      sessionUser.employeeRecordId = null;
      sessionUser.departmentId = null;
      sessionUser.departmentName = null;
      sessionUser.isManager = false;
    }
  }

  if (u.role === "client") {
    const client = await Client.findOne({ userId: u._id }).select("companyLogo clientId").lean();
    sessionUser.clientId = client ? client._id : null;
    sessionUser.clientCode = client?.clientId || null;
    if (client?.companyLogo) sessionUser.profileImage = client.companyLogo;
  }

  return sessionUser;
};

/* POST /api/auth/login (web) */
export const login = asyncHandler(async (req, res) => {
  const user = await authenticate(req.body);
  const token = signWebToken(user);
  return res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    user: await buildSessionUser(user),
  });
});

/* POST /api/auth/verify */
export const verify = asyncHandler(async (req, res) => {
  return res.status(200).json({ success: true, user: await buildSessionUser(req.user) });
});

/* POST /api/auth/mobile/login */
export const mobileLogin = asyncHandler(async (req, res) => {
  const user = await authenticate(req.body);
  const tokens = await createMobileSession(user, { deviceName: req.body?.deviceName });
  return res.status(200).json({ success: true, ...tokens, user: await buildSessionUser(user) });
});

/* POST /api/auth/mobile/refresh */
export const mobileRefresh = asyncHandler(async (req, res) => {
  const { user, tokens } = await rotateRefreshToken(req.body?.refreshToken);
  return res.status(200).json({ success: true, ...tokens, user: await buildSessionUser(user) });
});

/* POST /api/auth/mobile/logout (idempotent) */
export const mobileLogout = asyncHandler(async (req, res) => {
  const token = req.body?.refreshToken;
  if (token !== undefined && typeof token !== "string") throw badRequest("refreshToken must be a string");
  await logoutRefreshToken(token);
  return res.status(200).json({ success: true });
});

/* POST /api/auth/logout-all */
export const logoutAll = asyncHandler(async (req, res) => {
  await revokeAllSessions(req.user._id, "logout_all");
  return res.status(200).json({ success: true, reauthRequired: true });
});

const PASSWORD_RESET_MESSAGE = "If this email is registered, an OTP has been sent.";
const PASSWORD_RESET_OTP_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;

const normalizeResetEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const findUserByResetEmail = (email) =>
  User.findOne({ email }).collation({ locale: "en", strength: 2 });

const invalidOtp = (message = "Invalid or expired OTP. Request a new code.") =>
  new ApiError(400, message, "OTP_INVALID");

/* POST /api/auth/forgot-password */
export const forgotPassword = asyncHandler(async (req, res) => {
  const email = normalizeResetEmail(req.body?.email);
  if (!email || email.length > 254) throw badRequest("A valid email is required");

  const user = await findUserByResetEmail(email);
  if (user) {
    const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    await PasswordReset.deleteMany({ userId: user._id });
    await PasswordReset.create({
      userId: user._id,
      otpHash: await bcrypt.hash(otp, 10),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MS),
    });
    try {
      await sendPasswordResetOtpEmail(user, otp);
    } catch (error) {
      console.error("[PASSWORD RESET OTP EMAIL ERROR]", error?.message || error);
    }
  }

  return res.status(200).json({ success: true, message: PASSWORD_RESET_MESSAGE });
});

/* POST /api/auth/verify-otp */
export const verifyPasswordResetOtp = asyncHandler(async (req, res) => {
  const email = normalizeResetEmail(req.body?.email);
  const otp = typeof req.body?.otp === "string" ? req.body.otp : "";
  if (!email || email.length > 254 || !otp || otp.length > 64) {
    throw badRequest("Email and OTP are required");
  }

  const user = await findUserByResetEmail(email);
  const record = user
    ? await PasswordReset.findOne({ userId: user._id })
    : null;
  const now = new Date();
  if (!record || record.expiresAt <= now || record.verified || record.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
    if (record && record.expiresAt <= now) await PasswordReset.deleteOne({ _id: record._id });
    throw invalidOtp();
  }

  if (!(await bcrypt.compare(otp, record.otpHash))) {
    const updated = await PasswordReset.findOneAndUpdate(
      { _id: record._id, verified: false, attempts: { $lt: PASSWORD_RESET_MAX_ATTEMPTS }, expiresAt: { $gt: now } },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (!updated) throw invalidOtp();
    const attemptsLeft = PASSWORD_RESET_MAX_ATTEMPTS - updated.attempts;
    if (attemptsLeft === 0) {
      await PasswordReset.deleteOne({ _id: updated._id });
      throw new ApiError(400, "Too many incorrect codes. Request a new OTP.", "OTP_ATTEMPTS_EXCEEDED", { attemptsLeft: 0 });
    }
    throw new ApiError(400, `Incorrect OTP. ${attemptsLeft} attempts remaining.`, "OTP_INVALID", { attemptsLeft });
  }

  const resetToken = crypto.randomBytes(32).toString("base64url");
  const resetTokenExpiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
  const verified = await PasswordReset.findOneAndUpdate(
    { _id: record._id, verified: false, attempts: { $lt: PASSWORD_RESET_MAX_ATTEMPTS }, expiresAt: { $gt: now } },
    {
      $set: {
        verified: true,
        resetTokenHash: hashToken(resetToken),
        resetTokenExpiresAt,
        expiresAt: resetTokenExpiresAt,
      },
    },
    { new: true }
  );
  if (!verified) throw invalidOtp();

  return res.status(200).json({ success: true, resetToken });
});

/* POST /api/auth/reset-password */
export const resetPassword = asyncHandler(async (req, res) => {
  const email = normalizeResetEmail(req.body?.email);
  const { resetToken, newPassword } = req.body || {};
  if (!email || email.length > 254 || typeof resetToken !== "string" || !resetToken) {
    throw badRequest("Email, reset token, and new password are required");
  }
  validateNewPassword(newPassword, "newPassword");
  if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw badRequest("Password must contain at least one letter and one number", "VALIDATION_ERROR", { field: "newPassword" });
  }

  const user = await findUserByResetEmail(email);
  const record = user
    ? await PasswordReset.findOne({
        userId: user._id,
        verified: true,
        resetTokenExpiresAt: { $gt: new Date() },
      })
    : null;
  const storedTokenHash = record?.resetTokenHash || "";
  const submittedTokenHash = hashToken(resetToken);
  if (!record || storedTokenHash.length !== submittedTokenHash.length || !crypto.timingSafeEqual(
    Buffer.from(storedTokenHash),
    Buffer.from(submittedTokenHash)
  )) {
    throw new ApiError(401, "Invalid or expired reset token. Verify your OTP again.", "RESET_TOKEN_INVALID");
  }

  const consumed = await PasswordReset.findOneAndDelete({
    _id: record._id,
    resetTokenHash: hashToken(resetToken),
    resetTokenExpiresAt: { $gt: new Date() },
  });
  if (!consumed) {
    throw new ApiError(401, "Invalid or expired reset token. Verify your OTP again.", "RESET_TOKEN_INVALID");
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: user._id },
    { $set: { password: await bcrypt.hash(newPassword, 10) }, $inc: { tokenVersion: 1 } },
    { new: true }
  );
  if (!updatedUser) throw notFound("User not found");
  await revokeAllForUser(user._id, "password_reset");

  try {
    await sendPasswordChangedEmail(updatedUser);
  } catch (error) {
    console.error("[PASSWORD RESET EMAIL ERROR]", error?.message || error);
  }

  return res.status(200).json({ success: true, message: "Password updated, please log in." });
});

/* POST /api/auth/setup-password */
export const setupPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw badRequest("Token and password are required");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_KEY);
  } catch (err) {
    throw new ApiError(401, "Invalid or expired setup token", "INVALID_TOKEN");
  }

  if (decoded.type !== "setup") throw new ApiError(401, "Invalid token type", "INVALID_TOKEN");

  const user = await User.findById(decoded._id);
  if (!user) throw badRequest("User no longer exists");

  validateNewPassword(password, "password");
  const hashedPassword = await bcrypt.hash(password, 10);

  user.password = hashedPassword;
  // Increment tokenVersion to kill any sessions that might theoretically exist
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  return res.status(200).json({ success: true, message: "Password setup successfully. You may now log in." });
});

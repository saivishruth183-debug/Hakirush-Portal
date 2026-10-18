import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Client from "../models/Client.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import { validateNewPassword } from "./settingController.js";
import { asyncHandler, badRequest, ApiError } from "../middleware/errorHandler.js";
import {
  signWebToken,
  createMobileSession,
  rotateRefreshToken,
  logoutRefreshToken,
  revokeAllSessions,
} from "../services/sessionService.js";

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

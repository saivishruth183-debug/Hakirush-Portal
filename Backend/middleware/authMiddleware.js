import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { isSessionActive } from "../services/sessionService.js";

const deny = (res, status, error, code) =>
  res.status(status).json({ success: false, error, code });

/**
 * Authenticates a Bearer access token.
 * - Rejects deactivated accounts (403 ACCOUNT_INACTIVE).
 * - Rejects tokens issued before the user's tokenVersion was bumped
 *   (password change, deactivation, "log out everywhere") with 401 SESSION_REVOKED.
 * - Mobile access tokens carry `sid` (refresh family id): the family must exist,
 *   belong to the user and not be revoked (mobile logout / refresh-reuse detection
 *   revoke one device's session immediately), else 401 SESSION_REVOKED.
 * Legacy web tokens without `tv` are treated as version 0; tokens without `sid`
 * (web) are governed by tokenVersion only.
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return deny(res, 401, "No token provided", "AUTH_REQUIRED");
  if (!authHeader.startsWith("Bearer ")) return deny(res, 401, "Invalid token format", "TOKEN_INVALID");

  const token = authHeader.slice(7).trim();
  if (!token) return deny(res, 401, "Token missing", "AUTH_REQUIRED");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_KEY);
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return deny(res, 401, "Session expired", "TOKEN_EXPIRED");
    }
    return deny(res, 401, "Invalid or expired token", "TOKEN_INVALID");
  }

  const userId = decoded?._id || decoded?.id;
  if (!userId || decoded?.typ === "refresh") {
    return deny(res, 401, "Invalid token payload", "TOKEN_INVALID");
  }

  try {
    const user = await User.findById(userId).select("-password");
    if (!user) return deny(res, 401, "Account no longer exists", "SESSION_REVOKED");
    if (user.isActive === false) return deny(res, 403, "Account is deactivated", "ACCOUNT_INACTIVE");
    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return deny(res, 401, "Session has been revoked", "SESSION_REVOKED");
    }
    if (decoded.sid !== undefined && !(await isSessionActive(decoded.sid, user._id))) {
      return deny(res, 401, "Session has been revoked", "SESSION_REVOKED");
    }
    req.user = user;
    req.auth = { tokenVersion: decoded.tv ?? 0, sessionId: decoded.sid || null };
    return next();
  } catch (error) {
    console.error("AUTH ERROR:", error?.message);
    return res.status(503).json({ success: false, error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" });
  }
};

export default authMiddleware;

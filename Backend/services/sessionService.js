// Session lifecycle: web access tokens, mobile access + rotating refresh tokens,
// and revocation (logout, logout-all, password change, deactivation).
//
// Revocation model (no multi-document transactions required):
// - A RefreshSession document (the "family", _id = sid) is AUTHORITATIVE.
//   A refresh token or an access token carrying `sid` is valid only while the
//   family's `revokedAt` is null.
// - Revokers set family.revokedAt FIRST, then mark the individual refresh tokens.
// - A refresher claims the presented token, inserts the child token, and only
//   THEN re-checks (and touches) the family with a conditional update. If the
//   family was revoked in the meantime, the refresher revokes its own child and
//   fails. Either the refresher observes the revocation (and kills the child),
//   or the revocation happened after the child was inserted (so the revoker's
//   token sweep, and the family check on every later use, kill it). No ordering
//   can leave a usable child in a revoked family.
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import RefreshSession from "../models/RefreshSession.js";
import { ApiError, unauthorized } from "../middleware/errorHandler.js";

const WEB_TOKEN_TTL = () => process.env.WEB_TOKEN_TTL || "10d";
const ACCESS_TOKEN_TTL = () => process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL_DAYS = () => {
  const n = Number(process.env.REFRESH_TOKEN_TTL_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 30;
};

// Test-only interception points (ignored unless NODE_ENV === "test").
export const __testHooks = {
  // async ({ familyId, userId, childToken }) => void; runs after the presented
  // token was claimed and before the child token is inserted.
  beforeInsertChild: null,
};

export const hashToken = (raw) => crypto.createHash("sha256").update(String(raw)).digest("hex");

const newRefreshTokenValue = () => crypto.randomBytes(48).toString("base64url");

const expiryIso = (token) => {
  const decoded = jwt.decode(token);
  return decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;
};

// Legacy web token: { _id, role, tv } (no sid; governed by tokenVersion only).
export const signWebToken = (user) =>
  jwt.sign(
    { _id: String(user._id), role: user.role, tv: user.tokenVersion ?? 0 },
    process.env.JWT_KEY,
    { expiresIn: WEB_TOKEN_TTL() }
  );

// Short-lived mobile access token carrying the refresh family id as `sid`.
export const signAccessToken = (user, familyId) =>
  jwt.sign(
    { _id: String(user._id), role: user.role, tv: user.tokenVersion ?? 0, sid: familyId },
    process.env.JWT_KEY,
    { expiresIn: ACCESS_TOKEN_TTL() }
  );

const refreshExpiry = () => new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS() * 24 * 60 * 60 * 1000);

const buildTokenPair = (user, familyId, refreshToken, refreshExpiresAt) => {
  const accessToken = signAccessToken(user, familyId);
  return {
    accessToken,
    accessTokenExpiresAt: expiryIso(accessToken),
    refreshToken,
    refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
  };
};

/* ---------------- revocation ---------------- */

const markTokensRevoked = (filter, reason, now) =>
  RefreshToken.updateMany({ ...filter, revokedAt: null }, { $set: { revokedAt: now, revokedReason: reason } });

// Family first (authoritative), then its tokens. The first revocation reason wins.
export const revokeFamily = async (familyId, reason) => {
  const now = new Date();
  await RefreshSession.updateOne({ _id: familyId, revokedAt: null }, { $set: { revokedAt: now, revokedReason: reason } });
  await markTokensRevoked({ familyId }, reason, now);
};

export const revokeAllForUser = async (userId, reason) => {
  const now = new Date();
  await RefreshSession.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: now, revokedReason: reason } });
  await markTokensRevoked({ userId }, reason, now);
};

// Invalidates every access token (tokenVersion) and every refresh session of a user.
export const revokeAllSessions = async (userId, reason = "logout_all") => {
  await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
  await revokeAllForUser(userId, reason);
};

/** Is this access-token session (sid) still valid for this user? Used by authMiddleware. */
export const isSessionActive = async (sid, userId) => {
  if (typeof sid !== "string" || !sid || sid.length > 100) return false;
  const session = await RefreshSession.findById(sid).select("userId revokedAt").lean();
  return Boolean(session && !session.revokedAt && String(session.userId) === String(userId));
};

// Maps a revoked family to the contract error.
const familyRevokedError = (reason) => {
  switch (reason) {
    case "reuse_detected":
      return unauthorized("Refresh token was already used; please sign in again", "REFRESH_REUSED");
    case "logout":
      return unauthorized("Session has ended", "REFRESH_INVALID");
    case "deactivated":
      return new ApiError(403, "Account is deactivated", "ACCOUNT_INACTIVE");
    default:
      return unauthorized("Session has been revoked", "SESSION_REVOKED");
  }
};

const reuseError = () => unauthorized("Refresh token was already used; please sign in again", "REFRESH_REUSED");

/* ---------------- sessions ---------------- */

// New sign-in on a device: new family (session document first, then its first token).
export const createMobileSession = async (user, { deviceName } = {}) => {
  const familyId = crypto.randomUUID();
  const refreshToken = newRefreshTokenValue();
  const expiresAt = refreshExpiry();
  const now = new Date();
  const device = typeof deviceName === "string" ? deviceName.trim().slice(0, 100) : "";
  await RefreshSession.create({ _id: familyId, userId: user._id, deviceName: device, lastUsedAt: now, expiresAt });
  await RefreshToken.create({
    userId: user._id,
    familyId,
    tokenHash: hashToken(refreshToken),
    tokenVersion: user.tokenVersion ?? 0,
    expiresAt,
    deviceName: device,
    lastUsedAt: now,
  });
  return buildTokenPair(user, familyId, refreshToken, expiresAt);
};

/**
 * Rotates a refresh token.
 * 1. The family must exist and be unrevoked (authoritative check).
 * 2. A token that was already rotated => reuse => revoke the family.
 * 3. Atomic single-winner claim of the presented token.
 * 4. Insert the child token.
 * 5. Conditional touch of the family ({revokedAt: null}); if it was revoked
 *    meanwhile, revoke the child and fail.
 * If step 4 fails after step 3 (crash/DB error), the presented token is already
 * consumed: the family is revoked (best effort) and the user must sign in again;
 * a later presentation of the old token is treated as reuse.
 */
export const rotateRefreshToken = async (rawToken) => {
  if (typeof rawToken !== "string" || rawToken.length < 20 || rawToken.length > 200) {
    throw unauthorized("Invalid refresh token", "REFRESH_INVALID");
  }
  const record = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
  if (!record) throw unauthorized("Invalid refresh token", "REFRESH_INVALID");

  const family = await RefreshSession.findById(record.familyId).lean();
  if (!family || String(family.userId) !== String(record.userId)) {
    throw unauthorized("Invalid refresh token", "REFRESH_INVALID");
  }
  if (family.revokedAt) throw familyRevokedError(family.revokedReason);

  if (record.revokedAt) {
    // Presented token was already consumed (rotated) => reuse.
    await revokeFamily(record.familyId, "reuse_detected");
    throw reuseError();
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw unauthorized("Refresh token expired", "REFRESH_INVALID");
  }

  const user = await User.findById(record.userId);
  if (!user) {
    await revokeFamily(record.familyId, "session_revoked");
    throw unauthorized("Session has been revoked", "SESSION_REVOKED");
  }
  if (user.isActive === false) {
    await revokeAllForUser(user._id, "deactivated");
    throw new ApiError(403, "Account is deactivated", "ACCOUNT_INACTIVE");
  }
  if ((record.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    await revokeFamily(record.familyId, "session_revoked");
    throw unauthorized("Session has been revoked", "SESSION_REVOKED");
  }

  const childToken = newRefreshTokenValue();
  const childHash = hashToken(childToken);
  const now = new Date();

  // Atomic single-winner claim.
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: record._id, revokedAt: null },
    { $set: { revokedAt: now, revokedReason: "rotated", replacedByHash: childHash, lastUsedAt: now } },
    { new: true }
  );
  if (!claimed) {
    // Lost a race with another refresh using the same token => reuse.
    await revokeFamily(record.familyId, "reuse_detected");
    throw reuseError();
  }

  const expiresAt = refreshExpiry();
  let child;
  try {
    if (process.env.NODE_ENV === "test" && typeof __testHooks.beforeInsertChild === "function") {
      await __testHooks.beforeInsertChild({ familyId: record.familyId, userId: user._id, childToken });
    }
    child = await RefreshToken.create({
      userId: user._id,
      familyId: record.familyId,
      tokenHash: childHash,
      tokenVersion: user.tokenVersion ?? 0,
      expiresAt,
      deviceName: record.deviceName,
      lastUsedAt: now,
    });
  } catch (err) {
    // The presented token is consumed and no child exists: end the session.
    await revokeFamily(record.familyId, "rotation_failed").catch(() => {});
    throw err;
  }

  // Post-insert authoritative check (and sliding expiry) on the family.
  const live = await RefreshSession.findOneAndUpdate(
    { _id: record.familyId, revokedAt: null },
    { $set: { lastUsedAt: now, expiresAt } },
    { new: true }
  ).lean();
  if (!live) {
    const revokedFamily = await RefreshSession.findById(record.familyId).select("revokedReason").lean();
    const reason = revokedFamily?.revokedReason || "reuse_detected";
    await RefreshToken.updateOne(
      { _id: child._id, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: reason } }
    );
    throw familyRevokedError(reason);
  }

  return { user, tokens: buildTokenPair(user, record.familyId, childToken, expiresAt) };
};

// Idempotent: unknown/already-revoked tokens are a successful no-op.
export const logoutRefreshToken = async (rawToken) => {
  if (typeof rawToken !== "string" || !rawToken) return;
  const record = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) }).select("familyId");
  if (record) await revokeFamily(record.familyId, "logout");
};

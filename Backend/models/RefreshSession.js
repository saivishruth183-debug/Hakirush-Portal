import mongoose from "mongoose";

// One mobile sign-in on one device ("refresh family"). `_id` is the family id,
// which is also the `sid` claim of every access token issued for this session.
//
// This document is AUTHORITATIVE for revocation: a refresh token or an access
// token of the family is only valid while `revokedAt` is null. Revocation sets
// `revokedAt` here first (single-document atomic update) and only then marks
// the individual RefreshToken rows.
const refreshSessionSchema = new mongoose.Schema(
  {
    _id: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceName: { type: String, default: "", maxlength: 100 },
    revokedAt: { type: Date, default: null },
    // reuse_detected | logout | logout_all | password_change | deactivated | session_revoked | rotation_failed
    revokedReason: { type: String, default: null },
    lastUsedAt: { type: Date, default: null },
    // Slides forward with every refresh (matches the newest refresh token's expiry).
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// MongoDB removes sessions once their last refresh token could no longer be used.
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("RefreshSession", refreshSessionSchema);

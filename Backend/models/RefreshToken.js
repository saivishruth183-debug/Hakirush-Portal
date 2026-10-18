import mongoose from "mongoose";

// Opaque mobile refresh tokens. Only the SHA-256 hash of the token is stored.
// A "family" is one sign-in on one device; every refresh rotates the token
// within the same family. Presenting an already-rotated token revokes the family.
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    // User.tokenVersion at issue time; a mismatch at refresh means the session was revoked.
    tokenVersion: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    // rotated | logout | logout_all | password_change | deactivated | reuse_detected | session_revoked
    revokedReason: { type: String, default: null },
    replacedByHash: { type: String, default: null },
    deviceName: { type: String, default: "", maxlength: 100 },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// MongoDB removes expired tokens automatically.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("RefreshToken", refreshTokenSchema);

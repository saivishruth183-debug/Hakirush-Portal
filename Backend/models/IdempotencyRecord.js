import mongoose from "mongoose";

// Stored responses for requests carrying an `Idempotency-Key` header.
// A retried request with the same key (same user, same operation) replays the
// stored response instead of executing again. Records expire after ~48h.
export const IDEMPOTENCY_TTL_SECONDS = 48 * 60 * 60;

const idempotencyRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  key: { type: String, required: true },
  scope: { type: String, required: true }, // e.g. "attendance:check-in"
  state: { type: String, enum: ["pending", "done"], default: "pending" },
  statusCode: { type: Number, default: null },
  body: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now },
});

idempotencyRecordSchema.index({ userId: 1, key: 1 }, { unique: true });
idempotencyRecordSchema.index({ createdAt: 1 }, { expireAfterSeconds: IDEMPOTENCY_TTL_SECONDS });

export default mongoose.model("IdempotencyRecord", idempotencyRecordSchema);

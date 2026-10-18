import mongoose from "mongoose";

// startDate/endDate are business dates stored as UTC midnight (the web sends YYYY-MM-DD).
const leaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    leaveType: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
    },
    // Working days (weekends + holidays excluded), always computed by the server.
    days: {
      type: Number,
      required: true
    },
    /* ===== Audit fields (additive) ===== */
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

leaveSchema.index({ employeeId: 1, status: 1, startDate: 1 });

export default mongoose.model("Leave", leaveSchema);

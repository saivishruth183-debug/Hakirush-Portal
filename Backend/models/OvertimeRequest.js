import mongoose from "mongoose";

const overtimeRequestSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    type: {
      type: String,
      enum: ["Comp-Off", "Payout"],
      required: true,
    },
    hours: {
      type: Number,
      required: true,
      min: 0.5,
      max: 100,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewRemarks: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

overtimeRequestSchema.index({ employeeId: 1, createdAt: -1 });
overtimeRequestSchema.index({ status: 1 });

const OvertimeRequest = mongoose.model("OvertimeRequest", overtimeRequestSchema);
export default OvertimeRequest;

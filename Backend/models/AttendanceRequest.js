import mongoose from "mongoose";

const attendanceRequestSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD, same format as Attendance.date
    currentStatus: { type: String, required: true }, // e.g. "Absent", "Half Day" (derived server-side)
    requestedStatus: { type: String, required: true, enum: ["Present", "Half Day"] },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewRemarks: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

attendanceRequestSchema.index({ employeeId: 1, date: 1 });
// At most one Pending request per employee/date (enforced by the database too).
// Different key pattern from the index above so both can coexist on existing databases.
attendanceRequestSchema.index(
  { employeeId: 1, date: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "Pending" }, name: "uniq_pending_request_per_employee_date" }
);

export default mongoose.model("AttendanceRequest", attendanceRequestSchema);

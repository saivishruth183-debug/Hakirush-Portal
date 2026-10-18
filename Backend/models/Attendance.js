import mongoose from "mongoose";

// Attendance day record. `date` is the business date (YYYY-MM-DD) in ORG_TIMEZONE.
// Instants (checkIn/checkOut/pauseStartedAt) are stored as UTC Dates and are
// always set by the server clock, never by the client.
const AttendanceSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    checkIn: {
      type: Date,
      default: null,
    },

    checkOut: {
      type: Date,
      default: null,
    },

    workedHours: {
      type: Number,
      default: 0,
    },

    overtimeHours: {
      type: Number,
      default: 0,
    },

    // "" = not yet determined (open punch session / placeholder record).
    status: {
      type: String,
      enum: ["Present", "Half Day", "Absent", "Leave", ""],
      default: "",
    },

    isPaused: {
      type: Boolean,
      default: false,
    },

    pauseStartedAt: {
      type: Date,
      default: null,
    },

    totalPausedMs: {
      type: Number,
      default: 0,
    },

    /* ===== Audit fields (additive) ===== */
    // Who last determined the status: punch (employee clock), admin (manual),
    // correction (approved correction request), system (day-close job).
    source: {
      type: String,
      enum: ["punch", "admin", "correction", "system", null],
      default: null,
    },
    // Where workedHours came from: "punch" (computed from timestamps),
    // "admin" / "correction" (nominal hours for the assigned status).
    hoursSource: { type: String, default: null },
    // Hours actually measured from punches when a status override replaced workedHours.
    punchedHours: { type: Number, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    adminUpdatedAt: { type: Date, default: null },
    correctionRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "AttendanceRequest", default: null },
    correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    correctedAt: { type: Date, default: null },
    // Set when the day-close job closed an open check-in from a previous day.
    autoClosedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AttendanceSchema.index(
  { employeeId: 1, date: 1 },
  { unique: true }
);
AttendanceSchema.index({ date: 1, status: 1 });
AttendanceSchema.index({ date: 1, employeeId: 1 });

const Attendance = mongoose.model("Attendance", AttendanceSchema);
export default Attendance;

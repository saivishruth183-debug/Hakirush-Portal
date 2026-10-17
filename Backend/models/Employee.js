import mongoose, { Schema } from "mongoose";

// Note: there is no `manager` field. Department management is an assignment
// stored on Department.managerEmployeeId.
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const GENDERS = ["Male", "Female", "Other"];
export const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];

const employeeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    employeeId: { type: String, required: true, unique: true },
    dob: { type: Date },
    gender: { type: String },
    maritalStatus: { type: String },
    dateOfJoining: { type: Date, default: Date.now },
    inactiveSince: { type: Date, default: null },
    inactiveDurationMs: { type: Number, default: 0, min: 0 },
    bloodGroup: {
      type: String,
      enum: [...BLOOD_GROUPS, null],
      default: null
    },
    designation: { type: String, required: true, trim: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    salary: { type: Number, required: true },
    experience: { type: String, default: "" },
    aadharcard: { type: String, default: "" },
    pancard: { type: String, default: "" },
    pfNumber: { type: String, default: "" },
  },
  { timestamps: true }
);

employeeSchema.index({ userId: 1 });
employeeSchema.index({ department: 1 });

export default mongoose.model("Employee", employeeSchema);

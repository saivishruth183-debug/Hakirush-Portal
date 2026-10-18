import mongoose from "mongoose";

// A department manager is an assignment on the Department (not a User role).
// The previous document-level `deleteOne` cascade hook was removed: it never ran
// for `findOneAndDelete` and would have silently deleted people and leave history.
// Deleting a department that still has employees is now rejected (409 DEPARTMENT_NOT_EMPTY).
const managerHistorySchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    changedAt: { type: Date, default: Date.now },
    reason: { type: String, default: "" },
  },
  { _id: true }
);

const departmentSchema = new mongoose.Schema(
  {
    dep_name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    managerEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    managerHistory: { type: [managerHistorySchema], default: [] },
  },
  { timestamps: true }
);

departmentSchema.index({ managerEmployeeId: 1 });

const Department = mongoose.model("Department", departmentSchema);

export default Department;

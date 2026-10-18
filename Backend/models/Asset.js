import mongoose, { Schema } from "mongoose";

const assetSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    assetType: { type: String, required: true, enum: ["Laptop", "Monitor", "Mobile", "ID Card", "Keys", "Other"] },
    serialNumber: { type: String, unique: true, sparse: true },
    status: { type: String, required: true, enum: ["Available", "Assigned", "Maintenance", "Retired"], default: "Available" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    issueDate: { type: Date, default: null },
    returnDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

assetSchema.index({ assignedTo: 1 });
assetSchema.index({ status: 1 });

export default mongoose.model("Asset", assetSchema);

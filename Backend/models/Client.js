import mongoose, { Schema } from "mongoose";

const clientSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  clientId: {
    type: String,
    trim: true,
    uppercase: true,
    minlength: 1,
    maxlength: 32,
    match: /^[A-Z0-9][A-Z0-9_-]*$/,
    unique: true,
    sparse: true,
  },
  dateOfJoining: { type: Date, required: true },
  companyLogo: { type: String },
  budget: { type: Number, required: true },
  planType: { type: String, enum: ["Annual", "Quarterly"], required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Client", clientSchema);

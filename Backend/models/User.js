import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {  
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["admin", "employee", "client"],
      required: true
    },
    profileImage: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    // Incremented to revoke every issued access token (password change, deactivation, logout-all).
    tokenVersion: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;

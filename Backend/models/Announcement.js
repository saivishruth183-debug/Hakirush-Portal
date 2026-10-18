import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String },
    type: {
      type: String,
      enum: ["Annual", "Quarterly", "Celebration"],
      required: true,
    },
    date: { type: String, required: true },
    venue: { type: String, required: true },
    status: {
      type: String,
      enum: ["Upcoming", "Ongoing", "Completed"],
      default: "Upcoming",
    },
    // MOVED: seenBy is now a top-level field for easy access
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default mongoose.model("Announcement", announcementSchema);
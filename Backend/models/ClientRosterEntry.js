import mongoose from "mongoose";

export const JERSEY_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
export const ROSTER_NAME_MAX = 80;
export const ROSTER_MAX_ENTRIES = 200;

// Client "Roster & Apparel" entries (fields from ClientRelationship.jsx).
const clientRosterEntrySchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: ROSTER_NAME_MAX },
    event: { type: String, trim: true, maxlength: ROSTER_NAME_MAX, default: "" },
    jerseySize: { type: String, required: true, enum: JERSEY_SIZES },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("ClientRosterEntry", clientRosterEntrySchema);

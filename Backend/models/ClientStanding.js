import mongoose from "mongoose";

export const STANDINGS_MAX_ROWS = 50;
export const TEAM_NAME_MAX = 80;

// One performance table per client; an admin PUT replaces the whole table.
const standingRowSchema = new mongoose.Schema({
  teamName: { type: String, required: true, trim: true, maxlength: TEAM_NAME_MAX },
  played: { type: Number, required: true, min: 0 },
  won: { type: Number, required: true, min: 0 },
  lost: { type: Number, required: true, min: 0 },
  points: { type: Number, required: true, min: 0 },
});

const clientStandingSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, unique: true },
    standings: { type: [standingRowSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("ClientStanding", clientStandingSchema);

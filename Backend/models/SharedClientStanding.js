import mongoose from "mongoose";
import { STANDINGS_MAX_ROWS, TEAM_NAME_MAX } from "./ClientStanding.js";

const standingRowSchema = new mongoose.Schema({
  teamName: { type: String, required: true, trim: true, maxlength: TEAM_NAME_MAX },
  played: { type: Number, required: true, min: 0 },
  won: { type: Number, required: true, min: 0 },
  lost: { type: Number, required: true, min: 0 },
  points: { type: Number, required: true, min: 0 },
});

const sharedClientStandingSchema = new mongoose.Schema(
  {
    scope: { type: String, enum: ["allClients"], default: "allClients", unique: true },
    standings: {
      type: [standingRowSchema],
      default: [],
      validate: (standings) => standings.length <= STANDINGS_MAX_ROWS,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("SharedClientStanding", sharedClientStandingSchema);

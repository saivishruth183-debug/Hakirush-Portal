import Sponsor from "../models/Sponsor.js";
import uploadToImageKit from "../utils/uploadToImageKit.js";
import { asyncHandler, notFound, ApiError, conflict } from "../middleware/errorHandler.js";
import { requireObjectId, trimmedString, toFiniteNumber, requireEnum } from "../utils/validate.js";

const COLLABORATIONS = ["Title Sponsor", "Associate Sponsor", "Event Sponsor", "Media Partner"];

const uploadLogo = async (file) => {
  if (!file?.buffer) return undefined;
  try {
    return await uploadToImageKit(file, "sponsors");
  } catch {
    throw new ApiError(502, "Image upload failed. Please try again.", "UPLOAD_FAILED");
  }
};

// Allowlisted fields; `partial` for updates (only provided keys).
const parseSponsor = (b = {}, { partial = false } = {}) => {
  const out = {};
  if (!partial || b.sponsorId !== undefined) out.sponsorId = trimmedString(b.sponsorId, "Sponsor ID", { max: 100 });
  if (!partial || b.name !== undefined) out.name = trimmedString(b.name, "name", { max: 200 });
  if (!partial || b.collaboration !== undefined) out.collaboration = requireEnum(b.collaboration, COLLABORATIONS, "collaboration");
  if (b.eventsSponsored !== undefined && b.eventsSponsored !== "") {
    out.eventsSponsored = Math.floor(toFiniteNumber(b.eventsSponsored, "eventsSponsored", { min: 0, max: 1e6 }));
  } else if (!partial) {
    out.eventsSponsored = 0;
  }
  if (!partial || b.reach !== undefined) out.reach = trimmedString(b.reach, "reach", { max: 200 });
  if (b.upcomingEvents !== undefined) {
    out.upcomingEvents = trimmedString(b.upcomingEvents, "upcomingEvents", { max: 2000, optional: true }) ?? "";
  }
  return out;
};

/* POST /api/sponsors/add (admin) */
export const addSponsor = asyncHandler(async (req, res) => {
  const data = parseSponsor(req.body);
  const logo = await uploadLogo(req.file);
  let sponsor;
  try {
    sponsor = await Sponsor.create({ ...data, logo: logo || "" });
  } catch (err) {
    if (err?.code === 11000 && err.keyPattern?.sponsorId) {
      throw conflict("Sponsor ID already exists", "DUPLICATE_SPONSOR_ID");
    }
    throw err;
  }
  res.status(201).json({ success: true, sponsor });
});

/* GET /api/sponsors (admin) */
export const getSponsors = asyncHandler(async (req, res) => {
  const sponsors = await Sponsor.find().sort({ createdAt: -1 });
  res.json({ success: true, sponsors });
});

/* GET /api/sponsors/:id (admin) */
export const getSponsor = asyncHandler(async (req, res) => {
  requireObjectId(req.params.id, "sponsor id");
  const sponsor = await Sponsor.findById(req.params.id);
  if (!sponsor) throw notFound("Sponsor not found");
  res.json({ success: true, sponsor });
});

/* PUT /api/sponsors/:id (admin) */
export const updateSponsor = asyncHandler(async (req, res) => {
  requireObjectId(req.params.id, "sponsor id");
  const data = parseSponsor(req.body, { partial: true });
  const logo = await uploadLogo(req.file);
  if (logo) data.logo = logo;
  let updated;
  try {
    updated = await Sponsor.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
  } catch (err) {
    if (err?.code === 11000 && err.keyPattern?.sponsorId) {
      throw conflict("Sponsor ID already exists", "DUPLICATE_SPONSOR_ID");
    }
    throw err;
  }
  if (!updated) throw notFound("Sponsor not found");
  res.json({ success: true, message: "Sponsor updated", sponsor: updated });
});

/* DELETE /api/sponsors/:id (admin) */
export const deleteSponsor = asyncHandler(async (req, res) => {
  requireObjectId(req.params.id, "sponsor id");
  const deleted = await Sponsor.findByIdAndDelete(req.params.id);
  if (!deleted) throw notFound("Sponsor not found");
  res.json({ success: true, message: "Sponsor deleted" });
});

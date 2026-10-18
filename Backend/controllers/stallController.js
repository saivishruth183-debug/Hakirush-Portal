import Stall from "../models/Stall.js";
import uploadToImageKit from "../utils/uploadToImageKit.js";
import { asyncHandler, notFound, badRequest, ApiError } from "../middleware/errorHandler.js";
import { requireObjectId, trimmedString, toFiniteNumber } from "../utils/validate.js";

const uploadLogo = async (file) => {
  if (!file?.buffer) return undefined;
  try {
    return await uploadToImageKit(file, "stalls");
  } catch {
    throw new ApiError(502, "Image upload failed. Please try again.", "UPLOAD_FAILED");
  }
};

// Multipart forms send repeated `plans` fields (array) or a single string.
const parsePlans = (v) => {
  if (v === undefined) return undefined;
  const arr = Array.isArray(v) ? v : [v];
  if (arr.length > 50) throw badRequest("Too many plans");
  return arr
    .map((p) => {
      if (typeof p !== "string") throw badRequest("plans must be text");
      const s = p.trim();
      if (s.length > 200) throw badRequest("A plan is too long");
      return s;
    })
    .filter(Boolean);
};

const parseStall = (b = {}, { partial = false } = {}) => {
  const out = {};
  if (!partial || b.name !== undefined) out.name = trimmedString(b.name, "name", { max: 200 });
  if (!partial || b.number !== undefined) out.number = trimmedString(String(b.number ?? ""), "number", { max: 50 });
  if (!partial || b.type !== undefined) out.type = trimmedString(b.type, "type", { max: 100 });
  if (b.eventCount !== undefined && b.eventCount !== "") {
    out.eventCount = Math.floor(toFiniteNumber(b.eventCount, "eventCount", { min: 0, max: 1e6 }));
  } else if (!partial) {
    out.eventCount = 0;
  }
  const plans = parsePlans(b.plans);
  if (plans !== undefined) out.plans = plans;
  else if (!partial) out.plans = [];
  return out;
};

/* GET /api/stalls (admin) */
export const getAllStalls = asyncHandler(async (req, res) => {
  const stalls = await Stall.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, stalls });
});

/* GET /api/stalls/:id (admin) */
export const getStallById = asyncHandler(async (req, res) => {
  requireObjectId(req.params.id, "stall id");
  const stall = await Stall.findById(req.params.id);
  if (!stall) throw notFound("Stall not found");
  res.status(200).json({ success: true, stall });
});

/* POST /api/stalls (admin) */
export const createStall = asyncHandler(async (req, res) => {
  const data = parseStall(req.body);
  const logo = await uploadLogo(req.file);
  const stall = await Stall.create({ ...data, logo: logo || null });
  res.status(201).json({ success: true, stall });
});

/* PUT /api/stalls/:id (admin) */
export const updateStall = asyncHandler(async (req, res) => {
  requireObjectId(req.params.id, "stall id");
  const data = parseStall(req.body, { partial: true });
  const logo = await uploadLogo(req.file);
  if (logo) data.logo = logo;
  const stall = await Stall.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
  if (!stall) throw notFound("Stall not found");
  res.status(200).json({ success: true, stall });
});

/* DELETE /api/stalls/:id (admin) */
export const deleteStall = asyncHandler(async (req, res) => {
  requireObjectId(req.params.id, "stall id");
  const stall = await Stall.findByIdAndDelete(req.params.id);
  if (!stall) throw notFound("Stall not found");
  res.status(200).json({ success: true, message: "Stall deleted" });
});

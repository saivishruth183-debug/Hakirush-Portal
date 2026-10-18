import Announcement from "../models/Announcement.js";
import uploadToImageKit from "../utils/uploadToImageKit.js";
import { asyncHandler, forbidden, notFound, ApiError } from "../middleware/errorHandler.js";
import { requireObjectId, trimmedString, requireEnum } from "../utils/validate.js";

const TYPES = ["Annual", "Quarterly", "Celebration"];
const STATUSES = ["Upcoming", "Ongoing", "Completed"];
// Audience rule (unchanged): non-admins only see announcements that are not Completed.
const PUBLIC_FILTER = { status: { $ne: "Completed" } };

const isAdmin = (req) => req.user?.role === "admin";

const uploadImage = async (file) => {
  if (!file?.buffer) return undefined;
  try {
    return await uploadToImageKit(file, "announcements");
  } catch {
    throw new ApiError(502, "Image upload failed. Please try again.", "UPLOAD_FAILED");
  }
};

// Allowlisted fields (seenBy etc. can never be set from the body).
const parseAnnouncement = (b = {}, { partial = false } = {}) => {
  const out = {};
  if (!partial || b.title !== undefined) out.title = trimmedString(b.title, "title", { max: 200 });
  if (!partial || b.description !== undefined) out.description = trimmedString(b.description, "description", { max: 5000 });
  if (!partial || b.type !== undefined) out.type = requireEnum(b.type, TYPES, "type");
  if (!partial || b.date !== undefined) out.date = trimmedString(b.date, "date", { max: 50 });
  if (!partial || b.venue !== undefined) out.venue = trimmedString(b.venue, "venue", { max: 300 });
  if (b.status !== undefined && b.status !== "") out.status = requireEnum(b.status, STATUSES, "status");
  return out;
};

// Non-admins only learn whether *they* have seen an announcement; the list of
// other viewers is not exposed. `seenBy` keeps its array shape for the web.
const forViewer = (req, doc) => {
  const a = doc.toObject ? doc.toObject() : { ...doc };
  const me = String(req.user._id);
  const seen = (a.seenBy || []).some((id) => String(id) === me);
  if (!isAdmin(req)) a.seenBy = seen ? [req.user._id] : [];
  a.seen = seen;
  return a;
};

/* POST /api/announcements/add (admin) */
export const addAnnouncement = asyncHandler(async (req, res) => {
  if (!isAdmin(req)) throw forbidden("Admin only");
  const data = parseAnnouncement(req.body);
  const imageUrl = (await uploadImage(req.file)) || "";
  const announcement = await Announcement.create({ ...data, image: imageUrl, seenBy: [] });
  res.status(201).json({ success: true, message: "Announcement added", announcement });
});

/* GET /api/announcements (admin) */
export const getAnnouncements = asyncHandler(async (req, res) => {
  if (!isAdmin(req)) throw forbidden("Admin only");
  const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(500);
  res.json({ success: true, announcements });
});

/* GET /api/announcements/public (all roles) */
export const getPublicAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await Announcement.find(PUBLIC_FILTER).sort({ createdAt: -1 }).limit(200);
  res.json({ success: true, announcements: announcements.map((a) => forViewer(req, a)) });
});

/* PUT /api/announcements/:id/read (any role) — only adds the caller to seenBy */
export const markAsRead = asyncHandler(async (req, res) => {
  requireObjectId(req.params.id, "announcement id");
  const filter = { _id: req.params.id, ...(isAdmin(req) ? {} : PUBLIC_FILTER) };
  const updated = await Announcement.findOneAndUpdate(filter, { $addToSet: { seenBy: req.user._id } }, { new: true });
  if (!updated) throw notFound("Announcement not found");
  res.status(200).json({ success: true, message: "Marked as read", announcementId: updated._id, seen: true });
});

/* DELETE /api/announcements/:id (admin) */
export const deleteAnnouncement = asyncHandler(async (req, res) => {
  if (!isAdmin(req)) throw forbidden("Admin only");
  requireObjectId(req.params.id, "announcement id");
  const deleted = await Announcement.findByIdAndDelete(req.params.id);
  if (!deleted) throw notFound("Announcement not found");
  res.json({ success: true, message: "Announcement deleted" });
});

/* GET /api/announcements/:id (admin: any; others: only publicly visible ones) */
export const getAnnouncementById = asyncHandler(async (req, res) => {
  requireObjectId(req.params.id, "announcement id");
  const filter = { _id: req.params.id, ...(isAdmin(req) ? {} : PUBLIC_FILTER) };
  const announcement = await Announcement.findOne(filter);
  if (!announcement) throw notFound("Announcement not found");
  res.json({ success: true, announcement: forViewer(req, announcement) });
});

/* PUT /api/announcements/:id (admin) */
export const updateAnnouncement = asyncHandler(async (req, res) => {
  if (!isAdmin(req)) throw forbidden("Admin only");
  requireObjectId(req.params.id, "announcement id");
  const updateData = parseAnnouncement(req.body, { partial: true });
  const image = await uploadImage(req.file);
  if (image) updateData.image = image;

  const updated = await Announcement.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true, runValidators: true });
  if (!updated) throw notFound("Announcement not found");
  res.json({ success: true, message: "Announcement updated", announcement: updated });
});

import Holiday from "../models/Holiday.js";
import { asyncHandler, notFound } from "../middleware/errorHandler.js";
import { requireObjectId, trimmedString, requireYmd } from "../utils/validate.js";
import { businessDate, addDays } from "../utils/orgTime.js";

// Holidays are calendar dates. New ones are stored as UTC midnight of the
// YYYY-MM-DD; their business date is evaluated in ORG_TIMEZONE.
const withStatus = (h, todayYmd) => {
  const ymd = businessDate(h.date);
  return { ...h, ymd, status: ymd < todayYmd ? "Past" : "Upcoming" };
};

/* POST /api/holiday/add (admin) body { title, date: "YYYY-MM-DD" } */
const addHoliday = asyncHandler(async (req, res) => {
  const title = trimmedString(req.body?.title, "title", { max: 200 });
  const rawDate = typeof req.body?.date === "string" ? req.body.date.trim().slice(0, 10) : req.body?.date;
  const ymd = requireYmd(rawDate, "date");
  const holiday = await Holiday.create({ title, date: new Date(`${ymd}T00:00:00Z`) });
  return res.status(201).json({ success: true, holiday });
});

/* DELETE /api/holiday/:id (admin) */
const deleteHoliday = asyncHandler(async (req, res) => {
  requireObjectId(req.params.id, "holiday id");
  const deleted = await Holiday.findByIdAndDelete(req.params.id);
  if (!deleted) throw notFound("Holiday not found");
  return res.status(200).json({ success: true, message: "Holiday deleted successfully" });
});

/* GET /api/holiday/all (any authenticated role) */
const getAllHolidays = asyncHandler(async (req, res) => {
  const holidays = await Holiday.find().sort({ date: 1 }).lean();
  const todayYmd = businessDate(new Date());
  return res.status(200).json({ success: true, holidays: holidays.map((h) => withStatus(h, todayYmd)) });
});

/* GET /api/holiday/upcoming (any authenticated role) */
const getUpcomingHolidays = asyncHandler(async (req, res) => {
  const todayYmd = businessDate(new Date());
  // Widen the DB window by a day so holidays stored at local midnight are not missed.
  const lowerBound = new Date(`${addDays(todayYmd, -1)}T00:00:00Z`);
  const holidays = await Holiday.find({ date: { $gte: lowerBound } }).sort({ date: 1 }).lean();
  return res.status(200).json({
    success: true,
    holidays: holidays.map((h) => withStatus(h, todayYmd)).filter((h) => h.ymd >= todayYmd),
  });
});

export { addHoliday, deleteHoliday, getAllHolidays, getUpcomingHolidays };

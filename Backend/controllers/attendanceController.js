import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import { asyncHandler, badRequest, notFound } from "../middleware/errorHandler.js";
import { requireObjectId, requireYmd, trimmedString } from "../utils/validate.js";
import { ORG_TIMEZONE, businessDate, addDays } from "../utils/orgTime.js";
import { NOMINAL_HOURS } from "../utils/attendanceStatus.js";
import { closeAttendanceDay } from "../utils/attendanceCron.js";
import { now as clockNow } from "../services/clock.js";
import { getEmployeeForUser, resolveEmployeeForCaller } from "../services/employeeScope.js";
import { readIdempotencyKey, withIdempotency } from "../services/idempotency.js";
import {
  applyPunch,
  getTodayRecord,
  buildMonthlyAttendance,
  buildTodayList,
  buildTodaySummary,
  buildReport,
  MAX_REPORT_SPAN_DAYS,
} from "../services/attendanceService.js";

/* ================= QUERY PARSING ================= */
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

// Accepts ?month=YYYY-MM, or legacy ?month=M&year=YYYY. Defaults to the current business month.
const parseMonthQuery = (query, now) => {
  const { month, year } = query || {};
  if (month === undefined && year === undefined) {
    const [y, m] = businessDate(now).split("-").map(Number);
    return { year: y, month: m };
  }
  if (typeof month === "string" && MONTH_RE.test(month) && year === undefined) {
    const [, y, m] = month.match(MONTH_RE);
    return { year: Number(y), month: Number(m) };
  }
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(y) || y < 2000 || y > 2100 ||
      !/^\d{1,2}$/.test(String(month)) || !/^\d{4}$/.test(String(year))) {
    throw badRequest("month must be YYYY-MM (or month=1-12 with year=YYYY)");
  }
  return { year: y, month: m };
};

/* ================= GET ATTENDANCE (ADMIN, TODAY) ================= */
const getAttendance = asyncHandler(async (req, res) => {
  const now = clockNow();
  const { attendance, isOffDay, reason, businessDate: date } = await buildTodayList({ now });
  return res.json({ success: true, attendance, isOffDay, reason, businessDate: date, timezone: ORG_TIMEZONE });
});

/* ================= ADMIN TODAY SUMMARY ================= */
const getAdminTodaySummary = asyncHandler(async (req, res) => {
  const summary = await buildTodaySummary({ now: clockNow(), timezone: ORG_TIMEZONE });
  return res.json({ success: true, ...summary });
});

/* ================= ATTENDANCE REPORT (ADMIN) ================= */
const attendanceReport = asyncHandler(async (req, res) => {
  const now = clockNow();
  const { date, search, month, year, from, to } = req.query;
  const searchText = trimmedString(search, "search", { max: 100, optional: true });

  let startDate;
  let endDate;
  if (month !== undefined || year !== undefined) {
    const { year: y, month: m } = parseMonthQuery({ month, year }, now);
    const mm = String(m).padStart(2, "0");
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    startDate = `${y}-${mm}-01`;
    endDate = `${y}-${mm}-${String(last).padStart(2, "0")}`;
  } else if (date !== undefined) {
    startDate = endDate = requireYmd(date, "date");
  } else if (from !== undefined || to !== undefined) {
    startDate = requireYmd(from, "from");
    endDate = requireYmd(to, "to");
  }
  if (startDate && endDate) {
    if (endDate < startDate) throw badRequest("End date must be on or after start date");
    if (startDate < addDays(endDate, -(MAX_REPORT_SPAN_DAYS - 1))) {
      throw badRequest(`Date range must not exceed ${MAX_REPORT_SPAN_DAYS} days`);
    }
  }

  const { groupData, holidayMap, from: f, to: t } = await buildReport({ startDate, endDate, search: searchText, now });
  return res.json({ success: true, groupData, holidayMap, from: f, to: t });
});

/* ================= PUNCH TRANSITIONS (EMPLOYEE) ================= */
const punch = (action) =>
  asyncHandler(async (req, res) => {
    const key = readIdempotencyKey(req);
    const employee = await getEmployeeForUser(req.user._id);
    const result = await withIdempotency(
      { userId: req.user._id, key, scope: `attendance:${action}` },
      async () => {
        const now = clockNow();
        const r = await applyPunch(action, { employee, now });
        return {
          status: 200,
          body: {
            success: true,
            attendance: r.attendance,
            alreadyApplied: r.alreadyApplied,
            serverTime: now.toISOString(),
            businessDate: r.date,
            timezone: ORG_TIMEZONE,
          },
        };
      }
    );
    if (result.replayed) res.set("Idempotent-Replayed", "true");
    return res.status(result.status).json(result.body);
  });

const checkIn = punch("check-in");
const checkOut = punch("check-out");
const pauseAttendance = punch("pause");
const resumeAttendance = punch("resume");

/* ================= GET MY TODAY ATTENDANCE ================= */
const getMyTodayAttendance = asyncHandler(async (req, res) => {
  const now = clockNow();
  const employee = await getEmployeeForUser(req.user._id);
  const { attendance, date } = await getTodayRecord(employee._id, now);
  return res.json({
    success: true,
    attendance: attendance || null,
    serverTime: now.toISOString(),
    businessDate: date,
    timezone: ORG_TIMEZONE,
  });
});

/* ================= MONTHLY ATTENDANCE ================= */
const sendMonthly = async (res, employee, query) => {
  const now = clockNow();
  const { year, month } = parseMonthQuery(query, now);
  const { attendance, todayStr } = await buildMonthlyAttendance({ employee, year, month, now });
  return res.json({
    success: true,
    attendance,
    month: `${year}-${String(month).padStart(2, "0")}`,
    businessDate: todayStr,
    timezone: ORG_TIMEZONE,
  });
};

// GET /attendance/me/monthly?month=YYYY-MM (employee, own)
const getMyMonthlyAttendance = asyncHandler(async (req, res) => {
  const employee = await getEmployeeForUser(req.user._id);
  return sendMonthly(res, employee, req.query);
});

// GET /attendance/user/:userId/monthly (admin any; employee only self). `:userId` may be a
// User._id or an Employee._id (legacy).
const getUserMonthlyAttendance = asyncHandler(async (req, res) => {
  const employee = await resolveEmployeeForCaller(req, req.params.userId, "userId");
  return sendMonthly(res, employee, req.query);
});

/* ================= UPDATE ATTENDANCE (ADMIN MANUAL STATUS) ================= */
// The web sends "Halfday" for Half Day; accept common spellings.
const STATUS_ALIASES = {
  present: "Present",
  "half day": "Half Day",
  halfday: "Half Day",
  "half-day": "Half Day",
  half_day: "Half Day",
  absent: "Absent",
  leave: "Leave",
};

const normalizeAdminStatus = (raw) => {
  if (typeof raw !== "string") throw badRequest("status is required");
  const status = STATUS_ALIASES[raw.trim().toLowerCase()];
  if (!status) throw badRequest("status must be one of: Present, Half Day, Absent, Leave");
  return status;
};

const updateAttendance = asyncHandler(async (req, res) => {
  const employeeId = requireObjectId(req.params.employeeId, "employeeId");
  const status = normalizeAdminStatus(req.body?.status);
  const now = clockNow();
  const today = businessDate(now);
  const date = req.body?.date === undefined || req.body?.date === null || req.body?.date === ""
    ? today
    : requireYmd(req.body.date, "date");
  if (date > today) throw badRequest("date cannot be in the future");

  const employee = await Employee.findById(employeeId).select("_id");
  if (!employee) throw notFound("Employee not found");

  const set = {
    status,
    workedHours: NOMINAL_HOURS[status],
    source: "admin",
    hoursSource: "admin",
    updatedBy: req.user._id,
    adminUpdatedAt: now,
  };
  if (status === "Absent" || status === "Leave") {
    // Original behaviour: clearing to Absent/Leave removes the punch session.
    Object.assign(set, { checkIn: null, checkOut: null, isPaused: false, pauseStartedAt: null, totalPausedMs: 0 });
  }

  let attendance;
  try {
    attendance = await Attendance.findOneAndUpdate(
      { employeeId: employee._id, date },
      { $set: set },
      { upsert: true, returnDocument: "after" }
    );
  } catch (err) {
    if (err?.code !== 11000) throw err;
    attendance = await Attendance.findOneAndUpdate({ employeeId: employee._id, date }, { $set: set }, { returnDocument: "after" });
  }
  await attendance.populate({
    path: "employeeId",
    populate: [{ path: "userId", select: "name email profileImage isActive" }, { path: "department", select: "dep_name" }],
  });
  return res.json({ success: true, attendance });
});

/* ================= SCHEDULED JOB ================= */
const runCloseDayJob = asyncHandler(async (req, res) => {
  const result = await closeAttendanceDay({ now: clockNow() });
  return res.json({ success: true, job: "close-day", ...result });
});

export {
  getAttendance,
  getAdminTodaySummary,
  checkIn,
  checkOut,
  pauseAttendance,
  resumeAttendance,
  getMyTodayAttendance,
  getMyMonthlyAttendance,
  getUserMonthlyAttendance,
  attendanceReport,
  updateAttendance,
  runCloseDayJob,
};

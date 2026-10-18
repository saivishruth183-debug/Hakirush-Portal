import crypto from "node:crypto";
import cron from "node-cron";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import { ORG_TIMEZONE, businessDate, addDays, eachDate } from "./orgTime.js";
import { NOMINAL_HOURS } from "./attendanceStatus.js";
import {
  storedDateToYmd,
  loadHolidayMap,
  loadApprovedLeaves,
  leaveOn,
  isWorkingDay,
} from "../services/businessCalendar.js";

export const DEFAULT_LOOKBACK_DAYS = 7;
const MAX_LOOKBACK_DAYS = 31;

/**
 * Idempotent day-close job. Safe to run any number of times (in-process cron,
 * Vercel Cron, manual trigger); repeated runs never create duplicates.
 *
 * 1. Open check-ins from previous business days (checkIn set, checkOut null,
 *    no explicit Present/Half Day/Leave status) are closed: an employee who checked in
 *    showed up to work, so they are marked Present with nominal hours (8h).
 * 2. For each of the previous `lookbackDays` business days that is a working
 *    day (not weekend/holiday), every active employee (joined on/before that
 *    day, not on approved leave) without a record gets an Absent record.
 *    Upserts on the unique {employeeId, date} index => no duplicates.
 */
export const closeAttendanceDay = async ({ now = new Date(), lookbackDays = DEFAULT_LOOKBACK_DAYS } = {}) => {
  const lookback = Math.min(MAX_LOOKBACK_DAYS, Math.max(1, Math.floor(Number(lookbackDays) || DEFAULT_LOOKBACK_DAYS)));
  const today = businessDate(now);
  const from = addDays(today, -lookback);
  const to = addDays(today, -1);

  // 1) Close stale open sessions: mark as Present (8h).
  const closed = await Attendance.updateMany(
    {
      checkIn: { $ne: null },
      checkOut: null,
      date: { $lt: today },
      status: { $nin: ["Present", "Half Day", "Leave"] },
      autoClosedAt: null,
    },
    {
      $set: {
        status: "Present",
        workedHours: NOMINAL_HOURS.Present,
        isPaused: false,
        pauseStartedAt: null,
        totalPausedMs: 0,
        source: "system",
        autoClosedAt: now,
      },
    }
  );

  // Auto-heal any past open check-in sessions that were previously closed as Absent
  await Attendance.updateMany(
    {
      checkIn: { $ne: null },
      checkOut: null,
      date: { $lt: today },
      status: "Absent",
    },
    {
      $set: {
        status: "Present",
        workedHours: NOMINAL_HOURS.Present,
      },
    }
  );

  // 2) Absent records for missed working days.
  const [holidayMap, leaves, employees] = await Promise.all([
    loadHolidayMap(from, to),
    loadApprovedLeaves(from, to),
    Employee.find().select("_id userId dateOfJoining").populate("userId", "isActive"),
  ]);
  const active = employees.filter((e) => e.userId && e.userId.isActive !== false);

  const ops = [];
  for (const date of eachDate(from, to)) {
    if (!isWorkingDay(date, holidayMap)) continue;
    for (const emp of active) {
      const joined = storedDateToYmd(emp.dateOfJoining);
      if (joined && date < joined) continue;
      if (leaveOn(leaves, emp._id, date)) continue;
      ops.push({
        updateOne: {
          filter: { employeeId: emp._id, date },
          update: {
            $setOnInsert: {
              status: "Absent",
              checkIn: null,
              checkOut: null,
              workedHours: 0,
              isPaused: false,
              pauseStartedAt: null,
              totalPausedMs: 0,
              source: "system",
            },
          },
          upsert: true,
        },
      });
    }
  }

  let absentCreated = 0;
  if (ops.length) {
    try {
      const res = await Attendance.bulkWrite(ops, { ordered: false });
      absentCreated = res.upsertedCount || 0;
    } catch (err) {
      // A concurrent run may win some upserts (duplicate key): count what we inserted.
      if (err?.code !== 11000 && !err?.writeErrors) throw err;
      absentCreated = err?.result?.upsertedCount ?? err?.result?.nUpserted ?? 0;
    }
  }

  return {
    businessDate: today,
    range: { from, to },
    closedOpenSessions: closed.modifiedCount || 0,
    absentCreated,
    employeesConsidered: active.length,
  };
};

/* ================= HTTP GUARD FOR THE JOB ENDPOINT ================= */
const MIN_SECRET_LENGTH = 16;
const digest = (v) => crypto.createHash("sha256").update(String(v)).digest();

/**
 * `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends when CRON_SECRET is set).
 * - CRON_SECRET unset or shorter than 16 chars => endpoint disabled (503 JOB_DISABLED).
 * - Missing/wrong bearer => 401.
 */
export const requireCronSecret = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    return res.status(503).json({ success: false, error: "Scheduled job endpoint is disabled", code: "JOB_DISABLED" });
  }
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !crypto.timingSafeEqual(digest(token), digest(secret))) {
    return res.status(401).json({ success: false, error: "Authentication required", code: "AUTH_REQUIRED" });
  }
  return next();
};

/* ================= IN-PROCESS SCHEDULE (long-lived hosts only) ================= */
let task = null;

import { runCelebrationsJob } from "../services/celebrationCron.js";

const startAttendanceCron = () => {
  if (task) return task;
  // 00:30 every day in the organization timezone.
  task = cron.schedule(
    "30 0 * * *",
    async () => {
      try {
        const result = await closeAttendanceDay({ now: new Date() });
        console.log(
          `[CRON] close-day ${result.businessDate}: closed=${result.closedOpenSessions} absentCreated=${result.absentCreated}`
        );
      } catch (error) {
        console.error("[CRON ERROR] close-day failed:", error?.message);
      }

      try {
        const celebResult = await runCelebrationsJob({ now: new Date() });
        console.log(
          `[CRON] celebrations ${celebResult.date}: birthdays=${celebResult.birthdays?.length || 0} anniversaries=${celebResult.anniversaries?.length || 0}`
        );
      } catch (celebError) {
        console.error("[CRON ERROR] celebrations failed:", celebError?.message);
      }
    },
    { timezone: ORG_TIMEZONE, name: "attendance-close-day", noOverlap: true }
  );
  return task;
};

export { startAttendanceCron };
export default startAttendanceCron;

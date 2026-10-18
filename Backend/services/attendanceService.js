// Attendance domain logic: punch state machine, monthly/today views, admin report.
//
// Punch transitions are atomic, state-guarded updates (findOneAndUpdate with
// preconditions), so concurrent requests or two devices produce exactly one
// valid transition. Repeats are idempotent and report `alreadyApplied: true`.
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import { conflict } from "../middleware/errorHandler.js";
import { businessDate, eachDate, addDays } from "../utils/orgTime.js";
import {
  buildAttendanceForEmployee,
  getStatusFromHours,
  isIncompleteCheckout,
  msToHours,
  pausedMsAt,
} from "../utils/attendanceStatus.js";
import {
  storedDateToYmd,
  loadHolidayMap,
  loadApprovedLeaves,
  leaveOn,
  offDayReason,
  dayTypeOf,
} from "./businessCalendar.js";

const AFTER = { returnDocument: "after" };
const MAX_CAS_ATTEMPTS = 5;

export const PUNCH_ACTIONS = ["check-in", "pause", "resume", "check-out"];

const plain = (doc) => (doc && typeof doc.toObject === "function" ? doc.toObject() : doc ?? null);

const invalidTransition = (message, attendance, now) =>
  conflict(message, "INVALID_TRANSITION", {
    attendance: plain(attendance),
    serverTime: now.toISOString(),
  });

const findDay = (employeeId, date) => Attendance.findOne({ employeeId, date });

// Create the day's placeholder record if missing (safe under concurrency:
// the unique {employeeId, date} index rejects a second insert).
const ensureDayRecord = async (employeeId, date) => {
  try {
    await Attendance.updateOne(
      { employeeId, date },
      { $setOnInsert: { checkIn: null, checkOut: null, workedHours: 0, status: "", isPaused: false, pauseStartedAt: null, totalPausedMs: 0 } },
      { upsert: true }
    );
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }
};

/* ================= CHECK-IN ================= */
const checkIn = async ({ employee, now }) => {
  const date = businessDate(now);
  await ensureDayRecord(employee._id, date);
  const updated = await Attendance.findOneAndUpdate(
    { employeeId: employee._id, date, checkIn: null, checkOut: null },
    {
      $set: {
        checkIn: now,
        isPaused: false,
        pauseStartedAt: null,
        totalPausedMs: 0,
        workedHours: 0,
        // A live punch session supersedes a placeholder/pre-filled status;
        // the final status is computed at check-out.
        status: "",
        source: "punch",
        hoursSource: null,
      },
    },
    AFTER
  );
  if (updated) return { attendance: updated, alreadyApplied: false, date };

  const current = await findDay(employee._id, date);
  if (current?.checkIn) return { attendance: current, alreadyApplied: true, date };
  throw invalidTransition("Check-in is not possible for today's attendance record", current, now);
};

/* ================= PAUSE ================= */
const pause = async ({ employee, now }) => {
  const date = businessDate(now);
  const updated = await Attendance.findOneAndUpdate(
    { employeeId: employee._id, date, checkIn: { $ne: null }, checkOut: null, isPaused: { $ne: true } },
    { $set: { isPaused: true, pauseStartedAt: now } },
    AFTER
  );
  if (updated) return { attendance: updated, alreadyApplied: false, date };

  const current = await findDay(employee._id, date);
  if (current?.checkIn && !current.checkOut && current.isPaused) {
    // Repeat pause: keep the original pauseStartedAt.
    return { attendance: current, alreadyApplied: true, date };
  }
  const reason = !current?.checkIn ? "Check-in required before pausing" : "Already checked out";
  throw invalidTransition(reason, current, now);
};

/* ================= RESUME ================= */
const resume = async ({ employee, now }) => {
  const date = businessDate(now);
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await findDay(employee._id, date);
    if (!current?.checkIn) throw invalidTransition("Check-in required before resuming", current, now);
    if (current.checkOut) throw invalidTransition("Already checked out", current, now);
    if (!current.isPaused) {
      // Repeat resume (or not paused): nothing to add, never double counts.
      return { attendance: current, alreadyApplied: true, date };
    }
    const startedAt = current.pauseStartedAt ? new Date(current.pauseStartedAt) : now;
    const pausedMs = Math.max(0, now.getTime() - startedAt.getTime());
    const updated = await Attendance.findOneAndUpdate(
      {
        _id: current._id,
        checkOut: null,
        isPaused: true,
        pauseStartedAt: current.pauseStartedAt ?? null,
      },
      { $inc: { totalPausedMs: pausedMs }, $set: { isPaused: false, pauseStartedAt: null } },
      AFTER
    );
    if (updated) return { attendance: updated, alreadyApplied: false, date };
  }
  const current = await findDay(employee._id, date);
  if (current?.checkIn && !current.checkOut && !current.isPaused) {
    return { attendance: current, alreadyApplied: true, date };
  }
  throw invalidTransition("Attendance changed concurrently; please retry", current, now);
};

/* ================= CHECK-OUT ================= */
const checkOut = async ({ employee, now }) => {
  const date = businessDate(now);
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    const current = await findDay(employee._id, date);
    if (!current?.checkIn) throw invalidTransition("Check-in required", current, now);
    if (current.checkOut) {
      // Repeat check-out: keep the original checkOut.
      return { attendance: current, alreadyApplied: true, date };
    }
    const totalPausedMs = pausedMsAt(current, now);
    const workedMs = Math.max(0, now.getTime() - new Date(current.checkIn).getTime() - totalPausedMs);
    const workedHours = msToHours(workedMs);
    const overtimeHours = workedHours > 8 ? Math.round((workedHours - 8) * 100) / 100 : 0;
    const updated = await Attendance.findOneAndUpdate(
      {
        _id: current._id,
        checkOut: null,
        isPaused: current.isPaused ? true : { $ne: true },
        pauseStartedAt: current.pauseStartedAt ?? null,
        // Hydrated docs default a missing field to 0, so 0 must also match "missing".
        totalPausedMs: current.totalPausedMs ? current.totalPausedMs : { $in: [0, null] },
      },
      {
        $set: {
          checkOut: now,
          isPaused: false,
          pauseStartedAt: null,
          totalPausedMs,
          workedHours,
          overtimeHours,
          status: getStatusFromHours(workedHours),
          source: "punch",
          hoursSource: "punch",
        },
      },
      AFTER
    );
    if (updated) return { attendance: updated, alreadyApplied: false, date };
  }
  const current = await findDay(employee._id, date);
  if (current?.checkOut) return { attendance: current, alreadyApplied: true, date };
  throw invalidTransition("Attendance changed concurrently; please retry", current, now);
};

const TRANSITIONS = { "check-in": checkIn, pause, resume, "check-out": checkOut };

export const applyPunch = (action, ctx) => {
  const fn = TRANSITIONS[action];
  if (!fn) throw new Error(`Unknown punch action ${action}`);
  return fn(ctx);
};

export const getTodayRecord = async (employeeId, now) => {
  const date = businessDate(now);
  const attendance = await findDay(employeeId, date);
  return { attendance, date };
};

/* ================= VIEWS ================= */

const finalizeDay = (built, { ymd, employeeId, holidayMap }) => {
  const out = { ...built };
  if (!out._id) out.date = ymd; // synthesized entries carry the day they describe
  out.employeeId = employeeId;
  out.dayType = dayTypeOf(ymd, holidayMap);
  const holidayName = holidayMap.get(ymd);
  if (holidayName) out.holidayName = holidayName;
  return out;
};

export const monthRange = (year, month) => {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
};

/**
 * One entry per day of the month up to today (org timezone), from the joining
 * date on. Same rules as utils/attendanceStatus.buildAttendanceForEmployee:
 * approved leave => Leave; existing record => as stored (a past open check-in
 * => Absent); missing record => Holiday on weekends/holidays, else Absent.
 */
export const buildMonthlyAttendance = async ({ employee, year, month, now }) => {
  const { start, end } = monthRange(year, month);
  const todayStr = businessDate(now);
  const joinStr = storedDateToYmd(employee.dateOfJoining);

  const [records, holidayMap, leaves] = await Promise.all([
    Attendance.find({ employeeId: employee._id, date: { $gte: start, $lte: end } }).sort({ date: 1 }).lean(),
    loadHolidayMap(start, end),
    loadApprovedLeaves(start, end, [employee._id]),
  ]);
  const byDate = new Map(records.map((r) => [r.date, r]));

  const attendance = [];
  for (const ymd of eachDate(start, end)) {
    if (ymd > todayStr) break;
    if (joinStr && ymd < joinStr) continue;
    const leave = leaveOn(leaves, employee._id, ymd);
    const built = buildAttendanceForEmployee({
      employee: { _id: employee._id },
      record: byDate.get(ymd) || null,
      isOffDay: Boolean(offDayReason(ymd, holidayMap)),
      leaveByEmployeeId: leave ? new Map([[String(employee._id), leave]]) : new Map(),
      todayStr,
    });
    attendance.push(finalizeDay(built, { ymd, employeeId: employee._id, holidayMap }));
  }
  return { attendance, start, end, todayStr };
};

const EMPLOYEE_USER_FIELDS = "name email profileImage isActive";

const activeOnly = (employees) => employees.filter((e) => e.userId && e.userId.isActive !== false);

/**
 * Admin "today" list (org timezone). Active employees only.
 */
export const buildTodayList = async ({ now }) => {
  const todayStr = businessDate(now);
  const [holidayMap, employeesAll, records, leaves] = await Promise.all([
    loadHolidayMap(todayStr, todayStr),
    Employee.find().populate("userId", EMPLOYEE_USER_FIELDS).populate("department", "dep_name"),
    Attendance.find({ date: todayStr }).lean(),
    loadApprovedLeaves(todayStr, todayStr),
  ]);
  const reason = offDayReason(todayStr, holidayMap);
  const isOffDay = Boolean(reason);
  const employees = activeOnly(employeesAll);
  const recordByEmp = new Map(records.map((r) => [String(r.employeeId), r]));

  const leaveByEmployeeId = new Map();
  for (const emp of employees) {
    const leave = leaveOn(leaves, emp._id, todayStr);
    if (leave) leaveByEmployeeId.set(String(emp._id), leave);
  }

  const attendance = employees.map((emp) => {
    const built = buildAttendanceForEmployee({
      employee: emp,
      record: recordByEmp.get(String(emp._id)) || null,
      isOffDay,
      leaveByEmployeeId,
      todayStr,
    });
    return { ...built, employeeId: emp };
  });

  return { attendance, isOffDay, reason: reason || "", businessDate: todayStr };
};

const hourInTz = (instant, tz) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date(instant)));

export const LATE_LOGIN_HOUR = 10; // check-in at/after 10:00 org time counts as late (original rule)

/**
 * Admin today summary (same counting rules as the original endpoint, but in
 * the org timezone and for active employees only).
 */
export const buildTodaySummary = async ({ now, timezone }) => {
  const todayStr = businessDate(now);
  const holidayMap = await loadHolidayMap(todayStr, todayStr);
  const reason = offDayReason(todayStr, holidayMap);
  if (reason) {
    return {
      isHoliday: true,
      holidayName: reason,
      presentToday: 0,
      activeToday: 0,
      halfDayToday: 0,
      onLeaveToday: 0,
      absentToday: 0,
      lateLogins: 0,
      businessDate: todayStr,
    };
  }

  const employees = activeOnly(await Employee.find().populate("userId", "isActive"));
  const activeIds = new Set(employees.map((e) => String(e._id)));
  const [records, leaves] = await Promise.all([
    Attendance.find({ date: todayStr }).lean(),
    loadApprovedLeaves(todayStr, todayStr),
  ]);
  const attendance = records.filter((a) => activeIds.has(String(a.employeeId)));
  const onLeave = new Set([...activeIds].filter((id) => leaveOn(leaves, id, todayStr)));
  const presentIds = new Set(attendance.filter((a) => a.checkIn).map((a) => String(a.employeeId)));

  const absentToday = [...activeIds].filter((id) => !presentIds.has(id) && !onLeave.has(id)).length;
  const halfDayToday = attendance.filter(
    (a) => a.status === "Half Day" || (a.workedHours && a.workedHours >= 4 && a.workedHours < 8)
  ).length;
  const presentToday =
    attendance.filter((a) => a.status === "Present" || (a.checkIn && a.workedHours >= 8)).length || presentIds.size;

  return {
    presentToday,
    activeToday: presentToday,
    halfDayToday,
    onLeaveToday: onLeave.size,
    absentToday,
    lateLogins: attendance.filter((a) => a.checkIn && hourInTz(a.checkIn, timezone) >= LATE_LOGIN_HOUR).length,
    businessDate: todayStr,
  };
};

export const MAX_REPORT_SPAN_DAYS = 366;

/**
 * Admin attendance report grouped by date: { groupData: {date: rows[]}, holidayMap: {date: title} }.
 */
export const buildReport = async ({ startDate, endDate, search, now }) => {
  const todayStr = businessDate(now);
  const employeesAll = await Employee.find()
    .populate("userId", EMPLOYEE_USER_FIELDS)
    .populate("department", "dep_name");

  let from = startDate;
  const to = endDate || todayStr;
  if (!from) {
    // No range given: from the earliest joining date, bounded to the last year.
    const earliest = employeesAll.reduce((min, emp) => {
      const d = storedDateToYmd(emp.dateOfJoining);
      return d && (!min || d < min) ? d : min;
    }, null);
    const floor = addDays(to, -(MAX_REPORT_SPAN_DAYS - 1));
    from = earliest && earliest > floor ? earliest : floor;
  }
  if (from > to) return { groupData: {}, holidayMap: {}, from, to };

  const [records, holidayMap, leaves] = await Promise.all([
    Attendance.find({ date: { $gte: from, $lte: to } }).lean(),
    loadHolidayMap(from, to),
    loadApprovedLeaves(from, to),
  ]);
  const recordMap = new Map(records.map((r) => [`${r.date}|${String(r.employeeId)}`, r]));

  let employees = employeesAll.filter((e) => e.userId);
  if (search) {
    const keyword = search.toLowerCase();
    employees = employees.filter(
      (emp) =>
        emp.userId?.name?.toLowerCase().includes(keyword) ||
        emp.employeeId?.toLowerCase().includes(keyword)
    );
  }

  const groupData = {};
  for (const d of eachDate(from, to)) {
    groupData[d] = [];
    const isOffDay = Boolean(offDayReason(d, holidayMap));
    for (const emp of employees) {
      const joinDateStr = storedDateToYmd(emp.dateOfJoining) || todayStr;
      if (d < joinDateStr) continue;
      const record = recordMap.get(`${d}|${String(emp._id)}`) || null;
      // Deactivated employees appear only on days they have a real record.
      if (!record && emp.userId?.isActive === false) continue;
      const leave = leaveOn(leaves, emp._id, d);
      const built = buildAttendanceForEmployee({
        employee: { _id: emp._id },
        record,
        isOffDay,
        leaveByEmployeeId: leave ? new Map([[String(emp._id), leave]]) : new Map(),
        todayStr,
      });
      groupData[d].push({
        _id: built._id || null,
        date: d,
        employeeRecordId: emp._id,
        employeeId: emp.employeeId || "N/A",
        employeeName: emp.userId?.name || "Unknown",
        departmentName: emp.department?.dep_name || "N/A",
        // Legacy rule: a record without a status reads as Absent unless a punch session is open.
        status: built.status || (built.checkIn ? "" : "Absent"),
        workedHours: built.workedHours || 0,
        checkIn: built.checkIn || null,
        checkOut: built.checkOut || null,
        isPaused: Boolean(built.isPaused),
        pauseStartedAt: built.pauseStartedAt || null,
        totalPausedMs: built.totalPausedMs || 0,
      });
    }
  }

  return { groupData, holidayMap: Object.fromEntries(holidayMap), from, to };
};

export { isIncompleteCheckout };

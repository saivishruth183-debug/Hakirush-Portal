// Leave rules shared by the leave endpoints.
//
// Day calculation (same rule as the original backend and web form): inclusive
// working days between start and end, excluding Saturdays, Sundays and Holiday dates.
//
// Entitlement: 12 Casual + 12 Sick = 24 days (original constants). The
// entitlement period is an owner decision; the default is the calendar year of
// the current business date (LEAVE_ENTITLEMENT_PERIOD=calendar-year). Set
// LEAVE_ENTITLEMENT_PERIOD=all-time to reproduce the original behaviour
// (all approved leave ever). No carry-forward is applied.
import Leave from "../models/Leave.js";
import { businessDate } from "../utils/orgTime.js";
import { loadHolidayMap, countWorkingDays, storedDateToYmd, ymdToDate } from "./businessCalendar.js";

export const LEAVE_TYPES = ["Casual Leave", "Sick Leave"];
export const ENTITLEMENT = { "Casual Leave": 12, "Sick Leave": 12 };
export const TOTAL_ENTITLEMENT = ENTITLEMENT["Casual Leave"] + ENTITLEMENT["Sick Leave"]; // 24
export const MAX_LEAVE_SPAN_DAYS = 60; // calendar days per application

/* ===== Extra leave types (no Casual/Sick-style quota) =====
 * Change the numbers to suit your company policy. Keep the web form
 * (EmployeeLeaveAdd.jsx) constants in step with these.
 */
export const COMP_OFF = "Comp Off";
export const MATERNITY = "Maternity Leave";
export const PATERNITY = "Paternity Leave";
export const LOSS_OF_PAY = "Loss of Pay";
export const EXTRA_LEAVE_TYPES = [COMP_OFF, MATERNITY, PATERNITY, LOSS_OF_PAY];
export const ALL_LEAVE_TYPES = [...LEAVE_TYPES, ...EXTRA_LEAVE_TYPES];

export const MATERNITY_MAX_CALENDAR_DAYS = 182; // 26 weeks per application (overrides MAX_LEAVE_SPAN_DAYS)
export const PATERNITY_DAYS_PER_PERIOD = 15;    // working days per entitlement period
export const COMP_OFF_VALID_DAYS = 60;          // a worked weekend/holiday must be claimed within this many days

export const computeLeaveDays = async (startYmd, endYmd) => {
  const holidays = await loadHolidayMap(startYmd, endYmd);
  return countWorkingDays(startYmd, endYmd, holidays);
};

export const entitlementPeriod = (now) => {
  const basis = (process.env.LEAVE_ENTITLEMENT_PERIOD || "calendar-year").toLowerCase();
  if (basis === "all-time") return { basis: "all-time", start: null, end: null };
  const year = businessDate(now).slice(0, 4);
  return { basis: "calendar-year", start: `${year}-01-01`, end: `${year}-12-31` };
};

/**
 * Days used per leave type within the entitlement period. Leaves fully inside
 * the period count their stored server-computed `days`; a leave crossing the
 * period boundary counts only its working days inside the period.
 */
export const computeLeaveBalance = async (employeeId, now) => {
  const period = entitlementPeriod(now);
  const filter = { employeeId, status: "Approved" };
  if (period.start) {
    filter.startDate = { $lte: new Date(`${period.end}T23:59:59.999Z`) };
    filter.endDate = { $gte: ymdToDate(period.start) };
  }
  const leaves = await Leave.find(filter).select("leaveType startDate endDate days").lean();

  const used = { "Casual Leave": 0, "Sick Leave": 0 };
  let holidays = null;
  for (const leave of leaves) {
    if (!(leave.leaveType in used)) continue;
    const s = storedDateToYmd(leave.startDate);
    const e = storedDateToYmd(leave.endDate);
    if (period.start && s && e && (s < period.start || e > period.end)) {
      if (!holidays) holidays = await loadHolidayMap(period.start, period.end);
      const from = s < period.start ? period.start : s;
      const to = e > period.end ? period.end : e;
      used[leave.leaveType] += countWorkingDays(from, to, holidays);
    } else {
      used[leave.leaveType] += Number(leave.days) || 0;
    }
  }

  const casualUsed = used["Casual Leave"];
  const sickUsed = used["Sick Leave"];
  return {
    casual: { total: ENTITLEMENT["Casual Leave"], used: casualUsed, balance: ENTITLEMENT["Casual Leave"] - casualUsed },
    sick: { total: ENTITLEMENT["Sick Leave"], used: sickUsed, balance: ENTITLEMENT["Sick Leave"] - sickUsed },
    total: { total: TOTAL_ENTITLEMENT, used: casualUsed + sickUsed, balance: TOTAL_ENTITLEMENT - casualUsed - sickUsed },
    period,
  };
};

// Pending/Approved leave of the same employee overlapping [startYmd, endYmd].
export const findOverlappingLeave = (employeeId, startYmd, endYmd, excludeId = null) => {
  const filter = {
    employeeId,
    status: { $in: ["Pending", "Approved"] },
    startDate: { $lte: ymdToDate(endYmd) },
    endDate: { $gte: ymdToDate(startYmd) },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return Leave.findOne(filter).select("_id status startDate endDate leaveType").lean();
};

export const formatLeaveRange = (leave) =>
  `${storedDateToYmd(leave.startDate)} to ${storedDateToYmd(leave.endDate)}`;

/**
 * Usage of the extra leave types inside the same entitlement period as
 * Casual/Sick. Paternity counts Approved + Pending so two requests can't
 * book the same days twice.
 */
export const computeExtraBalances = async (employeeId, now) => {
  const period = entitlementPeriod(now);
  const filter = { employeeId, leaveType: { $in: EXTRA_LEAVE_TYPES }, status: { $in: ["Approved", "Pending"] } };
  if (period.start) {
    filter.startDate = { $lte: new Date(`${period.end}T23:59:59.999Z`) };
    filter.endDate = { $gte: ymdToDate(period.start) };
  }
  const rows = await Leave.find(filter).select("leaveType status days").lean();
  const sum = (type, statuses = ["Approved"]) =>
    rows.filter((r) => r.leaveType === type && statuses.includes(r.status)).reduce((n, r) => n + (Number(r.days) || 0), 0);

  const paternityUsed = sum(PATERNITY);
  const paternityHeld = sum(PATERNITY, ["Approved", "Pending"]);
  return {
    paternity: {
      total: PATERNITY_DAYS_PER_PERIOD,
      used: paternityUsed,
      pending: paternityHeld - paternityUsed,
      balance: Math.max(0, PATERNITY_DAYS_PER_PERIOD - paternityHeld),
    },
    maternity: { maxCalendarDays: MATERNITY_MAX_CALENDAR_DAYS, used: sum(MATERNITY) },
    compOff: { used: sum(COMP_OFF), validDays: COMP_OFF_VALID_DAYS },
    lossOfPay: { used: sum(LOSS_OF_PAY) },
  };
};
// Business-calendar helpers shared by attendance, leave and the day-close job.
// Working day = not Saturday/Sunday and not a Holiday (same rule the web
// leave form and the original backend used).
import Holiday from "../models/Holiday.js";
import Leave from "../models/Leave.js";
import { businessDate, isWeekend, weekdayOf, eachDate, addDays } from "../utils/orgTime.js";

// Stored calendar dates (Holiday.date, Leave.startDate/endDate) come from
// "YYYY-MM-DD" inputs and are saved as UTC midnight; read those back as the
// UTC calendar day. Any other instant is interpreted in the org timezone.
export const storedDateToYmd = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
  ) {
    return d.toISOString().slice(0, 10);
  }
  return businessDate(d);
};

export const ymdToDate = (ymd) => new Date(`${ymd}T00:00:00.000Z`);

// Map<YYYY-MM-DD, title> for holidays between two business dates (inclusive).
export const loadHolidayMap = async (fromYmd, toYmd) => {
  const filter = {};
  if (fromYmd && toYmd) {
    filter.date = {
      $gte: new Date(`${addDays(fromYmd, -1)}T00:00:00.000Z`),
      $lte: new Date(`${addDays(toYmd, 1)}T23:59:59.999Z`),
    };
  }
  const holidays = await Holiday.find(filter).select("title date").lean();
  const map = new Map();
  for (const h of holidays) {
    const ymd = storedDateToYmd(h.date);
    if (!ymd) continue;
    if (fromYmd && (ymd < fromYmd || ymd > toYmd)) continue;
    map.set(ymd, h.title);
  }
  return map;
};

export const isWorkingDay = (ymd, holidayMap) => !isWeekend(ymd) && !holidayMap.has(ymd);

export const countWorkingDays = (fromYmd, toYmd, holidayMap) =>
  fromYmd > toYmd ? 0 : eachDate(fromYmd, toYmd).filter((d) => isWorkingDay(d, holidayMap)).length;

// Off-day label (same wording as the original admin attendance screen), or null.
export const offDayReason = (ymd, holidayMap) => {
  if (holidayMap.has(ymd)) return holidayMap.get(ymd);
  if (isWeekend(ymd)) return weekdayOf(ymd) === 0 ? "Sunday (Weekend)" : "Saturday (Weekend)";
  return null;
};

export const dayTypeOf = (ymd, holidayMap) =>
  holidayMap.has(ymd) ? "holiday" : isWeekend(ymd) ? "weekend" : "working";

// Approved leaves overlapping [fromYmd, toYmd]; Map<employeeId, [{startYmd, endYmd, leave}]>.
export const loadApprovedLeaves = async (fromYmd, toYmd, employeeIds = null) => {
  const filter = {
    status: "Approved",
    startDate: { $lte: new Date(`${addDays(toYmd, 1)}T23:59:59.999Z`) },
    endDate: { $gte: new Date(`${addDays(fromYmd, -1)}T00:00:00.000Z`) },
  };
  if (employeeIds) filter.employeeId = { $in: employeeIds };
  const leaves = await Leave.find(filter).lean();
  const map = new Map();
  for (const leave of leaves) {
    const startYmd = storedDateToYmd(leave.startDate);
    const endYmd = storedDateToYmd(leave.endDate);
    if (!startYmd || !endYmd || endYmd < fromYmd || startYmd > toYmd) continue;
    const key = String(leave.employeeId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ startYmd, endYmd, leave });
  }
  return map;
};

export const leaveOn = (leavesByEmployee, employeeId, ymd) => {
  const list = leavesByEmployee.get(String(employeeId)) || [];
  const hit = list.find((l) => l.startYmd <= ymd && ymd <= l.endYmd);
  return hit ? hit.leave : null;
};

// Organization business-time helpers. Instants are stored as UTC Dates;
// business dates (YYYY-MM-DD) are derived in the organization timezone,
// never from the server's or the phone's local timezone.
// ORG_TIMEZONE defaults to Asia/Kolkata (provisional; confirm before release).
export const ORG_TIMEZONE = process.env.ORG_TIMEZONE || "Asia/Kolkata";

const ymdFormatter = (tz) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });

export const businessDate = (instant = new Date(), tz = ORG_TIMEZONE) =>
  ymdFormatter(tz).format(new Date(instant));

// Day of week (0=Sun..6=Sat) for a YYYY-MM-DD business date.
export const weekdayOf = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay();
export const isWeekend = (ymd) => {
  const d = weekdayOf(ymd);
  return d === 0 || d === 6;
};

export const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Inclusive list of YYYY-MM-DD between two business dates.
export const eachDate = (fromYmd, toYmd) => {
  const out = [];
  for (let d = fromYmd; d <= toYmd; d = addDays(d, 1)) out.push(d);
  return out;
};

// Month/day parts of a stored Date interpreted in org timezone (for birthdays etc.).
export const monthDayOf = (instant, tz = ORG_TIMEZONE) => {
  const [, m, d] = businessDate(instant, tz).split("-").map(Number);
  return { month: m, day: d };
};

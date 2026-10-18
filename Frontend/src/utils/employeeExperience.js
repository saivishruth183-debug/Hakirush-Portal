const toLocalDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const datePart = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  let date;
  if (datePart) {
    const [year, month, day] = datePart.slice(1).map(Number);
    date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  } else {
    date = new Date(value);
  }

  return Number.isNaN(date.getTime()) ? null : date;
};

const completedMonthsBetween = (start, end) => {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months--;
  return Math.max(0, months);
};

export const formatTotalExperience = (
  experienceAtJoining,
  dateOfJoining,
  { isActive, inactiveSince, inactiveDurationMs = 0 } = {},
  now = new Date()
) => {
  const parsedExperience = Number(experienceAtJoining);
  const previousMonths = Number.isFinite(parsedExperience) && parsedExperience > 0
    ? Math.round(parsedExperience * 12)
    : 0;
  const joined = toLocalDate(dateOfJoining);
  const pausedAt = isActive === false ? toLocalDate(inactiveSince) || joined : null;
  const elapsedUntil = pausedAt || now;
  const inactiveDuration = Number.isFinite(Number(inactiveDurationMs)) && Number(inactiveDurationMs) > 0
    ? Number(inactiveDurationMs)
    : 0;
  const adjustedJoinDate = joined ? new Date(joined.getTime() + inactiveDuration) : null;
  const elapsedMonths = adjustedJoinDate
    ? completedMonthsBetween(adjustedJoinDate, elapsedUntil)
    : 0;
  const totalMonths = previousMonths + elapsedMonths;

  if (!totalMonths) return joined && joined <= now ? "Joined this month" : "";

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return [
    years && `${years} yr${years === 1 ? "" : "s"}`,
    months && `${months} mo`,
  ].filter(Boolean).join(" ");
};

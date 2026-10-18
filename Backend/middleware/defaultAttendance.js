// Deprecated: this middleware used to insert placeholder Attendance rows on
// GET /api/attendance (with a misspelled `staus` field and a UTC date).
// Missing day records are now synthesized at read time by
// utils/attendanceStatus.buildAttendanceForEmployee, and Absent rows for past
// working days are written by the idempotent day-close job
// (utils/attendanceCron.closeAttendanceDay). Kept as a no-op so any stale
// import keeps working; it performs no writes.
const defaultAttendance = (req, res, next) => next();

export default defaultAttendance;

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth } from "./helpers/testEnv.js";
import { ensureDomainIndexes, setClock, setJoiningDates, ist } from "./helpers/domain.js";

let app, fx, Attendance, Holiday, Leave;

before(async () => {
  await startTestDb();
  app = await getApp();
  await ensureDomainIndexes();
  Attendance = (await import("../models/Attendance.js")).default;
  Holiday = (await import("../models/Holiday.js")).default;
  Leave = (await import("../models/Leave.js")).default;
});
after(async () => {
  await setClock(null);
  await stopTestDb();
});
beforeEach(async () => {
  await clearDb();
  fx = await seedFixtures();
  await setJoiningDates("2026-01-01");
  delete process.env.CRON_SECRET;
});

const post = (user, action, headers = {}) =>
  request(app).post(`/api/attendance/${action}`).set(auth(user)).set(headers).send({});

test("full journey: check-in -> pause -> resume -> check-out with pause accounting and idempotent repeats", async () => {
  const emp = fx.itDev1.user;

  await setClock(ist("2026-09-15 09:00"));
  const r1 = await post(emp, "check-in");
  assert.equal(r1.status, 200);
  assert.equal(r1.body.alreadyApplied, false);
  assert.equal(r1.body.businessDate, "2026-09-15");
  assert.equal(r1.body.timezone, "Asia/Kolkata");
  assert.equal(r1.body.serverTime, ist("2026-09-15 09:00").toISOString());
  assert.equal(r1.body.attendance.checkIn, ist("2026-09-15 09:00").toISOString());

  await setClock(ist("2026-09-15 11:00"));
  const p1 = await post(emp, "pause");
  assert.equal(p1.status, 200);
  assert.equal(p1.body.alreadyApplied, false);
  assert.equal(p1.body.attendance.isPaused, true);
  const pauseStartedAt = p1.body.attendance.pauseStartedAt;
  assert.equal(pauseStartedAt, ist("2026-09-15 11:00").toISOString());

  // Double pause keeps the original pauseStartedAt.
  await setClock(ist("2026-09-15 11:30"));
  const p2 = await post(emp, "pause");
  assert.equal(p2.status, 200);
  assert.equal(p2.body.alreadyApplied, true);
  assert.equal(p2.body.attendance.pauseStartedAt, pauseStartedAt);

  await setClock(ist("2026-09-15 11:45"));
  const res1 = await post(emp, "resume");
  assert.equal(res1.status, 200);
  assert.equal(res1.body.alreadyApplied, false);
  assert.equal(res1.body.attendance.isPaused, false);
  assert.equal(res1.body.attendance.totalPausedMs, 45 * 60 * 1000);

  // Double resume never double counts.
  await setClock(ist("2026-09-15 12:00"));
  const res2 = await post(emp, "resume");
  assert.equal(res2.status, 200);
  assert.equal(res2.body.alreadyApplied, true);
  assert.equal(res2.body.attendance.totalPausedMs, 45 * 60 * 1000);

  // 09:00 -> 17:45 = 8h45m elapsed, minus 45m paused = 8h => Present.
  await setClock(ist("2026-09-15 17:45"));
  const c1 = await post(emp, "check-out");
  assert.equal(c1.status, 200);
  assert.equal(c1.body.alreadyApplied, false);
  assert.equal(c1.body.attendance.workedHours, 8);
  assert.equal(c1.body.attendance.status, "Present");
  assert.equal(c1.body.attendance.checkOut, ist("2026-09-15 17:45").toISOString());

  // Double check-out keeps the original checkOut.
  await setClock(ist("2026-09-15 18:45"));
  const c2 = await post(emp, "check-out");
  assert.equal(c2.status, 200);
  assert.equal(c2.body.alreadyApplied, true);
  assert.equal(c2.body.attendance.checkOut, ist("2026-09-15 17:45").toISOString());
  assert.equal(c2.body.attendance.workedHours, 8);

  // Repeat check-in after check-out returns the existing record.
  const r2 = await post(emp, "check-in");
  assert.equal(r2.status, 200);
  assert.equal(r2.body.alreadyApplied, true);
  assert.equal(r2.body.attendance.checkIn, ist("2026-09-15 09:00").toISOString());

  // Pause after check-out is an invalid transition.
  const p3 = await post(emp, "pause");
  assert.equal(p3.status, 409);
  assert.equal(p3.body.code, "INVALID_TRANSITION");
  assert.equal(p3.body.details.attendance.checkOut, ist("2026-09-15 17:45").toISOString());

  const today = await request(app).get("/api/attendance/today/me").set(auth(emp));
  assert.equal(today.status, 200);
  assert.equal(today.body.businessDate, "2026-09-15");
  assert.equal(today.body.timezone, "Asia/Kolkata");
  assert.ok(today.body.serverTime);
  assert.equal(today.body.attendance.status, "Present");

  assert.equal(await Attendance.countDocuments({}), 1);
});

test("check-out while paused counts the open pause; thresholds Half Day >= 4h, else Absent", async () => {
  await setClock(ist("2026-09-15 09:00"));
  await post(fx.itDev1.user, "check-in");
  await post(fx.itDev2.user, "check-in");

  await setClock(ist("2026-09-15 12:00"));
  await post(fx.itDev1.user, "pause");
  await setClock(ist("2026-09-15 14:00"));
  const c = await post(fx.itDev1.user, "check-out");
  assert.equal(c.status, 200);
  assert.equal(c.body.attendance.workedHours, 3);
  assert.equal(c.body.attendance.totalPausedMs, 2 * 3600 * 1000);
  assert.equal(c.body.attendance.isPaused, false);
  assert.equal(c.body.attendance.status, "Absent");

  await setClock(ist("2026-09-15 13:30"));
  const h = await post(fx.itDev2.user, "check-out");
  assert.equal(h.body.attendance.workedHours, 4.5);
  assert.equal(h.body.attendance.status, "Half Day");
});

test("invalid transitions return 409 INVALID_TRANSITION with details.attendance", async () => {
  await setClock(ist("2026-09-15 09:00"));
  for (const action of ["pause", "resume", "check-out"]) {
    const r = await post(fx.itDev1.user, action);
    assert.equal(r.status, 409, action);
    assert.equal(r.body.code, "INVALID_TRANSITION");
    assert.equal(r.body.success, false);
    assert.ok("attendance" in r.body.details);
    assert.equal(r.body.stack, undefined);
  }
});

test("concurrent requests produce exactly one transition", async () => {
  await setClock(ist("2026-09-15 09:00"));
  const ins = await Promise.all(Array.from({ length: 8 }, () => post(fx.itDev1.user, "check-in")));
  assert.ok(ins.every((r) => r.status === 200));
  assert.equal(ins.filter((r) => r.body.alreadyApplied === false).length, 1);
  assert.equal(await Attendance.countDocuments({ employeeId: fx.itDev1.employee._id }), 1);

  await setClock(ist("2026-09-15 10:00"));
  const pauses = await Promise.all(Array.from({ length: 5 }, () => post(fx.itDev1.user, "pause")));
  assert.equal(pauses.filter((r) => r.body.alreadyApplied === false).length, 1);
  assert.equal(new Set(pauses.map((r) => r.body.attendance.pauseStartedAt)).size, 1);

  await setClock(ist("2026-09-15 10:30"));
  const resumes = await Promise.all(Array.from({ length: 5 }, () => post(fx.itDev1.user, "resume")));
  assert.equal(resumes.filter((r) => r.body.alreadyApplied === false).length, 1);
  const rec = await Attendance.findOne({ employeeId: fx.itDev1.employee._id });
  assert.equal(rec.totalPausedMs, 30 * 60 * 1000);

  await setClock(ist("2026-09-15 18:00"));
  const outs = await Promise.all(Array.from({ length: 5 }, () => post(fx.itDev1.user, "check-out")));
  assert.ok(outs.every((r) => r.status === 200));
  assert.equal(outs.filter((r) => r.body.alreadyApplied === false).length, 1);
  assert.equal(new Set(outs.map((r) => r.body.attendance.checkOut)).size, 1);
  assert.equal(outs[0].body.attendance.workedHours, 8.5);
});

test("Idempotency-Key replays the stored response; key reuse for another action is rejected", async () => {
  const emp = fx.itDev1.user;
  const key = { "Idempotency-Key": "d2f1c6a0-0d52-4b8e-9c8e-6f1f3d1f2a10" };

  await setClock(ist("2026-09-15 09:00"));
  const first = await post(emp, "check-in", key);
  assert.equal(first.status, 200);
  assert.equal(first.body.alreadyApplied, false);

  await setClock(ist("2026-09-15 09:05"));
  const replay = await post(emp, "check-in", key);
  assert.equal(replay.status, 200);
  assert.equal(replay.headers["idempotent-replayed"], "true");
  assert.deepEqual(replay.body, first.body);

  const reuse = await post(emp, "pause", key);
  assert.equal(reuse.status, 409);
  assert.equal(reuse.body.code, "CONFLICT");

  // Different user, same key: independent.
  const other = await post(fx.itDev2.user, "check-in", key);
  assert.equal(other.status, 200);
  assert.equal(other.body.alreadyApplied, false);

  const bad = await post(emp, "pause", { "Idempotency-Key": "x" });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, "VALIDATION_ERROR");

  // Concurrent duplicates with one key still yield a single transition.
  await setClock(ist("2026-09-15 10:00"));
  const k2 = { "Idempotency-Key": "pause-key-000000002" };
  const dup = await Promise.all([post(emp, "pause", k2), post(emp, "pause", k2), post(emp, "pause", k2)]);
  assert.ok(dup.every((r) => r.status === 200));
  assert.ok(dup.every((r) => r.body.attendance.pauseStartedAt === ist("2026-09-15 10:00").toISOString()));
});

test("business date uses the org timezone at the 23:30 / 00:30 IST boundary", async () => {
  // 2026-09-15 23:30 IST == 18:00Z; 2026-09-16 00:30 IST == 19:00Z (both 2026-09-15 in UTC).
  await setClock(new Date("2026-09-15T18:00:00Z"));
  const late = await post(fx.itDev1.user, "check-in");
  assert.equal(late.body.businessDate, "2026-09-15");
  assert.equal(late.body.attendance.date, "2026-09-15");

  await setClock(new Date("2026-09-15T19:00:00Z"));
  const early = await post(fx.itDev2.user, "check-in");
  assert.equal(early.body.businessDate, "2026-09-16");
  assert.equal(early.body.attendance.date, "2026-09-16");

  const t = await request(app).get("/api/attendance/today/me").set(auth(fx.itDev1.user));
  assert.equal(t.body.businessDate, "2026-09-16");
  assert.equal(t.body.attendance, null);
});

test("monthly attendance: ownership, validation, and leave/holiday/weekend handling", async () => {
  await Holiday.create({ title: "Founders Day", date: new Date("2026-09-11T00:00:00Z") });
  await Leave.create({
    employeeId: fx.itDev1.employee._id, leaveType: "Sick Leave",
    startDate: new Date("2026-09-09T00:00:00Z"), endDate: new Date("2026-09-09T00:00:00Z"),
    status: "Approved", days: 1,
  });
  await Attendance.create({
    employeeId: fx.itDev1.employee._id, date: "2026-09-10",
    checkIn: ist("2026-09-10 09:00"), checkOut: null, status: "",
  });
  await setClock(ist("2026-09-15 10:00"));

  const own = await request(app).get(`/api/attendance/me/monthly?month=2026-09`).set(auth(fx.itDev1.user));
  assert.equal(own.status, 200);
  assert.equal(own.body.month, "2026-09");
  assert.equal(own.body.attendance.length, 15); // Sep 1..15 (today)
  const byDate = Object.fromEntries(own.body.attendance.map((a) => [a.date, a]));
  assert.equal(byDate["2026-09-09"].status, "Leave");
  assert.equal(byDate["2026-09-10"].status, "Present"); // past open check-in: marked Present
  assert.equal(byDate["2026-09-10"].workedHours, 8);
  assert.equal(byDate["2026-09-11"].status, "Holiday");
  assert.equal(byDate["2026-09-11"].holidayName, "Founders Day");
  assert.equal(byDate["2026-09-12"].dayType, "weekend");
  assert.equal(byDate["2026-09-14"].status, "Absent");

  const legacySelf = await request(app)
    .get(`/api/attendance/user/${fx.itDev1.user._id}/monthly?month=9&year=2026`)
    .set(auth(fx.itDev1.user));
  assert.equal(legacySelf.status, 200);
  assert.equal(legacySelf.body.attendance.length, 15);

  const other = await request(app)
    .get(`/api/attendance/user/${fx.itDev2.user._id}/monthly?month=9&year=2026`)
    .set(auth(fx.itDev1.user));
  assert.equal(other.status, 403);
  assert.equal(other.body.code, "FORBIDDEN");

  const otherByEmp = await request(app)
    .get(`/api/attendance/user/${fx.itDev2.employee._id}/monthly?month=2026-09`)
    .set(auth(fx.itDev1.user));
  assert.equal(otherByEmp.status, 403);

  const admin = await request(app)
    .get(`/api/attendance/user/${fx.itDev2.user._id}/monthly?month=9&year=2026`)
    .set(auth(fx.admin));
  assert.equal(admin.status, 200);

  const bad = await request(app).get(`/api/attendance/me/monthly?month=2026-13`).set(auth(fx.itDev1.user));
  assert.equal(bad.status, 400);
  const badId = await request(app).get(`/api/attendance/user/not-an-id/monthly?month=2026-09`).set(auth(fx.admin));
  assert.equal(badId.status, 400);
  assert.equal(badId.body.code, "INVALID_ID");
  const client = await request(app).get(`/api/attendance/me/monthly`).set(auth(fx.clientA.user));
  assert.equal(client.status, 403);
});

test("role gates: admin-only org views, employee-only punches", async () => {
  await setClock(ist("2026-09-15 10:00"));
  for (const path of ["/api/attendance", "/api/attendance/admin/summary", "/api/attendance/report"]) {
    const r = await request(app).get(path).set(auth(fx.itDev1.user));
    assert.equal(r.status, 403, path);
    const ok = await request(app).get(path).set(auth(fx.admin));
    assert.equal(ok.status, 200, path);
  }
  const adminPunch = await post(fx.admin, "check-in");
  assert.equal(adminPunch.status, 403);
  const clientPunch = await post(fx.clientA.user, "check-in");
  assert.equal(clientPunch.status, 403);
  const empUpdate = await request(app)
    .put(`/api/attendance/update/${fx.itDev2.employee._id}`)
    .set(auth(fx.itDev1.user))
    .send({ status: "Present" });
  assert.equal(empUpdate.status, 403);
});

test("admin list/summary use org date and exclude deactivated employees", async () => {
  await setClock(ist("2026-09-15 10:30"));
  await post(fx.itDev1.user, "check-in");
  const list = await request(app).get("/api/attendance").set(auth(fx.admin));
  assert.equal(list.status, 200);
  assert.equal(list.body.businessDate, "2026-09-15");
  assert.equal(list.body.isOffDay, false);
  const names = list.body.attendance.map((a) => a.employeeId.userId.name);
  assert.ok(!names.includes("Ivan Inactive"));
  assert.equal(list.body.attendance.length, 6);
  const alan = list.body.attendance.find((a) => a.employeeId.userId.name === "Alan Dev");
  assert.ok(alan.checkIn);
  assert.equal(alan.employeeId.userId.tokenVersion, undefined);

  const summary = await request(app).get("/api/attendance/admin/summary").set(auth(fx.admin));
  assert.equal(summary.body.absentToday, 5);
  assert.equal(summary.body.lateLogins, 1); // 10:30 IST >= 10:00

  await setClock(ist("2026-09-12 10:00")); // Saturday
  const weekend = await request(app).get("/api/attendance/admin/summary").set(auth(fx.admin));
  assert.equal(weekend.body.isHoliday, true);
  assert.equal(weekend.body.holidayName, "Saturday (Weekend)");
});

test("admin manual status: validates, accepts the web's 'Halfday', records audit fields", async () => {
  await setClock(ist("2026-09-15 12:00"));
  const r = await request(app)
    .put(`/api/attendance/update/${fx.itDev1.employee._id}`)
    .set(auth(fx.admin))
    .send({ status: "Halfday" });
  assert.equal(r.status, 200);
  assert.equal(r.body.attendance.status, "Half Day");
  assert.equal(r.body.attendance.workedHours, 4);
  assert.equal(r.body.attendance.source, "admin");
  assert.equal(r.body.attendance.updatedBy, String(fx.admin._id));
  assert.equal(r.body.attendance.date, "2026-09-15");

  const past = await request(app)
    .put(`/api/attendance/update/${fx.itDev1.employee._id}`)
    .set(auth(fx.admin))
    .send({ status: "Leave", date: "2026-09-14" });
  assert.equal(past.status, 200);
  assert.equal(past.body.attendance.date, "2026-09-14");
  assert.equal(past.body.attendance.workedHours, 0);

  const cases = [
    [{ status: "Excellent" }, 400],
    [{ status: "Present", date: "2026-09-16" }, 400],
    [{ status: "Present", date: "15-09-2026" }, 400],
  ];
  for (const [body, code] of cases) {
    const bad = await request(app).put(`/api/attendance/update/${fx.itDev1.employee._id}`).set(auth(fx.admin)).send(body);
    assert.equal(bad.status, code, JSON.stringify(body));
  }
  const badId = await request(app).put(`/api/attendance/update/123`).set(auth(fx.admin)).send({ status: "Present" });
  assert.equal(badId.status, 400);
  const missing = await request(app)
    .put(`/api/attendance/update/${fx.admin._id}`)
    .set(auth(fx.admin))
    .send({ status: "Present" });
  assert.equal(missing.status, 404);
});

test("report: bounded ranges and consistent statuses", async () => {
  await Holiday.create({ title: "Founders Day", date: new Date("2026-09-11T00:00:00Z") });
  await setClock(ist("2026-09-15 12:00"));
  const r = await request(app).get("/api/attendance/report?from=2026-09-10&to=2026-09-11").set(auth(fx.admin));
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body.groupData).sort(), ["2026-09-10", "2026-09-11"]);
  assert.equal(r.body.holidayMap["2026-09-11"], "Founders Day");
  assert.ok(r.body.groupData["2026-09-10"].every((row) => row.status === "Absent"));
  assert.ok(r.body.groupData["2026-09-11"].every((row) => row.status === "Holiday"));

  const month = await request(app).get("/api/attendance/report?month=9&year=2026").set(auth(fx.admin));
  assert.equal(Object.keys(month.body.groupData).length, 30);

  const tooLong = await request(app).get("/api/attendance/report?from=2024-01-01&to=2026-09-15").set(auth(fx.admin));
  assert.equal(tooLong.status, 400);
  const reversed = await request(app).get("/api/attendance/report?from=2026-09-15&to=2026-09-01").set(auth(fx.admin));
  assert.equal(reversed.status, 400);
  const badDate = await request(app).get("/api/attendance/report?date=2026-9-1").set(auth(fx.admin));
  assert.equal(badDate.status, 400);
});

test("close-day job is idempotent and follows working-day/leave/active rules", async () => {
  const { closeAttendanceDay } = await import("../utils/attendanceCron.js");
  await Holiday.create({ title: "Founders Day", date: new Date("2026-09-11T00:00:00Z") });
  await Leave.create({
    employeeId: fx.itDev1.employee._id, leaveType: "Casual Leave",
    startDate: new Date("2026-09-10T00:00:00Z"), endDate: new Date("2026-09-10T00:00:00Z"),
    status: "Approved", days: 1,
  });
  await Attendance.create({
    employeeId: fx.itDev2.employee._id, date: "2026-09-14",
    checkIn: ist("2026-09-14 09:00"), checkOut: null, status: "", isPaused: true, pauseStartedAt: ist("2026-09-14 12:00"),
  });
  // Explicit status (e.g. approved correction) on an open check-in is not reset.
  await Attendance.create({
    employeeId: fx.opsStaff1.employee._id, date: "2026-09-14",
    checkIn: ist("2026-09-14 09:00"), checkOut: null, status: "Present", workedHours: 8, source: "correction",
  });

  const now = ist("2026-09-16 00:30");
  const first = await closeAttendanceDay({ now, lookbackDays: 7 });
  assert.equal(first.businessDate, "2026-09-16");
  assert.deepEqual(first.range, { from: "2026-09-09", to: "2026-09-15" });
  assert.equal(first.closedOpenSessions, 1);
  // Working days Sep 9, 10, 14, 15 x 6 active employees, minus 1 leave day, minus 2 existing records.
  assert.equal(first.absentCreated, 21);

  const closed = await Attendance.findOne({ employeeId: fx.itDev2.employee._id, date: "2026-09-14" });
  assert.equal(closed.status, "Present");
  assert.equal(closed.workedHours, 8);
  assert.equal(closed.isPaused, false);
  assert.ok(closed.checkIn);
  const kept = await Attendance.findOne({ employeeId: fx.opsStaff1.employee._id, date: "2026-09-14" });
  assert.equal(kept.status, "Present");

  assert.equal(await Attendance.countDocuments({ employeeId: fx.itInactive.employee._id }), 0);
  assert.equal(await Attendance.countDocuments({ date: { $in: ["2026-09-11", "2026-09-12", "2026-09-13", "2026-09-16"] } }), 0);
  assert.equal(await Attendance.countDocuments({ employeeId: fx.itDev1.employee._id, date: "2026-09-10" }), 0);

  const total = await Attendance.countDocuments({});
  const second = await closeAttendanceDay({ now, lookbackDays: 7 });
  assert.equal(second.absentCreated, 0);
  assert.equal(second.closedOpenSessions, 0);
  assert.equal(await Attendance.countDocuments({}), total);

  // Concurrent runs do not create duplicates either.
  await Attendance.deleteMany({ source: "system", checkIn: null });
  await Promise.all([closeAttendanceDay({ now }), closeAttendanceDay({ now })]);
  assert.equal(await Attendance.countDocuments({}), total);
});

test("close-day HTTP endpoint is guarded by CRON_SECRET (POST and Vercel's GET)", async () => {
  await setClock(ist("2026-09-16 00:30"));
  const disabled = await request(app).post("/api/attendance/jobs/close-day");
  assert.equal(disabled.status, 503);
  assert.equal(disabled.body.code, "JOB_DISABLED");

  process.env.CRON_SECRET = "test-cron-secret-0123456789";
  const missing = await request(app).post("/api/attendance/jobs/close-day");
  assert.equal(missing.status, 401);
  const wrong = await request(app).post("/api/attendance/jobs/close-day").set("Authorization", "Bearer nope");
  assert.equal(wrong.status, 401);
  const userToken = await request(app).post("/api/attendance/jobs/close-day").set(auth(fx.admin));
  assert.equal(userToken.status, 401);

  const ok = await request(app)
    .post("/api/attendance/jobs/close-day")
    .set("Authorization", `Bearer ${process.env.CRON_SECRET}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.success, true);
  assert.ok(ok.body.absentCreated > 0);

  const viaGet = await request(app)
    .get("/api/attendance/jobs/close-day")
    .set("Authorization", `Bearer ${process.env.CRON_SECRET}`);
  assert.equal(viaGet.status, 200);
  assert.equal(viaGet.body.absentCreated, 0);
  delete process.env.CRON_SECRET;
});

test("check-in over a pre-filled placeholder (legacy Absent row for today) starts a live session", async () => {
  await Attendance.create({ employeeId: fx.itDev1.employee._id, date: "2026-09-15", status: "Absent", source: "system" });
  await setClock(ist("2026-09-15 09:00"));
  const r = await post(fx.itDev1.user, "check-in");
  assert.equal(r.status, 200);
  assert.equal(r.body.alreadyApplied, false);
  assert.equal(r.body.attendance.status, "");
  assert.equal(r.body.attendance.source, "punch");
  assert.equal(await Attendance.countDocuments({ employeeId: fx.itDev1.employee._id }), 1);

  // Legacy rows created without totalPausedMs still check out cleanly.
  await Attendance.collection.updateOne({ employeeId: fx.itDev1.employee._id }, { $unset: { totalPausedMs: "" } });
  await setClock(ist("2026-09-15 13:00"));
  const out = await post(fx.itDev1.user, "check-out");
  assert.equal(out.status, 200);
  assert.equal(out.body.attendance.workedHours, 4);
  assert.equal(out.body.attendance.status, "Half Day");
});

test("an abandoned pending Idempotency-Key claim is taken over; a fresh one is reported as in progress", async () => {
  const IdempotencyRecord = (await import("../models/IdempotencyRecord.js")).default;
  await setClock(ist("2026-09-15 09:00"));
  await IdempotencyRecord.create({
    userId: fx.itDev1.user._id, key: "stale-key-0001", scope: "attendance:check-in", state: "pending",
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
  });
  const taken = await post(fx.itDev1.user, "check-in", { "Idempotency-Key": "stale-key-0001" });
  assert.equal(taken.status, 200);
  assert.equal(taken.body.alreadyApplied, false);

  await IdempotencyRecord.create({
    userId: fx.itDev2.user._id, key: "busy-key-0001", scope: "attendance:check-in", state: "pending",
  });
  const busy = await post(fx.itDev2.user, "check-in", { "Idempotency-Key": "busy-key-0001" });
  assert.equal(busy.status, 409);
  assert.equal(busy.body.code, "CONFLICT");
  assert.equal(await Attendance.countDocuments({ employeeId: fx.itDev2.employee._id }), 0);
});

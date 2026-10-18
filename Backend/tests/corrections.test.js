import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth } from "./helpers/testEnv.js";
import { ensureDomainIndexes, setClock, setJoiningDates, ist } from "./helpers/domain.js";

let app, fx, Attendance, AttendanceRequest, Notification;

before(async () => {
  await startTestDb();
  app = await getApp();
  await ensureDomainIndexes();
  Attendance = (await import("../models/Attendance.js")).default;
  AttendanceRequest = (await import("../models/AttendanceRequest.js")).default;
  Notification = (await import("../models/Notification.js")).default;
});
after(async () => {
  await setClock(null);
  await stopTestDb();
});
beforeEach(async () => {
  await clearDb();
  fx = await seedFixtures();
  await setJoiningDates("2026-01-01");
  await setClock(ist("2026-09-15 10:00"));
});

const create = (user, body) => request(app).post("/api/attendance-request").set(auth(user)).send(body);
const review = (user, id, body) => request(app).put(`/api/attendance-request/${id}/review`).set(auth(user)).send(body);

test("create: validation, server-derived current status, one pending per date", async () => {
  const ok = await create(fx.itDev1.user, {
    date: "2026-09-14", currentStatus: "Half Day", requestedStatus: "Present", reason: "Forgot to punch in",
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.request.status, "Pending");
  assert.equal(ok.body.request.currentStatus, "Absent"); // derived: no record => Absent

  const dup = await create(fx.itDev1.user, { date: "2026-09-14", requestedStatus: "Half Day", reason: "again" });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.code, "CONFLICT");

  // Another employee may request the same date.
  const other = await create(fx.itDev2.user, { date: "2026-09-14", requestedStatus: "Present", reason: "x" });
  assert.equal(other.status, 201);

  const cases = [
    [{ date: "2026-09-16", requestedStatus: "Present", reason: "future" }, 400],
    [{ date: "14/09/2026", requestedStatus: "Present", reason: "bad date" }, 400],
    [{ date: "2026-09-13", requestedStatus: "Leave", reason: "bad status" }, 400],
    [{ date: "2026-09-13", requestedStatus: "Present" }, 400],
    [{ date: "2026-09-13", requestedStatus: "Present", reason: "x".repeat(501) }, 400],
  ];
  for (const [body, status] of cases) {
    const r = await create(fx.itDev1.user, body);
    assert.equal(r.status, status, JSON.stringify(body).slice(0, 80));
    assert.equal(r.body.success, false);
  }

  // Requested status equal to the current one is rejected.
  await Attendance.create({ employeeId: fx.itDev1.employee._id, date: "2026-09-10", status: "Present", workedHours: 8,
    checkIn: ist("2026-09-10 09:00"), checkOut: ist("2026-09-10 17:00") });
  const same = await create(fx.itDev1.user, { date: "2026-09-10", requestedStatus: "Present", reason: "same" });
  assert.equal(same.status, 400);

  const asAdmin = await create(fx.admin, { date: "2026-09-14", requestedStatus: "Present", reason: "x" });
  assert.equal(asAdmin.status, 403);

  const adminNotes = await Notification.find({ type: "attendance-request", "data.adminId": fx.admin._id });
  assert.equal(adminNotes.length, 2);
  assert.ok(adminNotes[0].data.requestId);
});

test("approve: no fabricated timestamps, nominal hours, audit fields; second review 409", async () => {
  const created = await create(fx.itDev1.user, { date: "2026-09-14", requestedStatus: "Present", reason: "WFH" });
  const id = created.body.request._id;

  const asEmployee = await review(fx.itDev1.user, id, { decision: "Approved" });
  assert.equal(asEmployee.status, 403);
  const badDecision = await review(fx.admin, id, { decision: "Maybe" });
  assert.equal(badDecision.status, 400);

  const r = await review(fx.admin, id, { decision: "Approved", remarks: "ok" });
  assert.equal(r.status, 200);
  assert.equal(r.body.request.status, "Approved");
  const att = await Attendance.findOne({ employeeId: fx.itDev1.employee._id, date: "2026-09-14" }).lean();
  assert.equal(att.status, "Present");
  assert.equal(att.checkIn, null);
  assert.equal(att.checkOut, null);
  assert.equal(att.workedHours, 8);
  assert.equal(att.hoursSource, "correction");
  assert.equal(att.source, "correction");
  assert.equal(String(att.correctionRequestId), id);
  assert.equal(String(att.correctedBy), String(fx.admin._id));
  assert.ok(att.correctedAt);

  const again = await review(fx.admin, id, { decision: "Rejected" });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, "ALREADY_REVIEWED");

  const note = await Notification.findOne({ type: "attendance-request-status", "data.userId": fx.itDev1.user._id });
  assert.ok(note);
  assert.match(note.message, /approved/);

  const missing = await review(fx.admin, String(fx.admin._id), { decision: "Approved" });
  assert.equal(missing.status, 404);
  const badId = await review(fx.admin, "zzz", { decision: "Approved" });
  assert.equal(badId.status, 400);
});

test("Half Day approval keeps real punches and records punched hours", async () => {
  const checkIn = ist("2026-09-14 09:00");
  const checkOut = ist("2026-09-14 11:00");
  await Attendance.create({
    employeeId: fx.itDev2.employee._id, date: "2026-09-14", checkIn, checkOut,
    workedHours: 2, status: "Absent", source: "punch",
  });
  const created = await create(fx.itDev2.user, { date: "2026-09-14", requestedStatus: "Half Day", reason: "client visit" });
  assert.equal(created.status, 201);
  assert.equal(created.body.request.currentStatus, "Absent");

  const r = await review(fx.admin, created.body.request._id, { decision: "Approved" });
  assert.equal(r.status, 200);
  const att = await Attendance.findOne({ employeeId: fx.itDev2.employee._id, date: "2026-09-14" }).lean();
  assert.equal(att.status, "Half Day");
  assert.equal(att.workedHours, 4);
  assert.equal(att.punchedHours, 2);
  assert.equal(att.checkIn.toISOString(), checkIn.toISOString());
  assert.equal(att.checkOut.toISOString(), checkOut.toISOString());
});

test("concurrent reviews: exactly one wins", async () => {
  const created = await create(fx.itDev1.user, { date: "2026-09-14", requestedStatus: "Present", reason: "x" });
  const id = created.body.request._id;
  const results = await Promise.all([
    review(fx.admin, id, { decision: "Approved" }),
    review(fx.admin, id, { decision: "Rejected" }),
    review(fx.admin, id, { decision: "Approved" }),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.ok(results.filter((r) => r.status !== 200).every((r) => r.status === 409 && r.body.code === "ALREADY_REVIEWED"));
});

test("rejected request frees the date; lists are scoped; delete rules", async () => {
  const first = await create(fx.itDev1.user, { date: "2026-09-14", requestedStatus: "Present", reason: "x" });
  await review(fx.admin, first.body.request._id, { decision: "Rejected" });
  const second = await create(fx.itDev1.user, { date: "2026-09-14", requestedStatus: "Half Day", reason: "y" });
  assert.equal(second.status, 201);
  await create(fx.opsStaff1.user, { date: "2026-09-14", requestedStatus: "Present", reason: "z" });

  const mine = await request(app).get("/api/attendance-request/me").set(auth(fx.itDev1.user));
  assert.equal(mine.status, 200);
  assert.equal(mine.body.requests.length, 2);

  const empAll = await request(app).get("/api/attendance-request").set(auth(fx.itDev1.user));
  assert.equal(empAll.status, 403);
  const all = await request(app).get("/api/attendance-request?status=Pending").set(auth(fx.admin));
  assert.equal(all.status, 200);
  assert.equal(all.body.requests.length, 2);
  assert.equal(all.body.requests[0].employeeId.userId.tokenVersion, undefined);
  const paged = await request(app).get("/api/attendance-request?page=1&limit=1").set(auth(fx.admin));
  assert.equal(paged.body.requests.length, 1);
  assert.equal(paged.body.total, 3);
  assert.equal(paged.body.hasMore, true);
  const badStatus = await request(app).get("/api/attendance-request?status=Weird").set(auth(fx.admin));
  assert.equal(badStatus.status, 400);

  // Not the owner -> 404; owner but reviewed -> 409; owner + pending -> 200.
  const notOwner = await request(app).delete(`/api/attendance-request/${second.body.request._id}`).set(auth(fx.itDev2.user));
  assert.equal(notOwner.status, 404);
  const reviewed = await request(app).delete(`/api/attendance-request/${first.body.request._id}`).set(auth(fx.itDev1.user));
  assert.equal(reviewed.status, 409);
  const adminDel = await request(app).delete(`/api/attendance-request/${second.body.request._id}`).set(auth(fx.admin));
  assert.equal(adminDel.status, 403);
  const ok = await request(app).delete(`/api/attendance-request/${second.body.request._id}`).set(auth(fx.itDev1.user));
  assert.equal(ok.status, 200);
  assert.equal(await AttendanceRequest.countDocuments({ employeeId: fx.itDev1.employee._id }), 1);
});

test("concurrent duplicate requests for one date: one created, the rest 409", async () => {
  const body = { date: "2026-09-14", requestedStatus: "Present", reason: "parallel" };
  const results = await Promise.all(Array.from({ length: 5 }, () => create(fx.itDev1.user, body)));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 409));
  assert.equal(await AttendanceRequest.countDocuments({ employeeId: fx.itDev1.employee._id, status: "Pending" }), 1);
});

test("employee with unclosed check-in can regularize or have Present approved", async () => {
  const checkIn = ist("2026-09-14 09:00");
  await Attendance.create({
    employeeId: fx.itDev1.employee._id,
    date: "2026-09-14",
    checkIn,
    checkOut: null,
    status: "",
    source: "punch",
  });

  const created = await create(fx.itDev1.user, {
    date: "2026-09-14",
    requestedStatus: "Present",
    reason: "Forgot to check out before leaving office",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.request.status, "Pending");

  const r = await review(fx.admin, created.body.request._id, { decision: "Approved" });
  assert.equal(r.status, 200);

  const att = await Attendance.findOne({ employeeId: fx.itDev1.employee._id, date: "2026-09-14" }).lean();
  assert.equal(att.status, "Present");
  assert.equal(att.workedHours, 8);
  assert.equal(att.checkIn.toISOString(), checkIn.toISOString());
  assert.equal(att.checkOut, null);
});


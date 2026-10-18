import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth } from "./helpers/testEnv.js";
import { ensureDomainIndexes, setClock, setJoiningDates, ist } from "./helpers/domain.js";

let app, fx, Leave, Holiday, Notification;

before(async () => {
  await startTestDb();
  app = await getApp();
  await ensureDomainIndexes();
  Leave = (await import("../models/Leave.js")).default;
  Holiday = (await import("../models/Holiday.js")).default;
  Notification = (await import("../models/Notification.js")).default;
});
after(async () => {
  await setClock(null);
  delete process.env.LEAVE_ENTITLEMENT_PERIOD;
  await stopTestDb();
});
beforeEach(async () => {
  await clearDb();
  fx = await seedFixtures();
  await setJoiningDates("2026-01-01");
  await Holiday.create({ title: "Founders Day", date: new Date("2026-09-11T00:00:00Z") });
  await setClock(ist("2026-09-01 10:00"));
});

const apply = (user, body) => request(app).post("/api/leave/add").set(auth(user)).send(body);
const decide = (user, id, status) => request(app).put(`/api/leave/${id}`).set(auth(user)).send({ status });

test("apply: server computes working days (weekends + holidays excluded), client days ignored", async () => {
  // Thu 10 .. Tue 15: 10, (11 holiday), (12-13 weekend), 14, 15 => 3 days
  const r = await apply(fx.itDev1.user, {
    leaveType: "Casual Leave", startDate: "2026-09-10", endDate: "2026-09-15", reason: "family", days: 99, userId: String(fx.itDev2.user._id),
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.leave.days, 3);
  assert.equal(r.body.leave.status, "Pending");
  assert.equal(String(r.body.leave.employeeId), String(fx.itDev1.employee._id)); // body userId ignored
  assert.equal(r.body.exceedsBalance, false);
  assert.equal(r.body.leave.startDate, "2026-09-10T00:00:00.000Z");

  const note = await Notification.findOne({ type: "leave-request", "data.adminId": fx.admin._id });
  assert.match(note.message, /3 days/);

  const cases = [
    [{ leaveType: "Vacation", startDate: "2026-09-21", endDate: "2026-09-21" }, 400],
    [{ leaveType: "Sick Leave", startDate: "2026-09-22", endDate: "2026-09-21" }, 400],
    [{ leaveType: "Sick Leave", startDate: "2026-09-12", endDate: "2026-09-13" }, 400], // weekend only
    [{ leaveType: "Sick Leave", startDate: "2026-09-21" }, 400],
    [{ leaveType: "Sick Leave", startDate: "2026-09-01", endDate: "2026-12-31" }, 400], // span too long
    [{ leaveType: "Sick Leave", startDate: "2026-02-30", endDate: "2026-03-01" }, 400],
  ];
  for (const [body, status] of cases) {
    const bad = await apply(fx.itDev1.user, body);
    assert.equal(bad.status, status, JSON.stringify(body));
    assert.equal(bad.body.success, false);
  }
  const asAdmin = await apply(fx.admin, { leaveType: "Sick Leave", startDate: "2026-09-21", endDate: "2026-09-21" });
  assert.equal(asAdmin.status, 403);
});

test("overlapping pending/approved leave is rejected with 409", async () => {
  const a = await apply(fx.itDev1.user, { leaveType: "Casual Leave", startDate: "2026-09-14", endDate: "2026-09-16" });
  assert.equal(a.status, 200);
  const overlap = await apply(fx.itDev1.user, { leaveType: "Sick Leave", startDate: "2026-09-16", endDate: "2026-09-18" });
  assert.equal(overlap.status, 409);
  assert.equal(overlap.body.code, "CONFLICT");

  // Other employee, same dates: fine. Adjacent dates: fine.
  assert.equal((await apply(fx.itDev2.user, { leaveType: "Sick Leave", startDate: "2026-09-14", endDate: "2026-09-16" })).status, 200);
  assert.equal((await apply(fx.itDev1.user, { leaveType: "Sick Leave", startDate: "2026-09-17", endDate: "2026-09-17" })).status, 200);

  // After rejection the dates are free again.
  await decide(fx.admin, a.body.leave._id, "Rejected");
  assert.equal((await apply(fx.itDev1.user, { leaveType: "Casual Leave", startDate: "2026-09-15", endDate: "2026-09-15" })).status, 200);
});

test("admin review is atomic (Pending only) and notifies the employee", async () => {
  const a = await apply(fx.itDev1.user, { leaveType: "Casual Leave", startDate: "2026-09-10", endDate: "2026-09-15" });
  const id = a.body.leave._id;

  assert.equal((await decide(fx.itDev1.user, id, "Approved")).status, 403);
  assert.equal((await decide(fx.admin, id, "Cancelled")).status, 400);
  assert.equal((await decide(fx.admin, "nope", "Approved")).status, 400);

  const results = await Promise.all([decide(fx.admin, id, "Approved"), decide(fx.admin, id, "Rejected")]);
  const winners = results.filter((r) => r.status === 200);
  assert.equal(winners.length, 1);
  const loser = results.find((r) => r.status !== 200);
  assert.equal(loser.status, 409);
  assert.equal(loser.body.code, "ALREADY_REVIEWED");

  const again = await decide(fx.admin, id, "Approved");
  assert.equal(again.status, 409);
  assert.equal(again.body.code, "ALREADY_REVIEWED");

  const note = await Notification.findOne({ type: "leave-status", "data.userId": fx.itDev1.user._id });
  assert.ok(note);
  assert.match(note.message, /2026-09-10 to 2026-09-15/);
});

test("balance: approved days in the calendar-year period; 12 + 12 = 24; scoped access", async () => {
  const a = await apply(fx.itDev1.user, { leaveType: "Casual Leave", startDate: "2026-09-10", endDate: "2026-09-15" });
  await decide(fx.admin, a.body.leave._id, "Approved");
  const s = await apply(fx.itDev1.user, { leaveType: "Sick Leave", startDate: "2026-09-21", endDate: "2026-09-21" });
  await decide(fx.admin, s.body.leave._id, "Approved");
  await apply(fx.itDev1.user, { leaveType: "Sick Leave", startDate: "2026-09-22", endDate: "2026-09-22" }); // pending: not counted
  // Previous year's approved leave is outside the current entitlement period.
  await Leave.create({ employeeId: fx.itDev1.employee._id, leaveType: "Casual Leave", status: "Approved", days: 5,
    startDate: new Date("2025-06-02T00:00:00Z"), endDate: new Date("2025-06-06T00:00:00Z") });

  const me = await request(app).get("/api/leave/balance/me").set(auth(fx.itDev1.user));
  assert.equal(me.status, 200);
  assert.deepEqual(me.body.casual, { total: 12, used: 3, balance: 9 });
  assert.deepEqual(me.body.sick, { total: 12, used: 1, balance: 11 });
  assert.deepEqual(me.body.total, { total: 24, used: 4, balance: 20 });
  assert.equal(me.body.period.basis, "calendar-year");
  assert.equal(me.body.period.start, "2026-01-01");

  const byEmp = await request(app).get(`/api/leave/balance/${fx.itDev1.employee._id}`).set(auth(fx.itDev1.user));
  assert.equal(byEmp.status, 200);
  const other = await request(app).get(`/api/leave/balance/${fx.itDev2.employee._id}`).set(auth(fx.itDev1.user));
  assert.equal(other.status, 403);
  const admin = await request(app).get(`/api/leave/balance/${fx.itDev1.employee._id}`).set(auth(fx.admin));
  assert.deepEqual(admin.body.casual, { total: 12, used: 3, balance: 9 });
  const adminMe = await request(app).get(`/api/leave/balance/me`).set(auth(fx.admin));
  assert.equal(adminMe.status, 403);

  process.env.LEAVE_ENTITLEMENT_PERIOD = "all-time";
  const allTime = await request(app).get("/api/leave/balance/me").set(auth(fx.itDev1.user));
  assert.deepEqual(allTime.body.casual, { total: 12, used: 8, balance: 4 });
  delete process.env.LEAVE_ENTITLEMENT_PERIOD;
});

test("cancel: owner only; Pending always; Approved only before it starts", async () => {
  const pending = await apply(fx.itDev1.user, { leaveType: "Casual Leave", startDate: "2026-09-14", endDate: "2026-09-14" });
  const future = await apply(fx.itDev1.user, { leaveType: "Casual Leave", startDate: "2026-09-21", endDate: "2026-09-22" });
  const started = await apply(fx.itDev1.user, { leaveType: "Sick Leave", startDate: "2026-09-02", endDate: "2026-09-03" });
  await decide(fx.admin, future.body.leave._id, "Approved");
  await decide(fx.admin, started.body.leave._id, "Approved");

  const notOwner = await request(app).put(`/api/leave/cancel/${pending.body.leave._id}`).set(auth(fx.itDev2.user));
  assert.equal(notOwner.status, 404);
  const adminCancel = await request(app).put(`/api/leave/cancel/${pending.body.leave._id}`).set(auth(fx.admin));
  assert.equal(adminCancel.status, 403);

  const c1 = await request(app).put(`/api/leave/cancel/${pending.body.leave._id}`).set(auth(fx.itDev1.user));
  assert.equal(c1.status, 200);
  assert.equal(c1.body.leave.status, "Cancelled");
  const c1again = await request(app).put(`/api/leave/cancel/${pending.body.leave._id}`).set(auth(fx.itDev1.user));
  assert.equal(c1again.status, 409);
  assert.equal(c1again.body.code, "INVALID_TRANSITION");

  await setClock(ist("2026-09-02 09:00")); // the 2026-09-02 leave has started
  const c2 = await request(app).put(`/api/leave/cancel/${started.body.leave._id}`).set(auth(fx.itDev1.user));
  assert.equal(c2.status, 409);
  const c3 = await request(app).put(`/api/leave/cancel/${future.body.leave._id}`).set(auth(fx.itDev1.user));
  assert.equal(c3.status, 200);

  const adminNote = await Notification.findOne({ type: "leave-request", "data.status": "Cancelled", "data.adminId": fx.admin._id });
  assert.ok(adminNote);
});

test("reads are scoped: /me, legacy /:id/:role ignores the role segment, detail ownership", async () => {
  const mine = await apply(fx.itDev1.user, { leaveType: "Casual Leave", startDate: "2026-09-14", endDate: "2026-09-14" });
  const theirs = await apply(fx.itDev2.user, { leaveType: "Casual Leave", startDate: "2026-09-14", endDate: "2026-09-14" });

  const me = await request(app).get("/api/leave/me").set(auth(fx.itDev1.user));
  assert.equal(me.status, 200);
  assert.deepEqual(me.body.leaves.map((l) => l._id), [mine.body.leave._id]);

  const legacyOwn = await request(app).get(`/api/leave/${fx.itDev1.user._id}/employee`).set(auth(fx.itDev1.user));
  assert.equal(legacyOwn.status, 200);
  assert.equal(legacyOwn.body.leaves.length, 1);

  // `role=admin` in the path grants nothing.
  const spoof = await request(app).get(`/api/leave/${fx.itDev2.employee._id}/admin`).set(auth(fx.itDev1.user));
  assert.equal(spoof.status, 403);
  const spoofUser = await request(app).get(`/api/leave/${fx.itDev2.user._id}/employee`).set(auth(fx.itDev1.user));
  assert.equal(spoofUser.status, 403);

  const adminView = await request(app).get(`/api/leave/${fx.itDev2.employee._id}/admin`).set(auth(fx.admin));
  assert.equal(adminView.status, 200);
  assert.equal(adminView.body.leaves[0]._id, theirs.body.leave._id);

  const detailOther = await request(app).get(`/api/leave/detail/${theirs.body.leave._id}`).set(auth(fx.itDev1.user));
  assert.equal(detailOther.status, 404);
  const detailOwn = await request(app).get(`/api/leave/detail/${mine.body.leave._id}`).set(auth(fx.itDev1.user));
  assert.equal(detailOwn.status, 200);
  assert.equal(detailOwn.body.leave.employeeId.userId.name, "Alan Dev");
  const detailAdmin = await request(app).get(`/api/leave/detail/${theirs.body.leave._id}`).set(auth(fx.admin));
  assert.equal(detailAdmin.status, 200);

  const listEmp = await request(app).get("/api/leave").set(auth(fx.itDev1.user));
  assert.equal(listEmp.status, 403);
  const listAdmin = await request(app).get("/api/leave").set(auth(fx.admin));
  assert.equal(listAdmin.status, 200);
  assert.equal(listAdmin.body.leaves.length, 2);
  const client = await request(app).get("/api/leave/me").set(auth(fx.clientA.user));
  assert.equal(client.status, 403);
});

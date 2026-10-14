import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth } from "./helpers/testEnv.js";

let app, fx, Notification, Announcement, Stall, Leave, businessDate, addDays;

before(async () => {
  await startTestDb();
  app = await getApp();
  Notification = (await import("../models/Notification.js")).default;
  Announcement = (await import("../models/Announcement.js")).default;
  Stall = (await import("../models/Stall.js")).default;
  Leave = (await import("../models/Leave.js")).default;
  ({ businessDate, addDays } = await import("../utils/orgTime.js"));
});
after(async () => { await stopTestDb(); });
beforeEach(async () => { await clearDb(); fx = await seedFixtures(); });

const asAdmin = () => auth(fx.admin);
const noStack = (body) => assert.ok(!JSON.stringify(body).includes("    at "), "no stack traces");

describe("stalls", () => {
  test("unauthenticated writes 401, employee writes/reads 403", async () => {
    assert.equal((await request(app).post("/api/stalls").send({ name: "S", number: "1", type: "Food" })).status, 401);
    assert.equal((await request(app).get("/api/stalls")).status, 401);
    const stall = await Stall.create({ name: "Seed", number: "9", type: "Food" });
    assert.equal((await request(app).put(`/api/stalls/${stall._id}`).send({ name: "x" })).status, 401);
    assert.equal((await request(app).delete(`/api/stalls/${stall._id}`)).status, 401);
    for (const u of [fx.itDev1.user, fx.clientA.user]) {
      assert.equal((await request(app).post("/api/stalls").set(auth(u)).send({ name: "S", number: "1", type: "Food" })).status, 403);
      assert.equal((await request(app).put(`/api/stalls/${stall._id}`).set(auth(u)).send({ name: "x" })).status, 403);
      assert.equal((await request(app).delete(`/api/stalls/${stall._id}`).set(auth(u))).status, 403);
      assert.equal((await request(app).get("/api/stalls").set(auth(u))).status, 403);
    }
    assert.equal((await Stall.findById(stall._id).lean()).name, "Seed");
  });

  test("admin CRUD with validation (multipart, repeated plans)", async () => {
    const missing = await request(app).post("/api/stalls").set(asAdmin()).field("name", "Only name");
    assert.equal(missing.status, 400);
    const created = await request(app).post("/api/stalls").set(asAdmin())
      .field("name", "Chai Point").field("number", "A-12").field("type", "Food").field("eventCount", "3")
      .field("plans", "Gold").field("plans", "Silver");
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.deepEqual(created.body.stall.plans, ["Gold", "Silver"]);
    const id = created.body.stall._id;
    const bad = await request(app).put(`/api/stalls/${id}`).set(asAdmin()).send({ eventCount: -1 });
    assert.equal(bad.status, 400);
    const upd = await request(app).put(`/api/stalls/${id}`).set(asAdmin()).send({ name: "Chai Point 2", logo: "https://evil.example/x.png", plans: "Platinum" });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.stall.name, "Chai Point 2");
    assert.notEqual(upd.body.stall.logo, "https://evil.example/x.png", "logo only via upload");
    assert.deepEqual(upd.body.stall.plans, ["Platinum"]);
    assert.equal((await request(app).get(`/api/stalls/${id}`).set(asAdmin())).status, 200);
    assert.equal((await request(app).get(`/api/stalls/nope`).set(asAdmin())).body.code, "INVALID_ID");
    assert.equal((await request(app).delete(`/api/stalls/${id}`).set(asAdmin())).status, 200);
    assert.equal((await request(app).delete(`/api/stalls/${id}`).set(asAdmin())).status, 404);
  });
});

describe("sponsors", () => {
  test("admin only; validated", async () => {
    assert.equal((await request(app).get("/api/sponsors").set(auth(fx.itDev1.user))).status, 403);
    assert.equal((await request(app).post("/api/sponsors/add").set(auth(fx.itDev1.user)).send({ name: "x" })).status, 403);
    const bad = await request(app).post("/api/sponsors/add").set(asAdmin()).send({ name: "Acme", collaboration: "Best Friend", reach: "Global" });
    assert.equal(bad.status, 400);
    const ok = await request(app).post("/api/sponsors/add").set(asAdmin()).send({ name: "Acme", collaboration: "Title Sponsor", reach: "Global", eventsSponsored: "4" });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.sponsor.eventsSponsored, 4);
    const id = ok.body.sponsor._id;
    const upd = await request(app).put(`/api/sponsors/${id}`).set(asAdmin()).send({ reach: "Local", createdAt: "1999-01-01" });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.sponsor.reach, "Local");
    assert.notEqual(new Date(upd.body.sponsor.createdAt).getUTCFullYear(), 1999);
    assert.equal((await request(app).get(`/api/sponsors/${new mongoose.Types.ObjectId()}`).set(asAdmin())).status, 404);
    assert.equal((await request(app).delete(`/api/sponsors/${id}`).set(auth(fx.itDev1.user))).status, 403);
    assert.equal((await request(app).delete(`/api/sponsors/${id}`).set(asAdmin())).status, 200);
  });
});

describe("holidays", () => {
  test("read for all roles, write admin only, validated", async () => {
    const tomorrow = addDays(businessDate(new Date()), 1);
    const yesterday = addDays(businessDate(new Date()), -1);
    assert.equal((await request(app).post("/api/holiday/add").set(auth(fx.itDev1.user)).send({ title: "X", date: tomorrow })).status, 403);
    assert.equal((await request(app).post("/api/holiday/add").set(asAdmin()).send({ title: "X", date: "31/12/2026" })).status, 400);
    assert.equal((await request(app).post("/api/holiday/add").set(asAdmin()).send({ date: tomorrow })).status, 400);
    const a = await request(app).post("/api/holiday/add").set(asAdmin()).send({ title: "Festival", date: tomorrow });
    assert.equal(a.status, 201);
    await request(app).post("/api/holiday/add").set(asAdmin()).send({ title: "Past Day", date: yesterday });

    for (const u of [fx.itDev1.user, fx.clientA.user, fx.admin]) {
      const all = await request(app).get("/api/holiday/all").set(auth(u));
      assert.equal(all.status, 200);
      assert.deepEqual(all.body.holidays.map((h) => [h.title, h.status]), [["Past Day", "Past"], ["Festival", "Upcoming"]]);
      const up = await request(app).get("/api/holiday/upcoming").set(auth(u));
      assert.deepEqual(up.body.holidays.map((h) => h.title), ["Festival"]);
    }
    assert.equal((await request(app).delete(`/api/holiday/${a.body.holiday._id}`).set(auth(fx.itDev1.user))).status, 403);
    assert.equal((await request(app).delete(`/api/holiday/bad`).set(asAdmin())).status, 400);
    assert.equal((await request(app).delete(`/api/holiday/${a.body.holiday._id}`).set(asAdmin())).status, 200);
    assert.equal((await request(app).delete(`/api/holiday/${a.body.holiday._id}`).set(asAdmin())).status, 404);
  });
});

describe("dashboard", () => {
  test("summary is admin only", async () => {
    assert.equal((await request(app).get("/api/dashboard/summary").set(auth(fx.itDev1.user))).status, 403);
    assert.equal((await request(app).get("/api/dashboard/summary").set(auth(fx.clientA.user))).status, 403);
    const r = await request(app).get("/api/dashboard/summary").set(asAdmin());
    assert.equal(r.status, 200);
    assert.equal(r.body.totalEmployees, 7);
  });

  test("leave summary excludes orphaned requests and reflects resolved pending requests", async () => {
    const leaveData = {
      leaveType: "Casual Leave",
      startDate: new Date("2026-10-15T00:00:00Z"),
      endDate: new Date("2026-10-15T00:00:00Z"),
      days: 1,
    };
    const pending = await Leave.create({
      ...leaveData,
      employeeId: fx.itDev1.employee._id,
      status: "Pending",
    });
    await Leave.create({
      ...leaveData,
      employeeId: new mongoose.Types.ObjectId(),
      status: "Pending",
    });
    await Leave.create({
      ...leaveData,
      employeeId: fx.itDev2.employee._id,
      status: "Approved",
    });

    const firstSummary = await request(app).get("/api/dashboard/summary").set(asAdmin());
    assert.equal(firstSummary.status, 200);
    assert.equal(firstSummary.body.leaveSummary.appliedFor, 2);
    assert.equal(firstSummary.body.leaveSummary.pending, 1);
    assert.equal(firstSummary.body.leaveSummary.approved, 1);

    await Leave.updateOne({ _id: pending._id }, { $set: { status: "Cancelled" } });
    const resolvedSummary = await request(app).get("/api/dashboard/summary").set(asAdmin());
    assert.equal(resolvedSummary.status, 200);
    assert.equal(resolvedSummary.body.leaveSummary.pending, 0);
  });
});

describe("announcements", () => {
  const body = { title: "Annual Meet", description: "All hands", type: "Annual", date: "2026-12-01", venue: "HQ", status: "Upcoming" };

  test("mutations admin-only; mass-assignment blocked", async () => {
    assert.equal((await request(app).post("/api/announcements/add").set(auth(fx.itDev1.user)).send(body)).status, 403);
    assert.equal((await request(app).get("/api/announcements").set(auth(fx.itDev1.user))).status, 403);
    const bad = await request(app).post("/api/announcements/add").set(asAdmin()).send({ ...body, type: "Weekly" });
    assert.equal(bad.status, 400);
    const r = await request(app).post("/api/announcements/add").set(asAdmin()).send({ ...body, seenBy: [String(fx.itDev1.user._id)] });
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.announcement.seenBy, []);
    const id = r.body.announcement._id;
    assert.equal((await request(app).put(`/api/announcements/${id}`).set(auth(fx.itDev1.user)).send({ title: "hacked" })).status, 403);
    assert.equal((await request(app).delete(`/api/announcements/${id}`).set(auth(fx.itDev1.user))).status, 403);
    const upd = await request(app).put(`/api/announcements/${id}`).set(asAdmin()).send({ title: "Annual Meet 2" });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.announcement.title, "Annual Meet 2");
  });

  test("public list hides Completed; markAsRead adds only the caller; seenBy not leaked", async () => {
    const a = await Announcement.create({ ...body, seenBy: [fx.opsStaff1.user._id] });
    await Announcement.create({ ...body, title: "Old", status: "Completed" });

    const before = await request(app).get("/api/announcements/public").set(auth(fx.itDev1.user));
    assert.equal(before.status, 200);
    assert.deepEqual(before.body.announcements.map((x) => x.title), ["Annual Meet"]);
    assert.deepEqual(before.body.announcements[0].seenBy, []);
    assert.equal(before.body.announcements[0].seen, false);

    const mark = await request(app).put(`/api/announcements/${a._id}/read`).set(auth(fx.itDev1.user)).send({ userId: String(fx.itDev2.user._id) });
    assert.equal(mark.status, 200);
    const doc = await Announcement.findById(a._id).lean();
    assert.deepEqual(doc.seenBy.map(String).sort(), [String(fx.itDev1.user._id), String(fx.opsStaff1.user._id)].sort());

    const afterRead = await request(app).get("/api/announcements/public").set(auth(fx.itDev1.user));
    assert.deepEqual(afterRead.body.announcements[0].seenBy, [String(fx.itDev1.user._id)]);
    assert.equal(afterRead.body.announcements[0].seen, true);

    const client = await request(app).get("/api/announcements/public").set(auth(fx.clientA.user));
    assert.equal(client.status, 200);
    assert.equal(client.body.announcements.length, 1);

    const completed = await Announcement.findOne({ title: "Old" });
    assert.equal((await request(app).get(`/api/announcements/${completed._id}`).set(auth(fx.itDev1.user))).status, 404);
    assert.equal((await request(app).get(`/api/announcements/${completed._id}`).set(asAdmin())).status, 200);
    assert.equal((await request(app).put(`/api/announcements/${completed._id}/read`).set(auth(fx.itDev1.user))).status, 404);
    assert.equal((await request(app).put(`/api/announcements/bad-id/read`).set(auth(fx.itDev1.user))).body.code, "INVALID_ID");
  });
});

describe("notifications", () => {
  const seed = async () => {
    const alanN = await Notification.create({ type: "leave-status", message: "Approved", data: { userId: fx.itDev1.user._id } });
    const alanStr = await Notification.create({ type: "leave-status", message: "Legacy string id", data: { userId: String(fx.itDev1.user._id) } });
    const beaN = await Notification.create({ type: "leave-status", message: "Rejected", data: { userId: fx.opsStaff1.user._id } });
    const adminN = await Notification.create({ type: "leave-request", message: "New request", data: { adminId: fx.admin._id } });
    return { alanN, alanStr, beaN, adminN };
  };

  test("GET returns only own notifications; client gets []", async () => {
    const n = await seed();
    const alan = await request(app).get("/api/notifications").set(auth(fx.itDev1.user));
    assert.equal(alan.status, 200);
    assert.deepEqual(alan.body.notifications.map((x) => x._id).sort(), [String(n.alanN._id), String(n.alanStr._id)].sort());
    assert.equal(alan.body.unseenCount, 2);
    const admin = await request(app).get("/api/notifications").set(asAdmin());
    assert.deepEqual(admin.body.notifications.map((x) => x._id), [String(n.adminN._id)]);
    const client = await request(app).get("/api/notifications").set(auth(fx.clientA.user));
    assert.deepEqual(client.body.notifications, []);
  });

  test("PATCH /:id/seen by a non-recipient → 404; recipient → 200", async () => {
    const n = await seed();
    const other = await request(app).patch(`/api/notifications/${n.alanN._id}/seen`).set(auth(fx.opsStaff1.user));
    assert.equal(other.status, 404);
    const adminTry = await request(app).patch(`/api/notifications/${n.alanN._id}/seen`).set(asAdmin());
    assert.equal(adminTry.status, 404);
    const clientTry = await request(app).patch(`/api/notifications/${n.alanN._id}/seen`).set(auth(fx.clientA.user));
    assert.equal(clientTry.status, 404);
    assert.equal((await Notification.findById(n.alanN._id).lean()).seen, false);

    const ok = await request(app).patch(`/api/notifications/${n.alanN._id}/seen`).set(auth(fx.itDev1.user));
    assert.equal(ok.status, 200);
    assert.equal((await Notification.findById(n.alanN._id).lean()).seen, true);
    const bad = await request(app).patch(`/api/notifications/zzz/seen`).set(auth(fx.itDev1.user));
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, "INVALID_ID");
    noStack(bad.body);
  });

  test("PATCH /seen-all marks only the caller's notifications", async () => {
    const n = await seed();
    const r = await request(app).patch("/api/notifications/seen-all").set(auth(fx.itDev1.user));
    assert.equal(r.status, 200);
    assert.equal(r.body.modified, 2);
    assert.equal((await Notification.findById(n.beaN._id).lean()).seen, false);
    assert.equal((await Notification.findById(n.adminN._id).lean()).seen, false);
    assert.equal((await request(app).patch("/api/notifications/seen-all")).status, 401);
  });
});

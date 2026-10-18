import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth, findSensitiveKeys } from "./helpers/testEnv.js";

let app, fx, User, Employee, Department;

before(async () => {
  await startTestDb();
  app = await getApp();
  User = (await import("../models/User.js")).default;
  Employee = (await import("../models/Employee.js")).default;
  Department = (await import("../models/Department.js")).default;
});
after(async () => { await stopTestDb(); });
beforeEach(async () => { await clearDb(); fx = await seedFixtures(); });

const asAdmin = () => auth(fx.admin);

describe("department access", () => {
  test("admin only; unauthenticated 401", async () => {
    assert.equal((await request(app).get("/api/department")).status, 401);
    for (const u of [fx.itDev1.user, fx.itManager.user, fx.clientA.user]) {
      assert.equal((await request(app).get("/api/department").set(auth(u))).status, 403);
      assert.equal((await request(app).post("/api/department/add").set(auth(u)).send({ dep_name: "X" })).status, 403);
      assert.equal((await request(app).put(`/api/department/${fx.departments.it._id}`).set(auth(u)).send({ dep_name: "X" })).status, 403);
      assert.equal((await request(app).delete(`/api/department/${fx.departments.empty._id}`).set(auth(u))).status, 403);
      assert.equal((await request(app).get(`/api/department/${fx.departments.it._id}/eligible-managers`).set(auth(u))).status, 403);
    }
    assert.ok(await Department.exists({ _id: fx.departments.empty._id }));
  });
});

describe("department CRUD", () => {
  test("list shape includes manager summary and counts", async () => {
    const r = await request(app).get("/api/department").set(asAdmin());
    assert.equal(r.status, 200);
    const it = r.body.departments.find((d) => d.dep_name === "IT");
    assert.equal(it.managerEmployeeId, String(fx.itManager.employee._id));
    assert.deepEqual(Object.keys(it.manager).sort(), ["designation", "employeeCode", "employeeRecordId", "name", "profileImageUrl"]);
    assert.equal(it.manager.name, "Iris Manager");
    assert.equal(it.managerStatus, "assigned");
    assert.equal(it.memberCount, 3); // Ivan inactive
    assert.equal(it.employeeCount, 4);
    assert.ok(it.updatedAt);
    const empty = r.body.departments.find((d) => d.dep_name === "Empty");
    assert.equal(empty.manager, null);
    assert.equal(empty.memberCount, 0);
    assert.deepEqual(findSensitiveKeys(r.body), []);
  });

  test("create validates name, uniqueness and manager", async () => {
    assert.equal((await request(app).post("/api/department/add").set(asAdmin()).send({ description: "x" })).status, 400);
    const dup = await request(app).post("/api/department/add").set(asAdmin()).send({ dep_name: " it ", description: "dup" });
    assert.equal(dup.status, 409);
    const withMgr = await request(app).post("/api/department/add").set(asAdmin())
      .send({ dep_name: "Sales", description: "S", managerEmployeeId: String(fx.itDev1.employee._id) });
    assert.equal(withMgr.status, 400);
    const ok = await request(app).post("/api/department/add").set(asAdmin()).send({ dep_name: "Sales", description: "S", managerEmployeeId: null });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.department.dep_name, "Sales");
    assert.equal(ok.body.department.managerEmployeeId, null);
  });

  test("get by id: invalid → 400 INVALID_ID, unknown → 404", async () => {
    const bad = await request(app).get("/api/department/abc").set(asAdmin());
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, "INVALID_ID");
    assert.equal(bad.body.stack, undefined);
    assert.equal((await request(app).get(`/api/department/${new mongoose.Types.ObjectId()}`).set(asAdmin())).status, 404);
    const ok = await request(app).get(`/api/department/${fx.departments.ops._id}`).set(asAdmin());
    assert.equal(ok.body.department.manager.name, "Olga Ops");
  });

  test("eligible managers: active members of that department only", async () => {
    const r = await request(app).get(`/api/department/${fx.departments.it._id}/eligible-managers`).set(asAdmin());
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.employees.map((e) => e.name), ["Alan Dev", "Iris Manager", "Sam Same"]);
    assert.deepEqual(Object.keys(r.body.employees[0]).sort(), ["designation", "employeeCode", "employeeRecordId", "name", "profileImageUrl"]);
    assert.deepEqual(findSensitiveKeys(r.body), []);
  });

  test("delete: non-empty → 409 DEPARTMENT_NOT_EMPTY (no cascade); empty → deleted", async () => {
    const r = await request(app).delete(`/api/department/${fx.departments.it._id}`).set(asAdmin());
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "DEPARTMENT_NOT_EMPTY");
    assert.equal(r.body.details.employeeCount, 4);
    assert.equal(await Employee.countDocuments({ department: fx.departments.it._id }), 4);
    assert.ok(await Department.exists({ _id: fx.departments.it._id }));

    // An inactive-only department is still not empty (history retained).
    await Employee.updateMany({ department: fx.departments.ops._id }, { department: fx.departments.it._id });
    const ok = await request(app).delete(`/api/department/${fx.departments.empty._id}`).set(asAdmin());
    assert.equal(ok.status, 200);
    assert.equal((await request(app).delete(`/api/department/${fx.departments.empty._id}`).set(asAdmin())).status, 404);
  });
});

describe("manager assignment", () => {
  const put = (body) => request(app).put(`/api/department/${fx.departments.it._id}`).set(asAdmin()).send(body);

  test("wrong department → 400, inactive → 400, unknown → 400, invalid id → 400", async () => {
    const wrong = await put({ managerEmployeeId: String(fx.opsStaff1.employee._id) });
    assert.equal(wrong.status, 400);
    const inactive = await put({ managerEmployeeId: String(fx.itInactive.employee._id) });
    assert.equal(inactive.status, 400);
    const unknown = await put({ managerEmployeeId: String(new mongoose.Types.ObjectId()) });
    assert.equal(unknown.status, 400);
    const invalid = await put({ managerEmployeeId: "nope" });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, "INVALID_ID");
    const d = await Department.findById(fx.departments.it._id).lean();
    assert.equal(String(d.managerEmployeeId), String(fx.itManager.employee._id));
    assert.equal(d.managerHistory.length, 0);
  });

  test("valid change records history, never changes User.role, bumps updatedAt", async () => {
    const before = await Department.findById(fx.departments.it._id).lean();
    const r = await put({ managerEmployeeId: String(fx.itDev1.employee._id), expectedUpdatedAt: before.updatedAt.toISOString() });
    assert.equal(r.status, 200);
    assert.equal(r.body.department.managerEmployeeId, String(fx.itDev1.employee._id));
    assert.equal(r.body.department.manager.name, "Alan Dev");
    const d = await Department.findById(fx.departments.it._id).lean();
    assert.equal(d.managerHistory.length, 1);
    assert.equal(String(d.managerHistory[0].from), String(fx.itManager.employee._id));
    assert.equal(String(d.managerHistory[0].to), String(fx.itDev1.employee._id));
    assert.equal(String(d.managerHistory[0].changedBy), String(fx.admin._id));
    assert.ok(d.managerHistory[0].changedAt);
    assert.ok(d.updatedAt >= before.updatedAt);
    assert.equal((await User.findById(fx.itDev1.user._id).lean()).role, "employee");
    assert.equal((await User.findById(fx.itManager.user._id).lean()).role, "employee");

    const clear = await put({ managerEmployeeId: null });
    assert.equal(clear.status, 200);
    assert.equal(clear.body.department.manager, null);
    const d2 = await Department.findById(fx.departments.it._id).lean();
    assert.equal(d2.managerHistory.length, 2);
    assert.equal(d2.managerHistory[1].to, null);
  });

  test("stale expectedUpdatedAt → 409 STALE_UPDATE", async () => {
    const stale = new Date(Date.now() - 60000).toISOString();
    const r = await put({ managerEmployeeId: String(fx.itDev1.employee._id), expectedUpdatedAt: stale });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "STALE_UPDATE");
    const bad = await put({ dep_name: "IT2", expectedUpdatedAt: "yesterday-ish" });
    assert.equal(bad.status, 400);
  });

  test("web form echo (whole object, unchanged manager) is accepted without history", async () => {
    const got = await request(app).get(`/api/department/${fx.departments.it._id}`).set(asAdmin());
    // Even if the current manager has become ineligible, echoing it back is not a change.
    await User.updateOne({ _id: fx.itManager.user._id }, { isActive: false });
    const r = await put({ ...got.body.department, description: "Updated description" });
    assert.equal(r.status, 200);
    assert.equal(r.body.department.description, "Updated description");
    assert.equal(r.body.department.managerStatus, "invalid");
    const d = await Department.findById(fx.departments.it._id).lean();
    assert.equal(d.managerHistory.length, 0);
    assert.equal(d.dep_name, "IT");
  });

  test("rename conflicts are rejected", async () => {
    const r = await put({ dep_name: "operations" });
    assert.equal(r.status, 409);
  });
});

describe("assignDepartmentManagers script (in-memory DB only)", () => {
  test("dry-run plan validates; apply writes with history", async () => {
    const { planAssignments, applyAssignments } = await import("../scripts/assignDepartmentManagers.js");
    await Department.updateMany({}, { managerEmployeeId: null });

    const bad = await planAssignments({
      [String(fx.departments.it._id)]: String(fx.opsStaff1.employee._id),
      [String(fx.departments.ops._id)]: String(fx.itInactive.employee._id),
      "not-an-id": null,
    });
    assert.equal(bad.ok, false);
    assert.deepEqual(bad.plan.map((p) => p.status), ["invalid", "invalid", "invalid"]);

    const good = await planAssignments({
      [String(fx.departments.it._id)]: String(fx.itManager.employee._id),
      [String(fx.departments.ops._id)]: String(fx.opsManager.employee._id),
      [String(fx.departments.empty._id)]: null,
    });
    assert.equal(good.ok, true);
    assert.deepEqual(good.plan.map((p) => p.status), ["change", "change", "unchanged"]);
    // Planning alone writes nothing.
    assert.equal(await Department.countDocuments({ managerEmployeeId: { $ne: null } }), 0);

    const changed = await applyAssignments(good.plan);
    assert.equal(changed, 2);
    const it = await Department.findById(fx.departments.it._id).lean();
    assert.equal(String(it.managerEmployeeId), String(fx.itManager.employee._id));
    assert.equal(it.managerHistory.length, 1);
    assert.equal(it.managerHistory[0].reason, "bulk-script");
  });
});

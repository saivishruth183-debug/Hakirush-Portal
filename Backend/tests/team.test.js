import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth, findSensitiveKeys } from "./helpers/testEnv.js";

let app, fx, User, Employee, Department, businessDate;

const SAFE_PERSON_KEYS = ["designation", "employeeCode", "employeeRecordId", "isManager", "isSelf", "name", "profileImageUrl", "userId"];

before(async () => {
  await startTestDb();
  app = await getApp();
  User = (await import("../models/User.js")).default;
  Employee = (await import("../models/Employee.js")).default;
  Department = (await import("../models/Department.js")).default;
  ({ businessDate } = await import("../utils/orgTime.js"));
});
after(async () => { await stopTestDb(); });
beforeEach(async () => { await clearDb(); fx = await seedFixtures(); });

const team = (user, query = "") => request(app).get(`/api/employee/team/me${query}`).set(auth(user));

const assertSafe = (body) => {
  assert.deepEqual(findSensitiveKeys(body), [], `sensitive keys leaked: ${findSensitiveKeys(body).join(", ")}`);
};
const assertSafePersonShape = (p) => assert.deepEqual(Object.keys(p).sort(), SAFE_PERSON_KEYS);

let seq = 100;
const addEmployee = async (name, dept, { active = true, designation = "Analyst" } = {}) => {
  seq += 1;
  const user = await User.create({ name, email: `extra${seq}@test.local`, password: "x".repeat(20), role: "employee", isActive: active });
  const employee = await Employee.create({
    userId: user._id, employeeId: `XTRA${seq}`, department: dept._id ?? dept, designation, salary: 1000 + seq,
    dob: new Date("1991-01-01T00:00:00Z"), aadharcard: "A", pancard: "P", pfNumber: "F",
  });
  return { user, employee };
};

describe("GET /employee/team/me", () => {
  test("IT employee gets IT manager first and only active IT people", async () => {
    const r = await team(fx.itDev1.user);
    assert.equal(r.status, 200);
    const b = r.body;
    assertSafe(b);
    assert.equal(b.version, 1);
    assert.deepEqual(b.department, { id: String(fx.departments.it._id), name: "IT" });
    assert.equal(b.managerStatus, "assigned");
    assertSafePersonShape(b.manager);
    assert.equal(b.manager.employeeRecordId, String(fx.itManager.employee._id));
    assert.equal(b.manager.isManager, true);
    assert.equal(b.manager.isSelf, false);
    assert.equal(b.manager.name, "Iris Manager");

    b.members.forEach(assertSafePersonShape);
    assert.deepEqual(b.members.map((m) => m.name), ["Alan Dev", "Sam Same"]);
    assert.deepEqual(b.members.map((m) => m.isSelf), [true, false]);
    assert.equal(b.members[1].employeeRecordId, String(fx.itDev2.employee._id));
    assert.ok(b.members.every((m) => m.isManager === false));
    assert.equal(b.totalMembers, 3); // manager + Alan + Sam; inactive Ivan excluded
    assert.equal(b.matchedMembers, 2);
    assert.equal(b.page, 1);
    assert.equal(b.limit, 50);
    assert.equal(b.hasMore, false);
    assert.ok(!Number.isNaN(Date.parse(b.updatedAt)));
    const ids = [b.manager, ...b.members].map((p) => p.userId);
    for (const ops of [fx.opsManager, fx.opsStaff1, fx.opsStaff2, fx.itInactive]) assert.ok(!ids.includes(String(ops.user._id)));
  });

  test("Ops employee gets Ops manager first and only Ops people; duplicate 'Sam Same' stays separated", async () => {
    const r = await team(fx.opsStaff1.user);
    assert.equal(r.status, 200);
    assertSafe(r.body);
    assert.equal(r.body.department.name, "Operations");
    assert.equal(r.body.manager.employeeRecordId, String(fx.opsManager.employee._id));
    assert.deepEqual(r.body.members.map((m) => m.name), ["Bea Ops", "Sam Same"]);
    assert.equal(r.body.members[1].employeeRecordId, String(fx.opsStaff2.employee._id));
    assert.notEqual(r.body.members[1].userId, String(fx.itDev2.user._id));

    const itSam = await team(fx.itDev2.user);
    const sams = itSam.body.members.filter((m) => m.name === "Sam Same");
    assert.equal(sams.length, 1);
    assert.equal(sams[0].employeeRecordId, String(fx.itDev2.employee._id));
    assert.equal(sams[0].isSelf, true);
  });

  test("manager self-view: appears once, as manager with isSelf", async () => {
    const r = await team(fx.itManager.user);
    assert.equal(r.body.manager.isSelf, true);
    assert.equal(r.body.manager.isManager, true);
    assert.ok(!r.body.members.some((m) => m.userId === String(fx.itManager.user._id)));
    assert.ok(r.body.members.every((m) => m.isSelf === false));
    assert.equal(r.body.totalMembers, 3);
  });

  test("scope query params are ignored", async () => {
    const q = `?departmentId=${fx.departments.ops._id}&department=${fx.departments.ops._id}&userId=${fx.opsStaff1.user._id}&employeeId=${fx.opsStaff1.employee._id}`;
    const r = await team(fx.itDev1.user, q);
    assert.equal(r.status, 200);
    assert.equal(r.body.department.name, "IT");
    assert.equal(r.body.manager.name, "Iris Manager");
  });

  test("missing manager → unassigned (manager listed as a member)", async () => {
    await Department.updateOne({ _id: fx.departments.it._id }, { managerEmployeeId: null });
    const r = await team(fx.itDev1.user);
    assert.equal(r.body.managerStatus, "unassigned");
    assert.equal(r.body.manager, null);
    assert.deepEqual(r.body.members.map((m) => m.name), ["Alan Dev", "Iris Manager", "Sam Same"]);
    assert.equal(r.body.totalMembers, 3);
  });

  test("inactive manager → unassigned and not listed", async () => {
    await User.updateOne({ _id: fx.itManager.user._id }, { isActive: false });
    const r = await team(fx.itDev1.user);
    assert.equal(r.body.managerStatus, "unassigned");
    assert.equal(r.body.manager, null);
    assert.deepEqual(r.body.members.map((m) => m.name), ["Alan Dev", "Sam Same"]);
    assert.equal(r.body.totalMembers, 2);
  });

  test("manager assignment pointing at another department's employee → unassigned", async () => {
    await Department.updateOne({ _id: fx.departments.it._id }, { managerEmployeeId: fx.opsManager.employee._id });
    const r = await team(fx.itDev1.user);
    assert.equal(r.body.managerStatus, "unassigned");
    assert.equal(r.body.manager, null);
    assert.ok(!r.body.members.some((m) => m.name === "Olga Ops"));
  });

  test("no department → no fallback to other employees", async () => {
    const orphan = await addEmployee("Orphan Person", new mongoose.Types.ObjectId());
    const r = await team(orphan.user);
    assert.equal(r.status, 200);
    assert.equal(r.body.department, null);
    assert.equal(r.body.managerStatus, "no_department");
    assert.equal(r.body.manager, null);
    assert.deepEqual(r.body.members, []);
    assert.equal(r.body.totalMembers, 0);

    // Employee account with no Employee record at all.
    const bare = await User.create({ name: "No Record", email: "norecord@test.local", password: "x".repeat(20), role: "employee" });
    const r2 = await team(bare);
    assert.equal(r2.status, 200);
    assert.equal(r2.body.managerStatus, "no_department");
    assert.deepEqual(r2.body.members, []);
  });

  test("pagination + search keep the manager and never cross departments", async () => {
    for (const n of ["Zed One", "Yan Two", "Xia Three", "Wes Four", "Val Five"]) await addEmployee(n, fx.departments.it);
    await addEmployee("Zara Opsfolk", fx.departments.ops);
    await addEmployee("Gone Person", fx.departments.it, { active: false });

    const seen = [];
    let page = 1;
    for (;;) {
      const r = await team(fx.itDev1.user, `?limit=3&page=${page}`);
      assert.equal(r.status, 200);
      assertSafe(r.body);
      assert.equal(r.body.manager.name, "Iris Manager", "manager on every page");
      assert.equal(r.body.totalMembers, 8);
      assert.equal(r.body.matchedMembers, 7);
      assert.ok(r.body.members.length <= 3);
      seen.push(...r.body.members.map((m) => m.name));
      if (!r.body.hasMore) break;
      page += 1;
    }
    assert.deepEqual(seen, ["Alan Dev", "Sam Same", "Val Five", "Wes Four", "Xia Three", "Yan Two", "Zed One"]);
    assert.ok(!seen.includes("Zara Opsfolk") && !seen.includes("Gone Person") && !seen.includes("Iris Manager"));

    const s = await team(fx.itDev1.user, "?search=sam");
    assert.deepEqual(s.body.members.map((m) => m.employeeRecordId), [String(fx.itDev2.employee._id)]);
    assert.equal(s.body.manager.name, "Iris Manager");
    assert.equal(s.body.matchedMembers, 1);
    assert.equal(s.body.totalMembers, 8);

    const crossDept = await team(fx.itDev1.user, "?search=Bea");
    assert.deepEqual(crossDept.body.members, []);
    assert.equal(crossDept.body.manager.name, "Iris Manager");

    const managerName = await team(fx.itDev1.user, "?search=Iris");
    assert.deepEqual(managerName.body.members, [], "manager is never duplicated into members");

    const byCode = await team(fx.itDev1.user, `?search=${fx.itDev2.employee.employeeId}`);
    assert.equal(byCode.body.members.length, 1);
    const byDesignation = await team(fx.itDev1.user, "?search=analyst");
    assert.equal(byDesignation.body.members.length, 5);

    const regex = await team(fx.itDev1.user, "?search=" + encodeURIComponent(".*(["));
    assert.equal(regex.status, 200);
    assert.deepEqual(regex.body.members, []);

    const capped = await team(fx.itDev1.user, "?limit=1000");
    assert.equal(capped.body.limit, 100);
  });

  test("sorting is case-insensitive by name then id", async () => {
    await addEmployee("alan lower", fx.departments.it);
    await addEmployee("Bob Upper", fx.departments.it);
    const r = await team(fx.itDev1.user);
    assert.deepEqual(r.body.members.map((m) => m.name), ["Alan Dev", "alan lower", "Bob Upper", "Sam Same"]);
  });

  test("only employees may call it", async () => {
    assert.equal((await team(fx.admin)).status, 403);
    assert.equal((await team(fx.clientA.user)).status, 403);
    assert.equal((await request(app).get("/api/employee/team/me")).status, 401);
  });
});

describe("legacy directory endpoints are department-scoped and safe", () => {
  test("GET /employee/by-department/me", async () => {
    const r = await request(app).get("/api/employee/by-department/me").set(auth(fx.itDev1.user));
    assert.equal(r.status, 200);
    assertSafe(r.body);
    assert.deepEqual(r.body.department, { _id: String(fx.departments.it._id), dep_name: "IT" });
    const names = r.body.employees.map((e) => e.userId.name);
    assert.deepEqual(names, ["Iris Manager", "Sam Same"]); // excludes caller and inactive Ivan
    const iris = r.body.employees.find((e) => e.userId.name === "Iris Manager");
    assert.equal(iris.isManager, true);
    assert.equal(iris.employeeId, fx.itManager.employee.employeeId);
    assert.deepEqual(Object.keys(iris).sort(), ["_id", "department", "designation", "employeeId", "isManager", "userId"]);
    assert.deepEqual(Object.keys(iris.userId).sort(), ["_id", "name", "profileImage"]);
    assert.equal((await request(app).get("/api/employee/by-department/me").set(auth(fx.admin))).status, 403);
  });

  test("GET /employee/department/:id/employees", async () => {
    const other = await request(app).get(`/api/employee/department/${fx.departments.ops._id}/employees`).set(auth(fx.itDev1.user));
    assert.equal(other.status, 403);

    const own = await request(app).get(`/api/employee/department/${fx.departments.it._id}/employees`).set(auth(fx.itDev1.user));
    assert.equal(own.status, 200);
    assertSafe(own.body);
    assert.deepEqual(own.body.employees.map((e) => e.userId.name), ["Alan Dev", "Iris Manager", "Sam Same"]);

    const admin = await request(app).get(`/api/employee/department/${fx.departments.ops._id}/employees`).set(auth(fx.admin));
    assert.equal(admin.status, 200);
    assert.equal(admin.body.employees.length, 3);
    assert.ok(admin.body.employees[0].salary !== undefined, "admin keeps the full HR view");

    const bad = await request(app).get(`/api/employee/department/not-an-id/employees`).set(auth(fx.admin));
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, "INVALID_ID");
    assert.equal((await request(app).get(`/api/employee/department/${fx.departments.it._id}/employees`).set(auth(fx.clientA.user))).status, 403);
  });

  test("GET /employee/:id is admin or self only", async () => {
    const opsAsIt = await request(app).get(`/api/employee/${fx.opsStaff1.employee._id}`).set(auth(fx.itDev1.user));
    assert.equal(opsAsIt.status, 403);
    const opsUserAsIt = await request(app).get(`/api/employee/${fx.opsStaff1.user._id}`).set(auth(fx.itDev1.user));
    assert.equal(opsUserAsIt.status, 403);
    const nonexistent = await request(app).get(`/api/employee/${new mongoose.Types.ObjectId()}`).set(auth(fx.itDev1.user));
    assert.equal(nonexistent.status, 403);

    const selfByRecord = await request(app).get(`/api/employee/${fx.itDev1.employee._id}`).set(auth(fx.itDev1.user));
    assert.equal(selfByRecord.status, 200);
    assert.equal(selfByRecord.body.employee.salary, fx.itDev1.employee.salary);
    const selfByUser = await request(app).get(`/api/employee/${fx.itDev1.user._id}`).set(auth(fx.itDev1.user));
    assert.equal(selfByUser.status, 200);
    assert.equal(selfByUser.body.employee.userId.password, undefined);
    assert.equal(selfByUser.body.employee.userId.tokenVersion, undefined);

    const admin = await request(app).get(`/api/employee/${fx.opsStaff1.employee._id}`).set(auth(fx.admin));
    assert.equal(admin.status, 200);
    assert.equal(admin.body.employee.isActive, true);
    assert.equal((await request(app).get(`/api/employee/${fx.opsStaff1.employee._id}`).set(auth(fx.clientA.user))).status, 403);
    assert.equal((await request(app).get(`/api/employee/${new mongoose.Types.ObjectId()}`).set(auth(fx.admin))).status, 404);
    assert.equal((await request(app).get(`/api/employee/xyz`).set(auth(fx.admin))).body.code, "INVALID_ID");
  });

  test("GET /employee (all) is admin only", async () => {
    assert.equal((await request(app).get("/api/employee").set(auth(fx.itDev1.user))).status, 403);
    const r = await request(app).get("/api/employee").set(auth(fx.admin));
    assert.equal(r.status, 200);
    assert.equal(r.body.employees.length, 7);
    const ivan = r.body.employees.find((e) => e.userId.email === "ivan@test.local");
    assert.equal(ivan.isActive, false);
    const paged = await request(app).get("/api/employee?page=2&limit=5").set(auth(fx.admin));
    assert.equal(paged.body.employees.length, 2);
    assert.equal(paged.body.total, 7);
  });

  test("birthdays / anniversaries / new joiners: employee sees own department only, safe fields", async () => {
    const todayYmd = businessDate(new Date());
    const [y, mm, dd] = todayYmd.split("-");
    const birthYear = mm === "02" && dd === "29" ? 1992 : 1990;
    const dobToday = new Date(`${birthYear}-${mm}-${dd}T00:00:00Z`);
    const joinedToday = new Date(`${Number(y) - 3}-${mm}-${dd === "29" && mm === "02" ? "28" : dd}T00:00:00Z`);
    for (const e of [fx.itDev2, fx.opsStaff1, fx.itInactive]) {
      await Employee.updateOne({ _id: e.employee._id }, { dob: dobToday, dateOfJoining: joinedToday });
    }

    const b = await request(app).get("/api/employee/birthdays").set(auth(fx.itDev1.user));
    assert.equal(b.status, 200);
    assertSafe(b.body);
    assert.deepEqual(b.body.today.map((x) => x.name), ["Sam Same"]);
    assert.equal(b.body.today[0]._id, String(fx.itDev2.employee._id));
    assert.equal(b.body.today[0].monthDay, `${mm}-${dd}`);
    assert.equal(b.body.today[0].department, "IT");
    assert.deepEqual(Object.keys(b.body.today[0]).sort(), ["_id", "department", "monthDay", "name", "profileImage"]);

    const adminB = await request(app).get("/api/employee/birthdays").set(auth(fx.admin));
    assert.deepEqual(adminB.body.today.map((x) => x.name).sort(), ["Bea Ops", "Sam Same"]);
    assert.ok(typeof adminB.body.today[0].age === "number");

    const a = await request(app).get("/api/employee/anniversaries").set(auth(fx.itDev1.user));
    assert.equal(a.status, 200);
    assertSafe(a.body);
    assert.deepEqual(a.body.today.map((x) => x.name), ["Sam Same"]);
    assert.equal(a.body.today[0].years, 3);
    assert.equal(a.body.today[0].monthDay.length, 5);

    const n = await request(app).get("/api/employee/new/recent").set(auth(fx.itDev1.user));
    assert.equal(n.status, 200);
    assertSafe(n.body);
    const newNames = n.body.employees.map((x) => x.name).sort();
    assert.deepEqual(newNames, ["Alan Dev", "Iris Manager"]); // Sam joined 3y ago; Ops excluded; Ivan inactive
    assert.equal(n.body.employees[0].email, undefined);
    const adminN = await request(app).get("/api/employee/new/recent").set(auth(fx.admin));
    assert.ok(adminN.body.employees.some((x) => x.name === "Olga Ops"));

    for (const p of ["birthdays", "anniversaries", "new/recent"]) {
      assert.equal((await request(app).get(`/api/employee/${p}`).set(auth(fx.clientA.user))).status, 403);
    }
  });
});

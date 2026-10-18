import { test, before, after, beforeEach, describe, mock } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth, PASSWORD } from "./helpers/testEnv.js";

let app, fx, User, Employee, Department, RefreshToken;

before(async () => {
  await startTestDb();
  app = await getApp();
  User = (await import("../models/User.js")).default;
  Employee = (await import("../models/Employee.js")).default;
  Department = (await import("../models/Department.js")).default;
  RefreshToken = (await import("../models/RefreshToken.js")).default;
});
after(async () => { await stopTestDb(); });
beforeEach(async () => { await clearDb(); fx = await seedFixtures(); });

const asAdmin = () => auth(fx.admin);
const deptOf = async (empId) => String((await Employee.findById(empId).lean()).department);
const managerOf = async (deptId) => {
  const d = await Department.findById(deptId).lean();
  return d.managerEmployeeId ? String(d.managerEmployeeId) : null;
};

describe("transfer of a department manager", () => {
  const transfer = (emp, body) => request(app).put(`/api/employee/${emp.employee._id}`).set(asAdmin()).send(body);

  test("without a decision → 409 MANAGER_REASSIGNMENT_REQUIRED and nothing changes", async () => {
    const r = await transfer(fx.itManager, { department: String(fx.departments.ops._id) });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "MANAGER_REASSIGNMENT_REQUIRED");
    assert.equal(r.body.details.departmentId, String(fx.departments.it._id));
    assert.equal(await deptOf(fx.itManager.employee._id), String(fx.departments.it._id));
    assert.equal(await managerOf(fx.departments.it._id), String(fx.itManager.employee._id));
  });

  test("clearManager: true moves the employee and clears the assignment with history", async () => {
    const r = await transfer(fx.itManager, { department: String(fx.departments.ops._id), clearManager: "true", designation: "Ops Lead" });
    assert.equal(r.status, 200);
    assert.equal(await deptOf(fx.itManager.employee._id), String(fx.departments.ops._id));
    assert.equal(await managerOf(fx.departments.it._id), null);
    const emp = await Employee.findById(fx.itManager.employee._id).lean();
    assert.equal(emp.designation, "Ops Lead");
    const d = await Department.findById(fx.departments.it._id).lean();
    assert.equal(d.managerHistory.length, 1);
    assert.equal(d.managerHistory[0].reason, "transfer");
    assert.equal(String(d.managerHistory[0].changedBy), String(fx.admin._id));
    // Ops manager untouched.
    assert.equal(await managerOf(fx.departments.ops._id), String(fx.opsManager.employee._id));
  });

  test("valid replacement takes over; invalid replacements are rejected", async () => {
    const self = await transfer(fx.itManager, { department: String(fx.departments.ops._id), replacementManagerEmployeeId: String(fx.itManager.employee._id) });
    assert.equal(self.status, 400);
    const otherDept = await transfer(fx.itManager, { department: String(fx.departments.ops._id), replacementManagerEmployeeId: String(fx.opsStaff1.employee._id) });
    assert.equal(otherDept.status, 400);
    const inactive = await transfer(fx.itManager, { department: String(fx.departments.ops._id), replacementManagerEmployeeId: String(fx.itInactive.employee._id) });
    assert.equal(inactive.status, 400);
    const badId = await transfer(fx.itManager, { department: String(fx.departments.ops._id), replacementManagerEmployeeId: "zzz" });
    assert.equal(badId.status, 400);
    assert.equal(await deptOf(fx.itManager.employee._id), String(fx.departments.it._id));

    const ok = await transfer(fx.itManager, { department: String(fx.departments.ops._id), replacementManagerEmployeeId: String(fx.itDev1.employee._id) });
    assert.equal(ok.status, 200);
    assert.equal(await managerOf(fx.departments.it._id), String(fx.itDev1.employee._id));
    assert.equal(await deptOf(fx.itManager.employee._id), String(fx.departments.ops._id));
  });

  test("non-manager transfer needs no decision; unknown department → 400", async () => {
    const bad = await transfer(fx.itDev1, { department: String(new mongoose.Types.ObjectId()) });
    assert.equal(bad.status, 400);
    const ok = await transfer(fx.itDev1, { department: String(fx.departments.ops._id) });
    assert.equal(ok.status, 200);
    assert.equal(await deptOf(fx.itDev1.employee._id), String(fx.departments.ops._id));
    assert.equal(await managerOf(fx.departments.it._id), String(fx.itManager.employee._id));
  });

  test("if the employee write fails the manager change is rolled back", async () => {
    const m = mock.method(Employee, "updateOne", async () => { throw new Error("simulated write failure"); });
    try {
      const r = await transfer(fx.itManager, { department: String(fx.departments.ops._id), clearManager: true });
      assert.equal(r.status, 500);
      assert.equal(r.body.code, "INTERNAL");
      assert.ok(!JSON.stringify(r.body).includes("simulated"), "internal messages are not leaked");
    } finally {
      m.mock.restore();
    }
    assert.equal(await managerOf(fx.departments.it._id), String(fx.itManager.employee._id));
    const d = await Department.findById(fx.departments.it._id).lean();
    assert.equal(d.managerHistory.length, 0);
    assert.equal(await deptOf(fx.itManager.employee._id), String(fx.departments.it._id));
  });
});

describe("deactivation", () => {
  test("DELETE of a manager requires a decision; then deactivates (retention-safe) and kills sessions", async () => {
    const login = await request(app).post("/api/auth/mobile/login").send({ email: "iris@test.local", password: PASSWORD });
    assert.equal(login.status, 200);

    const blocked = await request(app).delete(`/api/employee/${fx.itManager.employee._id}`).set(asAdmin());
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, "MANAGER_REASSIGNMENT_REQUIRED");
    assert.equal((await User.findById(fx.itManager.user._id).lean()).isActive, true);

    const r = await request(app).delete(`/api/employee/${fx.itManager.employee._id}`).set(asAdmin()).send({ clearManager: true });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { success: true, deactivated: true });
    const u = await User.findById(fx.itManager.user._id).lean();
    assert.equal(u.isActive, false);
    assert.equal(u.tokenVersion, 1);
    assert.ok(await Employee.exists({ _id: fx.itManager.employee._id }), "HR record retained");
    assert.equal(await managerOf(fx.departments.it._id), null);
    assert.equal(await RefreshToken.countDocuments({ userId: fx.itManager.user._id, revokedAt: null }), 0);

    const v = await request(app).post("/api/auth/verify").set({ Authorization: `Bearer ${login.body.accessToken}` });
    assert.equal(v.status, 403);
    assert.equal(v.body.code, "ACCOUNT_INACTIVE");
    const rf = await request(app).post("/api/auth/mobile/refresh").send({ refreshToken: login.body.refreshToken });
    assert.equal(rf.status, 403);
    assert.equal(rf.body.code, "ACCOUNT_INACTIVE");
  });

  test("DELETE accepts clearManager via query string; non-manager needs nothing", async () => {
    const r = await request(app).delete(`/api/employee/${fx.opsManager.employee._id}?clearManager=true`).set(asAdmin());
    assert.equal(r.status, 200);
    const plain = await request(app).delete(`/api/employee/${fx.itDev2.employee._id}`).set(asAdmin());
    assert.equal(plain.status, 200);
    assert.equal((await User.findById(fx.itDev2.user._id).lean()).isActive, false);
  });

  test("PATCH /:id/status with replacement; reactivation; validation", async () => {
    const missing = await request(app).patch(`/api/employee/${fx.itManager.employee._id}/status`).set(asAdmin()).send({});
    assert.equal(missing.status, 400);
    const blocked = await request(app).patch(`/api/employee/${fx.itManager.employee._id}/status`).set(asAdmin()).send({ isActive: false });
    assert.equal(blocked.status, 409);
    const ok = await request(app).patch(`/api/employee/${fx.itManager.employee._id}/status`).set(asAdmin())
      .send({ isActive: false, replacementManagerEmployeeId: String(fx.itDev2.employee._id) });
    assert.equal(ok.status, 200);
    assert.equal(await managerOf(fx.departments.it._id), String(fx.itDev2.employee._id));
    assert.equal((await User.findById(fx.itManager.user._id).lean()).isActive, false);
    const inactiveEmployee = await Employee.findById(fx.itManager.employee._id).lean();
    assert.ok(inactiveEmployee.inactiveSince instanceof Date);

    const back = await request(app).patch(`/api/employee/${fx.itManager.employee._id}/status`).set(asAdmin()).send({ isActive: true });
    assert.equal(back.status, 200);
    assert.equal((await User.findById(fx.itManager.user._id).lean()).isActive, true);
    const reactivatedEmployee = await Employee.findById(fx.itManager.employee._id).lean();
    assert.equal(reactivatedEmployee.inactiveSince, undefined);
    assert.ok(reactivatedEmployee.inactiveDurationMs >= 0);

    assert.equal((await request(app).patch(`/api/employee/${fx.itDev1.employee._id}/status`).set(auth(fx.itDev1.user)).send({ isActive: false })).status, 403);
  });

  test("employees cannot delete/update other employees", async () => {
    assert.equal((await request(app).delete(`/api/employee/${fx.itDev2.employee._id}`).set(auth(fx.itDev1.user))).status, 403);
    assert.equal((await request(app).put(`/api/employee/${fx.itDev1.employee._id}`).set(auth(fx.itDev1.user)).send({ salary: 1 })).status, 403);
    assert.equal((await User.findById(fx.itDev2.user._id).lean()).isActive, true);
  });
});

describe("self profile edit", () => {
  const edit = (who, id, body) => request(app).put(`/api/employee/update-profile/${id}`).set(auth(who)).send(body);

  test("forbidden fields → 403 FIELD_NOT_EDITABLE; nothing written", async () => {
    const r = await edit(fx.itDev1.user, fx.itDev1.user._id, { name: "Alan Renamed", salary: 999999, department: String(fx.departments.ops._id), role: "admin" });
    assert.equal(r.status, 403);
    assert.equal(r.body.code, "FIELD_NOT_EDITABLE");
    assert.deepEqual(r.body.details.fields.sort(), ["department", "role", "salary"]);
    assert.equal((await User.findById(fx.itDev1.user._id).lean()).name, "Alan Dev");
    const emp = await Employee.findById(fx.itDev1.employee._id).lean();
    assert.equal(emp.salary, fx.itDev1.employee.salary);

    for (const body of [{ designation: "CTO" }, { employeeId: "HACK1" }, { email: "x@y.z" }, { userId: String(fx.admin._id) }, { manager: String(fx.itManager.employee._id) }, { isActive: "false" }]) {
      const x = await edit(fx.itDev1.user, fx.itDev1.employee._id, body);
      assert.equal(x.status, 403, JSON.stringify(body));
      assert.equal(x.body.code, "FIELD_NOT_EDITABLE");
    }
  });

  test("allowed fields succeed; unchanged protected values are tolerated (web compatibility)", async () => {
    const r = await edit(fx.itDev1.user, fx.itDev1.employee._id, {
      name: "Alan Updated", experience: "4", dob: "1992-03-04", bloodGroup: "B+", maritalStatus: "Married",
      aadharcard: " 1234 ", pancard: "ABCDE1234F", pfNumber: "PF-9",
      salary: String(fx.itDev1.employee.salary), department: String(fx.departments.it._id), designation: "Developer",
      employeeId: fx.itDev1.employee.employeeId, email: "ALAN@test.local", role: "employee", manager: "",
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const u = await User.findById(fx.itDev1.user._id).lean();
    assert.equal(u.name, "Alan Updated");
    const e = await Employee.findById(fx.itDev1.employee._id).lean();
    assert.equal(e.experience, "4");
    assert.equal(e.bloodGroup, "B+");
    assert.equal(e.maritalStatus, "Married");
    assert.equal(e.aadharcard, "1234");
    assert.equal(e.dob.toISOString().slice(0, 10), "1992-03-04");

    const clear = await edit(fx.itDev1.user, fx.itDev1.employee._id, { bloodGroup: "", maritalStatus: "", dob: "" });
    assert.equal(clear.status, 200);
    const e2 = await Employee.findById(fx.itDev1.employee._id).lean();
    assert.equal(e2.bloodGroup, null);
    assert.equal(e2.dob, null);
  });

  test("validation and ownership", async () => {
    assert.equal((await edit(fx.itDev1.user, fx.itDev1.employee._id, { bloodGroup: "Z+" })).status, 400);
    assert.equal((await edit(fx.itDev1.user, fx.itDev1.employee._id, { maritalStatus: "Complicated" })).status, 400);
    assert.equal((await edit(fx.itDev1.user, fx.itDev1.employee._id, { dob: "2999-01-01" })).status, 400);
    assert.equal((await edit(fx.itDev1.user, fx.itDev1.employee._id, { dob: "1990-02-30" })).status, 400);
    assert.equal((await edit(fx.itDev1.user, fx.itDev1.employee._id, { name: "" })).status, 400);
    const other = await edit(fx.itDev1.user, fx.itDev2.employee._id, { name: "Hacked" });
    assert.equal(other.status, 403);
    assert.equal((await User.findById(fx.itDev2.user._id).lean()).name, "Sam Same");
    assert.equal((await edit(fx.clientA.user, fx.itDev2.employee._id, { name: "x" })).status, 403);
  });

  test("admin may use update-profile with the admin field set", async () => {
    const r = await edit(fx.admin, fx.itDev1.employee._id, { salary: 12345, designation: "Senior Developer" });
    assert.equal(r.status, 200);
    const e = await Employee.findById(fx.itDev1.employee._id).lean();
    assert.equal(e.salary, 12345);
    assert.equal(e.designation, "Senior Developer");
  });
});

describe("add employee", () => {
  const base = () => ({
    name: "New Person", email: "New.Person@Test.Local", employeeId: "HAKI9001", department: String(fx.departments.it._id),
    designation: "Intern", salary: "1000", password: "Initial-Pass-1", role: "employee", gender: "Female",
    maritalStatus: "Single", bloodGroup: "A+", dob: "2000-01-02", experience: "1",
  });
  const add = (body, who = fx.admin) => request(app).post("/api/employee/add").set(auth(who)).send(body);

  test("creates user + employee; manager field ignored; email normalized", async () => {
    const r = await add({ ...base(), manager: String(fx.itManager.employee._id) });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.employee.manager, undefined);
    const u = await User.findOne({ email: "new.person@test.local" }).lean();
    assert.equal(u.role, "employee");
    const e = await Employee.findOne({ employeeId: "HAKI9001" }).lean();
    assert.equal(e.experience, "1");
    assert.equal(e.manager, undefined);
    assert.equal(await managerOf(fx.departments.it._id), String(fx.itManager.employee._id));
    const login = await request(app).post("/api/auth/login").send({ email: "new.person@test.local", password: "Initial-Pass-1" });
    assert.equal(login.status, 200);
  });

  test("role defaults to employee, admin only when explicit, others rejected", async () => {
    const omitted = await add({ ...base(), role: undefined });
    assert.equal(omitted.status, 201);
    assert.equal((await User.findOne({ email: "new.person@test.local" }).lean()).role, "employee");
    const client = await add({ ...base(), email: "c@test.local", employeeId: "HAKI9002", role: "client" });
    assert.equal(client.status, 400);
    const admin = await add({ ...base(), email: "a2@test.local", employeeId: "HAKI9003", role: "admin" });
    assert.equal(admin.status, 201);
    assert.equal((await User.findOne({ email: "a2@test.local" }).lean()).role, "admin");
  });

  test("validation and uniqueness", async () => {
    const cases = [
      [{ salary: "-5" }, 400], [{ salary: "abc" }, 400], [{ email: "not-an-email" }, 400],
      [{ department: "xyz" }, 400], [{ department: String(new mongoose.Types.ObjectId()) }, 400],
      [{ bloodGroup: "Q" }, 400], [{ gender: "Robot" }, 400], [{ dob: "garbage" }, 400],
      [{ password: "short" }, 400], [{ name: "" }, 400],
      [{ email: "alan@test.local" }, 409], [{ employeeId: fx.itDev1.employee.employeeId }, 409],
    ];
    for (const [patch, status] of cases) {
      const r = await add({ ...base(), ...patch });
      assert.equal(r.status, status, JSON.stringify(patch));
      assert.equal(r.body.success, false);
    }
    assert.equal(await User.countDocuments({ email: "new.person@test.local" }), 0);
    assert.equal((await add(base(), fx.itDev1.user)).status, 403);
    assert.equal((await request(app).post("/api/employee/add").send(base())).status, 401);
  });
});

describe("own record & aliases", () => {
  test("GET /employee/me returns own record with managerOfDepartment", async () => {
    const iris = await request(app).get("/api/employee/me").set(auth(fx.itManager.user));
    assert.equal(iris.status, 200);
    assert.equal(iris.body.employee._id, String(fx.itManager.employee._id));
    assert.equal(iris.body.employee.managerOfDepartment, true);
    assert.deepEqual(iris.body.employee.department, { _id: String(fx.departments.it._id), dep_name: "IT" });
    assert.equal(iris.body.employee.userId.password, undefined);
    const alan = await request(app).get("/api/employee/me").set(auth(fx.itDev1.user));
    assert.equal(alan.body.employee.managerOfDepartment, false);
    assert.equal(alan.body.employee.salary, fx.itDev1.employee.salary);
    assert.equal((await request(app).get("/api/employee/me").set(auth(fx.admin))).status, 403);
  });

  test("GET /employee/leave/balance/me is the leave-balance alias (employee only)", async () => {
    const r = await request(app).get("/api/employee/leave/balance/me").set(auth(fx.itDev1.user));
    assert.equal(r.status, 200);
    assert.ok(r.body.casual && r.body.sick);
    assert.equal((await request(app).get("/api/employee/leave/balance/me").set(auth(fx.admin))).status, 403);
  });
});

describe("image upload validation", () => {
  const upload = (buf, filename, contentType, field = "profileImage") =>
    request(app)
      .put(`/api/employee/update-profile/${fx.itDev1.employee._id}`)
      .set(auth(fx.itDev1.user))
      .field("name", "Alan Dev")
      .attach(field, buf, { filename, contentType });

  const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(64)]);

  test("HEIC is rejected with 415 UNSUPPORTED_FILE (by name/type and by content)", async () => {
    const byName = await upload(heic, "IMG_0001.HEIC", "image/heic");
    assert.equal(byName.status, 415);
    assert.equal(byName.body.code, "UNSUPPORTED_FILE");
    assert.match(byName.body.error, /HEIC/);
    const disguised = await upload(heic, "photo.jpg", "image/jpeg");
    assert.equal(disguised.status, 415);
    assert.match(disguised.body.error, /HEIC/);
  });

  test("non-image bytes with an image mimetype → 415; non-image type → 415", async () => {
    const fake = await upload(Buffer.from("this is definitely not a png file at all"), "x.png", "image/png");
    assert.equal(fake.status, 415);
    assert.equal(fake.body.code, "UNSUPPORTED_FILE");
    const svg = await upload(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), "x.svg", "image/svg+xml");
    assert.equal(svg.status, 415);
    const pdf = await upload(Buffer.from("%PDF-1.7 fake"), "x.pdf", "application/pdf");
    assert.equal(pdf.status, 415);
  });

  test("files over 5 MB → 413 FILE_TOO_LARGE", async () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(5 * 1024 * 1024 + 10)]);
    const r = await upload(big, "big.jpg", "image/jpeg");
    assert.equal(r.status, 413);
    assert.equal(r.body.code, "FILE_TOO_LARGE");
    assert.equal(r.body.success, false);
  });

  test("unexpected file field → 400 normalized JSON", async () => {
    const r = await upload(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]), "a.jpg", "image/jpeg", "avatar");
    assert.equal(r.status, 400);
    assert.equal(r.body.code, "VALIDATION_ERROR");
  });

  test("signature detection unit checks", async () => {
    const { detectImageType } = await import("../middleware/upload.js");
    const pad = Buffer.alloc(16);
    assert.equal(detectImageType(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), pad])).mime, "image/jpeg");
    assert.equal(detectImageType(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pad])).mime, "image/png");
    assert.equal(detectImageType(Buffer.concat([Buffer.from("GIF89a"), pad])).mime, "image/gif");
    assert.equal(detectImageType(Buffer.concat([Buffer.from("RIFF"), Buffer.from([1, 2, 3, 4]), Buffer.from("WEBP"), pad])).mime, "image/webp");
    assert.equal(detectImageType(heic).heif, true);
    assert.equal(detectImageType(Buffer.from("hello world, plain text")), null);
  });
});

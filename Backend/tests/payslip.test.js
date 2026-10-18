import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth } from "./helpers/testEnv.js";
import {
  ensureDomainIndexes, setClock, setJoiningDates, ist, installFakeImageKit, pdfBytes, PNG_BYTES, streamedResponse,
} from "./helpers/domain.js";

let app, fx, ikLog, fetchLog, Payslip, Attendance, Leave, setPayslipFetch, payslipFiles;
// Default upstream: a valid PDF, streamed. Tests may replace `upstream` with a function(url, init) -> Response.
let upstream = null;
const defaultUpstream = () => streamedResponse([pdfBytes(2048)]);
const { formatPayPeriod } = await import("../services/pdfPayslipGenerator.js");

before(async () => {
  await startTestDb();
  app = await getApp();
  await ensureDomainIndexes();
  Payslip = (await import("../models/Payslip.js")).default;
  Attendance = (await import("../models/Attendance.js")).default;
  Leave = (await import("../models/Leave.js")).default;
  ikLog = await installFakeImageKit();
  payslipFiles = await import("../services/payslipFiles.js");
  ({ setPayslipFetch } = payslipFiles);
  setPayslipFetch(async (url, init) => {
    fetchLog.push({ url, init });
    return (upstream || defaultUpstream)(url, init);
  });
});
after(async () => {
  setPayslipFetch(null);
  const { setImageKitClient } = await import("../utils/uploadToImageKit.js");
  setImageKitClient(null);
  await setClock(null);
  await stopTestDb();
});
beforeEach(async () => {
  await clearDb();
  fx = await seedFixtures();
  await setJoiningDates("2026-01-01");
  await setClock(ist("2026-09-30 12:00"));
  fetchLog = [];
  upstream = null;
  ikLog.uploads.length = 0;
  ikLog.deletes.length = 0;
});

const FIELDS = {
  month: "2026-09",
  basicSalary: "50000",
  hra: "10000",
  overtimeHours: "10",
  overtimeRate: "200",
  providentFund: "1800",
  incomeTax: "2000",
  // Client-sent totals must be ignored.
  overtimePay: "1",
  grossSalary: "1",
  totalDeductions: "1",
  netSalary: "999999",
};

const addPayslip = (user, { employeeId, fields = FIELDS, file = pdfBytes(), field = "payslip", filename = "slip.pdf" } = {}) => {
  let req = request(app).post("/api/payslip/add").set(auth(user));
  req = req.field("employeeId", String(employeeId));
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  if (file) req = req.attach(field, file, { filename, contentType: "application/pdf" });
  return req;
};

test("upload validation: PDF signature (415), size (413), field name, auth before parsing", async () => {
  const emp = fx.itDev1.employee._id;

  const notPdf = await addPayslip(fx.admin, { employeeId: emp, file: PNG_BYTES, filename: "fake.pdf" });
  assert.equal(notPdf.status, 415);
  assert.equal(notPdf.body.code, "UNSUPPORTED_FILE");

  const big = await addPayslip(fx.admin, { employeeId: emp, file: pdfBytes(5 * 1024 * 1024 + 10) });
  assert.equal(big.status, 413);
  assert.equal(big.body.code, "FILE_TOO_LARGE");

  const wrongField = await addPayslip(fx.admin, { employeeId: emp, field: "document" });
  assert.equal(wrongField.status, 400);

  const noFile = await addPayslip(fx.admin, { employeeId: emp, file: null });
  assert.equal(noFile.status, 400);

  const asEmployee = await addPayslip(fx.itDev1.user, { employeeId: emp });
  assert.equal(asEmployee.status, 403);

  assert.equal(ikLog.uploads.length, 0);
  assert.equal(await Payslip.countDocuments({}), 0);
});

test("server computes totals from validated numbers; month/employee/duplicate checks", async () => {
  const emp = fx.itDev1.employee._id;
  const r = await addPayslip(fx.admin, { employeeId: emp });
  assert.equal(r.status, 201);
  const p = r.body.payslip;
  assert.equal(p.overtimePay, 2000);
  assert.equal(p.grossSalary, 62000);
  assert.equal(p.totalDeductions, 3800);
  assert.equal(p.netSalary, 58200);
  assert.equal(p.paymentStatus, "Paid");
  assert.equal(p.hasFile, true);
  assert.equal(p.fileId, undefined);
  assert.equal(p.filePath, undefined);
  assert.match(p.payslipFile, /ik-s=/); // admin sees a short-lived signed URL only

  assert.equal(ikLog.uploads.length, 1);
  assert.equal(ikLog.uploads[0].isPrivateFile, true);
  assert.equal(ikLog.uploads[0].folder, "payslips");
  const stored = await Payslip.findById(p._id).lean();
  assert.ok(stored.fileId);
  assert.ok(stored.filePath);

  const dup = await addPayslip(fx.admin, { employeeId: emp });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.code, "CONFLICT");

  // Employee referenced by userId also works (legacy).
  const byUser = await addPayslip(fx.admin, { employeeId: fx.itDev2.user._id });
  assert.equal(byUser.status, 201);

  const cases = [
    [{ ...FIELDS, month: "2026-13" }, 400],
    [{ ...FIELDS, month: "September" }, 400],
    [{ ...FIELDS, month: "2026-08", hra: "-5" }, 400],
    [{ ...FIELDS, month: "2026-08", bonus: "abc" }, 400],
    [{ ...FIELDS, month: "2026-08", basicSalary: "0" }, 400],
    [{ ...FIELDS, month: "2026-08", overtimeHours: "1e9" }, 400],
    [{ ...FIELDS, month: "2026-08", paymentStatus: "Maybe" }, 400],
  ];
  for (const [fields, status] of cases) {
    const bad = await addPayslip(fx.admin, { employeeId: emp, fields });
    assert.equal(bad.status, status, JSON.stringify(fields).slice(0, 60));
  }
  const unknownEmp = await addPayslip(fx.admin, { employeeId: fx.admin._id, fields: { ...FIELDS, month: "2026-08" } });
  assert.equal(unknownEmp.status, 404);
  const badId = await addPayslip(fx.admin, { employeeId: "abc", fields: { ...FIELDS, month: "2026-08" } });
  assert.equal(badId.status, 400);
});

test("auto-generated payslip applies LOP only for absent days, not approved leave", async () => {
  const employee = fx.itDev1.employee;
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = `2026-09-${String(index + 1).padStart(2, "0")}`;
    return {
      employeeId: employee._id,
      date,
      status: date === "2026-09-14" ? "Absent" : "Present",
    };
  });
  await Attendance.insertMany(days);
  await Leave.create({
    employeeId: employee._id,
    leaveType: "Casual Leave",
    startDate: new Date("2026-09-15T00:00:00Z"),
    endDate: new Date("2026-09-15T00:00:00Z"),
    status: "Approved",
    days: 1,
  });

  const response = await request(app)
    .post("/api/payslip/auto-generate")
    .set(auth(fx.admin))
    .send({ employeeId: String(employee._id), month: "2026-09" });

  assert.equal(response.status, 201);
  assert.equal(response.body.payslip.lossOfPay, Math.round(employee.salary / days.length));
});

test("payslip PDF pay period uses the full month and year", () => {
  assert.equal(formatPayPeriod("2026-09"), "September 2026");
});

test("admin can delete a payslip and its private PDF", async () => {
  const payslip = (await addPayslip(fx.admin, { employeeId: fx.itDev1.employee._id })).body.payslip;
  const stored = await Payslip.findById(payslip._id).lean();

  const denied = await request(app)
    .delete(`/api/payslip/${payslip._id}`)
    .set(auth(fx.itDev1.user));
  assert.equal(denied.status, 403);
  assert.equal(await Payslip.countDocuments({ _id: payslip._id }), 1);
  assert.equal(ikLog.deletes.length, 0);

  const deleted = await request(app)
    .delete(`/api/payslip/${payslip._id}`)
    .set(auth(fx.admin));
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.success, true);
  assert.equal(await Payslip.countDocuments({ _id: payslip._id }), 0);
  assert.deepEqual(ikLog.deletes, [stored.fileId]);

  const missing = await request(app)
    .delete(`/api/payslip/${payslip._id}`)
    .set(auth(fx.admin));
  assert.equal(missing.status, 404);
  const invalidId = await request(app)
    .delete("/api/payslip/not-an-id")
    .set(auth(fx.admin));
  assert.equal(invalidId.status, 400);
});

test("lists: employee sees own only, with hasFile and no file URL", async () => {
  const mine = await addPayslip(fx.admin, { employeeId: fx.itDev1.employee._id });
  await addPayslip(fx.admin, { employeeId: fx.itDev2.employee._id });

  const me = await request(app).get("/api/payslip/me").set(auth(fx.itDev1.user));
  assert.equal(me.status, 200);
  assert.equal(me.body.payslips.length, 1);
  const item = me.body.payslips[0];
  assert.equal(item._id, mine.body.payslip._id);
  assert.equal(item.hasFile, true);
  assert.equal(item.payslipFile, undefined);
  assert.equal(item.fileId, undefined);
  assert.equal(item.filePath, undefined);

  const legacyOwnByUser = await request(app).get(`/api/payslip/employee/${fx.itDev1.user._id}`).set(auth(fx.itDev1.user));
  assert.equal(legacyOwnByUser.status, 200);
  assert.equal(legacyOwnByUser.body.payslips[0].payslipFile, undefined);
  const legacyOwnByEmp = await request(app).get(`/api/payslip/employee/${fx.itDev1.employee._id}`).set(auth(fx.itDev1.user));
  assert.equal(legacyOwnByEmp.status, 200);

  const other = await request(app).get(`/api/payslip/employee/${fx.itDev2.employee._id}`).set(auth(fx.itDev1.user));
  assert.equal(other.status, 403);
  const otherByUser = await request(app).get(`/api/payslip/employee/${fx.itDev2.user._id}`).set(auth(fx.itDev1.user));
  assert.equal(otherByUser.status, 403);

  const admin = await request(app).get(`/api/payslip/employee/${fx.itDev2.employee._id}`).set(auth(fx.admin));
  assert.equal(admin.status, 200);
  assert.equal(admin.body.payslips.length, 1);
  assert.equal(admin.body.payslips[0].hasFile, true);

  const client = await request(app).get("/api/payslip/me").set(auth(fx.clientA.user));
  assert.equal(client.status, 403);
});

test("download and signed link: owner or admin only", async () => {
  const mine = (await addPayslip(fx.admin, { employeeId: fx.itDev1.employee._id })).body.payslip;
  const theirs = (await addPayslip(fx.admin, { employeeId: fx.itDev2.employee._id })).body.payslip;

  const dl = await request(app)
    .get(`/api/payslip/${mine._id}/download`)
    .set(auth(fx.itDev1.user))
    .buffer(true)
    .parse((res, cb) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
  assert.equal(dl.status, 200);
  assert.match(dl.headers["content-type"], /application\/pdf/);
  assert.match(dl.headers["content-disposition"], /payslip-2026-09\.pdf/);
  assert.equal(dl.body.subarray(0, 5).toString(), "%PDF-");
  assert.equal(fetchLog.length, 1);
  assert.ok(fetchLog[0].url.startsWith(`${process.env.IMAGEKIT_URL_ENDPOINT}/`));
  assert.match(fetchLog[0].url, /ik-s=/);
  assert.equal(fetchLog[0].init.redirect, "manual");

  const dlOther = await request(app).get(`/api/payslip/${theirs._id}/download`).set(auth(fx.itDev1.user));
  assert.equal(dlOther.status, 404);
  const dlAdmin = await request(app).get(`/api/payslip/${theirs._id}/download`).set(auth(fx.admin));
  assert.equal(dlAdmin.status, 200);

  const link = await request(app).get(`/api/payslip/${mine._id}/link`).set(auth(fx.itDev1.user));
  assert.equal(link.status, 200);
  assert.match(link.body.url, /ik-s=/);
  assert.match(link.body.url, /ik-t=/);
  const ttlMs = new Date(link.body.expiresAt).getTime() - ist("2026-09-30 12:00").getTime();
  assert.ok(ttlMs > 0 && ttlMs <= 300 * 1000);

  const linkOther = await request(app).get(`/api/payslip/${theirs._id}/link`).set(auth(fx.itDev1.user));
  assert.equal(linkOther.status, 404);
  const linkClient = await request(app).get(`/api/payslip/${mine._id}/link`).set(auth(fx.clientA.user));
  assert.equal(linkClient.status, 403);
  const badId = await request(app).get(`/api/payslip/xyz/link`).set(auth(fx.admin));
  assert.equal(badId.status, 400);

  upstream = () => new Response("missing", { status: 404 });
  const broken = await request(app).get(`/api/payslip/${mine._id}/download`).set(auth(fx.itDev1.user));
  assert.equal(broken.status, 502);
  assert.equal(broken.body.code, "FILE_UNAVAILABLE");

  upstream = () => streamedResponse([Buffer.from("<html>not a pdf</html>")]);
  const notPdf = await request(app).get(`/api/payslip/${mine._id}/download`).set(auth(fx.itDev1.user));
  assert.equal(notPdf.status, 502);
});

test("legacy public payslips fail closed: 409 LEGACY_FILE_NOT_MIGRATED, URL never returned or fetched", async () => {
  const legacyUrl = `${process.env.IMAGEKIT_URL_ENDPOINT}/payslips/old.pdf`;
  const legacy = await Payslip.create({
    employee: fx.itDev1.employee._id, month: "2025-12", basicSalary: 1000, grossSalary: 1000, totalDeductions: 0,
    netSalary: 1000, payslipFile: legacyUrl,
  });
  // Even a record claiming a filePath is not served without the private marker.
  const halfMarked = await Payslip.create({
    employee: fx.itDev1.employee._id, month: "2025-11", basicSalary: 1000, grossSalary: 1000, totalDeductions: 0,
    netSalary: 1000, payslipFile: `${process.env.IMAGEKIT_URL_ENDPOINT}/payslips/old2.pdf`, filePath: "/payslips/old2.pdf",
  });

  for (const id of [legacy._id, halfMarked._id]) {
    for (const kind of ["link", "download"]) {
      for (const user of [fx.itDev1.user, fx.admin]) {
        const r = await request(app).get(`/api/payslip/${id}/${kind}`).set(auth(user));
        assert.equal(r.status, 409, `${kind} ${user.role}`);
        assert.equal(r.body.code, "LEGACY_FILE_NOT_MIGRATED");
        assert.match(r.body.error, /migrated/);
        assert.ok(!JSON.stringify(r.body).includes("old.pdf"));
      }
    }
  }
  assert.equal(fetchLog.length, 0);

  // Another employee still gets 404 (ownership is checked first).
  const other = await request(app).get(`/api/payslip/${legacy._id}/link`).set(auth(fx.itDev2.user));
  assert.equal(other.status, 404);

  for (const user of [fx.itDev1.user, fx.admin]) {
    const list = await request(app).get(`/api/payslip/employee/${fx.itDev1.employee._id}`).set(auth(user));
    assert.equal(list.status, 200);
    const item = list.body.payslips.find((p) => p._id === String(legacy._id));
    assert.equal(item.hasFile, true);
    assert.equal(item.fileMigrationRequired, true);
    assert.equal(item.payslipFile, undefined);
    assert.ok(!JSON.stringify(list.body).includes("old.pdf"));
  }
});

test("download fetch is hardened: exact origin only, no redirects, streamed 5 MB cap", async () => {
  const mine = (await addPayslip(fx.admin, { employeeId: fx.itDev1.employee._id })).body.payslip;
  const url = `/api/payslip/${mine._id}/download`;

  // Redirect to an unapproved host is not followed.
  upstream = () => new Response(null, { status: 302, headers: { location: "https://evil.example.com/x.pdf" } });
  const redirected = await request(app).get(url).set(auth(fx.itDev1.user));
  assert.equal(redirected.status, 502);
  assert.equal(redirected.body.code, "FILE_UNAVAILABLE");
  assert.equal(fetchLog.length, 1);
  assert.equal(fetchLog[0].init.redirect, "manual");

  // Chunked body without content-length is cut off once it passes 5 MB.
  let pulled = 0;
  const chunk = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(1024 * 1024 - 9, 0x20)]);
  upstream = () => streamedResponse((i) => (i < 50 ? chunk : null), { onPull: (n) => { pulled += n; } });
  const huge = await request(app).get(url).set(auth(fx.itDev1.user));
  assert.equal(huge.status, 502);
  assert.ok(pulled <= 7 * 1024 * 1024, `read ${pulled} bytes before aborting`);

  // Declared oversize is rejected before reading.
  upstream = () => new Response(pdfBytes(1024), { status: 200, headers: { "content-length": String(6 * 1024 * 1024) } });
  assert.equal((await request(app).get(url).set(auth(fx.itDev1.user))).status, 502);

  // Exactly 5 MB is accepted.
  upstream = () => streamedResponse([pdfBytes(5 * 1024 * 1024)]);
  const atLimit = await request(app).get(url).set(auth(fx.itDev1.user));
  assert.equal(atLimit.status, 200);

  // Unauthorized ids never reach the network.
  const before = fetchLog.length;
  const otherEmp = await request(app).get(url).set(auth(fx.itDev2.user));
  assert.equal(otherEmp.status, 404);
  const client = await request(app).get(url).set(auth(fx.clientA.user));
  assert.equal(client.status, 403);
  assert.equal(fetchLog.length, before);
});

test("approved-origin check: only the configured endpoint origin and path prefix", () => {
  const ok = payslipFiles.isApprovedFileUrl;
  const base = process.env.IMAGEKIT_URL_ENDPOINT; // https://ik.example.test/hakirush
  assert.equal(ok(`${base}/payslips/a.pdf?ik-s=1`), true);
  assert.equal(ok("https://ik.imagekit.io/hakirush/payslips/a.pdf"), false);
  assert.equal(ok("https://ik.example.test/other/payslips/a.pdf"), false);
  assert.equal(ok("https://ik.example.test/hakirush-evil/a.pdf"), false);
  assert.equal(ok("https://ik.example.test/hakirush/../other/a.pdf"), false);
  assert.equal(ok("http://ik.example.test/hakirush/payslips/a.pdf"), false);
  assert.equal(ok("https://user:pw@ik.example.test/hakirush/payslips/a.pdf"), false);
  assert.equal(ok("https://ik.example.test.evil.com/hakirush/a.pdf"), false);
  assert.equal(ok("not a url"), false);
});

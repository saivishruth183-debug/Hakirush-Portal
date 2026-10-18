// Planning/apply logic of scripts/migrateLegacyPayslips.js against the in-memory DB,
// with ImageKit and fetch mocked (no network, no real ImageKit).
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth } from "./helpers/testEnv.js";
import { ensureDomainIndexes, installFakeImageKit, pdfBytes, streamedResponse } from "./helpers/domain.js";

let app, fx, ikLog, Payslip, migration, setPayslipFetch, fetchLog;
let responses; // url -> () => Response

before(async () => {
  await startTestDb();
  app = await getApp();
  await ensureDomainIndexes();
  ikLog = await installFakeImageKit();
  Payslip = (await import("../models/Payslip.js")).default;
  migration = await import("../scripts/migrateLegacyPayslips.js");
  ({ setPayslipFetch } = await import("../services/payslipFiles.js"));
  setPayslipFetch(async (url, init) => {
    fetchLog.push({ url, init });
    const make = responses.get(url);
    return make ? make() : new Response("not found", { status: 404 });
  });
});
after(async () => {
  setPayslipFetch(null);
  const { setImageKitClient } = await import("../utils/uploadToImageKit.js");
  setImageKitClient(null);
  await stopTestDb();
});
beforeEach(async () => {
  await clearDb();
  fx = await seedFixtures();
  ikLog.uploads.length = 0;
  ikLog.deletes.length = 0;
  ikLog.listCalls.length = 0;
  ikLog.files.length = 0;
  fetchLog = [];
  responses = new Map();
});

const BASE = () => process.env.IMAGEKIT_URL_ENDPOINT;
const legacy = (month, payslipFile) =>
  Payslip.create({
    employee: fx.itDev1.employee._id, month, basicSalary: 1000, grossSalary: 1000, totalDeductions: 0,
    netSalary: 1000, payslipFile,
  });

const seedMix = async () => {
  const good = await legacy("2025-10", `${BASE()}/payslips/1700000000-oct.pdf`);
  const broken = await legacy("2025-11", `${BASE()}/payslips/1700000001-nov.pdf`);
  const foreign = await legacy("2025-12", "https://other-cdn.example.com/payslips/dec.pdf");
  const priv = await Payslip.create({
    employee: fx.itDev1.employee._id, month: "2026-01", basicSalary: 1000, grossSalary: 1000, totalDeductions: 0,
    netSalary: 1000, payslipFile: `${BASE()}/payslips/private.pdf`, storage: "private", isPrivateFile: true,
    fileId: "file_private", filePath: "/payslips/private.pdf",
  });
  responses.set(good.payslipFile, () => streamedResponse([pdfBytes(4096)]));
  responses.set(broken.payslipFile, () => streamedResponse([Buffer.from("<html>gone</html>")]));
  return { good, broken, foreign, priv };
};

test("dry run: inventory only, no writes, no network, no URLs in the report", async () => {
  const { good, broken, foreign } = await seedMix();
  const result = await migration.migrateLegacyPayslips();
  assert.equal(result.mode, "dry-run");
  assert.deepEqual(result.counts, { legacy: 3, toReupload: 2, skipped: 1, migratedAwaitingRetirement: 0 });
  const byId = Object.fromEntries(result.items.map((i) => [i.payslipId, i]));
  assert.equal(byId[String(good._id)].action, "reupload-private");
  assert.equal(byId[String(broken._id)].action, "reupload-private");
  assert.equal(byId[String(foreign._id)].action, "skip");
  assert.match(byId[String(foreign._id)].reason, /IMAGEKIT_URL_ENDPOINT/);
  assert.ok(!JSON.stringify(result).includes("http"));

  assert.equal(fetchLog.length, 0);
  assert.equal(ikLog.uploads.length, 0);
  assert.equal(await Payslip.countDocuments({ storage: "private" }), 1);
});

test("--apply re-uploads approved legacy PDFs as private files; failures and foreign URLs untouched; idempotent", async () => {
  const { good, broken, foreign } = await seedMix();
  const result = await migration.migrateLegacyPayslips({ apply: true });
  assert.equal(result.mode, "apply");
  assert.deepEqual(result.migrated.map((m) => m.payslipId), [String(good._id)]);
  assert.deepEqual(result.failed.map((f) => f.payslipId), [String(broken._id)]);

  assert.equal(ikLog.uploads.length, 1);
  assert.equal(ikLog.uploads[0].isPrivateFile, true);
  assert.equal(ikLog.uploads[0].folder, "payslips");
  assert.ok(fetchLog.every((f) => f.init.redirect === "manual"));
  assert.ok(!fetchLog.some((f) => f.url.includes("other-cdn")));

  const migrated = await Payslip.findById(good._id).lean();
  assert.equal(migrated.storage, "private");
  assert.equal(migrated.isPrivateFile, true);
  assert.ok(migrated.fileId);
  assert.ok(migrated.filePath);
  assert.equal(migrated.legacyUrl, good.payslipFile);
  assert.notEqual(migrated.payslipFile, good.payslipFile);
  assert.ok(migrated.migratedAt);

  const untouched = await Payslip.findById(broken._id).lean();
  assert.equal(untouched.storage, null);
  assert.equal(untouched.payslipFile, broken.payslipFile);
  assert.equal((await Payslip.findById(foreign._id).lean()).storage, null);

  // The migrated payslip is now served; the others still fail closed.
  const link = await request(app).get(`/api/payslip/${good._id}/link`).set(auth(fx.itDev1.user));
  assert.equal(link.status, 200);
  assert.match(link.body.url, /ik-s=/);
  const stillLegacy = await request(app).get(`/api/payslip/${broken._id}/link`).set(auth(fx.itDev1.user));
  assert.equal(stillLegacy.status, 409);
  assert.equal(stillLegacy.body.code, "LEGACY_FILE_NOT_MIGRATED");

  // Second run: nothing new is uploaded for already-migrated records.
  const again = await migration.migrateLegacyPayslips({ apply: true });
  assert.equal(again.migrated.length, 0);
  assert.equal(ikLog.uploads.length, 1);
  assert.equal(again.counts.migratedAwaitingRetirement, 1);
  assert.equal(ikLog.deletes.length, 0); // nothing retired without --retire-public
});

test("oversized or redirected legacy downloads are rejected during migration", async () => {
  const big = await legacy("2025-09", `${BASE()}/payslips/big.pdf`);
  const moved = await legacy("2025-08", `${BASE()}/payslips/moved.pdf`);
  responses.set(big.payslipFile, () =>
    streamedResponse((i) => (i < 20 ? Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(512 * 1024)]) : null))
  );
  responses.set(moved.payslipFile, () => new Response(null, { status: 301, headers: { location: "https://evil.example.com/x" } }));
  const result = await migration.migrateLegacyPayslips({ apply: true });
  assert.equal(result.migrated.length, 0);
  assert.equal(result.failed.length, 2);
  assert.equal(ikLog.uploads.length, 0);
});

test("--retire-public needs --apply and deletes only an exact single public match", async () => {
  await assert.rejects(() => migration.migrateLegacyPayslips({ retirePublic: true }), /requires --apply/);

  const { good } = await seedMix();
  const another = await legacy("2025-07", `${BASE()}/payslips/1700000002-jul.pdf`);
  responses.set(another.payslipFile, () => streamedResponse([pdfBytes(2048)]));
  // Library: exactly one public match for `good`; none for `another`; a private file with the same name is ignored.
  ikLog.files.push(
    { fileId: "old_public_oct", filePath: "/payslips/1700000000-oct.pdf", isPrivateFile: false },
    { fileId: "private_twin", filePath: "/payslips/1700000002-jul.pdf", isPrivateFile: true }
  );

  const result = await migration.migrateLegacyPayslips({ apply: true, retirePublic: true });
  assert.equal(result.migrated.length, 2);
  assert.deepEqual(result.retired.map((r) => r.payslipId), [String(good._id)]);
  assert.deepEqual(result.retireSkipped.map((r) => r.payslipId), [String(another._id)]);
  assert.match(result.retireSkipped[0].reason, /exactly one/);
  assert.deepEqual(ikLog.deletes, ["old_public_oct"]);
  assert.ok((await Payslip.findById(good._id).lean()).legacyRetiredAt);
  assert.equal((await Payslip.findById(another._id).lean()).legacyRetiredAt, null);

  // Re-running does not delete again.
  const again = await migration.migrateLegacyPayslips({ apply: true, retirePublic: true });
  assert.equal(again.retired.length, 0);
  assert.deepEqual(ikLog.deletes, ["old_public_oct"]);
});

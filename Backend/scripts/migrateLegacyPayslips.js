// Legacy payslip migration: public ImageKit uploads -> private files.
//
//   node --env-file=.env scripts/migrateLegacyPayslips.js                    # inventory + dry run (no writes)
//   node --env-file=.env scripts/migrateLegacyPayslips.js --apply            # re-upload legacy PDFs as private files
//   node --env-file=.env scripts/migrateLegacyPayslips.js --apply --retire-public
//                                                                            # also delete the old public objects of
//                                                                            # already-migrated records
//
// Phases (each idempotent, safe to re-run):
// 1. Plan: every Payslip without `storage: "private"` is a legacy record. Its
//    stored URL is re-uploaded only if it is on the exact configured
//    IMAGEKIT_URL_ENDPOINT origin + path prefix; anything else is skipped.
// 2. --apply: download the PDF from that URL (no redirects, %PDF- signature,
//    5 MB cap), upload it with isPrivateFile:true, then update the record
//    (storage "private", fileId, filePath, payslipFile = new URL, legacyUrl =
//    old URL for audit, migratedAt). The update is conditional on the record
//    still being legacy; if it changed, the new upload is deleted.
// 3. --retire-public (requires --apply): for records already migrated and not
//    yet retired, look up the old public object by its exact file path and
//    delete it only when exactly one public file matches; sets legacyRetiredAt.
//    Run this only after verifying the private copies (download a sample).
//
// Output never prints file URLs (legacy public URLs open salary PDFs).
// NOT run by the agents against any real database or ImageKit account.
import path from "node:path";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import Payslip from "../models/Payslip.js";
import uploadToImageKit, { getImageKitClient, deleteFromImageKit } from "../utils/uploadToImageKit.js";
import { isApprovedFileUrl, fetchPdfFromApprovedOrigin } from "../services/payslipFiles.js";

const safeSegment = (v) => String(v || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "x";

// File path of an approved ImageKit URL relative to the configured endpoint ("/payslips/a.pdf").
export const filePathFromUrl = (url) => {
  const base = new URL(process.env.IMAGEKIT_URL_ENDPOINT);
  const u = new URL(url);
  const prefix = base.pathname.replace(/\/+$/, "");
  return decodeURIComponent(u.pathname.slice(prefix.length));
};

/**
 * Inventory of legacy payslips (no writes).
 * @returns {Promise<{items: Array, retire: Array, counts: object}>}
 */
export const planLegacyPayslipMigration = async () => {
  const legacy = await Payslip.find({ storage: { $ne: "private" } })
    .select("_id employee month payslipFile")
    .sort({ createdAt: 1 })
    .lean();
  const items = legacy.map((r) => {
    const url = r.payslipFile || "";
    const base = { payslipId: String(r._id), employee: String(r.employee), month: r.month, url };
    if (!url) return { ...base, action: "skip", reason: "no stored file URL" };
    if (!isApprovedFileUrl(url)) {
      return { ...base, action: "skip", reason: "stored URL is not under the configured IMAGEKIT_URL_ENDPOINT" };
    }
    return { ...base, action: "reupload-private" };
  });

  const migrated = await Payslip.find({ storage: "private", legacyUrl: { $ne: null }, legacyRetiredAt: null })
    .select("_id month legacyUrl")
    .lean();
  const retire = migrated.map((r) => ({ payslipId: String(r._id), month: r.month, legacyUrl: r.legacyUrl }));

  return {
    items,
    retire,
    counts: {
      legacy: items.length,
      toReupload: items.filter((i) => i.action === "reupload-private").length,
      skipped: items.filter((i) => i.action === "skip").length,
      migratedAwaitingRetirement: retire.length,
    },
  };
};

// fileId of the old public object, only when exactly one public file matches the exact path.
const findPublicFileId = async (legacyUrl) => {
  if (!isApprovedFileUrl(legacyUrl)) return { fileId: null, reason: "legacy URL is not under the configured endpoint" };
  const filePath = filePathFromUrl(legacyUrl);
  const folder = path.posix.dirname(filePath);
  const name = path.posix.basename(filePath);
  const client = getImageKitClient();
  if (typeof client.listFiles !== "function") return { fileId: null, reason: "ImageKit client cannot list files" };
  const files = await client.listFiles({ path: folder, searchQuery: `name = "${name.replace(/"/g, "")}"` });
  const matches = (Array.isArray(files) ? files : []).filter(
    (f) => f && f.filePath === filePath && f.isPrivateFile !== true && f.fileId
  );
  if (matches.length !== 1) return { fileId: null, reason: `expected exactly one public match, found ${matches.length}` };
  return { fileId: matches[0].fileId, reason: null };
};

/**
 * @param {{apply?: boolean, retirePublic?: boolean, now?: () => Date}} options
 */
export const migrateLegacyPayslips = async ({ apply = false, retirePublic = false, now = () => new Date() } = {}) => {
  if (retirePublic && !apply) throw new Error("--retire-public requires --apply");
  const plan = await planLegacyPayslipMigration();
  const result = {
    mode: apply ? "apply" : "dry-run",
    counts: plan.counts,
    items: plan.items.map(({ url, ...rest }) => rest), // never expose URLs in the report
    migrated: [],
    failed: [],
    retired: [],
    retireSkipped: [],
  };
  if (!apply) return result;

  for (const item of plan.items.filter((i) => i.action === "reupload-private")) {
    let stored = null;
    try {
      const pdf = await fetchPdfFromApprovedOrigin(item.url);
      stored = await uploadToImageKit({ buffer: pdf, originalname: "payslip.pdf" }, "payslips", {
        isPrivateFile: true,
        returnDetails: true,
        fileName: `payslip-${safeSegment(item.employee)}-${safeSegment(item.month)}.pdf`,
      });
      if (!stored?.url || !stored?.filePath) throw new Error("upload returned no file path");
      const updated = await Payslip.updateOne(
        { _id: item.payslipId, storage: { $ne: "private" }, payslipFile: item.url },
        {
          $set: {
            storage: "private",
            isPrivateFile: true,
            fileId: stored.fileId,
            filePath: stored.filePath,
            payslipFile: stored.url,
            legacyUrl: item.url,
            migratedAt: now(),
          },
        }
      );
      if (updated.modifiedCount !== 1) {
        await deleteFromImageKit(stored.fileId);
        throw new Error("record changed during migration; new upload removed");
      }
      result.migrated.push({ payslipId: item.payslipId, month: item.month });
    } catch (err) {
      result.failed.push({ payslipId: item.payslipId, month: item.month, error: err?.code || err?.message || "failed" });
    }
  }

  if (retirePublic) {
    const { retire } = await planLegacyPayslipMigration();
    for (const r of retire) {
      try {
        const { fileId, reason } = await findPublicFileId(r.legacyUrl);
        if (!fileId) {
          result.retireSkipped.push({ payslipId: r.payslipId, month: r.month, reason });
          continue;
        }
        const ok = await deleteFromImageKit(fileId);
        if (!ok) {
          result.retireSkipped.push({ payslipId: r.payslipId, month: r.month, reason: "delete failed" });
          continue;
        }
        await Payslip.updateOne({ _id: r.payslipId, legacyRetiredAt: null }, { $set: { legacyRetiredAt: now() } });
        result.retired.push({ payslipId: r.payslipId, month: r.month });
      } catch (err) {
        result.retireSkipped.push({ payslipId: r.payslipId, month: r.month, reason: err?.message || "failed" });
      }
    }
  }
  return result;
};

/* ================= CLI ================= */
const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const retirePublic = args.has("--retire-public");
  const run = async () => {
    if (retirePublic && !apply) throw new Error("--retire-public requires --apply");
    if (!process.env.MONGODB_URL) throw new Error("MONGODB_URL is not set");
    if (!process.env.IMAGEKIT_URL_ENDPOINT) throw new Error("IMAGEKIT_URL_ENDPOINT is not set");
    await mongoose.connect(process.env.MONGODB_URL);
    try {
      const result = await migrateLegacyPayslips({ apply, retirePublic });
      console.log(`Mode: ${result.mode}`);
      console.log("Counts:", JSON.stringify(result.counts));
      for (const i of result.items) {
        console.log(`  ${i.payslipId} ${i.month} -> ${i.action}${i.reason ? ` (${i.reason})` : ""}`);
      }
      if (apply) {
        console.log(`Migrated: ${result.migrated.length}, failed: ${result.failed.length}`);
        for (const f of result.failed) console.log(`  FAILED ${f.payslipId} ${f.month}: ${f.error}`);
      }
      if (retirePublic) {
        console.log(`Retired public objects: ${result.retired.length}, skipped: ${result.retireSkipped.length}`);
        for (const s of result.retireSkipped) console.log(`  SKIPPED ${s.payslipId} ${s.month}: ${s.reason}`);
      }
    } finally {
      await mongoose.disconnect();
    }
  };
  run().then(
    () => process.exit(0),
    (err) => {
      console.error("Migration failed:", err?.message || err);
      process.exit(1);
    }
  );
}

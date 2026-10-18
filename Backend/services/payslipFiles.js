// Payslip PDF storage on ImageKit (private files) + short-lived signed access.
//
// Fail-closed rules:
// - Only payslips marked `storage: "private"` with a stored `filePath` (private
//   uploads made by this server) get a signed link or a download.
// - Legacy records (public URL only, no private marker) are never served and
//   their stored URL is never returned: 409 LEGACY_FILE_NOT_MIGRATED until
//   scripts/migrateLegacyPayslips.js has re-uploaded them as private files.
// - Server-side fetches go only to the exact configured IMAGEKIT_URL_ENDPOINT
//   origin + path prefix, never follow redirects, and stop reading once the
//   body exceeds the 5 MB payslip limit.
// All ImageKit/network access goes through this module so tests can replace it
// (setImageKitClient in utils/uploadToImageKit.js, setPayslipFetch here).
import uploadToImageKit, { getImageKitClient, deleteFromImageKit } from "../utils/uploadToImageKit.js";
import { ApiError } from "../middleware/errorHandler.js";
import { PDF_MAX_BYTES, isPdfBuffer } from "../middleware/pdfUpload.js";

export const LINK_TTL_SECONDS = 300; // signed URLs valid for at most 5 minutes
const FETCH_TIMEOUT_MS = 15000;

let fetchImpl = (...args) => fetch(...args);
export const setPayslipFetch = (fn) => {
  fetchImpl = fn || ((...args) => fetch(...args));
};

const unavailable = () => new ApiError(502, "Payslip file is unavailable", "FILE_UNAVAILABLE");
export const legacyNotMigrated = () =>
  new ApiError(
    409,
    "This payslip was stored with an older public upload and must be migrated to private storage before it can be opened. Please contact HR.",
    "LEGACY_FILE_NOT_MIGRATED"
  );

const safeSegment = (v) => String(v || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "employee";

export const isPrivatePayslip = (payslip) =>
  Boolean(payslip && payslip.storage === "private" && payslip.filePath);

export const storePayslipPdf = async (file, { employeeCode, month }) => {
  const details = await uploadToImageKit(file, "payslips", {
    isPrivateFile: true,
    returnDetails: true,
    fileName: `payslip-${safeSegment(employeeCode)}-${safeSegment(month)}.pdf`,
  });
  if (!details?.url || !details?.filePath) throw new ApiError(502, "Payslip upload failed", "UPLOAD_FAILED");
  return details;
};

export const removePayslipFile = (fileId) => deleteFromImageKit(fileId);

/**
 * Signed URL (<= 5 minutes) for a private payslip. Legacy records -> 409.
 */
export const signedPayslipUrl = (payslip, { now = new Date(), expireSeconds = LINK_TTL_SECONDS } = {}) => {
  if (!isPrivatePayslip(payslip)) throw legacyNotMigrated();
  const ttl = Math.min(LINK_TTL_SECONDS, Math.max(30, Math.floor(expireSeconds)));
  const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();
  const url = getImageKitClient().url({ path: payslip.filePath, signed: true, expireSeconds: ttl });
  return { url, expiresAt };
};

/* ================= HARDENED FETCH ================= */

// The configured endpoint as a parsed URL, or null when unusable.
const configuredEndpoint = () => {
  const raw = process.env.IMAGEKIT_URL_ENDPOINT || "";
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
};

/**
 * True only for https URLs on the exact configured ImageKit origin under the
 * configured path prefix (no other *.imagekit.io host, no credentials).
 */
export const isApprovedFileUrl = (url) => {
  const base = configuredEndpoint();
  if (!base) return false;
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  if (u.origin !== base.origin) return false;
  const prefix = `${base.pathname.replace(/\/+$/, "")}/`;
  return u.pathname.startsWith(prefix);
};

const readLimited = async (body, limit, controller) => {
  if (!body || typeof body.getReader !== "function") throw unavailable();
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
      total += chunk.length;
      if (total > limit) {
        controller.abort();
        await reader.cancel().catch(() => {});
        throw unavailable();
      }
      chunks.push(chunk);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
  return Buffer.concat(chunks, total);
};

/**
 * GETs a PDF from an approved ImageKit URL: no redirects, 5 MB streaming cap,
 * %PDF- signature required. Used by /download and the legacy migration script.
 * @returns {Promise<Buffer>}
 */
export const fetchPdfFromApprovedOrigin = async (url, { maxBytes = PDF_MAX_BYTES } = {}) => {
  if (!isApprovedFileUrl(url)) throw unavailable();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetchImpl(url, { redirect: "manual", signal: controller.signal });
    } catch {
      throw unavailable();
    }
    if (!response || response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      throw unavailable();
    }
    if (!response.ok) throw unavailable();
    const declared = Number(response.headers?.get?.("content-length") || 0);
    if (declared > maxBytes) {
      controller.abort();
      throw unavailable();
    }
    const buffer = await readLimited(response.body, maxBytes, controller);
    if (!isPdfBuffer(buffer)) throw unavailable();
    return buffer;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Downloads a private payslip PDF server-side through a short-lived signed URL.
 * Legacy records -> 409 LEGACY_FILE_NOT_MIGRATED (checked before any network call).
 */
export const fetchPayslipPdf = async (payslip, { now = new Date() } = {}) => {
  const { url } = signedPayslipUrl(payslip, { now, expireSeconds: 60 });
  return fetchPdfFromApprovedOrigin(url);
};

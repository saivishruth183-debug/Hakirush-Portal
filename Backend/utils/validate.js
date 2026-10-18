import mongoose from "mongoose";
import { badRequest } from "../middleware/errorHandler.js";

export const isObjectId = (v) =>
  typeof v === "string" && mongoose.Types.ObjectId.isValid(v) && String(new mongoose.Types.ObjectId(v)) === v;

export const requireObjectId = (v, field = "id") => {
  if (!isObjectId(String(v ?? ""))) throw badRequest(`Invalid ${field}`, "INVALID_ID");
  return String(v);
};

// Keep only allowlisted keys that are present (not undefined).
export const pick = (obj, keys) => {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
};

export const toFiniteNumber = (v, field, { min = -Infinity, max = Infinity, optional = false } = {}) => {
  if (v === undefined || v === null || v === "") {
    if (optional) return undefined;
    throw badRequest(`${field} is required`);
  }
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isFinite(n) || n < min || n > max) throw badRequest(`${field} must be a valid number`);
  return n;
};

export const requireEnum = (v, allowed, field) => {
  if (!allowed.includes(v)) throw badRequest(`${field} must be one of: ${allowed.join(", ")}`);
  return v;
};

export const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const requireYmd = (v, field = "date") => {
  if (typeof v !== "string" || !YMD.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
    throw badRequest(`${field} must be YYYY-MM-DD`);
  }
  // Reject impossible calendar dates such as 2026-02-30 (Date.parse rolls them over).
  if (new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) {
    throw badRequest(`${field} must be YYYY-MM-DD`);
  }
  return v;
};

export const trimmedString = (v, field, { max = 500, optional = false } = {}) => {
  if (v === undefined || v === null || v === "") {
    if (optional) return undefined;
    throw badRequest(`${field} is required`);
  }
  if (typeof v !== "string") throw badRequest(`${field} must be text`);
  const s = v.trim();
  if (!s && !optional) throw badRequest(`${field} is required`);
  if (s.length > max) throw badRequest(`${field} is too long`);
  return s;
};

// Bounded pagination: ?page=1&limit=20 (limit capped).
export const parsePagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(1, Math.floor(Number(query?.page) || 1));
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(query?.limit) || defaultLimit)));
  return { page, limit, skip: (page - 1) * limit };
};

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---- Additive helpers (backend-auth-people) ----

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeEmail = (v, field = "email", { optional = false } = {}) => {
  if (v === undefined || v === null || v === "") {
    if (optional) return undefined;
    throw badRequest(`${field} is required`);
  }
  if (typeof v !== "string") throw badRequest(`${field} must be text`);
  const s = v.trim().toLowerCase();
  if (s.length > 254 || !EMAIL_RE.test(s)) throw badRequest(`${field} must be a valid email address`);
  return s;
};

// Accepts true/false, "true"/"false", "1"/"0" (multipart forms send strings).
export const parseBoolean = (v, field, { optional = true } = {}) => {
  if (v === undefined || v === null || v === "") {
    if (optional) return undefined;
    throw badRequest(`${field} is required`);
  }
  if (v === true || v === "true" || v === "1" || v === 1) return true;
  if (v === false || v === "false" || v === "0" || v === 0) return false;
  throw badRequest(`${field} must be true or false`);
};

// Calendar date input: "YYYY-MM-DD" or a full ISO timestamp. Returns a Date
// (YYYY-MM-DD is stored as UTC midnight). "" / null => null when allowEmpty.
export const parseDateInput = (v, field, { allowEmpty = true, notFuture = false } = {}) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") {
    if (allowEmpty) return null;
    throw badRequest(`${field} is required`);
  }
  if (typeof v !== "string" && !(v instanceof Date)) throw badRequest(`${field} must be a date`);
  let d;
  if (typeof v === "string" && YMD.test(v.trim())) {
    d = new Date(`${v.trim()}T00:00:00Z`);
    if (d.toISOString().slice(0, 10) !== v.trim()) throw badRequest(`${field} must be a valid date`);
  } else {
    d = new Date(v);
  }
  if (Number.isNaN(d.getTime())) throw badRequest(`${field} must be a valid date`);
  if (d.getUTCFullYear() < 1900 || d.getUTCFullYear() > 2200) throw badRequest(`${field} is out of range`);
  if (notFuture && d.getTime() > Date.now()) throw badRequest(`${field} cannot be in the future`);
  return d;
};

// Optional enum where "" / null clears the value.
export const optionalEnum = (v, allowed, field) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return requireEnum(v, allowed, field);
};

export const sameId = (a, b) => a != null && b != null && String(a?._id ?? a) === String(b?._id ?? b);

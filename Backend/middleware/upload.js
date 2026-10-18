// Image upload middleware (memory storage, one file per request).
// `upload.single(field)` keeps the multer-style call used by the routes but
// returns [parse, verify]: multer errors become normalized JSON and the actual
// file bytes must be JPEG, PNG, WebP or GIF (client-supplied mimetype and file
// name are not trusted). HEIC/HEIF/AVIF are rejected with 415 UNSUPPORTED_FILE.
import multer from "multer";
import { ApiError, sendError } from "./errorHandler.js";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const startsWith = (buf, bytes, offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf, start, end) => (buf.length >= end ? buf.toString("latin1", start, end) : "");

const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1", "avif", "avis"]);

// Returns { mime, ext } for supported images, { heif: true } for HEIC-family, or null.
export const detectImageType = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  const head6 = ascii(buf, 0, 6);
  if (head6 === "GIF87a" || head6 === "GIF89a") return { mime: "image/gif", ext: "gif" };
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (ascii(buf, 4, 8) === "ftyp" && HEIF_BRANDS.has(ascii(buf, 8, 12).toLowerCase())) return { heif: true };
  return null;
};

const unsupported = (message) => new ApiError(415, message, "UNSUPPORTED_FILE");
const HEIC_MESSAGE =
  "HEIC/HEIF photos are not supported. Please upload a JPEG, PNG, WebP or GIF image " +
  "(on iPhone choose a JPEG export, or set Camera > Formats to 'Most Compatible').";

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 60, fieldSize: 100 * 1024 },
  fileFilter: (req, file, cb) => {
    const type = String(file.mimetype || "").toLowerCase();
    const name = String(file.originalname || "").toLowerCase();
    if (/hei[cf]|avif/.test(type) || /\.(heic|heif|avif)$/.test(name)) return cb(unsupported(HEIC_MESSAGE));
    if (type && !type.startsWith("image/") && type !== "application/octet-stream") {
      return cb(unsupported("Only image files (JPEG, PNG, WebP, GIF) are allowed"));
    }
    cb(null, true);
  },
});

const normalizeUploadError = (err) => {
  if (err instanceof ApiError) return err;
  switch (err?.code) {
    case "LIMIT_FILE_SIZE":
      return new ApiError(413, "Image must be 5 MB or smaller", "FILE_TOO_LARGE");
    case "LIMIT_FILE_COUNT":
      return new ApiError(400, "Only one file can be uploaded", "VALIDATION_ERROR");
    case "LIMIT_UNEXPECTED_FILE":
      return new ApiError(400, `Unexpected file field${err.field ? `: ${err.field}` : ""}`, "VALIDATION_ERROR");
    case "LIMIT_FIELD_COUNT":
    case "LIMIT_FIELD_KEY":
    case "LIMIT_FIELD_VALUE":
    case "LIMIT_PART_COUNT":
      return new ApiError(400, "Upload form is too large", "VALIDATION_ERROR");
    default:
      return new ApiError(400, "Malformed upload", "VALIDATION_ERROR");
  }
};

// Verifies the uploaded bytes and normalizes file metadata.
export const verifyImageFile = (req, res, next) => {
  const file = req.file;
  if (!file) return next();
  const detected = detectImageType(file.buffer);
  if (!detected) return sendError(res, unsupported("Only image files (JPEG, PNG, WebP, GIF) are allowed"));
  if (detected.heif) return sendError(res, unsupported(HEIC_MESSAGE));
  file.mimetype = detected.mime;
  file.originalname = `upload.${detected.ext}`;
  return next();
};

const single = (field) => {
  const parse = multerInstance.single(field);
  const parseNormalized = (req, res, next) =>
    parse(req, res, (err) => (err ? sendError(res, normalizeUploadError(err)) : next()));
  return [parseNormalized, verifyImageFile];
};

const upload = { single };

export default upload;

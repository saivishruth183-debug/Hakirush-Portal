import multer from "multer";

// PDF upload guard: memory storage, single file in one named field, size cap,
// and a content check on the "%PDF-" signature (the client-sent MIME type and
// file name are not trusted).
export const PDF_MAX_BYTES = 5 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF-", "latin1");

export const isPdfBuffer = (buf) =>
  Buffer.isBuffer(buf) && buf.length >= PDF_MAGIC.length && buf.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);

const reject = (res, status, error, code) => res.status(status).json({ success: false, error, code });

/**
 * pdfUpload("payslip") -> middleware. Errors are JSON:
 *  413 FILE_TOO_LARGE, 415 UNSUPPORTED_FILE, 400 VALIDATION_ERROR (wrong/extra file field, malformed upload).
 */
export const pdfUpload = (field = "payslip", { maxBytes = PDF_MAX_BYTES } = {}) => {
  const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 40, fieldSize: 16 * 1024, parts: 45 },
  }).single(field);

  return (req, res, next) =>
    parser(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return reject(res, 413, `File is too large (max ${Math.floor(maxBytes / (1024 * 1024))} MB)`, "FILE_TOO_LARGE");
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
          return reject(res, 400, `Upload exactly one file in the "${field}" field`, "VALIDATION_ERROR");
        }
        return reject(res, 400, "Invalid upload", "VALIDATION_ERROR");
      }
      if (req.file) {
        if (!isPdfBuffer(req.file.buffer)) {
          return reject(res, 415, "Only PDF files are accepted", "UNSUPPORTED_FILE");
        }
        req.file.mimetype = "application/pdf";
      }
      return next();
    });
};

export default pdfUpload;

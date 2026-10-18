// Normalized API errors. The `error` string is kept for web compatibility;
// `code` gives clients a stable machine-readable reason.
export class ApiError extends Error {
  constructor(status, message, code = undefined, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, code = "VALIDATION_ERROR", details) =>
  new ApiError(400, message, code, details);
export const unauthorized = (message = "Authentication required", code = "AUTH_REQUIRED") =>
  new ApiError(401, message, code);
export const forbidden = (message = "Access denied", code = "FORBIDDEN") =>
  new ApiError(403, message, code);
export const notFound = (message = "Not found", code = "NOT_FOUND") =>
  new ApiError(404, message, code);
export const conflict = (message, code = "CONFLICT", details) =>
  new ApiError(409, message, code, details);

export const sendError = (res, err) => {
  if (err instanceof ApiError) {
    const body = { success: false, error: err.message };
    if (err.code) body.code = err.code;
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ success: false, error: "Invalid identifier", code: "INVALID_ID" });
  }
  if (err?.name === "ValidationError") {
    return res.status(400).json({ success: false, error: "Invalid data", code: "VALIDATION_ERROR" });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ success: false, error: "Duplicate record", code: "DUPLICATE" });
  }
  console.error("[API ERROR]", err?.message || err);
  return res.status(500).json({ success: false, error: "Internal Server Error", code: "INTERNAL" });
};

// Wraps async handlers so thrown ApiErrors become normalized responses.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => sendError(res, err));

export const notFoundHandler = (req, res) =>
  res.status(404).json({ success: false, error: "Route not found", code: "ROUTE_NOT_FOUND" });

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, error: "Malformed JSON", code: "BAD_JSON" });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ success: false, error: "File is too large", code: "FILE_TOO_LARGE" });
  }
  return sendError(res, err);
};

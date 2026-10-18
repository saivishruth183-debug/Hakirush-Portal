// Express error middleware for any multer instance not created through
// middleware/upload.js. Produces the normalized API error shape.
import { sendError, ApiError } from "./errorHandler.js";

// eslint-disable-next-line no-unused-vars
const multerErrorHandler = (err, req, res, next) => {
  if (!err) return next();
  if (err?.code === "LIMIT_FILE_SIZE") {
    return sendError(res, new ApiError(413, "File is too large", "FILE_TOO_LARGE"));
  }
  if (err?.name === "MulterError") {
    return sendError(res, new ApiError(400, "Invalid upload", "VALIDATION_ERROR"));
  }
  return next(err);
};

export default multerErrorHandler;

import imagekit from "../config/imagekit.js";
import { ApiError } from "../middleware/errorHandler.js";

// The ImageKit client is swappable so tests never touch the network.
let client = imagekit;
export const setImageKitClient = (c) => {
  client = c || imagekit;
};
export const getImageKitClient = () => client;

/**
 * Uploads a multer memory file to ImageKit.
 *
 * uploadToImageKit(file, folder)            -> url string ("" when no file)  [original behaviour]
 * uploadToImageKit(file, folder, options)   options:
 *   - isPrivateFile: true   store as a private file (URL needs signing to be read)
 *   - fileName: string      explicit stored file name
 *   - returnDetails: true   resolve to { url, fileId, filePath } (null when no file)
 */
const uploadToImageKit = async (file, folder = "employees", options = {}) => {
  const { isPrivateFile = false, fileName, returnDetails = false } = options || {};
  if (!file || !file.buffer) {
    return returnDetails ? null : "";
  }

  const params = {
    file: file.buffer,
    fileName: fileName || `${Date.now()}-${file.originalname}`,
    folder,
  };
  if (isPrivateFile) params.isPrivateFile = true;

  let result;
  try {
    result = await client.upload(params);
  } catch (error) {
    console.error("[IMAGEKIT] upload failed:", error?.message || "unknown error");
    throw new ApiError(502, "Image upload failed", "UPLOAD_FAILED");
  }

  if (returnDetails) {
    return { url: result?.url || "", fileId: result?.fileId || null, filePath: result?.filePath || null };
  }
  return result?.url || "";
};

// Best-effort removal of an uploaded file (used when a later step fails, or on delete).
export const deleteFromImageKit = async (fileId) => {
  if (!fileId) return false;
  try {
    await client.deleteFile(fileId);
    return true;
  } catch (error) {
    console.error("[IMAGEKIT] delete failed:", error?.message || "unknown error");
    return false;
  }
};

export default uploadToImageKit;

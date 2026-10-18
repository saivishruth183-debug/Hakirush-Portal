import mongoose from "mongoose";

export const GALLERY_CAPTION_MAX = 200;

// Admin-uploaded images can be private to a client or shared with all clients.
const clientGalleryImageSchema = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", default: null, index: true },
    audience: { type: String, enum: ["client", "allClients"], default: "client", index: true },
    galleryMonth: { type: String, match: /^\d{4}-(0[1-9]|1[0-2])$/, default: null, index: true },
    url: { type: String, required: true },
    fileId: { type: String, default: null },
    filePath: { type: String, default: null },
    caption: { type: String, default: "", trim: true, maxlength: GALLERY_CAPTION_MAX },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("ClientGalleryImage", clientGalleryImageSchema);

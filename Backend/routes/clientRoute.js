import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireAdmin, requireClient } from "../middleware/roleMiddleware.js";
import upload from "../middleware/upload.js";


import {
  addClient,
  getClients,
  getClient,
  getMyClient,
  updateClient,
  deleteClient,
  getClientPerformance,
  getClientImages,
  getClientGallery,
  getClientGalleryUploadAuth,
  getMyClientGallery,
  uploadClientGalleryImage,
  getSharedGallery,
  getSharedGalleryUploadAuth,
  uploadSharedGalleryImage,
  deleteSharedGalleryImage,
  getMyClientPerformance,
  getClientStandings,
  updateClientStandings,
  deleteClientGalleryImage,
} from "../controllers/clientController.js";

const router = express.Router();
// GET /api/client/performance?userId=xxx

// GET /api/client/images?userId=xxx
router.get("/images", authMiddleware, getClientImages);
router.get("/me/gallery", authMiddleware, requireClient, getMyClientGallery);
router.get("/me/performance", authMiddleware, requireClient, getMyClientPerformance);
router.get("/gallery/shared/upload-auth", authMiddleware, requireAdmin, getSharedGalleryUploadAuth);
router.get("/gallery/shared", authMiddleware, requireAdmin, getSharedGallery);
router.post("/gallery/shared", authMiddleware, requireAdmin, uploadSharedGalleryImage);
router.delete("/gallery/shared/:imageId", authMiddleware, requireAdmin, deleteSharedGalleryImage);
router.get("/:id/gallery/upload-auth", authMiddleware, requireAdmin, getClientGalleryUploadAuth);
router.get("/:id/gallery", authMiddleware, requireAdmin, getClientGallery);
router.post(
  "/:id/gallery",
  authMiddleware,
  requireAdmin,
  uploadClientGalleryImage
);
router.delete("/:id/gallery/:imageId", authMiddleware, requireAdmin, deleteClientGalleryImage);

router.get("/performance", authMiddleware, (req, res, next) => {
  if (!["admin", "client"].includes(req.user?.role)) {
    return res.status(403).json({ success: false, error: "Access denied", code: "FORBIDDEN" });
  }
  return getClientPerformance(req, res, next);
});
router.get("/:id/performance", authMiddleware, requireAdmin, getClientStandings);
router.put("/:id/performance", authMiddleware, requireAdmin, updateClientStandings);

router.get("/", authMiddleware, getClients);
router.get("/me", authMiddleware, getMyClient);
router.get("/:id", authMiddleware, getClient);

router.post(
  "/add",
  authMiddleware,
  upload.single("companyLogo"),
  addClient
);

router.put(
  "/:id",
  authMiddleware,
  upload.single("companyLogo"),
  updateClient
);

router.delete("/:id", authMiddleware, deleteClient);

export default router;

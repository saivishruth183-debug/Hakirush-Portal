import express from "express";
import {
  addAnnouncement,
  getAnnouncements,
  deleteAnnouncement,
  getPublicAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  markAsRead,
} from "../controllers/announcementController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/roleMiddleware.js";
import upload from "../middleware/upload.js";
import { requireCronSecret } from "../utils/attendanceCron.js";
import { runCelebrationsJob } from "../services/celebrationCron.js";

const router = express.Router();

router.post("/jobs/celebrations", requireCronSecret, async (req, res) => {
  const result = await runCelebrationsJob();
  return res.json({ success: true, ...result });
});
router.get("/jobs/celebrations", requireCronSecret, async (req, res) => {
  const result = await runCelebrationsJob();
  return res.json({ success: true, ...result });
});

// General Routes
router.get("/", authMiddleware, requireAdmin, getAnnouncements);
router.get("/public", authMiddleware, getPublicAnnouncements);
router.post("/add", authMiddleware, requireAdmin, upload.single("image"), addAnnouncement);

// Mark as Read (any authenticated user; only adds the caller)
router.put("/:id/read", authMiddleware, markAsRead);

// ID Specific Routes
router.get("/:id", authMiddleware, getAnnouncementById);
router.put("/:id", authMiddleware, requireAdmin, upload.single("image"), updateAnnouncement);
router.delete("/:id", authMiddleware, requireAdmin, deleteAnnouncement);

export default router;

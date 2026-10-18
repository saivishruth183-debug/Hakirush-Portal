import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/roleMiddleware.js";
import upload from "../middleware/upload.js";
import {
  addSponsor,
  getSponsors,
  getSponsor,
  updateSponsor,
  deleteSponsor,
} from "../controllers/sponsorController.js";

const router = express.Router();

// Sponsors are only used by admin screens on the web; all routes are admin-only.
router.use(authMiddleware, requireAdmin);

router.get("/", getSponsors);
router.post("/add", upload.single("logo"), addSponsor);
router.get("/:id", getSponsor);
router.put("/:id", upload.single("logo"), updateSponsor);
router.delete("/:id", deleteSponsor);

export default router;

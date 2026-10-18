import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/roleMiddleware.js";
import upload from "../middleware/upload.js";
import {
  getAllStalls,
  getStallById,
  createStall,
  updateStall,
  deleteStall
} from "../controllers/stallController.js";

const router = express.Router();

// Previously unauthenticated. Only admin web screens use stalls.
router.use(authMiddleware, requireAdmin);

router.get("/", getAllStalls);
router.get("/:id", getStallById);
router.post("/", upload.single("logo"), createStall);
router.put("/:id", upload.single("logo"), updateStall);
router.delete("/:id", deleteStall);

export default router;

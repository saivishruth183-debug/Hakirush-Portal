import express from "express";
import {
  addAsset,
  getAssets,
  getMyAssets,
  assignAsset,
  returnAsset,
  deleteAsset
} from "../controllers/assetController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireAdmin, requireEmployee } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/add", authMiddleware, requireAdmin, addAsset);
router.get("/", authMiddleware, requireAdmin, getAssets);
router.get("/me", authMiddleware, requireEmployee, getMyAssets);
router.post("/:id/assign", authMiddleware, requireAdmin, assignAsset);
router.post("/:id/return", authMiddleware, requireAdmin, returnAsset);
router.delete("/:id", authMiddleware, requireAdmin, deleteAsset);

export default router;

import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/roleMiddleware.js";
import {
  addDepartment,
  getDepartments,
  getDepartment,
  getEligibleManagers,
  updateDepartment,
  deleteDepartment,
} from "../controllers/departmentController.js";

const router = express.Router();

router.use(authMiddleware, requireAdmin);

router.get("/", getDepartments);
router.post("/add", addDepartment);
router.get("/:id/eligible-managers", getEligibleManagers);
router.get("/:id", getDepartment);
router.put("/:id", updateDepartment);
router.delete("/:id", deleteDepartment);

export default router;

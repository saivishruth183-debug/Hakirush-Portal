import express from "express";
import {
  getMyOvertimeSummary,
  applyOvertime,
  getAllOvertimeRequests,
  reviewOvertimeRequest,
  deleteOvertimeRequest,
} from "../controllers/overtimeController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles, { requireEmployee } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/summary/me", authMiddleware, requireEmployee, getMyOvertimeSummary);
router.post("/apply", authMiddleware, requireEmployee, applyOvertime);
router.get("/", authMiddleware, authorizeRoles("admin", "employee"), getAllOvertimeRequests);
router.put("/:id/review", authMiddleware, authorizeRoles("admin", "employee"), reviewOvertimeRequest);
router.delete("/:id", authMiddleware, authorizeRoles("admin", "employee"), deleteOvertimeRequest);

export default router;

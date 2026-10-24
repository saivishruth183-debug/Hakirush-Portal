import express from "express";
import {
  createAttendanceRequest,
  getMyAttendanceRequests,
  getAllAttendanceRequests,
  getTeamAttendanceRequests,
  deleteAttendanceRequest,
  reviewAttendanceRequest,
} from "../controllers/attendanceRequestController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles, { requireAdmin, requireEmployee } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, requireEmployee, createAttendanceRequest);
router.get("/me", authMiddleware, requireEmployee, getMyAttendanceRequests);
router.get("/team", authMiddleware, requireEmployee, getTeamAttendanceRequests);
router.get("/", authMiddleware, requireAdmin, getAllAttendanceRequests);
router.delete("/:requestId", authMiddleware, requireEmployee, deleteAttendanceRequest);
router.put("/:requestId/review", authMiddleware, authorizeRoles("admin", "employee"), reviewAttendanceRequest);

export default router;

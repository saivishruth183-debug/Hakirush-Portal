import express from "express";
import {
  createAttendanceRequest,
  getMyAttendanceRequests,
  getAllAttendanceRequests,
  deleteAttendanceRequest,
  reviewAttendanceRequest,
} from "../controllers/attendanceRequestController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireAdmin, requireEmployee } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, requireEmployee, createAttendanceRequest);
router.get("/me", authMiddleware, requireEmployee, getMyAttendanceRequests);
router.get("/", authMiddleware, requireAdmin, getAllAttendanceRequests);
router.delete("/:requestId", authMiddleware, requireEmployee, deleteAttendanceRequest);
router.put("/:requestId/review", authMiddleware, requireAdmin, reviewAttendanceRequest);

export default router;

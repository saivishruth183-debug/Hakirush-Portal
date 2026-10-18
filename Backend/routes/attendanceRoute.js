import express from "express";
import {
  attendanceReport,
  getAttendance,
  getUserMonthlyAttendance,
  getMyMonthlyAttendance,
  updateAttendance,
  checkIn,
  checkOut,
  pauseAttendance,
  resumeAttendance,
  getMyTodayAttendance,
  getAdminTodaySummary,
  runCloseDayJob,
} from "../controllers/attendanceController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles, { requireAdmin, requireEmployee } from "../middleware/roleMiddleware.js";
import { requireCronSecret } from "../utils/attendanceCron.js";

const router = express.Router();

/* Scheduled day-close job (Vercel Cron sends GET with `Authorization: Bearer $CRON_SECRET`). */
router.post("/jobs/close-day", requireCronSecret, runCloseDayJob);
router.get("/jobs/close-day", requireCronSecret, runCloseDayJob);

/* Admin (org-wide). Missing day records are synthesized at read time, so no
   placeholder rows are written on GET (the old defaultAttendance middleware is not used). */
router.get("/", authMiddleware, requireAdmin, getAttendance);
router.get("/admin/summary", authMiddleware, requireAdmin, getAdminTodaySummary);
router.get("/report", authMiddleware, requireAdmin, attendanceReport);
router.put("/update/:employeeId", authMiddleware, requireAdmin, updateAttendance);

/* Employee punch clock (server-owned timestamps, optional Idempotency-Key). */
router.post("/check-in", authMiddleware, requireEmployee, checkIn);
router.post("/check-out", authMiddleware, requireEmployee, checkOut);
router.post("/pause", authMiddleware, requireEmployee, pauseAttendance);
router.post("/resume", authMiddleware, requireEmployee, resumeAttendance);

router.get("/today/me", authMiddleware, requireEmployee, getMyTodayAttendance);
router.get("/me/monthly", authMiddleware, requireEmployee, getMyMonthlyAttendance);
router.get("/user/:userId/monthly", authMiddleware, authorizeRoles("admin", "employee"), getUserMonthlyAttendance);

export default router;

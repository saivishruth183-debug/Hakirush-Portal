import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/roleMiddleware.js";
import { getUpcomingHolidays, addHoliday, deleteHoliday, getAllHolidays } from "../controllers/holidayController.js";

const router = express.Router();

// Read: any authenticated role (employees use holidays for leave/attendance calendars).
router.get("/upcoming", authMiddleware, getUpcomingHolidays);
router.get("/all", authMiddleware, getAllHolidays);
// Write: admin only.
router.post("/add", authMiddleware, requireAdmin, addHoliday);
router.delete("/:id", authMiddleware, requireAdmin, deleteHoliday);

export default router;

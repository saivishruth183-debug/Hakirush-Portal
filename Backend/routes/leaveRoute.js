import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles, { requireAdmin, requireEmployee } from "../middleware/roleMiddleware.js";
import {
  addLeave,
  getLeave,
  getLeaves,
  getMyLeaves,
  getLeaveDetail,
  updateLeave,
  cancelLeave,
  getLeaveBalance,
  getLeaveBalanceByEmployeeId,
  getTeamLeaves,
} from "../controllers/leaveController.js";

const router = express.Router();
const adminOrEmployee = authorizeRoles("admin", "employee");

router.post("/add", authMiddleware, requireEmployee, addLeave);
router.get("/me", authMiddleware, requireEmployee, getMyLeaves);
router.get("/balance/me", authMiddleware, requireEmployee, getLeaveBalance);
router.get("/balance/:employeeId", authMiddleware, adminOrEmployee, getLeaveBalanceByEmployeeId);
router.get("/detail/:id", authMiddleware, adminOrEmployee, getLeaveDetail);
router.get("/team/requests", authMiddleware, requireEmployee, getTeamLeaves);
router.get("/:id/:role", authMiddleware, adminOrEmployee, getLeave);
router.get("/", authMiddleware, requireAdmin, getLeaves);
router.put("/cancel/:id", authMiddleware, requireEmployee, cancelLeave);
router.put("/:id", authMiddleware, adminOrEmployee, updateLeave);

export default router;

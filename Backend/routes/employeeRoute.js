import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles, { requireAdmin, requireEmployee } from "../middleware/roleMiddleware.js";
import upload from "../middleware/upload.js";
import { getLeaveBalance } from "../controllers/leaveController.js";

import {
  addEmployee,
  getEmployees,
  getEmployee,
  getMyEmployee,
  getMyTeam,
  updateEmployee,
  editEmployeeProfile,
  deleteEmployee,
  setEmployeeStatus,
  getEmployeesByDepartment,
  getNewEmployees,
  getEmployeesByDepartmentId,
  getAllEmployeeBirthdays,
  getAllEmployeeAnniversaries,
} from "../controllers/employeeController.js";

const router = express.Router();
const staffOnly = authorizeRoles("admin", "employee");

/* ================= STATIC ROUTES (must precede /:id) ================= */

router.get("/team/me", authMiddleware, requireEmployee, getMyTeam);
router.get("/me", authMiddleware, requireEmployee, getMyEmployee);
router.get("/by-department/me", authMiddleware, requireEmployee, getEmployeesByDepartment);
router.get("/department/:id/employees", authMiddleware, staffOnly, getEmployeesByDepartmentId);
router.get("/new/recent", authMiddleware, staffOnly, getNewEmployees);
// Alias of /api/leave/balance/me (implemented by the leave controller).
router.get("/leave/balance/me", authMiddleware, requireEmployee, getLeaveBalance);
router.get("/birthdays", authMiddleware, staffOnly, getAllEmployeeBirthdays);
router.get("/anniversaries", authMiddleware, staffOnly, getAllEmployeeAnniversaries);
router.post("/add", authMiddleware, requireAdmin, upload.single("profileImage"), addEmployee);
router.put("/update-profile/:id", authMiddleware, staffOnly, upload.single("profileImage"), editEmployeeProfile);

/* ================= :id ROUTES ================= */

router.patch("/:id/status", authMiddleware, requireAdmin, setEmployeeStatus);
router.put("/:id", authMiddleware, requireAdmin, upload.single("profileImage"), updateEmployee);
router.delete("/:id", authMiddleware, requireAdmin, deleteEmployee);
router.get("/", authMiddleware, requireAdmin, getEmployees);
router.get("/:id", authMiddleware, staffOnly, getEmployee);

export default router;

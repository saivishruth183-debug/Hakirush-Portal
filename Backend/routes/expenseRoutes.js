import express from "express";
import multer from "multer";
import {
  createExpenseClaim,
  getMyExpenseClaims,
  getApprovedReimbursementsForEmployee,
  getAllExpenseClaims,
  reviewExpenseClaim,
  deleteExpenseClaim,
} from "../controllers/expenseController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles, { requireEmployee, requireAdmin } from "../middleware/roleMiddleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max receipt
});

const router = express.Router();

router.post("/", authMiddleware, requireEmployee, upload.single("receipt"), createExpenseClaim);
router.get("/me", authMiddleware, requireEmployee, getMyExpenseClaims);
router.get("/employee/:employeeId/approved", authMiddleware, requireAdmin, getApprovedReimbursementsForEmployee);
router.get("/", authMiddleware, authorizeRoles("admin", "employee"), getAllExpenseClaims);
router.put("/:id/review", authMiddleware, requireAdmin, reviewExpenseClaim);
router.delete("/:id", authMiddleware, authorizeRoles("admin", "employee"), deleteExpenseClaim);

export default router;

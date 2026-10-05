import express from "express";
import {
  addPayslip,
  getPayslipsByEmployee,
  getMyPayslips,
  getPayslipLink,
  downloadPayslip,
  autoGeneratePayslip,
} from "../controllers/payslipController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles, { requireAdmin, requireEmployee } from "../middleware/roleMiddleware.js";
import pdfUpload from "../middleware/pdfUpload.js";

const router = express.Router();
const adminOrEmployee = authorizeRoles("admin", "employee");

// Auth + role run before the multipart body is parsed.
router.post("/add", authMiddleware, requireAdmin, pdfUpload("payslip"), addPayslip);
router.post("/auto-generate", authMiddleware, requireAdmin, autoGeneratePayslip);
router.get("/me", authMiddleware, requireEmployee, getMyPayslips);
router.get("/employee/:id", authMiddleware, adminOrEmployee, getPayslipsByEmployee);
router.get("/:payslipId/download", authMiddleware, adminOrEmployee, downloadPayslip);
router.get("/:payslipId/link", authMiddleware, adminOrEmployee, getPayslipLink);

export default router;

import ExpenseClaim, { EXPENSE_CATEGORIES } from "../models/ExpenseClaim.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import uploadToImageKit from "../utils/uploadToImageKit.js";
import { asyncHandler, badRequest, conflict, forbidden, notFound, ApiError } from "../middleware/errorHandler.js";
import { getEmployeeForUser } from "../services/employeeScope.js";
import { requireObjectId, requireEnum, toFiniteNumber, trimmedString, requireYmd } from "../utils/validate.js";

const uploadReceiptImage = async (file) => {
  if (!file?.buffer) return "";
  try {
    return await uploadToImageKit(file, "expenses");
  } catch (err) {
    console.error("Receipt upload to ImageKit failed:", err.message);
    throw new ApiError(502, "Receipt upload failed. Please try again.", "UPLOAD_FAILED");
  }
};

/* ================= EMPLOYEE: SUBMIT EXPENSE CLAIM ================= */
export const createExpenseClaim = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const title = trimmedString(b.title, "title", { max: 120 });
  const category = requireEnum(b.category, EXPENSE_CATEGORIES, "category");
  const amount = toFiniteNumber(b.amount, "amount", { min: 1, max: 1e7 });
  const date = requireYmd(b.date, "date");
  const description = trimmedString(b.description, "description", { max: 500, optional: true }) || "";

  if (!req.file && (!b.receiptUrl || typeof b.receiptUrl !== "string" || !b.receiptUrl.trim())) {
    throw badRequest("Receipt or bill photo is required");
  }

  const employee = await getEmployeeForUser(req.user._id);

  let receiptUrl = "";
  if (req.file) {
    receiptUrl = await uploadReceiptImage(req.file);
  } else if (typeof b.receiptUrl === "string") {
    receiptUrl = b.receiptUrl.trim();
  }

  if (!receiptUrl) {
    throw badRequest("Receipt or bill photo is required");
  }

  const claim = await ExpenseClaim.create({
    employeeId: employee._id,
    title,
    category,
    amount,
    date,
    description,
    receiptUrl,
    status: "Pending",
  });

  // Notify admins
  const admins = await User.find({ role: "admin", isActive: { $ne: false } }).select("_id").lean();
  if (admins.length > 0) {
    const notifications = admins.map((admin) => ({
      type: "expense-claim",
      message: `${req.user.name || "An employee"} submitted an expense claim of ₹${amount} (${category})`,
      data: {
        claimId: claim._id,
        employeeId: employee._id,
        adminId: admin._id,
        link: "/admin-dashboard/expenses",
      },
    }));
    await Notification.insertMany(notifications);
  }

  return res.status(201).json({ success: true, claim });
});

/* ================= EMPLOYEE: GET MY CLAIMS ================= */
export const getMyExpenseClaims = asyncHandler(async (req, res) => {
  const employee = await getEmployeeForUser(req.user._id);
  const claims = await ExpenseClaim.find({ employeeId: employee._id }).sort({ date: -1, createdAt: -1 }).lean();

  const totalSubmitted = claims.reduce((s, c) => s + (c.amount || 0), 0);
  const totalApproved = claims.filter((c) => c.status === "Approved").reduce((s, c) => s + (c.amount || 0), 0);
  const totalReimbursed = claims.filter((c) => c.status === "Reimbursed").reduce((s, c) => s + (c.amount || 0), 0);

  return res.json({
    success: true,
    totalSubmitted,
    totalApproved,
    totalReimbursed,
    claims,
  });
});

/* ================= GET PENDING APPROVED CLAIMS FOR PAYSLIP ================= */
// Used by Admin / Add Payslip to auto-populate approved reimbursements for an employee
export const getApprovedReimbursementsForEmployee = asyncHandler(async (req, res) => {
  const employeeId = requireObjectId(req.params.employeeId, "employeeId");

  const approvedClaims = await ExpenseClaim.find({
    employeeId,
    status: "Approved",
    reimbursedPayslipId: null,
  })
    .sort({ date: 1 })
    .lean();

  const totalReimbursement = approvedClaims.reduce((sum, c) => sum + (c.amount || 0), 0);

  return res.json({
    success: true,
    totalReimbursement,
    claims: approvedClaims,
  });
});

/* ================= ADMIN / MANAGER: GET ALL EXPENSE CLAIMS ================= */
export const getAllExpenseClaims = asyncHandler(async (req, res) => {
  let filter = {};

  if (req.user.role !== "admin") {
    const managerEmp = await Employee.findOne({ userId: req.user._id }).select("_id").lean();
    if (!managerEmp) throw forbidden();

    const dept = await Department.findOne({ managerEmployeeId: managerEmp._id }).select("_id").lean();
    if (!dept) throw forbidden("Only department managers or admins can view team expenses");

    const deptEmployees = await Employee.find({ department: dept._id }).select("_id").lean();
    filter = { employeeId: { $in: deptEmployees.map((e) => e._id) } };
  }

  const claims = await ExpenseClaim.find(filter)
    .populate({
      path: "employeeId",
      select: "employeeId designation department",
      populate: [
        { path: "userId", select: "name email profileImage" },
        { path: "department", select: "dep_name" },
      ],
    })
    .sort({ createdAt: -1 })
    .lean();

  return res.json({ success: true, claims });
});

/* ================= ADMIN: REVIEW EXPENSE CLAIM ================= */
export const reviewExpenseClaim = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    throw forbidden("Only admins can review expense claims");
  }

  const claimId = requireObjectId(req.params.id, "id");
  const decision = requireEnum(req.body?.decision, ["Approved", "Rejected"], "decision");
  const remarks = trimmedString(req.body?.remarks, "remarks", { max: 500, optional: true }) || "";

  const claim = await ExpenseClaim.findById(claimId);
  if (!claim) throw notFound("Expense claim not found");
  if (claim.status === "Reimbursed") {
    throw conflict("Cannot modify a claim that has already been reimbursed in payroll", "ALREADY_REIMBURSED");
  }

  const targetEmp = await Employee.findById(claim.employeeId).select("userId").lean();
  if (targetEmp?.userId?.toString() === req.user._id.toString()) {
    throw forbidden("You cannot review your own expense claims");
  }

  claim.status = decision;
  claim.reviewedBy = req.user._id;
  claim.reviewedAt = new Date();
  claim.reviewRemarks = remarks;
  await claim.save();

  // Notify employee
  const emp = await Employee.findById(claim.employeeId).select("userId").lean();
  if (emp?.userId) {
    await Notification.create({
      type: "expense-status",
      message: `Your ₹${claim.amount} expense claim (${claim.title}) was ${decision.toLowerCase()}.${remarks ? ` Remarks: ${remarks}` : ""}`,
      seen: false,
      data: { userId: emp.userId, claimId: claim._id, status: decision },
    });
  }

  return res.json({ success: true, claim });
});

/* ================= EMPLOYEE / ADMIN: DELETE (WITHDRAW) EXPENSE CLAIM ================= */
export const deleteExpenseClaim = asyncHandler(async (req, res) => {
  const claimId = requireObjectId(req.params.id, "id");

  const claim = await ExpenseClaim.findById(claimId);
  if (!claim) throw notFound("Expense claim not found");

  // Reimbursed claims are locked — they are already credited in payroll
  if (claim.status === "Reimbursed") {
    throw conflict(
      "Cannot delete a claim that has already been reimbursed in payroll",
      "ALREADY_REIMBURSED"
    );
  }

  // Authorization: admin can delete any non-reimbursed claim; employees can only delete their own
  if (req.user.role !== "admin") {
    const employee = await getEmployeeForUser(req.user._id);
    if (claim.employeeId.toString() !== employee._id.toString()) {
      throw forbidden("You can only delete your own expense claims");
    }
  }

  await ExpenseClaim.findByIdAndDelete(claimId);

  return res.json({
    success: true,
    message: "Expense claim deleted successfully",
  });
});

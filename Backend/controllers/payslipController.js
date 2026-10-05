import Payslip from "../models/Payslip.js";
import { asyncHandler, badRequest, conflict, forbidden, notFound } from "../middleware/errorHandler.js";
import { requireObjectId, toFiniteNumber, requireEnum } from "../utils/validate.js";
import { now as clockNow } from "../services/clock.js";
import { findEmployeeByAnyId, getEmployeeForUser, resolveEmployeeForCaller } from "../services/employeeScope.js";
import { generatePayslipPdf } from "../services/pdfService.js";
import { buildMonthlyAttendance } from "../services/attendanceService.js";
import {
  storePayslipPdf,
  removePayslipFile,
  signedPayslipUrl,
  fetchPayslipPdf,
  isPrivatePayslip,
} from "../services/payslipFiles.js";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_AMOUNT = 1e9;
const MAX_OVERTIME_HOURS = 744; // hours in a 31-day month

const EARNINGS = ["hra", "conveyanceAllowance", "medicalAllowance", "otherAllowances", "bonus", "reimbursements"];
const DEDUCTIONS = ["providentFund", "professionalTax", "incomeTax", "lossOfPay", "otherDeductions"];

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Validated, server-computed payslip figures. Client-sent totals
 * (overtimePay, grossSalary, totalDeductions, netSalary) are ignored.
 */
export const computePayslipFigures = (body) => {
  const amount = (field, opts = {}) =>
    toFiniteNumber(body[field], field, { min: 0, max: MAX_AMOUNT, optional: true, ...opts }) ?? 0;

  const basicSalary = toFiniteNumber(body.basicSalary, "basicSalary", { min: 0, max: MAX_AMOUNT });
  if (basicSalary <= 0) throw badRequest("basicSalary must be greater than 0");

  const figures = { basicSalary };
  for (const f of EARNINGS) figures[f] = amount(f);
  for (const f of DEDUCTIONS) figures[f] = amount(f);
  figures.overtimeHours = amount("overtimeHours", { max: MAX_OVERTIME_HOURS });
  figures.overtimeRate = amount("overtimeRate");

  figures.overtimePay = round2(figures.overtimeHours * figures.overtimeRate);
  figures.grossSalary = round2(
    basicSalary + EARNINGS.reduce((sum, f) => sum + figures[f], 0) + figures.overtimePay
  );
  figures.totalDeductions = round2(DEDUCTIONS.reduce((sum, f) => sum + figures[f], 0));
  figures.netSalary = round2(figures.grossSalary - figures.totalDeductions);
  return figures;
};

/**
 * Response shape: never exposes storage ids or stored/legacy URLs. Everyone
 * gets `hasFile` and `fileMigrationRequired` (legacy public upload not yet
 * migrated: link/download answer 409 LEGACY_FILE_NOT_MIGRATED). Admins
 * additionally get `payslipFile` as a short-lived signed URL, only for private files.
 */
const toDto = (p, { forAdmin = false, now = new Date() } = {}) => {
  const obj = typeof p.toObject === "function" ? p.toObject() : { ...p };
  const hasFile = Boolean(obj.payslipFile || obj.filePath);
  const isPrivate = isPrivatePayslip(obj);
  for (const k of ["fileId", "filePath", "isPrivateFile", "payslipFile", "legacyUrl", "storage", "createdBy"]) delete obj[k];
  obj.hasFile = hasFile;
  obj.fileMigrationRequired = hasFile && !isPrivate;
  if (forAdmin && isPrivate) {
    const { url, expiresAt } = signedPayslipUrl(p, { now });
    obj.payslipFile = url;
    obj.fileUrlExpiresAt = expiresAt;
  }
  return obj;
};

/* ================= ADD PAYSLIP (ADMIN) ================= */
export const addPayslip = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const employeeRef = requireObjectId(body.employeeId, "employeeId");
  const month = typeof body.month === "string" ? body.month.trim() : "";
  if (!MONTH_RE.test(month)) throw badRequest("month must be YYYY-MM");
  const paymentStatus = requireEnum(body.paymentStatus || "Paid", ["Pending", "Paid"], "paymentStatus");
  const figures = computePayslipFigures(body);

  if (!req.file) throw badRequest("Payslip PDF file is required");

  const employee = await findEmployeeByAnyId(employeeRef);
  if (!employee) throw notFound("Employee not found");

  if (await Payslip.exists({ employee: employee._id, month })) {
    throw conflict("A payslip for this employee and month already exists", "CONFLICT");
  }

  const now = clockNow();
  const stored = await storePayslipPdf(req.file, { employeeCode: employee.employeeId, month });

  let payslip;
  try {
    payslip = await Payslip.create({
      employee: employee._id,
      month,
      ...figures,
      paymentStatus,
      paymentDate: paymentStatus === "Paid" ? now : null,
      payslipFile: stored.url,
      fileId: stored.fileId,
      filePath: stored.filePath,
      storage: "private",
      isPrivateFile: true,
      createdBy: req.user._id,
    });
  } catch (err) {
    await removePayslipFile(stored.fileId);
    if (err?.code === 11000) throw conflict("A payslip for this employee and month already exists", "CONFLICT");
    throw err;
  }

  return res.status(201).json({ success: true, payslip: toDto(payslip, { forAdmin: true, now }) });
});

/* ================= AUTO-GENERATE PAYSLIP (ADMIN) ================= */
export const autoGeneratePayslip = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const employeeRef = requireObjectId(body.employeeId, "employeeId");
  const month = typeof body.month === "string" ? body.month.trim() : "";
  if (!MONTH_RE.test(month)) throw badRequest("month must be YYYY-MM");
  
  const employee = await findEmployeeByAnyId(employeeRef);
  if (!employee) throw notFound("Employee not found");
  await employee.populate("userId"); // Need name

  if (await Payslip.exists({ employee: employee._id, month })) {
    throw conflict("A payslip for this employee and month already exists", "CONFLICT");
  }

  const now = clockNow();
  const [yyyy, mm] = month.split("-").map(Number);

  // Get attendance data for LOP calculation
  const { attendance: monthAttendance } = await buildMonthlyAttendance({
    employee,
    year: yyyy,
    month: mm,
    now,
  });

  // Calculate Loss Of Pay (LOP)
  // Assuming a standard 22 working days per month (or calculate dynamically from monthAttendance)
  const totalWorkingDays = monthAttendance.length || 22;
  const absentDays = monthAttendance.filter(a => a.status === "Absent" || a.status === "Leave").length;
  
  const basicSalary = employee.salary || 0;
  let lossOfPay = 0;
  if (totalWorkingDays > 0) {
    lossOfPay = Math.round((basicSalary / totalWorkingDays) * absentDays);
  }

  // Auto-calculated figures
  const figures = computePayslipFigures({
    basicSalary,
    lossOfPay,
    // Add standard defaults
    providentFund: Math.round(basicSalary * 0.12), // 12% standard PF
    professionalTax: 200, // standard PT in India
  });

  // Generate PDF
  const pdfBuffer = await generatePayslipPdf({ ...figures, month }, employee, employee.userId);

  // Mock a Multer file object for storePayslipPdf
  const fileObj = {
    buffer: pdfBuffer,
    originalname: `payslip-${month}.pdf`,
    mimetype: "application/pdf",
  };

  const stored = await storePayslipPdf(fileObj, { employeeCode: employee.employeeId, month });

  let payslip;
  try {
    payslip = await Payslip.create({
      employee: employee._id,
      month,
      ...figures,
      paymentStatus: "Paid", // Auto-generated usually assumes Paid or can be configured
      paymentDate: now,
      payslipFile: stored.url,
      fileId: stored.fileId,
      filePath: stored.filePath,
      storage: "private",
      isPrivateFile: true,
      createdBy: req.user._id,
    });
  } catch (err) {
    await removePayslipFile(stored.fileId);
    if (err?.code === 11000) throw conflict("A payslip for this employee and month already exists", "CONFLICT");
    throw err;
  }

  return res.status(201).json({ success: true, payslip: toDto(payslip, { forAdmin: true, now }) });
});

/* ================= LISTS ================= */
const listFor = async (employeeId) => Payslip.find({ employee: employeeId }).sort({ month: -1, createdAt: -1 });

// GET /payslip/me (employee)
export const getMyPayslips = asyncHandler(async (req, res) => {
  const employee = await getEmployeeForUser(req.user._id);
  const payslips = await listFor(employee._id);
  return res.json({ success: true, payslips: payslips.map((p) => toDto(p)) });
});

// GET /payslip/employee/:id (admin any; employee own). `:id` = Employee._id or userId.
export const getPayslipsByEmployee = asyncHandler(async (req, res) => {
  const employee = await resolveEmployeeForCaller(req, req.params.id, "id");
  const payslips = await listFor(employee._id);
  const forAdmin = req.user.role === "admin";
  const now = clockNow();
  return res.json({ success: true, payslips: payslips.map((p) => toDto(p, { forAdmin, now })) });
});

/* ================= SINGLE PAYSLIP FILE ACCESS ================= */
// Admin: any payslip. Employee: only their own (404 otherwise, no existence leak).
const loadAccessiblePayslip = async (req) => {
  const id = requireObjectId(req.params.payslipId, "payslipId");
  const filter = { _id: id };
  if (req.user.role === "employee") {
    const own = await getEmployeeForUser(req.user._id);
    filter.employee = own._id;
  } else if (req.user.role !== "admin") {
    throw forbidden();
  }
  const payslip = await Payslip.findOne(filter);
  if (!payslip) throw notFound("Payslip not found");
  if (!payslip.payslipFile && !payslip.filePath) throw notFound("Payslip file not found");
  return payslip;
};

// GET /payslip/:payslipId/link -> { url, expiresAt } (<= 5 minutes); legacy -> 409 LEGACY_FILE_NOT_MIGRATED
export const getPayslipLink = asyncHandler(async (req, res) => {
  const payslip = await loadAccessiblePayslip(req);
  const { url, expiresAt } = signedPayslipUrl(payslip, { now: clockNow() });
  res.set("Cache-Control", "no-store");
  return res.json({ success: true, url, expiresAt });
});

// GET /payslip/:payslipId/download -> application/pdf; legacy -> 409 LEGACY_FILE_NOT_MIGRATED
export const downloadPayslip = asyncHandler(async (req, res) => {
  const payslip = await loadAccessiblePayslip(req);
  const pdf = await fetchPayslipPdf(payslip, { now: clockNow() });
  res.set({
    "Content-Type": "application/pdf",
    "Content-Length": String(pdf.length),
    "Content-Disposition": `attachment; filename="payslip-${payslip.month}.pdf"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  return res.status(200).end(pdf);
});

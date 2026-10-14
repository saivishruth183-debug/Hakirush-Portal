import OvertimeRequest from "../models/OvertimeRequest.js";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { asyncHandler, badRequest, conflict, forbidden, notFound } from "../middleware/errorHandler.js";
import { getEmployeeForUser } from "../services/employeeScope.js";
import { requireObjectId, requireEnum, toFiniteNumber, trimmedString } from "../utils/validate.js";

const round2 = (n) => Math.round(n * 100) / 100;

/* ================= EMPLOYEE: GET OVERTIME SUMMARY ================= */
export const getMyOvertimeSummary = asyncHandler(async (req, res) => {
  const employee = await getEmployeeForUser(req.user._id);

  // 1. Total overtime hours earned from punches
  const punchRecords = await Attendance.find({
    employeeId: employee._id,
    overtimeHours: { $gt: 0 },
  })
    .select("date checkIn checkOut workedHours overtimeHours status")
    .sort({ date: -1 })
    .lean();

  const totalEarnedHours = round2(
    punchRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0)
  );

  // 2. Overtime hours requested (Pending or Approved)
  const requests = await OvertimeRequest.find({ employeeId: employee._id })
    .sort({ createdAt: -1 })
    .lean();

  const claimedHours = round2(
    requests
      .filter((r) => r.status === "Pending" || r.status === "Approved")
      .reduce((sum, r) => sum + (r.hours || 0), 0)
  );

  const availableHours = round2(Math.max(0, totalEarnedHours - claimedHours));

  return res.json({
    success: true,
    totalEarnedHours,
    claimedHours,
    availableHours,
    recentOvertimeDays: punchRecords.slice(0, 30),
    requests,
  });
});

/* ================= EMPLOYEE: APPLY FOR COMP-OFF OR PAYOUT ================= */
export const applyOvertime = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const type = requireEnum(body.type, ["Comp-Off", "Payout"], "type");
  const hours = toFiniteNumber(body.hours, "hours", { min: 0.5, max: 100 });
  const reason = trimmedString(body.reason, "reason", { max: 500, optional: true }) || "";

  const employee = await getEmployeeForUser(req.user._id);

  // Check available overtime hours
  const punchRecords = await Attendance.find({
    employeeId: employee._id,
    overtimeHours: { $gt: 0 },
  })
    .select("overtimeHours")
    .lean();

  const totalEarned = round2(punchRecords.reduce((s, r) => s + (r.overtimeHours || 0), 0));

  const existingRequests = await OvertimeRequest.find({
    employeeId: employee._id,
    status: { $in: ["Pending", "Approved"] },
  }).select("hours").lean();

  const alreadyClaimed = round2(existingRequests.reduce((s, r) => s + (r.hours || 0), 0));
  const available = round2(Math.max(0, totalEarned - alreadyClaimed));

  if (hours > available) {
    throw badRequest(`Requested hours (${hours}h) exceed your available overtime balance (${available}h)`);
  }

  const isManager = Boolean(await Department.exists({ managerEmployeeId: employee._id }));

  // Department managers are directly approved
  if (isManager || req.user.role === "admin") {
    const request = await OvertimeRequest.create({
      employeeId: employee._id,
      type,
      hours,
      reason,
      status: "Approved",
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      reviewRemarks: "Auto-approved for Department Manager",
    });

    return res.status(201).json({
      success: true,
      request,
      autoApproved: true,
      message: `Overtime ${type} request approved directly`,
    });
  }

  const request = await OvertimeRequest.create({
    employeeId: employee._id,
    type,
    hours,
    reason,
    status: "Pending",
  });

  // Notify admins
  const admins = await User.find({ role: "admin", isActive: { $ne: false } }).select("_id").lean();
  if (admins.length > 0) {
    const notifications = admins.map((admin) => ({
      type: "overtime-request",
      message: `${req.user.name || "An employee"} applied for ${hours}h overtime ${type}`,
      data: {
        requestId: request._id,
        employeeId: employee._id,
        adminId: admin._id,
        link: "/admin-dashboard/attendance",
      },
    }));
    await Notification.insertMany(notifications);
  }

  return res.status(201).json({ success: true, request });
});

/* ================= ADMIN / MANAGER: GET ALL OVERTIME REQUESTS ================= */
export const getAllOvertimeRequests = asyncHandler(async (req, res) => {
  let filter = {};

  if (req.user.role !== "admin") {
    const managerEmp = await Employee.findOne({ userId: req.user._id }).select("_id").lean();
    if (!managerEmp) throw forbidden();

    const dept = await Department.findOne({ managerEmployeeId: managerEmp._id }).select("_id").lean();
    if (!dept) throw forbidden("Only department managers or admins can view team overtime requests");

    const deptEmployees = await Employee.find({ department: dept._id }).select("_id").lean();
    filter = { employeeId: { $in: deptEmployees.map((e) => e._id) } };
  }

  const requests = await OvertimeRequest.find(filter)
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

  return res.json({ success: true, requests });
});

/* ================= ADMIN / MANAGER: REVIEW REQUEST ================= */
export const reviewOvertimeRequest = asyncHandler(async (req, res) => {
  const requestId = requireObjectId(req.params.id, "id");
  const decision = requireEnum(req.body?.decision, ["Approved", "Rejected"], "decision");
  const remarks = trimmedString(req.body?.remarks, "remarks", { max: 500, optional: true }) || "";

  const request = await OvertimeRequest.findById(requestId);
  if (!request) throw notFound("Overtime request not found");
  if (request.status !== "Pending") {
    throw conflict("Request has already been reviewed", "ALREADY_REVIEWED", { status: request.status });
  }

  // Authorization check
  if (req.user.role !== "admin") {
    const managerEmp = await Employee.findOne({ userId: req.user._id }).select("_id").lean();
    const targetEmp = await Employee.findById(request.employeeId).select("department").lean();
    const managesDept = Boolean(
      managerEmp &&
        targetEmp &&
        (await Department.exists({ _id: targetEmp.department, managerEmployeeId: managerEmp._id }))
    );
    if (!managesDept) throw forbidden("You can only review requests for your department members");
  }

  request.status = decision;
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  request.reviewRemarks = remarks;
  await request.save();

  // Notify employee
  const emp = await Employee.findById(request.employeeId).select("userId").lean();
  if (emp?.userId) {
    await Notification.create({
      type: "overtime-status",
      message: `Your ${request.hours}h overtime ${request.type} request was ${decision.toLowerCase()}.${remarks ? ` Remarks: ${remarks}` : ""}`,
      seen: false,
      data: { userId: emp.userId, requestId: request._id, status: decision },
    });
  }

  return res.json({ success: true, request });
});

/* ================= EMPLOYEE / ADMIN: DELETE (WITHDRAW) OVERTIME REQUEST ================= */
export const deleteOvertimeRequest = asyncHandler(async (req, res) => {
  const requestId = requireObjectId(req.params.id, "id");

  const request = await OvertimeRequest.findById(requestId);
  if (!request) throw notFound("Overtime request not found");

  // Authorization: admin can delete any request; employees can only delete their own
  if (req.user.role !== "admin") {
    const employee = await getEmployeeForUser(req.user._id);
    if (request.employeeId.toString() !== employee._id.toString()) {
      throw forbidden("You can only delete your own overtime requests");
    }
  }

  await OvertimeRequest.findByIdAndDelete(requestId);

  return res.json({
    success: true,
    message: "Overtime request deleted successfully",
  });
});

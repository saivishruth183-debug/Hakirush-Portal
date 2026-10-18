import AttendanceRequest from "../models/AttendanceRequest.js";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { asyncHandler, badRequest, conflict, notFound } from "../middleware/errorHandler.js";
import {
  requireObjectId,
  requireYmd,
  requireEnum,
  trimmedString,
  parsePagination,
} from "../utils/validate.js";
import { businessDate } from "../utils/orgTime.js";
import { NOMINAL_HOURS, isIncompleteCheckout, workedMsAt, msToHours } from "../utils/attendanceStatus.js";
import { now as clockNow } from "../services/clock.js";
import { getEmployeeForUser } from "../services/employeeScope.js";

const REQUESTABLE = ["Present", "Half Day"];
const DECISIONS = ["Approved", "Rejected"];
const REQUEST_STATUSES = ["Pending", "Approved", "Rejected"];
const REASON_MAX = 500;

const EMPLOYEE_POPULATE = {
  path: "employeeId",
  populate: [
    { path: "userId", select: "name email profileImage" },
    { path: "department", select: "dep_name" },
  ],
};

// Status the day currently shows (server-derived; the client value is informational only).
const effectiveStatus = (record, date, today) => {
  if (!record) return "Absent";
  if (isIncompleteCheckout(record) && date < today) return "Present";
  if (record.checkIn && !record.status) return "Present";
  return record.status || "Absent";
};

/* ================= EMPLOYEE: CREATE REQUEST ================= */
const createAttendanceRequest = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const date = requireYmd(body.date, "date");
  const requestedStatus = requireEnum(body.requestedStatus, REQUESTABLE, "requestedStatus");
  const reason = trimmedString(body.reason, "reason", { max: REASON_MAX });

  const now = clockNow();
  const today = businessDate(now);
  if (date > today) throw badRequest("date cannot be in the future");

  const employee = await getEmployeeForUser(req.user._id);

  const record = await Attendance.findOne({ employeeId: employee._id, date }).lean();
  const currentStatus = effectiveStatus(record, date, today);
  if (currentStatus === requestedStatus && (record?.status || "Absent") === requestedStatus) {
    throw badRequest("Requested status must differ from current status");
  }

  const existing = await AttendanceRequest.exists({ employeeId: employee._id, date, status: "Pending" });
  if (existing) throw conflict("A request for this date is already pending", "CONFLICT");

  const isManager = Boolean(await Department.exists({ managerEmployeeId: employee._id }));

  // If caller is a Department Manager (or Admin), directly apply and auto-approve.
  // No request is routed to admin.
  if (isManager || req.user.role === "admin") {
    let directRequest;
    try {
      directRequest = await AttendanceRequest.create({
        employeeId: employee._id,
        date,
        currentStatus,
        requestedStatus,
        reason: reason || "Direct attendance entry by Department Manager",
        status: "Approved",
        reviewedBy: req.user._id,
        reviewedAt: now,
        reviewRemarks: "Direct entry by Department Manager (Auto-approved)",
      });
    } catch (err) {
      if (err?.code === 11000) throw conflict("A request for this date already exists", "CONFLICT");
      throw err;
    }

    const attendance = await applyApprovedCorrection(directRequest, req.user._id, now);
    return res.status(201).json({
      success: true,
      request: directRequest,
      attendance,
      autoApproved: true,
      message: "Attendance recorded directly without admin review",
    });
  }

  let request;
  try {
    request = await AttendanceRequest.create({
      employeeId: employee._id,
      date,
      currentStatus,
      requestedStatus,
      reason,
    });
  } catch (err) {
    if (err?.code === 11000) throw conflict("A request for this date is already pending", "CONFLICT");
    throw err;
  }

  const admins = await User.find({ role: "admin", isActive: { $ne: false } }).select("_id");
  if (admins.length > 0) {
    const notifications = admins.map((admin) => ({
      type: "attendance-request",
      message: `${req.user.name || "An employee"} submitted an attendance correction request for ${date}`,
      data: {
        requestId: request._id,
        employeeId: employee._id,
        adminId: admin._id,
        link: "/admin-dashboard/attendance-requests",
      },
    }));
    await Notification.insertMany(notifications);
  }

  return res.status(201).json({ success: true, request });
});

/* ================= EMPLOYEE: MY REQUESTS ================= */
const getMyAttendanceRequests = asyncHandler(async (req, res) => {
  const employee = await getEmployeeForUser(req.user._id);
  const requests = await AttendanceRequest.find({ employeeId: employee._id }).sort({ createdAt: -1 }).limit(500);
  return res.json({ success: true, requests });
});

/* ================= ADMIN: ALL REQUESTS ================= */
// Filters: status, employeeId (Employee._id), from/to (YYYY-MM-DD on the request date).
// Pagination only when page or limit is given (the web reads the full list).
const getAllAttendanceRequests = asyncHandler(async (req, res) => {
  const { status, employeeId, from, to, page, limit } = req.query;
  const filter = {};
  if (status !== undefined && status !== "" && status !== "All") {
    filter.status = requireEnum(status, REQUEST_STATUSES, "status");
  }
  if (employeeId !== undefined && employeeId !== "") filter.employeeId = requireObjectId(employeeId, "employeeId");
  if (from !== undefined || to !== undefined) {
    filter.date = {};
    if (from !== undefined) filter.date.$gte = requireYmd(from, "from");
    if (to !== undefined) filter.date.$lte = requireYmd(to, "to");
    if (filter.date.$gte && filter.date.$lte && filter.date.$lte < filter.date.$gte) {
      throw badRequest("to must be on or after from");
    }
  }

  const query = AttendanceRequest.find(filter).populate(EMPLOYEE_POPULATE).sort({ createdAt: -1 });
  if (page !== undefined || limit !== undefined) {
    const p = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const [requests, total] = await Promise.all([
      query.skip(p.skip).limit(p.limit),
      AttendanceRequest.countDocuments(filter),
    ]);
    return res.json({ success: true, requests, page: p.page, limit: p.limit, total, hasMore: p.skip + requests.length < total });
  }
  const requests = await query.limit(1000);
  return res.json({ success: true, requests });
});

/* ================= ADMIN: REVIEW REQUEST ================= */
const applyApprovedCorrection = async (request, reviewer, now) => {
  const existing = await Attendance.findOne({ employeeId: request.employeeId, date: request.date }).lean();
  const set = {
    status: request.requestedStatus,
    // Nominal hours for the approved status (Present 8h, Half Day 4h — existing thresholds).
    workedHours: NOMINAL_HOURS[request.requestedStatus],
    hoursSource: "correction",
    source: "correction",
    correctionRequestId: request._id,
    correctedBy: reviewer,
    correctedAt: now,
    isPaused: false,
    pauseStartedAt: null,
  };
  // Real punches are kept untouched; punch timestamps are never fabricated.
  if (existing?.checkIn && existing?.checkOut) {
    set.punchedHours = msToHours(workedMsAt(existing, existing.checkOut));
  }
  try {
    return await Attendance.findOneAndUpdate(
      { employeeId: request.employeeId, date: request.date },
      { $set: set },
      { upsert: true, returnDocument: "after" }
    );
  } catch (err) {
    if (err?.code !== 11000) throw err;
    return Attendance.findOneAndUpdate(
      { employeeId: request.employeeId, date: request.date },
      { $set: set },
      { returnDocument: "after" }
    );
  }
};

const reviewAttendanceRequest = asyncHandler(async (req, res) => {
  const requestId = requireObjectId(req.params.requestId, "requestId");
  const decision = requireEnum(req.body?.decision, DECISIONS, "decision");
  const remarks = trimmedString(req.body?.remarks, "remarks", { max: REASON_MAX, optional: true }) || "";
  const now = clockNow();

  // Atomic Pending -> Approved/Rejected: only one review can win.
  const request = await AttendanceRequest.findOneAndUpdate(
    { _id: requestId, status: "Pending" },
    { $set: { status: decision, reviewedBy: req.user._id, reviewRemarks: remarks, reviewedAt: now } },
    { returnDocument: "after" }
  );
  if (!request) {
    const exists = await AttendanceRequest.findById(requestId).select("status").lean();
    if (!exists) throw notFound("Request not found");
    throw conflict("Request has already been reviewed", "ALREADY_REVIEWED", { status: exists.status });
  }

  let attendance = null;
  if (decision === "Approved") {
    try {
      attendance = await applyApprovedCorrection(request, req.user._id, now);
    } catch (err) {
      // Compensate so the request can be reviewed again.
      await AttendanceRequest.updateOne(
        { _id: request._id, status: "Approved" },
        { $set: { status: "Pending", reviewedBy: null, reviewRemarks: "", reviewedAt: null } }
      ).catch(() => {});
      throw err;
    }
  }

  const employeeDoc = await Employee.findById(request.employeeId).select("userId").lean();
  if (employeeDoc?.userId) {
    const statusText = decision === "Approved" ? "approved" : "rejected";
    await Notification.create({
      type: "attendance-request-status",
      message: `Your attendance correction request for ${request.date} (${request.requestedStatus}) was ${statusText}.${remarks ? ` Remarks: ${remarks}` : ""}`,
      seen: false,
      data: { userId: employeeDoc.userId, requestId: request._id, employeeId: request.employeeId, status: decision },
    });
  }

  return res.json({ success: true, request, attendance });
});

/* ================= EMPLOYEE: DELETE REQUEST ================= */
const deleteAttendanceRequest = asyncHandler(async (req, res) => {
  const requestId = requireObjectId(req.params.requestId, "requestId");
  const employee = await getEmployeeForUser(req.user._id);

  const deleted = await AttendanceRequest.findOneAndDelete({
    _id: requestId,
    employeeId: employee._id,
    status: "Pending",
  });
  if (!deleted) {
    const own = await AttendanceRequest.findOne({ _id: requestId, employeeId: employee._id }).select("status").lean();
    if (!own) throw notFound("Request not found");
    throw conflict("Only pending requests can be deleted", "INVALID_TRANSITION", { status: own.status });
  }
  return res.json({ success: true, message: "Request deleted successfully" });
});

export {
  createAttendanceRequest,
  getMyAttendanceRequests,
  getAllAttendanceRequests,
  deleteAttendanceRequest,
  reviewAttendanceRequest,
};

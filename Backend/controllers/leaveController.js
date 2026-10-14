import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import Leave from "../models/Leave.js";
import Holiday from "../models/Holiday.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const toRawDateString = (dateInput) => {
  const d = new Date(dateInput);
  // Use local date, not UTC/ISO
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/* ================= UPDATED HELPER: EXCLUDES SAT & SUN ================= */
const calculateNetWorkDays = (startDate, endDate, holidays = []) => {
    let count = 0;
    // Always construct dates using year, month, day (local)
    const start = new Date(startDate);
    const end = new Date(endDate);
    let current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const holidayStrings = holidays.map(h => toRawDateString(h.date));
    while (current <= last) {
        const dateStr = toRawDateString(current);
        const dayOfWeek = current.getDay();
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;
        const isHoliday = holidayStrings.includes(dateStr);
        if (!isSunday && !isSaturday && !isHoliday) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
};

/* ================= ADD LEAVE ================= */
const addLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;
    const employee = await Employee.findOne({ userId: req.user._id });
    const holidays = await Holiday.find(); 
    const daysRequested = calculateNetWorkDays(startDate, endDate, holidays);

    // Debug logging for troubleshooting
    console.log("[LEAVE DEBUG] Requested:", { startDate, endDate, holidays: holidays.map(h=>h.date), daysRequested });

    const leave = await Leave.create({
      employeeId: employee._id,
      leaveType,
      startDate,
      endDate,
      reason,
      status: "Pending",
      days: daysRequested, 
    });

    // Notify all admins of new leave request
    const admins = await User.find({ role: "admin" });
    const employeeUser = await User.findById(req.user._id);
    const notifications = admins.map(admin => ({
      type: "leave-request",
      message: `${employeeUser.name} applied for ${leaveType} leave (${daysRequested} days)`,
      data: { leaveId: leave._id, employeeId: employee._id, adminId: admin._id, link: "/admin-dashboard/leaves" },
    }));
    await Notification.insertMany(notifications);

    return res.status(200).json({ success: true, leave });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/* ================= UPDATE LEAVE STATUS (ADMIN) ================= */
const updateLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid leave status" });
    }

    const updates = { status };
    if (status === "Approved") {
      const leaveDates = await Leave.findById(id).select("startDate endDate");
      if (!leaveDates) {
        return res.status(404).json({ success: false, message: "Leave request not found" });
      }
      const holidays = await Holiday.find();
      updates.days = calculateNetWorkDays(leaveDates.startDate, leaveDates.endDate, holidays);
    }

    const leave = await Leave.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    // Notify employee of leave status update
    const employee = await Employee.findById(leave.employeeId).populate("userId");
    if (employee && employee.userId) {
      let msg = `Your leave request from ${leave.startDate.toLocaleDateString()} to ${leave.endDate.toLocaleDateString()} was ${status}`;
      await Notification.create({
        type: "leave-status",
        message: msg,
        data: { leaveId: leave._id, employeeId: employee._id, userId: employee.userId._id, status },
      });
    }

    return res.status(200).json({ success: true, leave });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const canCancelLeave = (status) => ["Pending", "Approved"].includes(status);

const cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await Leave.findById(id);

    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave request not found" });
    }

    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee) {
      return res.status(403).json({ success: false, message: "Employee profile not found" });
    }

    const isOwner = leave.employeeId.toString() === employee._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "You are not authorized to cancel this leave" });
    }

    if (!canCancelLeave(leave.status)) {
      return res.status(400).json({ success: false, message: "Only pending or approved leave requests can be cancelled" });
    }

    leave.status = "Cancelled";
    await leave.save();

    const employeeUser = await Employee.findById(leave.employeeId).populate("userId");
    if (employeeUser?.userId) {
      await Notification.create({
        type: "leave-status",
        message: `Your leave request from ${leave.startDate.toLocaleDateString()} to ${leave.endDate.toLocaleDateString()} was Cancelled`,
        data: { leaveId: leave._id, employeeId: employeeUser._id, userId: employeeUser.userId._id, status: "Cancelled" },
      });
    }

    return res.status(200).json({ success: true, leave });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/* ================= GET LEAVE BALANCE (SELF — logged-in employee) ================= */
const getLeaveBalance = async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.user._id });
    const approved = await Leave.aggregate([
      { $match: { employeeId: employee._id, status: "Approved" } },
      { $group: { _id: "$leaveType", daysUsed: { $sum: "$days" } } },
    ]);

    const used = { "Casual Leave": 0, "Sick Leave": 0 };
    approved.forEach(item => { used[item._id] = item.daysUsed; });

    return res.status(200).json({
      success: true,
      casual: { total: 12, used: used["Casual Leave"], balance: 12 - used["Casual Leave"] },
      sick: { total: 12, used: used["Sick Leave"], balance: 12 - used["Sick Leave"] },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= GET LEAVE BALANCE BY EMPLOYEE ID (ADMIN VIEW) ================= */
const getLeaveBalanceByEmployeeId = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ success: false, message: "Invalid employee id" });
    }

    const approved = await Leave.aggregate([
      {
        $match: {
          employeeId: new mongoose.Types.ObjectId(employeeId),
          status: "Approved",
        },
      },
      { $group: { _id: "$leaveType", daysUsed: { $sum: "$days" } } },
    ]);

    const used = { "Casual Leave": 0, "Sick Leave": 0 };
    approved.forEach((item) => { used[item._id] = item.daysUsed; });

    return res.status(200).json({
      success: true,
      casual: { total: 12, used: used["Casual Leave"], balance: 12 - used["Casual Leave"] },
      sick: { total: 12, used: used["Sick Leave"], balance: 12 - used["Sick Leave"] },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= GET LEAVE ================= */
const getLeave = async (req, res) => {
  try {
    const { id, role } = req.params;
    let query = role === "admin" ? { employeeId: id } : { employeeId: (await Employee.findOne({ userId: id }))._id };
    const leaves = await Leave.find(query).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, leaves });
  } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
};

/* ================= GET LEAVES ================= */
const getLeaves = async (req, res) => {
  try {
    const activeEmployeeIds = await Employee.distinct("_id");
    const leaves = await Leave.find({ employeeId: { $in: activeEmployeeIds } })
      .populate({ path: "employeeId", populate: [{ path: "department" }, { path: "userId" }] })
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, leaves });
  } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
};

/* ================= GET LEAVES DETAIL ================= */
const getLeaveDetail = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id).populate({ path: "employeeId", populate: [{ path: "department" }, { path: "userId" }] });
    return res.status(200).json({ success: true, leave });
  } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
};


export {
   calculateNetWorkDays,
   canCancelLeave,
   addLeave,
   updateLeave,
   cancelLeave,
   getLeaveBalance,
   getLeaveBalanceByEmployeeId,
   getLeave,
   getLeaves,
   getLeaveDetail
}

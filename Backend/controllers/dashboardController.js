import Employee from "../models/Employee.js";
import Client from "../models/Client.js";
import Department from "../models/Department.js";
import Leave from "../models/Leave.js";
import Sponsor from "../models/Sponsor.js";
import Stall from "../models/Stall.js";
import { sendError } from "../middleware/errorHandler.js";

const getSummary = async (req, res) => {
  try {
    /* ========== BASIC COUNTS ========== */
    const activeEmployeeLookup = [
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $match: { "user.isActive": { $ne: false } } },
    ];
    const [employeeCount] = await Employee.aggregate([
      ...activeEmployeeLookup,
      { $count: "total" },
    ]);
    const totalEmployees = employeeCount?.total || 0;
    const totalDepartments = await Department.countDocuments();
    const totalClients = await Client.countDocuments();
    const totalSponsors = await Sponsor.countDocuments();

    const totalAnnual = await Client.countDocuments({ planType: "Annual" });
    const totalQuarterly = await Client.countDocuments({ planType: "Quarterly" });

    /* ========== LEAVE SUMMARY ========== */
    const leaveStatus = await Leave.aggregate([
      {
        $lookup: {
          from: "employees",
          localField: "employeeId",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $match: { "employee.0": { $exists: true } } },
      {
        $group: {
          _id: { $toUpper: "$status" },
          count: { $sum: 1 },
          employeeIds: { $addToSet: "$employeeId" },
        },
      },
    ]);
    const employeeAppliedForLeave = new Set(
      leaveStatus.flatMap((status) => status.employeeIds.map((id) => String(id)))
    );

    const leaveSummary = {
      appliedFor: employeeAppliedForLeave.size,
      approved: leaveStatus.find(i => i._id === "APPROVED")?.count || 0,
      rejected: leaveStatus.find(i => i._id === "REJECTED")?.count || 0,
      pending: leaveStatus.find(i => i._id === "PENDING")?.count || 0,
    };

    /* ========== DEPARTMENT SUMMARY ========== */
    const departmentSummary = await Employee.aggregate([
      ...activeEmployeeLookup,
      {
        $group: {
          _id: "$department",
          employees: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "dep",
        },
      },
      { $unwind: "$dep" },
      {
        $project: {
          department: "$dep.dep_name",
          employees: 1,
        },
      },
    ]);

    /* ========== SPONSOR SUMMARY (FINAL FIX) ========== */
const sponsors = await Sponsor.find();

const totalSponsoredEvents = sponsors.reduce(
  (sum, s) => sum + Number(s.eventsSponsored || 0),
  0
);

const collaborationSummary = sponsors.reduce((acc, s) => {
  const key = s.collaboration || "Unknown";
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

const sponsorSummary = {
  totalSponsors,
  totalSponsoredEvents,
  collaborationSummary,
};



    /* ========== STALL SUMMARY ========== */
    const stalls = await Stall.find();
    const totalStalls = stalls.length;
    const totalStallEvents = stalls.reduce((sum, s) => sum + Number(s.eventCount || 0), 0);
    const typeSummary = stalls.reduce((acc, s) => {
      const key = s.type || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const stallSummary = {
      totalStalls,
      totalStallEvents,
      typeSummary,
    };

    /* ========== BIRTHDAY SUMMARY (IMPROVED) ========== */

      const today = new Date();
      const next30Days = new Date();
      next30Days.setDate(today.getDate() + 30);

      // Accurate age calculator
      const calculateAge = (dob) => {
        const birthDate = new Date(dob);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();

        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }

        return age;
      };


      // Use the same logic as getAllEmployeeBirthdays in employeeController.js for consistency
      const employees = await Employee.find({ dob: { $ne: null } })
        .populate("userId", "name profileImage isActive")
        .populate("department", "dep_name");

      const todayBirthdays = [];
      const upcomingBirthdays = [];

      employees.forEach(emp => {
        if (emp.userId?.isActive === false) return;
        const d = new Date(emp.dob);
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const age = today.getFullYear() - d.getFullYear();

        const result = {
          _id: emp._id,
          name: emp.userId?.name,
          profileImage: emp.userId?.profileImage,
          department: emp.department?.dep_name,
          age: age,
          dob: emp.dob
        };

        if (m === (today.getMonth() + 1) && day === today.getDate()) {
          todayBirthdays.push(result);
        } else {
          // Check if birthday falls within the next 30 days
          let bdayThisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
          if (bdayThisYear < today) {
            // If birthday this year already passed, check next year's birthday
            bdayThisYear = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
          }
          if (bdayThisYear > today && bdayThisYear <= next30Days) {
            upcomingBirthdays.push(result);
          }
        }
      });

      const birthdaySummary = {
        today: todayBirthdays,
        upcoming: upcomingBirthdays,
      };



    /* ========== RESPONSE ========== */
    return res.status(200).json({
      success: true,

      totalEmployees,
      totalDepartments,
      totalClients,
      totalSponsors,

      totalAnnual,
      totalQuarterly,

      leaveSummary,
      departmentSummary,
      sponsorSummary,
      stallSummary,
      birthdaySummary,
    });

  } catch (error) {
    return sendError(res, error);
  }
};

export { getSummary };

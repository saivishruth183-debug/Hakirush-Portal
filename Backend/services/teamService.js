// Department team directory (manager-first) and manager eligibility.
// Every directory response is built from SAFE projections only.
import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import { escapeRegex, parsePagination } from "../utils/validate.js";

const NAME_COLLATION = { locale: "en", strength: 2 };
const toObjectId = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(String(v)));

// $lookup of the login account, keeping only active accounts.
const activeUserStages = [
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "u",
      pipeline: [{ $project: { name: 1, profileImage: 1, isActive: 1 } }],
    },
  },
  { $unwind: "$u" },
  { $match: { "u.isActive": { $ne: false } } },
];

const safeProjection = {
  _id: 0,
  employeeRecordId: "$_id",
  userId: "$u._id",
  employeeCode: "$employeeId",
  name: "$u.name",
  designation: "$designation",
  profileImageUrl: "$u.profileImage",
};

/** SafePerson: exactly these 8 keys. */
export const toSafePerson = (row, { callerUserId, isManager }) => ({
  employeeRecordId: String(row.employeeRecordId),
  userId: String(row.userId),
  employeeCode: row.employeeCode ?? null,
  name: row.name ?? "",
  designation: row.designation ?? "",
  profileImageUrl: row.profileImageUrl ? row.profileImageUrl : null,
  isSelf: callerUserId != null && String(row.userId) === String(callerUserId),
  isManager: Boolean(isManager),
});

/**
 * Resolves the effective manager of a department: the assigned Employee must
 * still exist, belong to that department, and have an active account.
 * Returns the safe row or null.
 */
export const resolveDepartmentManager = async (dept) => {
  if (!dept?.managerEmployeeId) return null;
  const rows = await Employee.aggregate([
    { $match: { _id: toObjectId(dept.managerEmployeeId), department: toObjectId(dept._id) } },
    ...activeUserStages,
    { $project: safeProjection },
  ]);
  return rows[0] || null;
};

/** Active members of a department eligible to be its manager. */
export const listEligibleManagers = async (departmentId) =>
  Employee.aggregate(
    [
      { $match: { department: toObjectId(departmentId) } },
      ...activeUserStages,
      { $project: { _id: 0, employeeRecordId: "$_id", employeeCode: "$employeeId", name: "$u.name", designation: "$designation", profileImageUrl: "$u.profileImage" } },
      { $sort: { name: 1, employeeRecordId: 1 } },
    ],
    { collation: NAME_COLLATION }
  );

/** Returns the Employee (lean) if it is an active member of the department, else null. */
export const findEligibleManager = async (employeeRecordId, departmentId) => {
  if (!mongoose.Types.ObjectId.isValid(String(employeeRecordId))) return null;
  const rows = await Employee.aggregate([
    { $match: { _id: toObjectId(employeeRecordId), department: toObjectId(departmentId) } },
    ...activeUserStages,
    { $project: { _id: 1, userId: 1, department: 1 } },
  ]);
  return rows[0] || null;
};

const emptyTeam = (page, limit, managerStatus = "no_department", department = null) => ({
  success: true,
  version: 1,
  department,
  managerStatus,
  manager: null,
  members: [],
  totalMembers: 0,
  matchedMembers: 0,
  page,
  limit,
  hasMore: false,
  updatedAt: new Date().toISOString(),
});

/**
 * TeamResponse v1 for the authenticated employee. Scope comes only from the
 * caller's own Employee record; query scope params are ignored.
 */
export const getTeamForUser = async (callerUserId, query = {}) => {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 50, maxLimit: 100 });
  const me = await Employee.findOne({ userId: callerUserId }).select("department").lean();
  if (!me?.department) return emptyTeam(page, limit);

  const dept = await Department.findById(me.department).select("dep_name managerEmployeeId updatedAt").lean();
  if (!dept) return emptyTeam(page, limit);

  const managerRow = await resolveDepartmentManager(dept);

  const baseMatch = { department: dept._id };
  if (managerRow) baseMatch._id = { $ne: toObjectId(managerRow.employeeRecordId) };

  const rawSearch = typeof query.search === "string" ? query.search.trim().slice(0, 100) : "";
  const searchStages = rawSearch
    ? [
        {
          $match: {
            $or: ["name", "designation", "employeeCode"].map((f) => ({
              [f]: { $regex: escapeRegex(rawSearch), $options: "i" },
            })),
          },
        },
      ]
    : [];

  const [result] = await Employee.aggregate(
    [
      { $match: baseMatch },
      ...activeUserStages,
      { $project: safeProjection },
      {
        $facet: {
          total: [{ $count: "n" }],
          matched: [...searchStages, { $count: "n" }],
          items: [...searchStages, { $sort: { name: 1, employeeRecordId: 1 } }, { $skip: skip }, { $limit: limit }],
        },
      },
    ],
    { collation: NAME_COLLATION }
  );

  const activeMembers = result?.total?.[0]?.n || 0;
  const matchedMembers = result?.matched?.[0]?.n || 0;
  const items = result?.items || [];

  return {
    success: true,
    version: 1,
    department: { id: String(dept._id), name: dept.dep_name },
    managerStatus: managerRow ? "assigned" : "unassigned",
    manager: managerRow ? toSafePerson(managerRow, { callerUserId, isManager: true }) : null,
    members: items.map((row) => toSafePerson(row, { callerUserId, isManager: false })),
    totalMembers: activeMembers + (managerRow ? 1 : 0),
    matchedMembers,
    page,
    limit,
    hasMore: skip + items.length < matchedMembers,
    updatedAt: new Date().toISOString(),
  };
};

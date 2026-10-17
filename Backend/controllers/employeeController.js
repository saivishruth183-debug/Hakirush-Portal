import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import Employee, { BLOOD_GROUPS, GENDERS, MARITAL_STATUSES } from "../models/Employee.js";
import User from "../models/User.js";
import Department from "../models/Department.js";
import uploadToImageKit from "../utils/uploadToImageKit.js";
import { sendWelcomeEmail } from "../services/emailService.js";
import { asyncHandler, badRequest, forbidden, notFound, conflict, ApiError } from "../middleware/errorHandler.js";
import {
  requireObjectId,
  trimmedString,
  toFiniteNumber,
  normalizeEmail,
  parseBoolean,
  parseDateInput,
  optionalEnum,
  requireEnum,
  parsePagination,
  sameId,
} from "../utils/validate.js";
import { businessDate, monthDayOf } from "../utils/orgTime.js";
import { getTeamForUser } from "../services/teamService.js";
import { transferEmployee, deactivateEmployee, reactivateUser } from "../services/employeeLifecycle.js";
import { validateNewPassword } from "./settingController.js";

const NAME_COLLATION = { locale: "en", strength: 2 };
const USER_PUBLIC_FIELDS = "name email role profileImage isActive createdAt updatedAt";
const toObjectId = (v) => new mongoose.Types.ObjectId(String(v));

/* ================= HELPERS ================= */

// Legacy routes accept either Employee._id or User._id in :id.
const findEmployeeByAnyId = async (id) => {
  requireObjectId(id, "id");
  return (await Employee.findById(id)) || (await Employee.findOne({ userId: id }));
};

const callerEmployee = (req) => Employee.findOne({ userId: req.user._id });

const withIsActive = (empDoc) => {
  const e = empDoc.toObject ? empDoc.toObject() : { ...empDoc };
  e.isActive = e.userId && typeof e.userId === "object" ? e.userId.isActive !== false : null;
  delete e.manager;
  return e;
};

const optionalText = (v, field, max = 100) => {
  if (v === undefined) return undefined;
  if (v === null) return "";
  if (typeof v === "number") return String(v);
  if (typeof v !== "string") throw badRequest(`${field} must be text`);
  const s = v.trim();
  if (s.length > max) throw badRequest(`${field} is too long`);
  return s;
};

const uploadProfileImage = async (file) => {
  if (!file?.buffer) return undefined;
  try {
    return await uploadToImageKit(file, "employees");
  } catch {
    throw new ApiError(502, "Image upload failed. Please try again.", "UPLOAD_FAILED");
  }
};

// Active employees (account isActive != false) matching `match`, with safe user fields.
const activePeople = (match, { sort = true, limit } = {}) => {
  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "u",
        pipeline: [{ $project: { name: 1, profileImage: 1, email: 1, isActive: 1 } }],
      },
    },
    { $unwind: "$u" },
    { $match: { "u.isActive": { $ne: false } } },
    {
      $lookup: {
        from: "departments",
        localField: "department",
        foreignField: "_id",
        as: "d",
        pipeline: [{ $project: { dep_name: 1, managerEmployeeId: 1 } }],
      },
    },
    { $addFields: { d: { $arrayElemAt: ["$d", 0] }, name: "$u.name" } },
  ];
  if (sort) pipeline.push({ $sort: { name: 1, _id: 1 } });
  if (limit) pipeline.push({ $limit: limit });
  return Employee.aggregate(pipeline, { collation: NAME_COLLATION });
};

// Legacy safe directory item (no salary/IDs/dob/email).
const legacySafeItem = (row) => ({
  _id: row._id,
  employeeId: row.employeeId,
  designation: row.designation,
  isManager: Boolean(row.d?.managerEmployeeId && String(row.d.managerEmployeeId) === String(row._id)),
  userId: { _id: row.u._id, name: row.u.name, profileImage: row.u.profileImage || "" },
  department: row.d ? { _id: row.d._id, dep_name: row.d.dep_name } : null,
});

const pad2 = (n) => String(n).padStart(2, "0");
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const DAY_MS = 24 * 60 * 60 * 1000;
const ymdToMs = (ymd) => Date.parse(`${ymd}T00:00:00Z`);

// Next occurrence (>= today, org timezone) of an annual month/day.
const nextOccurrence = (todayYmd, month, day) => {
  const ty = Number(todayYmd.slice(0, 4));
  const build = (y) => `${y}-${pad2(month)}-${pad2(month === 2 && day === 29 && !isLeap(y) ? 28 : day)}`;
  let occ = build(ty);
  if (occ < todayYmd) occ = build(ty + 1);
  return { occ, daysUntil: Math.round((ymdToMs(occ) - ymdToMs(todayYmd)) / DAY_MS) };
};

// Scope for celebration widgets: admin => org-wide, employee => own department only.
const celebrationScope = async (req) => {
  if (req.user.role === "admin") return { match: {}, isAdmin: true };
  const me = await Employee.findOne({ userId: req.user._id }).select("department").lean();
  if (!me?.department) return null;
  return { match: { department: me.department }, isAdmin: false };
};

/* ================= ADD EMPLOYEE (ADMIN) ================= */
// role: "employee" unless the admin explicitly passes "admin". The legacy `manager`
// body field is ignored (managers are Department assignments).
const addEmployee = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const name = trimmedString(b.name, "name", { max: 100 });
  const email = normalizeEmail(b.email);
  const employeeId = trimmedString(b.employeeId, "employeeId", { max: 50 });
  const designation = trimmedString(b.designation, "designation", { max: 100 });
  const salary = toFiniteNumber(b.salary, "salary", { min: 0, max: 1e12 });
  const departmentId = requireObjectId(b.department, "department");
  const role = b.role === undefined || b.role === "" ? "employee" : requireEnum(b.role, ["employee", "admin"], "role");
  const dob = parseDateInput(b.dob, "dob", { notFuture: true });
  const gender = optionalEnum(b.gender, GENDERS, "gender");
  const maritalStatus = optionalEnum(b.maritalStatus, MARITAL_STATUSES, "maritalStatus");
  const bloodGroup = optionalEnum(b.bloodGroup, BLOOD_GROUPS, "bloodGroup");
  const experience = optionalText(b.experience, "experience", 50) ?? "";
  const aadharcard = optionalText(b.aadharcard, "aadharcard", 50) ?? "";
  const pancard = optionalText(b.pancard, "pancard", 50) ?? "";
  const pfNumber = optionalText(b.pfNumber, "pfNumber", 50) ?? "";

  if (!(await Department.exists({ _id: departmentId }))) throw badRequest("Department does not exist");
  if (await User.exists({ email })) throw conflict("A user with this email already exists", "CONFLICT");
  if (await Employee.exists({ employeeId })) throw conflict("This employee ID is already in use", "CONFLICT");

  const profileImage = (await uploadProfileImage(req.file)) || "";
  
  let rawPassword = typeof b.password === "string" && b.password.length > 0 ? b.password : null;
  if (rawPassword) {
    validateNewPassword(rawPassword);
  } else {
    rawPassword = crypto.randomBytes(32).toString("hex");
  }
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const user = await User.create({ name, email, password: hashedPassword, role, profileImage });
  let employee;
  try {
    employee = await Employee.create({
      userId: user._id,
      employeeId,
      dob: dob || undefined,
      gender: gender || undefined,
      maritalStatus: maritalStatus || undefined,
      department: departmentId,
      designation,
      salary,
      bloodGroup: bloodGroup || null,
      experience,
      dateOfJoining: new Date(),
      aadharcard,
      pancard,
      pfNumber,
    });
  } catch (err) {
    await User.deleteOne({ _id: user._id }); // keep user+employee creation all-or-nothing
    throw err;
  }

  // Trigger automated onboarding email asynchronously (do not block the response)
  sendWelcomeEmail(user, employee).catch(err => {
    console.error("Failed to send welcome email to", user.email, err);
  });

  return res.status(201).json({ success: true, employee });
});

/* ================= GET ALL EMPLOYEES (ADMIN) ================= */
// Without ?page the full array is returned (the web list paginates client-side).
const getEmployees = asyncHandler(async (req, res) => {
  const paged = req.query.page !== undefined || req.query.limit !== undefined;
  let query = Employee.find()
    .populate("userId", USER_PUBLIC_FIELDS)
    .populate("department", "-managerHistory")
    .sort({ createdAt: -1, _id: 1 });
  let pageInfo = {};
  if (paged) {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const total = await Employee.countDocuments();
    query = query.skip(skip).limit(limit);
    pageInfo = { page, limit, total };
  }
  const employees = (await query).map(withIsActive);
  return res.json({ success: true, employees, ...pageInfo });
});

/* ================= GET SINGLE EMPLOYEE (ADMIN or SELF) ================= */
const getEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  requireObjectId(id, "id");

  if (req.user.role !== "admin") {
    const own = await callerEmployee(req);
    if (!own || (String(own._id) !== id && String(own.userId) !== id)) throw forbidden();
  }

  const employee =
    (await Employee.findById(id).populate("userId", USER_PUBLIC_FIELDS).populate("department", "-managerHistory")) ||
    (await Employee.findOne({ userId: id }).populate("userId", USER_PUBLIC_FIELDS).populate("department", "-managerHistory"));
  if (!employee) throw notFound("Employee not found");

  return res.json({ success: true, employee: withIsActive(employee) });
});

/* ================= GET MY EMPLOYEE RECORD ================= */
const getMyEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user._id })
    .populate("userId", "name email profileImage")
    .populate("department", "dep_name");
  if (!employee) throw notFound("Employee record not found");
  const managerOfDepartment = Boolean(
    employee.department &&
      (await Department.exists({ _id: employee.department._id, managerEmployeeId: employee._id }))
  );
  const e = employee.toObject();
  delete e.manager;
  return res.json({ success: true, employee: { ...e, managerOfDepartment } });
});

/* ================= TEAM (manager-first, own department) ================= */
const getMyTeam = asyncHandler(async (req, res) => {
  return res.json(await getTeamForUser(req.user._id, { search: req.query.search, page: req.query.page, limit: req.query.limit }));
});

/* ================= UPDATE EMPLOYEE (ADMIN) ================= */
// Parses the admin-editable fields. Returns { employeeSet, userSet, departmentId }.
const parseAdminFields = async (b, employee) => {
  const employeeSet = {};
  const userSet = {};

  if (b.name !== undefined) userSet.name = trimmedString(b.name, "name", { max: 100 });
  if (b.designation !== undefined) employeeSet.designation = trimmedString(b.designation, "designation", { max: 100 });
  // The web edit form sends "" for an untouched 0 salary; treat "" as "no change".
  if (b.salary !== undefined && b.salary !== "") {
    employeeSet.salary = toFiniteNumber(b.salary, "salary", { min: 0, max: 1e12 });
  }
  if (b.employeeId !== undefined) {
    const code = trimmedString(b.employeeId, "employeeId", { max: 50 });
    if (code !== employee.employeeId) {
      if (await Employee.exists({ employeeId: code, _id: { $ne: employee._id } })) {
        throw conflict("This employee ID is already in use", "CONFLICT");
      }
      employeeSet.employeeId = code;
    }
  }
  const dob = parseDateInput(b.dob, "dob", { notFuture: true });
  if (dob !== undefined) employeeSet.dob = dob;
  const gender = optionalEnum(b.gender, GENDERS, "gender");
  if (gender !== undefined) employeeSet.gender = gender;
  const maritalStatus = optionalEnum(b.maritalStatus, MARITAL_STATUSES, "maritalStatus");
  if (maritalStatus !== undefined) employeeSet.maritalStatus = maritalStatus;
  const bloodGroup = optionalEnum(b.bloodGroup, BLOOD_GROUPS, "bloodGroup");
  if (bloodGroup !== undefined) employeeSet.bloodGroup = bloodGroup;
  for (const f of ["experience", "aadharcard", "pancard", "pfNumber"]) {
    const v = optionalText(b[f], f, 50);
    if (v !== undefined) employeeSet[f] = v;
  }

  let departmentId;
  if (b.department !== undefined && b.department !== "" && b.department !== null) {
    const dep = requireObjectId(b.department, "department");
    if (dep !== String(employee.department)) {
      if (!(await Department.exists({ _id: dep }))) throw badRequest("Department does not exist");
      departmentId = dep;
    }
  }
  return { employeeSet, userSet, departmentId };
};

const applyAdminUpdate = async (req, employee) => {
  const b = req.body || {};
  const { employeeSet, userSet, departmentId } = await parseAdminFields(b, employee);

  const profileImage = await uploadProfileImage(req.file);
  if (profileImage) userSet.profileImage = profileImage;

  if (departmentId) {
    // Manager rule: 409 MANAGER_REASSIGNMENT_REQUIRED unless clearManager / replacement given.
    await transferEmployee(
      employee,
      toObjectId(departmentId),
      { clearManager: b.clearManager, replacementManagerEmployeeId: b.replacementManagerEmployeeId },
      req.user._id,
      employeeSet
    );
  } else if (Object.keys(employeeSet).length) {
    await Employee.updateOne({ _id: employee._id }, { $set: employeeSet }, { runValidators: true });
  }
  if (Object.keys(userSet).length) await User.updateOne({ _id: employee.userId }, { $set: userSet });
};

const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await findEmployeeByAnyId(req.params.id);
  if (!employee) throw notFound("Employee not found");
  await applyAdminUpdate(req, employee);
  return res.json({ success: true });
});

/* ================= EDIT EMPLOYEE PROFILE (SELF or ADMIN) ================= */
const SELF_FORBIDDEN = ["salary", "department", "designation", "role", "manager", "employeeId", "email", "userId", "isActive", "password"];

const isUnchanged = (field, value, employee, user) => {
  switch (field) {
    case "salary":
      return value !== "" && value !== null && Number(value) === Number(employee.salary);
    case "department":
      return sameId(value, employee.department);
    case "userId":
      return sameId(value, employee.userId);
    case "designation":
      return typeof value === "string" && value.trim() === (employee.designation || "");
    case "employeeId":
      return typeof value === "string" && value.trim() === employee.employeeId;
    case "role":
      return value === user.role;
    case "email":
      return typeof value === "string" && value.trim().toLowerCase() === user.email;
    case "manager":
      return value === "" || value === null || value === "null" || value === "undefined";
    case "isActive":
      try {
        return parseBoolean(value, "isActive") === (user.isActive !== false);
      } catch {
        return false;
      }
    case "password":
      return value === "";
    default:
      return false;
  }
};

const editEmployeeProfile = asyncHandler(async (req, res) => {
  const employee = await findEmployeeByAnyId(req.params.id);

  if (req.user.role === "admin") {
    if (!employee) throw notFound("Employee not found");
    await applyAdminUpdate(req, employee);
    return res.json({ success: true, message: "Employee profile updated successfully" });
  }

  if (!employee || !sameId(employee.userId, req.user._id)) throw forbidden();

  const b = req.body || {};
  const user = await User.findById(employee.userId).select("role email isActive").lean();
  const blocked = SELF_FORBIDDEN.filter((f) => b[f] !== undefined && !isUnchanged(f, b[f], employee, user));
  if (blocked.length) {
    throw new ApiError(403, `These fields can only be changed by an administrator: ${blocked.join(", ")}`, "FIELD_NOT_EDITABLE", {
      fields: blocked,
    });
  }

  const userSet = {};
  const employeeSet = {};
  if (b.name !== undefined) userSet.name = trimmedString(b.name, "name", { max: 100 });
  const dob = parseDateInput(b.dob, "dob", { notFuture: true });
  if (dob !== undefined) employeeSet.dob = dob;
  const bloodGroup = optionalEnum(b.bloodGroup, BLOOD_GROUPS, "bloodGroup");
  if (bloodGroup !== undefined) employeeSet.bloodGroup = bloodGroup;
  const maritalStatus = optionalEnum(b.maritalStatus, MARITAL_STATUSES, "maritalStatus");
  if (maritalStatus !== undefined) employeeSet.maritalStatus = maritalStatus;
  for (const f of ["experience", "aadharcard", "pancard", "pfNumber"]) {
    const v = optionalText(b[f], f, 50);
    if (v !== undefined) employeeSet[f] = v;
  }

  const profileImage = await uploadProfileImage(req.file);
  if (profileImage) userSet.profileImage = profileImage;

  if (Object.keys(employeeSet).length) {
    await Employee.updateOne({ _id: employee._id }, { $set: employeeSet }, { runValidators: true });
  }
  if (Object.keys(userSet).length) await User.updateOne({ _id: employee.userId }, { $set: userSet });

  return res.json({ success: true, message: "Employee profile updated successfully" });
});

/* ================= DELETE EMPLOYEE (ADMIN) => DEACTIVATE ================= */
// Retention-safe: payroll/attendance/leave history is kept. Manager options may be
// passed in the JSON body or the query string.
const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await findEmployeeByAnyId(req.params.id);
  if (!employee) throw notFound("Employee not found");
  const opts = { ...(req.query || {}), ...(req.body || {}) };
  await deactivateEmployee(
    employee,
    { clearManager: opts.clearManager, replacementManagerEmployeeId: opts.replacementManagerEmployeeId },
    req.user._id
  );
  return res.json({ success: true, deactivated: true });
});

/* ================= PATCH /:id/status (ADMIN) ================= */
const setEmployeeStatus = asyncHandler(async (req, res) => {
  const employee = await findEmployeeByAnyId(req.params.id);
  if (!employee) throw notFound("Employee not found");
  const b = req.body || {};
  const isActive = parseBoolean(b.isActive, "isActive", { optional: false });
  if (isActive) {
    await reactivateUser(employee.userId, employee._id);
  } else {
    await deactivateEmployee(
      employee,
      { clearManager: b.clearManager, replacementManagerEmployeeId: b.replacementManagerEmployeeId },
      req.user._id
    );
  }
  return res.json({ success: true, isActive });
});

/* ================= BY-DEPARTMENT/ME (legacy, employee) ================= */
// Same department, active only, excludes the caller, safe fields only.
const getEmployeesByDepartment = asyncHandler(async (req, res) => {
  const me = await callerEmployee(req);
  if (!me) throw notFound("Employee not found");
  const dept = await Department.findById(me.department).select("dep_name").lean();
  if (!dept) return res.json({ success: true, department: null, employees: [] });

  const rows = await activePeople({ department: dept._id, userId: { $ne: req.user._id } });
  return res.json({
    success: true,
    department: { _id: dept._id, dep_name: dept.dep_name },
    employees: rows.map(legacySafeItem),
  });
});

/* ================= DEPARTMENT/:id/EMPLOYEES ================= */
// Admin: full HR list. Employee: only own department (else 403), safe fields.
const getEmployeesByDepartmentId = asyncHandler(async (req, res) => {
  const id = requireObjectId(req.params.id, "department id");

  if (req.user.role === "admin") {
    const employees = await Employee.find({ department: id })
      .populate("userId", "name email profileImage isActive")
      .populate("department", "dep_name");
    return res.status(200).json({ success: true, employees: employees.map(withIsActive) });
  }

  const me = await callerEmployee(req);
  if (!me || String(me.department) !== id) throw forbidden();
  const rows = await activePeople({ department: toObjectId(id) });
  return res.status(200).json({ success: true, employees: rows.map(legacySafeItem) });
});

/* ================= BIRTHDAYS ================= */
// Employee: own department, { _id, name, profileImage, department, monthDay } only.
// Admin: org-wide, additionally includes age.
const getAllEmployeeBirthdays = asyncHandler(async (req, res) => {
  const scope = await celebrationScope(req);
  if (!scope) return res.json({ success: true, today: [], upcoming: [] });

  const todayYmd = businessDate(new Date());
  const rows = await activePeople({ ...scope.match, dob: { $ne: null } }, { sort: false });
  const today = [];
  const upcoming = [];
  for (const row of rows) {
    if (!row.dob) continue;
    const { month, day } = monthDayOf(row.dob);
    const { occ, daysUntil } = nextOccurrence(todayYmd, month, day);
    if (daysUntil > 7) continue;
    const item = {
      _id: row._id,
      name: row.u.name,
      profileImage: row.u.profileImage || "",
      department: row.d?.dep_name || null,
      monthDay: `${pad2(month)}-${pad2(day)}`,
    };
    if (scope.isAdmin) item.age = Number(occ.slice(0, 4)) - Number(businessDate(row.dob).slice(0, 4));
    (daysUntil === 0 ? today : upcoming).push({ item, daysUntil });
  }
  const order = (a, b) => a.daysUntil - b.daysUntil || String(a.item.name).localeCompare(String(b.item.name));
  return res.json({
    success: true,
    today: today.sort(order).map((x) => x.item),
    upcoming: upcoming.sort(order).map((x) => x.item),
  });
});

/* ================= ANNIVERSARIES ================= */
// Items: { _id, name, profileImage, department, years, monthDay, joiningDate }.
// joiningDate is kept for the existing web dashboard (date of joining is not HR-sensitive).
const getAllEmployeeAnniversaries = asyncHandler(async (req, res) => {
  const scope = await celebrationScope(req);
  if (!scope) return res.json({ success: true, today: [], upcoming: [] });

  const todayYmd = businessDate(new Date());
  const rows = await activePeople({ ...scope.match, dateOfJoining: { $ne: null } }, { sort: false });
  const today = [];
  const upcoming = [];
  for (const row of rows) {
    if (!row.dateOfJoining) continue;
    const { month, day } = monthDayOf(row.dateOfJoining);
    const { occ, daysUntil } = nextOccurrence(todayYmd, month, day);
    const years = Number(occ.slice(0, 4)) - Number(businessDate(row.dateOfJoining).slice(0, 4));
    if (years <= 0 || daysUntil > 7) continue;
    const item = {
      _id: row._id,
      name: row.u.name,
      profileImage: row.u.profileImage || "",
      department: row.d?.dep_name || null,
      years,
      monthDay: `${pad2(month)}-${pad2(day)}`,
      joiningDate: row.dateOfJoining,
    };
    (daysUntil === 0 ? today : upcoming).push({ item, daysUntil });
  }
  const order = (a, b) => a.daysUntil - b.daysUntil || String(a.item.name).localeCompare(String(b.item.name));
  return res.json({
    success: true,
    today: today.sort(order).map((x) => x.item),
    upcoming: upcoming.sort(order).map((x) => x.item),
  });
});

/* ================= NEW EMPLOYEES (LAST 30 DAYS) ================= */
// Employee: own department, no email. Admin: org-wide (with email). Max 100 items.
const getNewEmployees = asyncHandler(async (req, res) => {
  const scope = await celebrationScope(req);
  if (!scope) return res.json({ success: true, totalNewEmployees: 0, employees: [] });

  const todayYmd = businessDate(new Date());
  const since = new Date(Date.now() - 31 * DAY_MS);
  const rows = await activePeople({ ...scope.match, dateOfJoining: { $gte: since } }, { sort: false });

  const employees = rows
    .map((row) => {
      const joinedDaysAgo = Math.round((ymdToMs(todayYmd) - ymdToMs(businessDate(row.dateOfJoining))) / DAY_MS);
      const item = {
        _id: row._id,
        name: row.u.name,
        profileImage: row.u.profileImage || "",
        department: row.d?.dep_name || null,
        dateOfJoining: row.dateOfJoining,
        joinedDaysAgo,
      };
      if (scope.isAdmin) item.email = row.u.email;
      return item;
    })
    .filter((e) => e.joinedDaysAgo <= 30)
    .sort((a, b) => new Date(b.dateOfJoining) - new Date(a.dateOfJoining))
    .slice(0, 100);

  return res.json({ success: true, totalNewEmployees: employees.length, employees });
});

export {
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
  getEmployeesByDepartmentId,
  getNewEmployees,
  getAllEmployeeBirthdays,
  getAllEmployeeAnniversaries,
};

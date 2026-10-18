import mongoose from "mongoose";
import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import { asyncHandler, badRequest, notFound, conflict } from "../middleware/errorHandler.js";
import { requireObjectId, trimmedString, escapeRegex } from "../utils/validate.js";
import { findEligibleManager, listEligibleManagers } from "../services/teamService.js";

const NAME_COLLATION = { locale: "en", strength: 2 };

// Department list item per contract; adds managerStatus ("assigned" | "unassigned" | "invalid")
// and employeeCount (all employee records, which governs deletability).
const buildItems = async (departments) => {
  if (!departments.length) return [];
  const ids = departments.map((d) => d._id);

  const counts = await Employee.aggregate([
    { $match: { department: { $in: ids } } },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "u",
        pipeline: [{ $project: { isActive: 1 } }],
      },
    },
    {
      $group: {
        _id: "$department",
        employeeCount: { $sum: 1 },
        // Active = account exists and isActive is not false (legacy docs may lack the field).
        memberCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: [{ $size: "$u" }, 0] },
                  { $ne: [{ $arrayElemAt: ["$u.isActive", 0] }, false] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c]));

  const managerIds = departments.map((d) => d.managerEmployeeId).filter(Boolean);
  const managers = managerIds.length
    ? await Employee.find({ _id: { $in: managerIds } })
        .select("employeeId designation department userId")
        .populate("userId", "name profileImage isActive")
        .lean()
    : [];
  const managerMap = new Map(managers.map((m) => [String(m._id), m]));

  return departments.map((d) => {
    const c = countMap.get(String(d._id));
    const m = d.managerEmployeeId ? managerMap.get(String(d.managerEmployeeId)) : null;
    const valid =
      m && m.userId && m.userId.isActive !== false && String(m.department) === String(d._id);
    return {
      _id: d._id,
      dep_name: d.dep_name,
      description: d.description || "",
      managerEmployeeId: d.managerEmployeeId || null,
      manager: m
        ? {
            employeeRecordId: m._id,
            name: m.userId?.name || "",
            employeeCode: m.employeeId,
            designation: m.designation,
            profileImageUrl: m.userId?.profileImage || null,
          }
        : null,
      managerStatus: !d.managerEmployeeId ? "unassigned" : valid ? "assigned" : "invalid",
      memberCount: c?.memberCount || 0,
      employeeCount: c?.employeeCount || 0,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  });
};

const loadDepartment = async (id) => {
  requireObjectId(id, "department id");
  const dept = await Department.findById(id).lean();
  if (!dept) throw notFound("Department not found");
  return dept;
};

const ensureUniqueName = async (name, excludeId) => {
  const filter = { dep_name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } };
  if (excludeId) filter._id = { $ne: excludeId };
  if (await Department.exists(filter)) throw conflict("A department with this name already exists", "CONFLICT");
};

/* GET /api/department (admin) */
const getDepartments = asyncHandler(async (req, res) => {
  const departments = await Department.find({}).collation(NAME_COLLATION).sort({ dep_name: 1 }).lean();
  return res.status(200).json({ success: true, departments: await buildItems(departments) });
});

/* POST /api/department/add (admin) */
const addDepartment = asyncHandler(async (req, res) => {
  const dep_name = trimmedString(req.body?.dep_name, "dep_name", { max: 100 });
  const description = trimmedString(req.body?.description, "description", { max: 1000, optional: true }) ?? "";
  const managerEmployeeId = req.body?.managerEmployeeId;
  if (managerEmployeeId !== undefined && managerEmployeeId !== null && managerEmployeeId !== "") {
    // A brand-new department has no members, so no one is eligible yet.
    throw badRequest("Manager must be an active employee of this department; assign the manager after adding members");
  }
  await ensureUniqueName(dep_name);
  const newDep = await Department.create({ dep_name, description });
  const [item] = await buildItems([newDep.toObject()]);
  return res.status(200).json({ success: true, department: item });
});

/* GET /api/department/:id (admin) */
const getDepartment = asyncHandler(async (req, res) => {
  const dept = await loadDepartment(req.params.id);
  const [item] = await buildItems([dept]);
  return res.status(200).json({ success: true, department: item });
});

/* GET /api/department/:id/eligible-managers (admin) */
const getEligibleManagers = asyncHandler(async (req, res) => {
  const dept = await loadDepartment(req.params.id);
  const employees = await listEligibleManagers(dept._id);
  return res.status(200).json({
    success: true,
    employees: employees.map((e) => ({
      employeeRecordId: e.employeeRecordId,
      name: e.name || "",
      employeeCode: e.employeeCode,
      designation: e.designation,
      profileImageUrl: e.profileImageUrl || null,
    })),
  });
});

/*
 * PUT /api/department/:id (admin)
 * Body: { dep_name?, description?, managerEmployeeId?: id|null, expectedUpdatedAt? }
 * Unknown keys (e.g. the web form echoing _id/updatedAt/manager) are ignored.
 */
const updateDepartment = asyncHandler(async (req, res) => {
  const dept = await loadDepartment(req.params.id);
  const body = req.body || {};

  if (body.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== null && body.expectedUpdatedAt !== "") {
    const expected = new Date(body.expectedUpdatedAt);
    if (Number.isNaN(expected.getTime())) throw badRequest("expectedUpdatedAt must be an ISO timestamp");
    if (new Date(dept.updatedAt).getTime() !== expected.getTime()) {
      throw conflict("Department was changed by someone else; reload and try again", "STALE_UPDATE", {
        currentUpdatedAt: dept.updatedAt,
      });
    }
  }

  const $set = {};
  if (body.dep_name !== undefined) {
    const name = trimmedString(body.dep_name, "dep_name", { max: 100 });
    if (name !== dept.dep_name) {
      await ensureUniqueName(name, dept._id);
      $set.dep_name = name;
    }
  }
  if (body.description !== undefined) {
    $set.description = trimmedString(body.description, "description", { max: 1000, optional: true }) ?? "";
  }

  let historyEntry = null;
  if (body.managerEmployeeId !== undefined) {
    const raw = body.managerEmployeeId;
    const next = raw === null || raw === "" ? null : requireObjectId(raw, "managerEmployeeId");
    const current = dept.managerEmployeeId ? String(dept.managerEmployeeId) : null;
    if (next !== current) {
      if (next) {
        const eligible = await findEligibleManager(next, dept._id);
        if (!eligible) throw badRequest("Manager must be an active employee of this department");
      }
      $set.managerEmployeeId = next ? new mongoose.Types.ObjectId(next) : null;
      historyEntry = {
        from: dept.managerEmployeeId || null,
        to: $set.managerEmployeeId,
        changedBy: req.user._id,
        changedAt: new Date(),
        reason: "assignment",
      };
    }
  }

  let updated = dept;
  if (Object.keys($set).length) {
    const update = { $set };
    if (historyEntry) update.$push = { managerHistory: historyEntry };
    // Compare-and-set on updatedAt: concurrent edits lose with 409 instead of overwriting.
    updated = await Department.findOneAndUpdate({ _id: dept._id, updatedAt: dept.updatedAt }, update, {
      new: true,
      runValidators: true,
    }).lean();
    if (!updated) {
      throw conflict("Department was changed by someone else; reload and try again", "STALE_UPDATE");
    }
  }

  const [item] = await buildItems([updated]);
  return res.status(200).json({ success: true, department: item });
});

/* DELETE /api/department/:id (admin) — no cascade; refuses when employees reference it. */
const deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await loadDepartment(req.params.id);
  const employeeCount = await Employee.countDocuments({ department: dept._id });
  if (employeeCount > 0) {
    throw conflict(
      "Department still has employees. Move or deactivate them before deleting it.",
      "DEPARTMENT_NOT_EMPTY",
      { employeeCount }
    );
  }
  const deleted = await Department.findOneAndDelete({ _id: dept._id }).lean();
  if (!deleted) throw notFound("Department not found");
  return res.status(200).json({ success: true, department: deleted });
});

export {
  addDepartment,
  getDepartments,
  getDepartment,
  getEligibleManagers,
  updateDepartment,
  deleteDepartment,
};

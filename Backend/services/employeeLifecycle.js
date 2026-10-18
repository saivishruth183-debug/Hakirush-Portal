// Employee lifecycle operations that must stay consistent with department
// manager assignments: transfer, deactivation, reactivation.
//
// The in-memory test server and the current deployment are not guaranteed to be
// replica sets, so multi-document transactions are not used. Instead writes are
// ordered and conditional: the department manager assignment is changed first
// with a compare-and-set update, then the employee/user write; if the second
// write fails the department change is rolled back (compare-and-set again).
import mongoose from "mongoose";
import User from "../models/User.js";
import Employee from "../models/Employee.js";
import Department from "../models/Department.js";
import { ApiError, badRequest, conflict } from "../middleware/errorHandler.js";
import { parseBoolean, isObjectId } from "../utils/validate.js";
import { revokeAllForUser } from "./sessionService.js";
import { findEligibleManager } from "./teamService.js";

/** isActive=false, tokenVersion++ (kills access tokens), revoke refresh tokens. */
export const deactivateUser = async (userId) => {
  await User.updateOne({ _id: userId }, { $set: { isActive: false }, $inc: { tokenVersion: 1 } });
  await revokeAllForUser(userId, "deactivated");
};

export const reactivateUser = async (userId, employeeId) => {
  const employee = await Employee.findById(employeeId).select("inactiveSince").lean();
  if (employee?.inactiveSince) {
    const inactiveSince = employee.inactiveSince;
    await Employee.updateOne(
      { _id: employeeId, inactiveSince },
      {
        $inc: { inactiveDurationMs: Math.max(0, Date.now() - inactiveSince.getTime()) },
        $unset: { inactiveSince: 1 },
      }
    );
  }
  await User.updateOne({ _id: userId }, { $set: { isActive: true } });
};

/**
 * If `employee` is the current manager of a department, decide what happens to
 * that assignment based on `options` ({ clearManager, replacementManagerEmployeeId }).
 * Returns null when the employee manages nothing, otherwise a plan
 * { department, from, to, reason }. Throws 409 MANAGER_REASSIGNMENT_REQUIRED
 * when no decision was supplied, 400 when the replacement is not eligible.
 */
export const planManagerHandoff = async (employee, options = {}, reason = "") => {
  const department = await Department.findOne({ managerEmployeeId: employee._id })
    .select("_id dep_name managerEmployeeId updatedAt")
    .lean();
  if (!department) return null;

  const clearManager = parseBoolean(options.clearManager, "clearManager") === true;
  const replacementRaw = options.replacementManagerEmployeeId;
  const hasReplacement = replacementRaw !== undefined && replacementRaw !== null && replacementRaw !== "";

  if (!clearManager && !hasReplacement) {
    throw conflict(
      `This employee is the manager of ${department.dep_name}. Choose a replacement manager or clear the assignment first.`,
      "MANAGER_REASSIGNMENT_REQUIRED",
      { departmentId: String(department._id), departmentName: department.dep_name }
    );
  }

  let to = null;
  if (hasReplacement) {
    const replacementId = String(replacementRaw);
    if (!isObjectId(replacementId)) throw badRequest("Invalid replacementManagerEmployeeId", "INVALID_ID");
    if (replacementId === String(employee._id)) {
      throw badRequest("Replacement manager must be a different employee");
    }
    const eligible = await findEligibleManager(replacementId, department._id);
    if (!eligible) {
      throw badRequest(`Replacement manager must be an active employee of ${department.dep_name}`);
    }
    to = eligible._id;
  }

  return { department, from: employee._id, to, reason };
};

const applyManagerChange = async (plan, actorUserId) => {
  const entry = {
    _id: new mongoose.Types.ObjectId(),
    from: plan.from,
    to: plan.to,
    changedBy: actorUserId || null,
    changedAt: new Date(),
    reason: plan.reason || "",
  };
  const updated = await Department.findOneAndUpdate(
    { _id: plan.department._id, managerEmployeeId: plan.from },
    { $set: { managerEmployeeId: plan.to }, $push: { managerHistory: entry } },
    { new: true }
  );
  if (!updated) {
    throw conflict("Department manager changed concurrently; reload and try again", "STALE_UPDATE");
  }
  return entry;
};

const rollbackManagerChange = async (plan, entry) => {
  try {
    await Department.updateOne(
      { _id: plan.department._id, managerEmployeeId: plan.to },
      { $set: { managerEmployeeId: plan.from }, $pull: { managerHistory: { _id: entry._id } } }
    );
  } catch (err) {
    console.error("[employeeLifecycle] manager rollback failed for department", String(plan.department._id));
  }
};

/**
 * Runs `write()` after applying the manager plan (if any); rolls the manager
 * change back if `write()` throws.
 */
export const withManagerHandoff = async (plan, actorUserId, write) => {
  if (!plan) return write();
  const entry = await applyManagerChange(plan, actorUserId);
  try {
    return await write();
  } catch (err) {
    await rollbackManagerChange(plan, entry);
    throw err;
  }
};

/**
 * Moves an employee to another department, applying the manager rule.
 * The employee write is conditional on the old department (compare-and-set).
 */
export const transferEmployee = async (employee, newDepartmentId, options, actorUserId, extraSet = {}) => {
  const plan = await planManagerHandoff(employee, options, "transfer");
  return withManagerHandoff(plan, actorUserId, async () => {
    const res = await Employee.updateOne(
      { _id: employee._id, department: employee.department },
      { $set: { ...extraSet, department: newDepartmentId } },
      { runValidators: true }
    );
    if (res.matchedCount === 0) {
      throw conflict("Employee was changed concurrently; reload and try again", "STALE_UPDATE");
    }
  });
};

/** Deactivates the employee's account, applying the manager rule. */
export const deactivateEmployee = async (employee, options, actorUserId) => {
  if (actorUserId && String(employee.userId) === String(actorUserId)) {
    throw badRequest("You cannot deactivate your own account");
  }
  const user = await User.findById(employee.userId).select("isActive").lean();
  if (!user) throw new ApiError(404, "Employee account not found", "NOT_FOUND");
  // Even if already inactive, a stale manager assignment must be resolved explicitly.
  const plan = await planManagerHandoff(employee, options, "deactivation");
  await withManagerHandoff(plan, actorUserId, async () => {
    if (user.isActive !== false) {
      await Employee.updateOne(
        { _id: employee._id, inactiveSince: null },
        { $set: { inactiveSince: new Date() } }
      );
    }
    await deactivateUser(employee.userId);
  });
};

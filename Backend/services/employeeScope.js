// Resolves which Employee record a request may act on. Authority always comes
// from req.user; ids in the path/body/query only select a record the caller
// is already allowed to see.
import Employee from "../models/Employee.js";
import { forbidden, notFound } from "../middleware/errorHandler.js";
import { requireObjectId } from "../utils/validate.js";

export const getEmployeeForUser = async (userId) => {
  const employee = await Employee.findOne({ userId });
  if (!employee) throw forbidden("Employee profile not found");
  return employee;
};

// Legacy ids may be an Employee._id or a User._id.
export const findEmployeeByAnyId = async (id) =>
  Employee.findOne({ $or: [{ _id: id }, { userId: id }] });

/**
 * Admin: any employee (404 if none). Employee: only their own record, addressed
 * by own Employee._id or own userId (403 otherwise). Other roles: 403.
 */
export const resolveEmployeeForCaller = async (req, rawId, field = "id") => {
  const id = requireObjectId(rawId, field);
  if (req.user.role === "admin") {
    const employee = await findEmployeeByAnyId(id);
    if (!employee) throw notFound("Employee not found");
    return employee;
  }
  if (req.user.role === "employee") {
    const own = await getEmployeeForUser(req.user._id);
    if (id !== String(own._id) && id !== String(req.user._id)) throw forbidden();
    return own;
  }
  throw forbidden();
};

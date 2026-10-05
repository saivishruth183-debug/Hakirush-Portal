import Asset from "../models/Asset.js";
import Employee from "../models/Employee.js";
import { asyncHandler, badRequest, notFound, conflict } from "../middleware/errorHandler.js";
import { requireObjectId, trimmedString, requireEnum } from "../utils/validate.js";
import { now as clockNow } from "../services/clock.js";
import { getEmployeeForUser } from "../services/employeeScope.js";

const ASSET_TYPES = ["Laptop", "Monitor", "Mobile", "ID Card", "Keys", "Other"];
const STATUSES = ["Available", "Assigned", "Maintenance", "Retired"];

export const addAsset = asyncHandler(async (req, res) => {
  const name = trimmedString(req.body.name, "name", { max: 100 });
  const assetType = requireEnum(req.body.assetType, ASSET_TYPES, "assetType");
  const serialNumber = trimmedString(req.body.serialNumber, "serialNumber", { max: 100, optional: true });
  const notes = trimmedString(req.body.notes, "notes", { max: 500, optional: true });

  if (serialNumber) {
    const existing = await Asset.findOne({ serialNumber });
    if (existing) throw conflict("An asset with this serial number already exists.");
  }

  const asset = await Asset.create({
    name,
    assetType,
    serialNumber,
    notes,
    status: "Available",
  });

  return res.status(201).json({ success: true, asset });
});

export const getAssets = asyncHandler(async (req, res) => {
  const assets = await Asset.find().populate({
    path: "assignedTo",
    populate: { path: "userId", select: "name email profileImage" }
  }).sort({ createdAt: -1 });
  return res.status(200).json({ success: true, assets });
});

export const getMyAssets = asyncHandler(async (req, res) => {
  const employee = await getEmployeeForUser(req.user._id);
  const assets = await Asset.find({ assignedTo: employee._id }).sort({ issueDate: -1 });
  return res.status(200).json({ success: true, assets });
});

export const assignAsset = asyncHandler(async (req, res) => {
  const id = requireObjectId(req.params.id, "id");
  const employeeId = requireObjectId(req.body.employeeId, "employeeId");

  const asset = await Asset.findById(id);
  if (!asset) throw notFound("Asset not found");
  if (asset.status === "Assigned") throw badRequest("Asset is already assigned to someone.");
  if (asset.status !== "Available") throw badRequest(`Asset cannot be assigned because it is ${asset.status}`);

  const employee = await Employee.findById(employeeId);
  if (!employee) throw notFound("Employee not found");

  asset.assignedTo = employee._id;
  asset.status = "Assigned";
  asset.issueDate = clockNow();
  asset.returnDate = null;
  await asset.save();

  await asset.populate({
    path: "assignedTo",
    populate: { path: "userId", select: "name email profileImage" }
  });

  return res.status(200).json({ success: true, asset });
});

export const returnAsset = asyncHandler(async (req, res) => {
  const id = requireObjectId(req.params.id, "id");
  const status = requireEnum(req.body.status || "Available", ["Available", "Maintenance", "Retired"], "status");

  const asset = await Asset.findById(id);
  if (!asset) throw notFound("Asset not found");
  if (asset.status !== "Assigned") throw badRequest("Asset is not currently assigned.");

  asset.assignedTo = null;
  asset.status = status;
  asset.returnDate = clockNow();
  await asset.save();

  return res.status(200).json({ success: true, asset });
});

export const deleteAsset = asyncHandler(async (req, res) => {
  const id = requireObjectId(req.params.id, "id");
  const asset = await Asset.findById(id);
  if (!asset) throw notFound("Asset not found");
  
  if (asset.status === "Assigned") throw badRequest("Cannot delete an asset that is currently assigned.");
  
  await Asset.findByIdAndDelete(id);
  return res.status(200).json({ success: true });
});

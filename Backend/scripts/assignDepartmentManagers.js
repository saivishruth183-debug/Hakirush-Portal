#!/usr/bin/env node
// Assign department managers from an owner-supplied mapping.
//
//   node --env-file=.env scripts/assignDepartmentManagers.js mapping.json          # dry run (default)
//   node --env-file=.env scripts/assignDepartmentManagers.js mapping.json --apply  # writes
//
// mapping.json: { "<departmentId>": "<employeeRecordId>" | null, ... }
// Every entry is validated (department exists; employee exists, belongs to that
// department and has an active account). Nothing is written unless --apply is
// given AND every entry is valid. Each change appends a managerHistory entry.
// Never run this against production without the owner's explicit approval.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Department from "../models/Department.js";
import Employee from "../models/Employee.js";
import User from "../models/User.js";

const isId = (v) => typeof v === "string" && mongoose.Types.ObjectId.isValid(v) && String(new mongoose.Types.ObjectId(v)) === v;

/** Validates a mapping and returns { ok, plan: [{departmentId, departmentName, from, to, status, error?}] }. */
export const planAssignments = async (mapping) => {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    throw new Error("Mapping must be a JSON object of departmentId -> employeeRecordId|null");
  }
  const plan = [];
  for (const [departmentId, employeeRecordId] of Object.entries(mapping)) {
    const row = { departmentId, departmentName: null, from: null, to: employeeRecordId ?? null, status: "invalid" };
    plan.push(row);
    if (!isId(departmentId)) { row.error = "invalid department id"; continue; }
    const dept = await Department.findById(departmentId).lean();
    if (!dept) { row.error = "department not found"; continue; }
    row.departmentName = dept.dep_name;
    row.from = dept.managerEmployeeId ? String(dept.managerEmployeeId) : null;

    if (employeeRecordId !== null && employeeRecordId !== undefined) {
      if (!isId(employeeRecordId)) { row.error = "invalid employee record id"; continue; }
      const emp = await Employee.findById(employeeRecordId).select("department userId").lean();
      if (!emp) { row.error = "employee not found"; continue; }
      if (String(emp.department) !== String(dept._id)) { row.error = "employee is not a member of this department"; continue; }
      const user = await User.findById(emp.userId).select("isActive").lean();
      if (!user || user.isActive === false) { row.error = "employee account is inactive or missing"; continue; }
    }
    row.status = row.from === (row.to ? String(row.to) : null) ? "unchanged" : "change";
  }
  return { ok: plan.every((r) => r.status !== "invalid"), plan };
};

/** Applies a validated plan (compare-and-set per department). Returns number of departments changed. */
export const applyAssignments = async (plan, { changedBy = null } = {}) => {
  let changed = 0;
  for (const row of plan) {
    if (row.status !== "change") continue;
    const to = row.to ? new mongoose.Types.ObjectId(String(row.to)) : null;
    const res = await Department.updateOne(
      { _id: row.departmentId, managerEmployeeId: row.from ? new mongoose.Types.ObjectId(row.from) : null },
      {
        $set: { managerEmployeeId: to },
        $push: { managerHistory: { from: row.from, to, changedBy, changedAt: new Date(), reason: "bulk-script" } },
      }
    );
    if (res.modifiedCount === 1) changed += 1;
    else console.warn(`Skipped ${row.departmentId}: manager changed since planning`);
  }
  return changed;
};

const main = async () => {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const apply = args.includes("--apply");
  if (!file) {
    console.error("Usage: node scripts/assignDepartmentManagers.js <mapping.json> [--apply]");
    process.exit(2);
  }
  if (!process.env.MONGODB_URL) {
    console.error("MONGODB_URL is not set");
    process.exit(2);
  }
  const mapping = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  await mongoose.connect(process.env.MONGODB_URL);
  try {
    const { ok, plan } = await planAssignments(mapping);
    for (const r of plan) {
      console.log(
        `${r.status.toUpperCase().padEnd(9)} ${r.departmentName ?? r.departmentId}: ${r.from ?? "none"} -> ${r.to ?? "none"}${r.error ? `  (${r.error})` : ""}`
      );
    }
    if (!ok) {
      console.error("Mapping has invalid entries; nothing was written.");
      process.exitCode = 1;
      return;
    }
    if (!apply) {
      console.log("Dry run only. Re-run with --apply to write these changes.");
      return;
    }
    const changed = await applyAssignments(plan);
    console.log(`Applied: ${changed} department(s) updated.`);
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Failed:", err?.message || err);
    process.exit(1);
  });
}

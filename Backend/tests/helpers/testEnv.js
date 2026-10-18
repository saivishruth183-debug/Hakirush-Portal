// Isolated integration-test environment: in-memory MongoDB + synthetic fixtures.
// Never points at a real database. Requires no .env file.
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.JWT_KEY = process.env.JWT_KEY_TEST || "test-only-jwt-key-not-a-secret";
process.env.ORG_TIMEZONE = process.env.ORG_TIMEZONE || "Asia/Kolkata";
process.env.NODE_ENV = "test";
process.env.IMAGEKIT_PUBLIC_KEY = "test_public";
process.env.IMAGEKIT_PRIVATE_KEY = "test_private";
process.env.IMAGEKIT_URL_ENDPOINT = "https://ik.example.test/hakirush";

let mongod;

export const startTestDb = async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "hakirush_test" });
};

export const stopTestDb = async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
};

export const clearDb = async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
};

export const getApp = async () => {
  const { createApp } = await import("../../app.js");
  return createApp();
};

// Access token matching the legacy login token shape (+ tokenVersion).
export const tokenFor = (user, extra = {}) =>
  jwt.sign({ _id: String(user._id), role: user.role, tv: user.tokenVersion ?? 0, ...extra }, process.env.JWT_KEY, {
    expiresIn: "1h",
  });

export const auth = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

export const PASSWORD = "Test-Passw0rd!";

/**
 * Synthetic fixture set:
 *  - admin
 *  - IT: itManager (assigned manager), itDev1, itDev2 ("Sam Same" duplicate name), itInactive (deactivated)
 *  - Operations: opsManager, opsStaff1, opsStaff2 ("Sam Same" duplicate name)
 *  - Empty department (no manager, no members)
 *  - noDeptEmployee? (Employee.department is required, so represented by a dangling department id)
 *  - clientA, clientB
 */
export const seedFixtures = async () => {
  const User = (await import("../../models/User.js")).default;
  const Employee = (await import("../../models/Employee.js")).default;
  const Department = (await import("../../models/Department.js")).default;
  const Client = (await import("../../models/Client.js")).default;

  const hash = await bcrypt.hash(PASSWORD, 4);
  const mkUser = (name, email, role, extra = {}) =>
    User.create({ name, email, password: hash, role, ...extra });

  const it = await Department.create({ dep_name: "IT", description: "Information Technology" });
  const ops = await Department.create({ dep_name: "Operations", description: "Operations" });
  const empty = await Department.create({ dep_name: "Empty", description: "No members" });

  const admin = await mkUser("Admin User", "admin@test.local", "admin");

  let seq = 1;
  const mkEmp = async (name, email, dept, designation, extra = {}, userExtra = {}) => {
    const user = await mkUser(name, email, "employee", userExtra);
    const employee = await Employee.create({
      userId: user._id,
      employeeId: `TEST${String(seq++).padStart(4, "0")}`,
      department: dept._id,
      designation,
      salary: 50000 + seq,
      dob: new Date("1990-06-15T00:00:00Z"),
      bloodGroup: "O+",
      aadharcard: `AADHAAR-${seq}`,
      pancard: `PAN-${seq}`,
      pfNumber: `PF-${seq}`,
      ...extra,
    });
    return { user, employee };
  };

  const itManager = await mkEmp("Iris Manager", "iris@test.local", it, "Engineering Manager");
  const itDev1 = await mkEmp("Alan Dev", "alan@test.local", it, "Developer");
  const itDev2 = await mkEmp("Sam Same", "sam.it@test.local", it, "Developer");
  const itInactive = await mkEmp("Ivan Inactive", "ivan@test.local", it, "Developer", {}, { isActive: false });
  const opsManager = await mkEmp("Olga Ops", "olga@test.local", ops, "Operations Manager");
  const opsStaff1 = await mkEmp("Bea Ops", "bea@test.local", ops, "Coordinator");
  const opsStaff2 = await mkEmp("Sam Same", "sam.ops@test.local", ops, "Coordinator");

  // Only set if the schema supports it (added in Phase 3).
  if (Department.schema.path("managerEmployeeId")) {
    await Department.updateOne({ _id: it._id }, { managerEmployeeId: itManager.employee._id });
    await Department.updateOne({ _id: ops._id }, { managerEmployeeId: opsManager.employee._id });
  }

  const clientAUser = await mkUser("Client A", "clienta@test.local", "client");
  const clientA = await Client.create({
    userId: clientAUser._id, clientId: "CLIENT-A", dateOfJoining: new Date("2026-01-01"), budget: 100000, planType: "Annual",
  });
  const clientBUser = await mkUser("Client B", "clientb@test.local", "client");
  const clientB = await Client.create({
    userId: clientBUser._id, clientId: "CLIENT-B", dateOfJoining: new Date("2026-02-01"), budget: 50000, planType: "Quarterly",
  });

  return {
    departments: { it, ops, empty },
    admin,
    itManager, itDev1, itDev2, itInactive,
    opsManager, opsStaff1, opsStaff2,
    clientA: { user: clientAUser, client: clientA },
    clientB: { user: clientBUser, client: clientB },
  };
};

// Fields that must never appear in a coworker/directory response.
export const SENSITIVE_KEYS = ["salary", "aadharcard", "pancard", "pfNumber", "dob", "bloodGroup", "password", "tokenVersion", "email", "maritalStatus"];

export const findSensitiveKeys = (value, keys = SENSITIVE_KEYS, path = "$") => {
  const hits = [];
  if (Array.isArray(value)) value.forEach((v, i) => hits.push(...findSensitiveKeys(v, keys, `${path}[${i}]`)));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (keys.includes(k)) hits.push(`${path}.${k}`);
      hits.push(...findSensitiveKeys(v, keys, `${path}.${k}`));
    }
  }
  return hits;
};

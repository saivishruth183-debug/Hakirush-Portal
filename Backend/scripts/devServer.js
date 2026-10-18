// Local demo/test backend for the mobile app and web app.
// - Runs the real Express app (app.js) against an IN-MEMORY MongoDB (mongodb-memory-server).
// - Seeds clearly SYNTHETIC data (".test" emails, fictional names). No real people or payroll.
// - Never reads Backend/.env and never connects to any external database or ImageKit account
//   (image uploads fail with UPLOAD_FAILED here, by design).
//
// Run:   cd Backend && node scripts/devServer.js            (port 5050, or DEV_PORT=xxxx)
// Android emulator app → http://10.0.2.2:5050 ; iOS simulator/web → http://localhost:5050
//
// Synthetic sign-in accounts (all use DEMO_PASSWORD below):
//   admin@demo.hakirush.test             admin
//   it.manager@demo.hakirush.test        employee, IT manager (assigned)
//   it.dev1@demo.hakirush.test           employee, IT
//   it.dev2@demo.hakirush.test           employee, IT
//   ops.manager@demo.hakirush.test       employee, Operations manager (assigned)
//   ops.staff1@demo.hakirush.test        employee, Operations
//   inactive@demo.hakirush.test          employee, IT, DEACTIVATED (login must fail)
//   client.a@demo.hakirush.test          client A
//   client.b@demo.hakirush.test          client B
import crypto from "crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

export const DEMO_PASSWORD = "Hakirush@Demo1";

process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.JWT_KEY = crypto.randomBytes(32).toString("hex"); // per-run, synthetic
process.env.ORG_TIMEZONE = process.env.ORG_TIMEZONE || "Asia/Kolkata";
process.env.IMAGEKIT_PUBLIC_KEY = "dev_placeholder_public";
process.env.IMAGEKIT_PRIVATE_KEY = "dev_placeholder_private";
process.env.IMAGEKIT_URL_ENDPOINT = "https://ik.invalid/dev";
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || "http://localhost:5173";
delete process.env.MONGODB_URL;

const port = Number(process.env.DEV_PORT || 5050);

const ymd = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

async function seed() {
  const User = (await import("../models/User.js")).default;
  const Employee = (await import("../models/Employee.js")).default;
  const Department = (await import("../models/Department.js")).default;
  const Client = (await import("../models/Client.js")).default;
  const Holiday = (await import("../models/Holiday.js")).default;
  const Announcement = (await import("../models/Announcement.js")).default;
  const Attendance = (await import("../models/Attendance.js")).default;
  const Leave = (await import("../models/Leave.js")).default;

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const mkUser = (name, email, role, extra = {}) => User.create({ name, email, password: hash, role, ...extra });

  const it = await Department.create({ dep_name: "IT", description: "Information Technology (synthetic)" });
  const ops = await Department.create({ dep_name: "Operations", description: "Operations (synthetic)" });
  await Department.create({ dep_name: "Marketing", description: "No members yet (synthetic)" });

  await mkUser("Demo Admin", "admin@demo.hakirush.test", "admin");

  let seq = 1;
  const mkEmp = async (name, email, dept, designation, joinedDaysAgo, userExtra = {}) => {
    const user = await mkUser(name, email, "employee", userExtra);
    const employee = await Employee.create({
      userId: user._id,
      employeeId: `DEMO${String(seq++).padStart(4, "0")}`,
      department: dept._id,
      designation,
      salary: 40000 + seq * 1000,
      dob: new Date(Date.UTC(1990, (seq * 2) % 12, 5 + seq)),
      gender: seq % 2 ? "Female" : "Male",
      maritalStatus: "Single",
      bloodGroup: "O+",
      dateOfJoining: daysFromNow(-joinedDaysAgo),
    });
    return employee;
  };

  const itManager = await mkEmp("Asha Rao", "it.manager@demo.hakirush.test", it, "Engineering Manager", 900);
  const itDev1 = await mkEmp("Kiran Mehta", "it.dev1@demo.hakirush.test", it, "Software Developer", 400);
  await mkEmp("Neha Joshi", "it.dev2@demo.hakirush.test", it, "QA Engineer", 12);
  await mkEmp("Vikram Inactive", "inactive@demo.hakirush.test", it, "Developer", 300, { isActive: false });
  const opsManager = await mkEmp("Ravi Nair", "ops.manager@demo.hakirush.test", ops, "Operations Manager", 700);
  await mkEmp("Priya Das", "ops.staff1@demo.hakirush.test", ops, "Event Coordinator", 200);

  await Department.updateOne({ _id: it._id }, { managerEmployeeId: itManager._id });
  await Department.updateOne({ _id: ops._id }, { managerEmployeeId: opsManager._id });

  const clientAUser = await mkUser("Demo Client A", "client.a@demo.hakirush.test", "client");
  await Client.create({ userId: clientAUser._id, dateOfJoining: daysFromNow(-120), budget: 250000, planType: "Annual" });
  const clientBUser = await mkUser("Demo Client B", "client.b@demo.hakirush.test", "client");
  await Client.create({ userId: clientBUser._id, dateOfJoining: daysFromNow(-30), budget: 80000, planType: "Quarterly" });

  await Holiday.create({ title: "Demo Holiday (synthetic)", date: daysFromNow(10) });
  await Holiday.create({ title: "Past Demo Holiday (synthetic)", date: daysFromNow(-20) });

  await Announcement.create({
    title: "Welcome to the Hakirush test environment",
    description: "This announcement is synthetic test data for the mobile app.",
    type: "Annual",
    date: ymd(daysFromNow(7)),
    venue: "Main office (synthetic)",
    status: "Upcoming",
  });

  // A completed working day for one employee (worked 8h30m), to populate monthly history.
  const yesterday = daysFromNow(-1);
  const checkIn = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), 3, 30));
  await Attendance.create({
    employeeId: itDev1._id,
    date: ymd(yesterday),
    checkIn,
    checkOut: new Date(checkIn.getTime() + 8.5 * 3600 * 1000),
    workedHours: 8.5,
    status: "Present",
  });

  await Leave.create({
    employeeId: itDev1._id,
    leaveType: "Casual Leave",
    startDate: daysFromNow(14),
    endDate: daysFromNow(14),
    reason: "Synthetic pending leave",
    status: "Pending",
    days: 1,
  });
}

const main = async () => {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "hakirush_dev" });
  await seed();
  const { createApp } = await import("../app.js");
  const app = createApp();
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`[dev] Hakirush demo API on http://localhost:${port} (in-memory DB, synthetic data)`);
  });
  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

main().catch((err) => {
  console.error("[dev] failed to start:", err?.message || err);
  process.exit(1);
});

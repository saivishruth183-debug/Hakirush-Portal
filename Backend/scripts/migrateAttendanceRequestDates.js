// scripts/migrateAttendanceRequestDates.js
import mongoose from "mongoose";
import AttendanceRequest from "../models/AttendanceRequest.js";

const formatToLocalYMD = (dateInput) => {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

async function migrate() {
  const requests = await AttendanceRequest.find({});
  for (const r of requests) {
    const fixedDate = formatToLocalYMD(r.date);
    await AttendanceRequest.updateOne({ _id: r._id }, { $set: { date: fixedDate } });
  }
  console.log(`Migrated ${requests.length} requests`);
}

migrate().then(() => process.exit(0));
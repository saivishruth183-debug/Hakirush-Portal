Asimport mongoose from "mongoose";
import Attendance from "./models/Attendance.js";
import Employee from "./models/Employee.js";

const formatToLocalYMD = (dateInput) => {
    const d = new Date(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDateList = (start, end) => {
    const arr = [];
    let dt = new Date(start);
    const endDt = new Date(end);
    while (dt <= endDt) {
        arr.push(formatToLocalYMD(dt));
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
};

async function fillAbsentAttendance() {
    await mongoose.connect("mongodb://localhost:27017/YOUR_DB_NAME"); // Change DB name
    const employees = await Employee.find();
    const todayStr = formatToLocalYMD(new Date());
    let totalInserted = 0;
    for (const emp of employees) {
        const joinDateStr = formatToLocalYMD(emp.dateOfJoining || new Date());
        const dateList = getDateList(joinDateStr, todayStr);
        for (const date of dateList) {
            const exists = await Attendance.findOne({ employeeId: emp._id, date });
            if (!exists) {
                await Attendance.create({
                    employeeId: emp._id,
                    date,
                    status: "Absent",
                    workedHours: 0,
                    checkIn: null,
                    checkOut: null,
                    isPaused: false,
                    totalPausedMs: 0,
                });
                totalInserted++;
            }
        }
    }
    console.log(`Inserted ${totalInserted} absent attendance records.`);
    await mongoose.disconnect();
}

fillAbsentAttendance().catch(console.error);
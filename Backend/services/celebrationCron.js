import Employee from "../models/Employee.js";
import Announcement from "../models/Announcement.js";
import { sendBirthdayEmail, sendWorkAnniversaryEmail } from "./emailService.js";
import { businessDate, monthDayOf, ORG_TIMEZONE } from "../utils/orgTime.js";
import { now as clockNow } from "./clock.js";

/**
 * Runs daily to check for employee birthdays and work anniversaries.
 * Automatically posts announcement banners and dispatches personalized emails.
 */
export const runCelebrationsJob = async ({ now = clockNow() } = {}) => {
  const today = businessDate(now);
  const [, todayMonth, todayDay] = today.split("-");
  const todayMmDd = `${todayMonth}-${todayDay}`;
  const currentYear = Number(today.split("-")[0]);

  // Load all active employees
  const employees = await Employee.find()
    .populate({
      path: "userId",
      match: { isActive: { $ne: false } },
      select: "name email isActive",
    })
    .lean();

  const activeEmployees = employees.filter((e) => e.userId && e.userId.isActive !== false);

  const results = {
    date: today,
    birthdays: [],
    anniversaries: [],
  };

  for (const emp of activeEmployees) {
    const user = emp.userId;

    // 1. Check Birthday
    if (emp.dob) {
      const dobMmDd = monthDayOf(emp.dob);
      if (dobMmDd === todayMmDd) {
        const title = `🎂 Happy Birthday, ${user.name}!`;
        const exists = await Announcement.exists({ title, date: today });
        if (!exists) {
          await Announcement.create({
            title,
            description: `Wishing ${user.name} a very Happy Birthday! May your day be filled with happiness, celebrations, and great memories from everyone at Hakirush! 🎉`,
            type: "Celebration",
            date: today,
            venue: "Hakirush Office / Virtual",
            status: "Ongoing",
          });

          sendBirthdayEmail(user).catch((err) =>
            console.error("Failed to send birthday email to", user.email, err.message)
          );
          results.birthdays.push(user.name);
        }
      }
    }

    // 2. Check Work Anniversary
    if (emp.dateOfJoining) {
      const joiningMmDd = monthDayOf(emp.dateOfJoining);
      const joiningYear = new Date(emp.dateOfJoining).getFullYear();
      const years = currentYear - joiningYear;

      if (joiningMmDd === todayMmDd && years >= 1) {
        const yearLabel = years === 1 ? "1 Year" : `${years} Years`;
        const title = `🏆 Happy ${yearLabel} Work Anniversary, ${user.name}!`;
        const exists = await Announcement.exists({ title, date: today });
        if (!exists) {
          await Announcement.create({
            title,
            description: `Congratulations to ${user.name} on completing ${yearLabel} with Hakirush! Thank you for your continued hard work, passion, and valuable contributions to the team! 🌟`,
            type: "Celebration",
            date: today,
            venue: "Hakirush Office",
            status: "Ongoing",
          });

          sendWorkAnniversaryEmail(user, years).catch((err) =>
            console.error("Failed to send anniversary email to", user.email, err.message)
          );
          results.anniversaries.push({ name: user.name, years });
        }
      }
    }
  }

  return results;
};

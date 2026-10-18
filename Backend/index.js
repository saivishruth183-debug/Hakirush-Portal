import connectToDatabase from "./db/db.js";
import startAttendanceCron from "./utils/attendanceCron.js";
import { createApp } from "./app.js";

connectToDatabase();

const app = createApp();

// In-process cron only runs on a long-lived server. On serverless hosts
// (e.g. Vercel) the scheduled job is triggered over HTTP instead.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
if (!isServerless && process.env.ENABLE_IN_PROCESS_CRON !== "false") {
  startAttendanceCron();
}

app.listen(process.env.PORT, () => {
  console.log(`Server is Running on port ${process.env.PORT}`);
});

export default app;

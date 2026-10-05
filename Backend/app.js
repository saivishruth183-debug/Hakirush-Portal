import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRouter from "./routes/authRoute.js";
import departmentRouter from "./routes/departmentRoute.js";
import employeeRouter from "./routes/employeeRoute.js";
import clientRouter from "./routes/clientRoute.js";
import leaveRouter from "./routes/leaveRoute.js";
import settingRouter from "./routes/settingRoute.js";
import attendanceRouter from "./routes/attendanceRoute.js";
import dashboardRouter from "./routes/dashboardRoute.js";
import holidayRouter from "./routes/holidayRoute.js";
import sponsorRouter from "./routes/sponsorRoutes.js";
import announcementRoutes from "./routes/announcementRoutes.js";
import stallRoutes from "./routes/stallRoutes.js";
import payslipRoutes from "./routes/payslipRoutes.js";
import attendanceRequestRouter from "./routes/attendanceRequestRoutes.js";
import notificationRoute from "./routes/notificationRoute.js";
import assetRoutes from "./routes/assetRoutes.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Browser origins allowed to call the API. Native apps do not use CORS.
const DEFAULT_ORIGINS = ["https://hakirush-portal.vercel.app"];
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  app.use(
    cors({
      origin: allowedOrigins.length ? allowedOrigins : DEFAULT_ORIGINS,
      credentials: true,
    })
  );

  app.use(express.static(path.join(__dirname, "public")));
  app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

  app.use("/api/auth", authRouter);
  app.use("/api/department", departmentRouter);
  app.use("/api/employee", employeeRouter);
  app.use("/api/client", clientRouter);
  app.use("/api/leave", leaveRouter);
  app.use("/api/setting", settingRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/holiday", holidayRouter);
  app.use("/api/sponsors", sponsorRouter);
  app.use("/api/stalls", stallRoutes);
  app.use("/api/payslip", payslipRoutes);
  app.use("/api/attendance-request", attendanceRequestRouter);
  app.use("/api/notifications", notificationRoute);
  app.use("/api/asset", assetRoutes);

  app.get("/api/test", (req, res) => {
    res.json({ success: true, message: "Backend is working!" });
  });
  app.use("/api/announcements", announcementRoutes);

  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApp;

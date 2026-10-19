```javascript
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import helmet from "helmet";

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
import overtimeRoute from "./routes/overtimeRoute.js";
import expenseRoutes from "./routes/expenseRoutes.js";

import {
  notFoundHandler,
  errorHandler,
} from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allowed frontend origins
const DEFAULT_ORIGINS = [
  "https://hakirush-portal.vercel.app",
];

// Read additional origins from backend environment variables
const allowedOrigins = [
  ...new Set([
    ...DEFAULT_ORIGINS,
    ...(process.env.CORS_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]),
];

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );

  app.use(compression());

  // Parse JSON requests
  app.use(express.json({ limit: "1mb" }));

  // CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Requests without an Origin header are allowed.
        // This includes many server-to-server requests.
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        console.warn(`CORS blocked origin: ${origin}`);

        return callback(
          new Error(`CORS blocked for origin: ${origin}`)
        );
      },
      credentials: true,
      methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Accept",
      ],
    })
  );

  // Static files
  app.use(express.static(path.join(__dirname, "public")));

  app.use(
    "/uploads",
    express.static(path.join(__dirname, "public/uploads"))
  );

  // API routes
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
  app.use("/api/sponsor", sponsorRouter);

  app.use("/api/stalls", stallRoutes);
  app.use("/api/stall", stallRoutes);

  app.use("/api/payslip", payslipRoutes);
  app.use("/api/payslips", payslipRoutes);

  app.use("/api/attendance-request", attendanceRequestRouter);
  app.use("/api/notifications", notificationRoute);

  app.use("/api/asset", assetRoutes);
  app.use("/api/assets", assetRoutes);

  app.use("/api/overtime", overtimeRoute);

  app.use("/api/expenses", expenseRoutes);
  app.use("/api/expense", expenseRoutes);

  app.use("/api/announcements", announcementRoutes);
  app.use("/api/announcement", announcementRoutes);

  // Backend health check
  app.get("/api/test", (req, res) => {
    res.status(200).json({
      success: true,
      message: "Hakirush Portal backend is working!",
    });
  });

  // Handle unknown API endpoints
  app.use("/api", notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
};

export default createApp;
```

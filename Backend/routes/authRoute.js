import express from "express";
import {
  login,
  verify,
  mobileLogin,
  mobileRefresh,
  mobileLogout,
  logoutAll,
  setupPassword,
  forgotPassword,
  verifyPasswordResetOtp,
  resetPassword
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { loginLimiter } from "../middleware/loginRateLimit.js";
import { passwordResetRequestLimiter } from "../middleware/passwordResetRateLimit.js";

const router = express.Router();

router.post("/login", loginLimiter, login);
router.post("/forgot-password", passwordResetRequestLimiter, forgotPassword);
router.post("/verify-otp", verifyPasswordResetOtp);
router.post("/reset-password", resetPassword);
router.post("/verify", authMiddleware, verify);

router.post("/mobile/login", loginLimiter, mobileLogin);
router.post("/mobile/refresh", mobileRefresh);
router.post("/mobile/logout", mobileLogout);
router.post("/logout-all", authMiddleware, logoutAll);
router.post("/setup-password", setupPassword);

export default router;

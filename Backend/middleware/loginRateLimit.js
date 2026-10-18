// Login throttling (web + mobile share the same budget).
// - per IP + normalized email: LOGIN_RATE_LIMIT_MAX (default 10) failed attempts / 15 min
// - per IP: LOGIN_RATE_LIMIT_IP_MAX (default 100) failed attempts / 15 min
// Successful logins do not count. Under NODE_ENV=test the defaults are raised
// so integration tests are not throttled; tests that exercise the limiter build
// one with a low limit via createLoginLimiters().
// Note: the default store is in-memory per process (per instance on serverless).
import { rateLimit, ipKeyGenerator } from "express-rate-limit";

const WINDOW_MS = 15 * 60 * 1000;

const envInt = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const normalizedEmail = (req) =>
  typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";

const rateLimitedHandler = (req, res, next, options) => {
  const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
  res.status(429).json({
    success: false,
    error: "Too many login attempts. Please wait and try again.",
    code: "RATE_LIMITED",
    details: { retryAfterSeconds },
  });
};

export const createLoginLimiters = ({ limit, ipLimit, windowMs = WINDOW_MS } = {}) => {
  const isTest = process.env.NODE_ENV === "test";
  const perAccount = rateLimit({
    windowMs,
    limit: limit ?? envInt("LOGIN_RATE_LIMIT_MAX", isTest ? 10000 : 10),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip || "")}|${normalizedEmail(req)}`,
    handler: rateLimitedHandler,
  });
  const perIp = rateLimit({
    windowMs,
    limit: ipLimit ?? envInt("LOGIN_RATE_LIMIT_IP_MAX", isTest ? 10000 : 100),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => ipKeyGenerator(req.ip || ""),
    handler: rateLimitedHandler,
  });
  return [perIp, perAccount];
};

// Shared instance used by /auth/login and /auth/mobile/login.
export const loginLimiter = createLoginLimiters();

export default loginLimiter;

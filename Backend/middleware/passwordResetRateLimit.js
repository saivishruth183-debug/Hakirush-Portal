import { rateLimit, ipKeyGenerator } from "express-rate-limit";

const normalizeEmail = (req) =>
  typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";

const handler = (req, res, next, options) => {
  res.status(429).json({
    success: false,
    error: "Too many password reset requests. Please wait before trying again.",
    code: "RATE_LIMITED",
    details: { retryAfterSeconds: Math.ceil(options.windowMs / 1000) },
  });
};

const limit = (windowMs, max, keyGenerator, options = {}) =>
  rateLimit({
    windowMs,
    limit: process.env.NODE_ENV === "test" ? 10000 : max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator,
    handler,
    ...options,
  });

const emailWindowLimit = (duration, max) =>
  limit(duration, max, normalizeEmail, { validate: { keyGeneratorIpFallback: false } });

const ipWindowLimit = (duration, max) =>
  limit(duration, max, (req) => ipKeyGenerator(req.ip || ""));

export const passwordResetRequestLimiter = [
  emailWindowLimit(60 * 1000, 1),
  emailWindowLimit(60 * 60 * 1000, 5),
  ipWindowLimit(60 * 1000, 1),
  ipWindowLimit(60 * 60 * 1000, 5),
];

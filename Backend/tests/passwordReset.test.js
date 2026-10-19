import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures } from "./helpers/testEnv.js";
import { __testHooks as emailTestHooks } from "../services/emailService.js";

let app;
let fixtures;
let User;
let PasswordReset;
let capturedOtp;

before(async () => {
  await startTestDb();
  app = await getApp();
  User = (await import("../models/User.js")).default;
  PasswordReset = (await import("../models/PasswordReset.js")).default;
  emailTestHooks.capturePasswordResetEmail = async ({ type, otp }) => {
    if (type === "otp") capturedOtp = otp;
  };
});

after(async () => {
  emailTestHooks.capturePasswordResetEmail = null;
  await stopTestDb();
});

beforeEach(async () => {
  await clearDb();
  fixtures = await seedFixtures();
  capturedOtp = null;
});

const requestOtp = async (email = "alan@test.local") => {
  const response = await request(app).post("/api/auth/forgot-password").send({ email });
  assert.equal(response.status, 200);
  assert.equal(response.body.message, "If this email is registered, an OTP has been sent.");
  assert.match(capturedOtp, /^\d{6}$/);
  return capturedOtp;
};

const verifyOtp = (email, otp) =>
  request(app).post("/api/auth/verify-otp").send({ email, otp });

describe("password reset", () => {
  test("unknown emails receive the same generic response", async () => {
    const response = await request(app).post("/api/auth/forgot-password").send({ email: "unknown@test.local" });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      success: true,
      message: "If this email is registered, an OTP has been sent.",
    });
    assert.equal(await PasswordReset.countDocuments(), 0);
  });

  test("wrong OTPs report attempts remaining and invalidate the reset after five", async () => {
    await requestOtp();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await verifyOtp("alan@test.local", "000000" === capturedOtp ? "000001" : "000000");
      assert.equal(response.status, 400);
      assert.equal(response.body.code, "OTP_INVALID");
      assert.equal(response.body.details.attemptsLeft, 5 - attempt);
    }
    const fifth = await verifyOtp("alan@test.local", "000000" === capturedOtp ? "000001" : "000000");
    assert.equal(fifth.status, 400);
    assert.equal(fifth.body.code, "OTP_ATTEMPTS_EXCEEDED");
    assert.equal(fifth.body.details.attemptsLeft, 0);
    assert.equal(await PasswordReset.countDocuments(), 0);
    const afterLimit = await verifyOtp("alan@test.local", capturedOtp);
    assert.equal(afterLimit.status, 400);
  });

  test("expired OTPs are rejected", async () => {
    await requestOtp();
    await PasswordReset.updateOne({ userId: fixtures.itDev1.user._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const response = await verifyOtp("alan@test.local", capturedOtp);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "OTP_INVALID");
    assert.equal(await PasswordReset.countDocuments(), 0);
  });

  test("valid OTP resets the password, increments tokenVersion, and deletes the reset record", async () => {
    await requestOtp("ALAN@Test.Local");
    const verified = await verifyOtp("alan@test.local", capturedOtp);
    assert.equal(verified.status, 200);
    assert.ok(verified.body.resetToken);

    const reset = await request(app).post("/api/auth/reset-password").send({
      email: "alan@test.local",
      resetToken: verified.body.resetToken,
      newPassword: "Reset-Pass9",
    });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.message, "Password updated, please log in.");
    assert.equal(await PasswordReset.countDocuments(), 0);
    const updatedUser = await User.findById(fixtures.itDev1.user._id);
    assert.equal(updatedUser.tokenVersion, 1);

    const login = await request(app).post("/api/auth/login").send({
      email: "alan@test.local",
      password: "Reset-Pass9",
    });
    assert.equal(login.status, 200);
  });

  test("reset token cannot be reused", async () => {
    await requestOtp();
    const verified = await verifyOtp("alan@test.local", capturedOtp);
    const payload = {
      email: "alan@test.local",
      resetToken: verified.body.resetToken,
      newPassword: "Reset-Pass9",
    };
    assert.equal((await request(app).post("/api/auth/reset-password").send(payload)).status, 200);
    const reused = await request(app).post("/api/auth/reset-password").send({ ...payload, newPassword: "Other-Pass8" });
    assert.equal(reused.status, 401);
    assert.equal(reused.body.code, "RESET_TOKEN_INVALID");
  });
});

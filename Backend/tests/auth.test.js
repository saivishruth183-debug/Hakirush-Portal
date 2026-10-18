import { test, before, after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth, PASSWORD } from "./helpers/testEnv.js";

let app, fx, User, RefreshToken, hashToken;

before(async () => {
  await startTestDb();
  app = await getApp();
  User = (await import("../models/User.js")).default;
  RefreshToken = (await import("../models/RefreshToken.js")).default;
  ({ hashToken } = await import("../services/sessionService.js"));
});
after(async () => { await stopTestDb(); });
beforeEach(async () => { await clearDb(); fx = await seedFixtures(); });

const mobileLogin = (email, password = PASSWORD, extra = {}) =>
  request(app).post("/api/auth/mobile/login").send({ email, password, ...extra });
const refresh = (refreshToken) => request(app).post("/api/auth/mobile/refresh").send({ refreshToken });

describe("web login", () => {
  test("success returns {success, token, user: SessionUser}; JWT carries _id, role, tv", async () => {
    const r = await request(app).post("/api/auth/login").send({ email: "alan@test.local", password: PASSWORD });
    assert.equal(r.status, 200);
    assert.equal(r.body.success, true);
    assert.ok(r.body.token);
    const payload = jwt.verify(r.body.token, process.env.JWT_KEY);
    assert.equal(payload._id, String(fx.itDev1.user._id));
    assert.equal(payload.role, "employee");
    assert.equal(payload.tv, 0);
    // default WEB_TOKEN_TTL 10d
    assert.ok(payload.exp - payload.iat === 10 * 24 * 3600);

    const u = r.body.user;
    assert.equal(u._id, String(fx.itDev1.user._id));
    assert.equal(u.employeeId, fx.itDev1.employee.employeeId);
    assert.equal(u.designation, "Developer");
    assert.equal(u.employeeRecordId, String(fx.itDev1.employee._id));
    assert.equal(u.departmentId, String(fx.departments.it._id));
    assert.equal(u.departmentName, "IT");
    assert.equal(u.isActive, true);
    assert.equal(u.password, undefined);
    assert.equal(u.tokenVersion, undefined);
  });

  test("email is trimmed and lowercased", async () => {
    const r = await request(app).post("/api/auth/login").send({ email: "  ALAN@Test.Local ", password: PASSWORD });
    assert.equal(r.status, 200);
  });

  test("unknown email and wrong password give the same 401 INVALID_CREDENTIALS", async () => {
    const a = await request(app).post("/api/auth/login").send({ email: "nobody@test.local", password: PASSWORD });
    const b = await request(app).post("/api/auth/login").send({ email: "alan@test.local", password: "wrong-password" });
    for (const r of [a, b]) {
      assert.equal(r.status, 401);
      assert.equal(r.body.code, "INVALID_CREDENTIALS");
      assert.equal(r.body.success, false);
    }
    assert.equal(a.body.error, b.body.error);
  });

  test("missing fields → 400; inactive account → 403 ACCOUNT_INACTIVE only with the right password", async () => {
    const m = await request(app).post("/api/auth/login").send({ email: "alan@test.local" });
    assert.equal(m.status, 400);
    assert.equal(m.body.code, "VALIDATION_ERROR");

    const inactive = await request(app).post("/api/auth/login").send({ email: "ivan@test.local", password: PASSWORD });
    assert.equal(inactive.status, 403);
    assert.equal(inactive.body.code, "ACCOUNT_INACTIVE");

    const inactiveWrong = await request(app).post("/api/auth/login").send({ email: "ivan@test.local", password: "nope-nope" });
    assert.equal(inactiveWrong.status, 401);
    assert.equal(inactiveWrong.body.code, "INVALID_CREDENTIALS");
  });

  test("verify returns SessionUser for employee and client", async () => {
    const e = await request(app).post("/api/auth/verify").set(auth(fx.opsStaff1.user));
    assert.equal(e.status, 200);
    assert.equal(e.body.user.departmentName, "Operations");
    assert.equal(e.body.user.employeeRecordId, String(fx.opsStaff1.employee._id));

    const c = await request(app).post("/api/auth/verify").set(auth(fx.clientA.user));
    assert.equal(c.status, 200);
    assert.equal(c.body.user.role, "client");
    assert.equal(c.body.user.clientId, String(fx.clientA.client._id));
    assert.equal(c.body.user.clientCode, "CLIENT-A");
    assert.equal(c.body.user.departmentId, undefined);
  });
});

describe("mobile session", () => {
  test("login issues 15m access token with sid and an opaque refresh token stored only as a hash", async () => {
    const r = await mobileLogin("alan@test.local", PASSWORD, { deviceName: "Pixel 9" });
    assert.equal(r.status, 200);
    const { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, user } = r.body;
    assert.ok(accessToken && refreshToken && user);
    const payload = jwt.verify(accessToken, process.env.JWT_KEY);
    assert.equal(payload.exp - payload.iat, 15 * 60);
    assert.ok(payload.sid);
    assert.equal(payload.tv, 0);
    assert.equal(new Date(accessTokenExpiresAt).getTime(), payload.exp * 1000);
    const days = (new Date(refreshTokenExpiresAt) - Date.now()) / 86400000;
    assert.ok(days > 29.9 && days <= 30);
    assert.match(refreshToken, /^[A-Za-z0-9_-]{64}$/);

    const rows = await RefreshToken.find({}).lean();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].tokenHash, hashToken(refreshToken));
    assert.equal(rows[0].familyId, payload.sid);
    assert.equal(rows[0].deviceName, "Pixel 9");
    assert.ok(!JSON.stringify(rows).includes(refreshToken), "raw refresh token must not be stored");
    const RefreshSession = (await import("../models/RefreshSession.js")).default;
    const session = await RefreshSession.findById(payload.sid).lean();
    assert.ok(session, "family/session document exists with _id = sid");
    assert.equal(String(session.userId), String(fx.itDev1.user._id));
    assert.equal(session.revokedAt, null);
    assert.equal(session.deviceName, "Pixel 9");

    const v = await request(app).post("/api/auth/verify").set({ Authorization: `Bearer ${accessToken}` });
    assert.equal(v.status, 200);
  });

  test("mobile login uses the same uniform errors", async () => {
    const r = await mobileLogin("nobody@test.local");
    assert.equal(r.status, 401);
    assert.equal(r.body.code, "INVALID_CREDENTIALS");
    const i = await mobileLogin("ivan@test.local");
    assert.equal(i.status, 403);
    assert.equal(i.body.code, "ACCOUNT_INACTIVE");
  });

  test("refresh rotates; reusing a rotated token revokes the family (REFRESH_REUSED)", async () => {
    const login = await mobileLogin("alan@test.local");
    const t1 = login.body.refreshToken;

    const r1 = await refresh(t1);
    assert.equal(r1.status, 200);
    const t2 = r1.body.refreshToken;
    assert.notEqual(t2, t1);
    assert.ok(r1.body.accessToken && r1.body.user);
    assert.equal(jwt.decode(r1.body.accessToken).sid, jwt.decode(login.body.accessToken).sid);

    const old = await RefreshToken.findOne({ tokenHash: hashToken(t1) }).lean();
    assert.ok(old.revokedAt);
    assert.equal(old.revokedReason, "rotated");
    assert.equal(old.replacedByHash, hashToken(t2));

    const reuse = await refresh(t1);
    assert.equal(reuse.status, 401);
    assert.equal(reuse.body.code, "REFRESH_REUSED");

    // Whole family revoked: the latest token no longer works either.
    const after = await refresh(t2);
    assert.equal(after.status, 401);
    const live = await RefreshToken.countDocuments({ revokedAt: null });
    assert.equal(live, 0);
  });

  test("concurrent refresh with the same token: one claim at most, and the detected reuse leaves nothing usable", async () => {
    const login = await mobileLogin("alan@test.local");
    const sid = jwt.decode(login.body.accessToken).sid;
    const t1 = login.body.refreshToken;
    const results = await Promise.all([refresh(t1), refresh(t1), refresh(t1)]);
    const ok = results.filter((r) => r.status === 200);
    const denied = results.filter((r) => r.status === 401);
    assert.ok(ok.length <= 1, "at most one refresh may succeed");
    assert.equal(ok.length + denied.length, 3);
    for (const d of denied) assert.ok(["REFRESH_REUSED"].includes(d.body.code), d.body.code);
    // Exactly one request claimed the parent; at most one child exists.
    assert.equal(await RefreshToken.countDocuments({ familyId: sid, revokedReason: "rotated" }), 1);
    assert.ok((await RefreshToken.countDocuments({ familyId: sid })) <= 2);
    // Reuse was detected, so the family is revoked and nothing in it is usable.
    assert.equal(await RefreshToken.countDocuments({ familyId: sid, revokedAt: null }), 0);
    for (const r of ok) {
      assert.equal((await refresh(r.body.refreshToken)).status, 401);
      const v = await request(app).post("/api/auth/verify").set({ Authorization: `Bearer ${r.body.accessToken}` });
      assert.equal(v.body.code, "SESSION_REVOKED");
    }
  });

  test("unknown / malformed / expired refresh tokens → 401 REFRESH_INVALID", async () => {
    const unknown = await refresh("x".repeat(64));
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.code, "REFRESH_INVALID");
    const missing = await request(app).post("/api/auth/mobile/refresh").send({});
    assert.equal(missing.status, 401);
    assert.equal(missing.body.code, "REFRESH_INVALID");

    const login = await mobileLogin("alan@test.local");
    await RefreshToken.updateOne({ tokenHash: hashToken(login.body.refreshToken) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await refresh(login.body.refreshToken);
    assert.equal(expired.status, 401);
    assert.equal(expired.body.code, "REFRESH_INVALID");
  });

  test("refresh checks account state and tokenVersion", async () => {
    const a = await mobileLogin("alan@test.local");
    await User.updateOne({ _id: fx.itDev1.user._id }, { $inc: { tokenVersion: 1 } });
    const tv = await refresh(a.body.refreshToken);
    assert.equal(tv.status, 401);
    assert.equal(tv.body.code, "SESSION_REVOKED");

    const b = await mobileLogin("bea@test.local");
    await User.updateOne({ _id: fx.opsStaff1.user._id }, { $set: { isActive: false } });
    const inactive = await refresh(b.body.refreshToken);
    assert.equal(inactive.status, 403);
    assert.equal(inactive.body.code, "ACCOUNT_INACTIVE");
  });

  test("logout revokes the family and is idempotent", async () => {
    const login = await mobileLogin("alan@test.local");
    const r1 = await refresh(login.body.refreshToken);
    const t2 = r1.body.refreshToken;

    const out = await request(app).post("/api/auth/mobile/logout").send({ refreshToken: t2 });
    assert.equal(out.status, 200);
    assert.equal(out.body.success, true);
    assert.equal(await RefreshToken.countDocuments({ revokedAt: null }), 0);

    const again = await request(app).post("/api/auth/mobile/logout").send({ refreshToken: t2 });
    assert.equal(again.status, 200);
    const unknown = await request(app).post("/api/auth/mobile/logout").send({ refreshToken: "nope" });
    assert.equal(unknown.status, 200);

    const afterLogout = await refresh(t2);
    assert.equal(afterLogout.status, 401);
    assert.equal(afterLogout.body.code, "REFRESH_INVALID");
  });

  test("logout-all bumps tokenVersion and revokes every refresh token", async () => {
    const a = await mobileLogin("alan@test.local", PASSWORD, { deviceName: "phone" });
    const b = await mobileLogin("alan@test.local", PASSWORD, { deviceName: "tablet" });
    const r = await request(app).post("/api/auth/logout-all").set({ Authorization: `Bearer ${a.body.accessToken}` });
    assert.equal(r.status, 200);

    const v = await request(app).post("/api/auth/verify").set({ Authorization: `Bearer ${b.body.accessToken}` });
    assert.equal(v.status, 401);
    assert.equal(v.body.code, "SESSION_REVOKED");
    for (const t of [a.body.refreshToken, b.body.refreshToken]) {
      const x = await refresh(t);
      assert.equal(x.status, 401);
      assert.equal(x.body.code, "SESSION_REVOKED");
    }
  });
});

describe("change password", () => {
  test("targets the caller, ignores body.userId, revokes sessions, never logs the body", async () => {
    const mob = await mobileLogin("alan@test.local");
    const webToken = (await request(app).post("/api/auth/login").send({ email: "alan@test.local", password: PASSWORD })).body.token;

    const logged = [];
    const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info };
    for (const k of Object.keys(orig)) console[k] = (...a) => logged.push(a.map(String).join(" "));
    let r;
    try {
      r = await request(app)
        .put("/api/setting/change-password")
        .set({ Authorization: `Bearer ${webToken}` })
        .send({ userId: String(fx.opsStaff1.user._id), oldPassword: PASSWORD, newPassword: "Brand-New-Pass-1", confirmPassword: "Brand-New-Pass-1" });
    } finally {
      Object.assign(console, orig);
    }
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { success: true, reauthRequired: true });
    assert.ok(!logged.join("\n").includes("Brand-New-Pass-1"), "password must not be logged");

    // Old tokens are dead.
    const v = await request(app).post("/api/auth/verify").set({ Authorization: `Bearer ${webToken}` });
    assert.equal(v.body.code, "SESSION_REVOKED");
    const rf = await refresh(mob.body.refreshToken);
    assert.equal(rf.status, 401);
    assert.equal(rf.body.code, "SESSION_REVOKED");

    // Caller's password changed; body.userId's password untouched.
    assert.equal((await request(app).post("/api/auth/login").send({ email: "alan@test.local", password: "Brand-New-Pass-1" })).status, 200);
    assert.equal((await request(app).post("/api/auth/login").send({ email: "bea@test.local", password: PASSWORD })).status, 200);
    assert.equal((await request(app).post("/api/auth/login").send({ email: "bea@test.local", password: "Brand-New-Pass-1" })).status, 401);
  });

  test("validation: min length, must differ, wrong old password, mismatch", async () => {
    const h = auth(fx.itDev1.user);
    const short = await request(app).put("/api/setting/change-password").set(h).send({ oldPassword: PASSWORD, newPassword: "short" });
    assert.equal(short.status, 400);
    const same = await request(app).put("/api/setting/change-password").set(h).send({ oldPassword: PASSWORD, newPassword: PASSWORD });
    assert.equal(same.status, 400);
    const wrong = await request(app).put("/api/setting/change-password").set(h).send({ oldPassword: "not-the-password", newPassword: "Another-Pass-9" });
    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.error, "Wrong old password");
    const mismatch = await request(app).put("/api/setting/change-password").set(h)
      .send({ oldPassword: PASSWORD, newPassword: "Another-Pass-9", confirmPassword: "Different-Pass-9" });
    assert.equal(mismatch.status, 400);
    const unauth = await request(app).put("/api/setting/change-password").send({ oldPassword: PASSWORD, newPassword: "Another-Pass-9" });
    assert.equal(unauth.status, 401);
    // Nothing changed.
    const u = await User.findById(fx.itDev1.user._id).lean();
    assert.equal(u.tokenVersion, 0);
  });
});

describe("login rate limiting", () => {
  test("limiter returns 429 RATE_LIMITED JSON after the limit (per IP + email)", async () => {
    const { createLoginLimiters } = await import("../middleware/loginRateLimit.js");
    const { login } = await import("../controllers/authController.js");
    const mini = express();
    mini.use(express.json());
    mini.post("/login", createLoginLimiters({ limit: 3, ipLimit: 50 }), login);

    for (let i = 0; i < 3; i++) {
      const r = await request(mini).post("/login").send({ email: "alan@test.local", password: "wrong-pass" });
      assert.equal(r.status, 401);
    }
    const limited = await request(mini).post("/login").send({ email: "ALAN@test.local ", password: PASSWORD });
    assert.equal(limited.status, 429);
    assert.equal(limited.body.success, false);
    assert.equal(limited.body.code, "RATE_LIMITED");

    // A different account from the same IP is not blocked by the per-account limiter.
    const other = await request(mini).post("/login").send({ email: "bea@test.local", password: PASSWORD });
    assert.equal(other.status, 200);
  });

  test("successful logins do not consume the budget", async () => {
    const { createLoginLimiters } = await import("../middleware/loginRateLimit.js");
    const { login } = await import("../controllers/authController.js");
    const mini = express();
    mini.use(express.json());
    mini.post("/login", createLoginLimiters({ limit: 2, ipLimit: 50 }), login);
    for (let i = 0; i < 4; i++) {
      const r = await request(mini).post("/login").send({ email: "alan@test.local", password: PASSWORD });
      assert.equal(r.status, 200);
    }
  });

  test("the real app's limiter is effectively disabled under NODE_ENV=test", async () => {
    for (let i = 0; i < 12; i++) {
      const r = await request(app).post("/api/auth/login").send({ email: "alan@test.local", password: "wrong-pass" });
      assert.equal(r.status, 401);
    }
  });
});

test("mongoose connection is the in-memory server", () => {
  assert.match(mongoose.connection.host, /127\.0\.0\.1|localhost/);
});

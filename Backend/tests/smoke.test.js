import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth } from "./helpers/testEnv.js";

let app, fx;
before(async () => { await startTestDb(); app = await getApp(); });
after(async () => { await stopTestDb(); });

test("auth middleware: missing token, inactive user, revoked token version", async () => {
  await clearDb();
  fx = await seedFixtures();
  const r1 = await request(app).post("/api/auth/verify");
  assert.equal(r1.status, 401);
  assert.equal(r1.body.code, "AUTH_REQUIRED");

  const r2 = await request(app).post("/api/auth/verify").set(auth(fx.itInactive.user));
  assert.equal(r2.status, 403);
  assert.equal(r2.body.code, "ACCOUNT_INACTIVE");

  const stale = { ...fx.itDev1.user.toObject(), tokenVersion: 0 };
  const User = (await import("../models/User.js")).default;
  await User.updateOne({ _id: fx.itDev1.user._id }, { $inc: { tokenVersion: 1 } });
  const r3 = await request(app).post("/api/auth/verify").set(auth(stale));
  assert.equal(r3.status, 401);
  assert.equal(r3.body.code, "SESSION_REVOKED");

  const r4 = await request(app).post("/api/auth/verify").set(auth(fx.admin));
  assert.equal(r4.status, 200);
});

// Deterministic regression tests for refresh-family revocation races and
// per-session access-token revocation (sid).
import { test, before, after, beforeEach, afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth, tokenFor, PASSWORD } from "./helpers/testEnv.js";

let app, fx, RefreshToken, RefreshSession, svc;

before(async () => {
  await startTestDb();
  app = await getApp();
  RefreshToken = (await import("../models/RefreshToken.js")).default;
  RefreshSession = (await import("../models/RefreshSession.js")).default;
  svc = await import("../services/sessionService.js");
});
after(async () => { await stopTestDb(); });
beforeEach(async () => { await clearDb(); fx = await seedFixtures(); });
afterEach(() => { svc.__testHooks.beforeInsertChild = null; });

const mobileLogin = async (email, deviceName) => {
  const r = await request(app).post("/api/auth/mobile/login").send({ email, password: PASSWORD, deviceName });
  assert.equal(r.status, 200);
  return { ...r.body, sid: jwt.decode(r.body.accessToken).sid };
};
const refresh = (refreshToken) => request(app).post("/api/auth/mobile/refresh").send({ refreshToken });
const bearer = (t) => ({ Authorization: `Bearer ${t}` });
const teamWith = (accessToken) => request(app).get("/api/employee/team/me").set(bearer(accessToken));

// Pauses the next refresh right after it claimed the presented token and before
// the child token is inserted. Returns { paused, release, ctx() }.
const pauseBeforeChildInsert = () => {
  let release, signalPaused, ctx;
  const gate = new Promise((r) => { release = r; });
  const paused = new Promise((r) => { signalPaused = r; });
  svc.__testHooks.beforeInsertChild = async (c) => {
    ctx = c;
    svc.__testHooks.beforeInsertChild = null; // only the first refresh pauses
    signalPaused();
    await gate;
  };
  return { paused, release: () => release(), ctx: () => ctx };
};

const assertNothingUsable = async (sid, user, extraRefreshTokens = []) => {
  assert.equal(await RefreshToken.countDocuments({ familyId: sid, revokedAt: null }), 0, "no live refresh token in family");
  const session = await RefreshSession.findById(sid).lean();
  assert.ok(session?.revokedAt, "family is revoked");
  for (const t of extraRefreshTokens) {
    const r = await refresh(t);
    assert.equal(r.status, 401, `refresh with ${t.slice(0, 6)}… must fail`);
  }
  // Any access token for this family (incl. one minted for the child) is rejected.
  const forged = svc.signAccessToken(user, sid);
  const v = await teamWith(forged);
  assert.equal(v.status, 401);
  assert.equal(v.body.code, "SESSION_REVOKED");
};

describe("refresh races (family revocation is authoritative)", () => {
  test("reuse revokes the family while the winner is paused before inserting its child → zero usable tokens", async () => {
    const s = await mobileLogin("alan@test.local", "phone");
    const pause = pauseBeforeChildInsert();

    const winner = refresh(s.refreshToken).then((r) => r); // claims t1, then pauses
    await pause.paused;

    const reuse = await refresh(s.refreshToken); // competing reuse runs to completion
    assert.equal(reuse.status, 401);
    assert.equal(reuse.body.code, "REFRESH_REUSED");
    assert.ok((await RefreshSession.findById(s.sid).lean()).revokedAt, "family revoked before the child exists");
    assert.equal(await RefreshToken.countDocuments({ familyId: s.sid }), 1, "child not inserted yet");

    pause.release();
    const w = await winner;
    assert.equal(w.status, 401, "the paused refresh must not hand out a usable child");
    assert.equal(w.body.code, "REFRESH_REUSED");
    assert.equal(w.body.refreshToken, undefined);

    const { childToken } = pause.ctx();
    const child = await RefreshToken.findOne({ tokenHash: svc.hashToken(childToken) }).lean();
    assert.ok(child, "child was inserted after the revocation");
    assert.ok(child.revokedAt, "…and revoked by the refresher's post-insert family check");
    await assertNothingUsable(s.sid, fx.itDev1.user, [childToken, s.refreshToken]);
    // The login's own access token is dead as well.
    assert.equal((await teamWith(s.accessToken)).body.code, "SESSION_REVOKED");
  });

  test("refresh vs logout: logout while the refresh is paused → refresh fails, nothing usable", async () => {
    const s = await mobileLogin("alan@test.local", "phone");
    const pause = pauseBeforeChildInsert();

    const pending = refresh(s.refreshToken).then((r) => r);
    await pause.paused;
    const out = await request(app).post("/api/auth/mobile/logout").send({ refreshToken: s.refreshToken });
    assert.equal(out.status, 200);

    pause.release();
    const r = await pending;
    assert.equal(r.status, 401);
    assert.equal(r.body.code, "REFRESH_INVALID");
    const session = await RefreshSession.findById(s.sid).lean();
    assert.equal(session.revokedReason, "logout");
    await assertNothingUsable(s.sid, fx.itDev1.user, [pause.ctx().childToken, s.refreshToken]);
  });

  test("failure between claim and child insert: request fails, old token cannot refresh, family consistent", async () => {
    const s = await mobileLogin("alan@test.local", "phone");
    svc.__testHooks.beforeInsertChild = async () => { throw new Error("simulated crash after claim"); };

    const r = await refresh(s.refreshToken);
    assert.equal(r.status, 500);
    assert.equal(r.body.code, "INTERNAL");
    assert.ok(!JSON.stringify(r.body).includes("simulated"));
    svc.__testHooks.beforeInsertChild = null;

    assert.equal(await RefreshToken.countDocuments({ familyId: s.sid }), 1, "no child was created");
    const again = await refresh(s.refreshToken);
    assert.equal(again.status, 401, "user must sign in again");
    await assertNothingUsable(s.sid, fx.itDev1.user, [s.refreshToken]);
    assert.equal((await RefreshSession.findById(s.sid).lean()).revokedReason, "rotation_failed");
  });

  test("hard crash between claim and insert (no cleanup ran): old token is treated as reuse", async () => {
    const s = await mobileLogin("alan@test.local", "phone");
    // State left behind by a process that died right after the atomic claim.
    await RefreshToken.updateOne(
      { tokenHash: svc.hashToken(s.refreshToken) },
      { $set: { revokedAt: new Date(), revokedReason: "rotated", replacedByHash: svc.hashToken("never-inserted") } }
    );
    assert.equal((await RefreshSession.findById(s.sid).lean()).revokedAt, null);

    const r = await refresh(s.refreshToken);
    assert.equal(r.status, 401);
    assert.equal(r.body.code, "REFRESH_REUSED");
    await assertNothingUsable(s.sid, fx.itDev1.user, [s.refreshToken]);
  });

  test("normal refresh slides the family expiry and keeps it active", async () => {
    const s = await mobileLogin("alan@test.local", "phone");
    const before = await RefreshSession.findById(s.sid).lean();
    const r = await refresh(s.refreshToken);
    assert.equal(r.status, 200);
    const afterRefresh = await RefreshSession.findById(s.sid).lean();
    assert.equal(afterRefresh.revokedAt, null);
    assert.ok(afterRefresh.expiresAt >= before.expiresAt);
    assert.equal(afterRefresh.expiresAt.toISOString(), r.body.refreshTokenExpiresAt);
    assert.equal((await teamWith(r.body.accessToken)).status, 200);
  });
});

describe("access tokens honour per-session revocation (sid)", () => {
  test("after mobile logout the same access token is rejected; another device keeps working", async () => {
    const phone = await mobileLogin("alan@test.local", "phone");
    const tablet = await mobileLogin("alan@test.local", "tablet");
    assert.equal((await teamWith(phone.accessToken)).status, 200);
    assert.equal((await teamWith(tablet.accessToken)).status, 200);

    const out = await request(app).post("/api/auth/mobile/logout").send({ refreshToken: phone.refreshToken });
    assert.equal(out.status, 200);

    const dead = await teamWith(phone.accessToken);
    assert.equal(dead.status, 401);
    assert.equal(dead.body.code, "SESSION_REVOKED");
    assert.equal((await teamWith(tablet.accessToken)).status, 200, "other device unaffected");
    const tr = await refresh(tablet.refreshToken);
    assert.equal(tr.status, 200);
    assert.equal((await teamWith(tr.body.accessToken)).status, 200);

    // Legacy web token (no sid) is governed by tokenVersion only: unaffected by a device logout.
    assert.equal((await request(app).get("/api/employee/team/me").set(auth(fx.itDev1.user))).status, 200);
  });

  test("after reuse detection the winner's access token is rejected", async () => {
    const s = await mobileLogin("alan@test.local", "phone");
    const win = await refresh(s.refreshToken);
    assert.equal(win.status, 200);
    assert.equal((await teamWith(win.body.accessToken)).status, 200);

    const reuse = await refresh(s.refreshToken);
    assert.equal(reuse.body.code, "REFRESH_REUSED");

    const v = await teamWith(win.body.accessToken);
    assert.equal(v.status, 401);
    assert.equal(v.body.code, "SESSION_REVOKED");
    assert.equal((await refresh(win.body.refreshToken)).status, 401);
    await assertNothingUsable(s.sid, fx.itDev1.user, [win.body.refreshToken]);
  });

  test("unknown sid or another user's sid is rejected", async () => {
    const bea = await mobileLogin("bea@test.local", "phone");
    const unknown = await teamWith(tokenFor(fx.itDev1.user, { sid: "00000000-0000-4000-8000-000000000000" }));
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.code, "SESSION_REVOKED");
    const foreign = await teamWith(tokenFor(fx.itDev1.user, { sid: bea.sid }));
    assert.equal(foreign.status, 401);
    assert.equal(foreign.body.code, "SESSION_REVOKED");
    assert.equal((await teamWith(bea.accessToken)).status, 200);
  });

  test("logout-all / deactivation still revoke via tokenVersion and family", async () => {
    const s = await mobileLogin("alan@test.local", "phone");
    const r = await request(app).post("/api/auth/logout-all").set(bearer(s.accessToken));
    assert.equal(r.status, 200);
    assert.equal((await teamWith(s.accessToken)).body.code, "SESSION_REVOKED");
    assert.equal((await RefreshSession.findById(s.sid).lean()).revokedReason, "logout_all");

    const o = await mobileLogin("olga@test.local", "phone");
    // Olga manages Operations: clear the assignment while deactivating.
    const d = await request(app).delete(`/api/employee/${fx.opsManager.employee._id}`).set(auth(fx.admin)).send({ clearManager: true });
    assert.equal(d.status, 200);
    assert.equal((await teamWith(o.accessToken)).body.code, "ACCOUNT_INACTIVE");
    assert.equal((await RefreshSession.findById(o.sid).lean()).revokedReason, "deactivated");
    const rf = await refresh(o.refreshToken);
    assert.equal(rf.status, 403);
    assert.equal(rf.body.code, "ACCOUNT_INACTIVE");
  });
});

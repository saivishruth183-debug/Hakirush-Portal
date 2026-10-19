import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth } from "./helpers/testEnv.js";
import { ensureDomainIndexes, installFakeImageKit, PNG_BYTES, pdfBytes } from "./helpers/domain.js";

let app, fx, ikLog, ClientRosterEntry, ClientGalleryImage, ClientStanding, User, Client;

before(async () => {
  await startTestDb();
  app = await getApp();
  await ensureDomainIndexes();
  ikLog = await installFakeImageKit();
  ClientRosterEntry = (await import("../models/ClientRosterEntry.js")).default;
  ClientGalleryImage = (await import("../models/ClientGalleryImage.js")).default;
  ClientStanding = (await import("../models/ClientStanding.js")).default;
  User = (await import("../models/User.js")).default;
  Client = (await import("../models/Client.js")).default;
});
after(async () => {
  const { setImageKitClient } = await import("../utils/uploadToImageKit.js");
  setImageKitClient(null);
  await stopTestDb();
});
beforeEach(async () => {
  await clearDb();
  fx = await seedFixtures();
  ikLog.uploads.length = 0;
  ikLog.deletes.length = 0;
});

const A = () => fx.clientA;
const B = () => fx.clientB;

test("GET /client/me returns the caller's own client with safe user fields", async () => {
  const r = await request(app).get("/api/client/me").set(auth(A().user));
  assert.equal(r.status, 200);
  assert.equal(r.body.client._id, String(A().client._id));
  assert.equal(r.body.client.userId.name, "Client A");
  assert.equal(r.body.client.planType, "Annual");
  assert.equal(r.body.client.userId.tokenVersion, undefined);
  assert.equal(r.body.client.userId.password, undefined);

  assert.equal((await request(app).get("/api/client/me").set(auth(fx.itDev1.user))).status, 403);
  assert.equal((await request(app).get("/api/client/me").set(auth(fx.admin))).status, 403);
});

test("client list/detail: list is admin-only; a client reads only itself", async () => {
  const adminList = await request(app).get("/api/client").set(auth(fx.admin));
  assert.equal(adminList.status, 200);
  assert.equal(adminList.body.clients.length, 2);
  assert.equal(adminList.body.clients[0].userId.tokenVersion, undefined);

  const aList = await request(app).get("/api/client").set(auth(A().user));
  assert.equal(aList.status, 403);

  assert.equal((await request(app).get("/api/client").set(auth(fx.itDev1.user))).status, 403);

  assert.equal((await request(app).get(`/api/client/${B().client._id}`).set(auth(A().user))).status, 404);
  assert.equal((await request(app).get(`/api/client/${A().client._id}`).set(auth(A().user))).status, 200);
  assert.equal((await request(app).get(`/api/client/${B().client._id}`).set(auth(fx.admin))).status, 200);
  assert.equal((await request(app).get(`/api/client/not-an-id`).set(auth(fx.admin))).status, 400);

  // Mutations are admin-only.
  const aUpdate = await request(app).put(`/api/client/${A().client._id}`).set(auth(A().user)).send({ budget: 1 });
  assert.equal(aUpdate.status, 403);
  const aDelete = await request(app).delete(`/api/client/${B().client._id}`).set(auth(A().user));
  assert.equal(aDelete.status, 403);

  const upd = await request(app).put(`/api/client/${A().client._id}`).set(auth(fx.admin)).field("budget", "2500").field("planType", "Quarterly");
  assert.equal(upd.status, 200);
  assert.equal(upd.body.client.budget, 2500);
  const badPlan = await request(app).put(`/api/client/${A().client._id}`).set(auth(fx.admin)).send({ planType: "Monthly" });
  assert.equal(badPlan.status, 400);
  const badBudget = await request(app).put(`/api/client/${A().client._id}`).set(auth(fx.admin)).send({ budget: -1 });
  assert.equal(badBudget.status, 400);
});

test("roster: validated, persisted across requests, isolated per client, capped", async () => {
  const add = (user, body) => request(app).post("/api/client/me/roster").set(auth(user)).send(body);
  const e1 = await add(A().user, { name: "  Rahul Sharma ", event: "Cricket", jerseySize: "L" });
  assert.equal(e1.status, 201);
  assert.equal(e1.body.entry.name, "Rahul Sharma");
  assert.equal(e1.body.entry.event, "Cricket");
  assert.equal(e1.body.entry.jerseySize, "L");
  assert.ok(e1.body.entry.createdAt);
  await add(A().user, { name: "Priya", jerseySize: "xs" });

  for (const body of [
    { name: "Bad", jerseySize: "XXXL" },
    { name: "", jerseySize: "M" },
    { name: "x".repeat(81), jerseySize: "M" },
    { jerseySize: "M" },
  ]) {
    assert.equal((await add(A().user, body)).status, 400, JSON.stringify(body).slice(0, 40));
  }

  const listA = await request(app).get("/api/client/me/roster").set(auth(A().user));
  assert.equal(listA.status, 200);
  assert.equal(listA.body.entries.length, 2);
  assert.equal(listA.body.entries.find((entry) => entry.name === "Rahul Sharma").event, "Cricket");
  assert.deepEqual(listA.body.entries.map((e) => e.jerseySize).sort(), ["L", "XS"]);

  const listB = await request(app).get("/api/client/me/roster").set(auth(B().user));
  assert.equal(listB.body.entries.length, 0);

  // B cannot delete A's entry by id.
  const steal = await request(app).delete(`/api/client/me/roster/${e1.body.entry._id}`).set(auth(B().user));
  assert.equal(steal.status, 404);
  assert.equal(await ClientRosterEntry.countDocuments({ clientId: A().client._id }), 2);

  const del = await request(app).delete(`/api/client/me/roster/${e1.body.entry._id}`).set(auth(A().user));
  assert.equal(del.status, 200);
  assert.equal((await request(app).get("/api/client/me/roster").set(auth(A().user))).body.entries.length, 1);

  assert.equal((await add(fx.itDev1.user, { name: "X", jerseySize: "M" })).status, 403);

  await ClientRosterEntry.insertMany(
    Array.from({ length: 199 }, (_, i) => ({ clientId: A().client._id, name: `P${i}`, jerseySize: "M" }))
  );
  const capped = await add(A().user, { name: "Overflow", jerseySize: "M" });
  assert.equal(capped.status, 409);
});

test("deleting a client removes its roster entries only", async () => {
  await request(app).post("/api/client/me/roster").set(auth(A().user)).send({ name: "Player A", jerseySize: "M" });
  await request(app).post("/api/client/me/roster").set(auth(B().user)).send({ name: "Player B", jerseySize: "S" });

  const deleted = await request(app).delete(`/api/client/${A().client._id}`).set(auth(fx.admin));
  assert.equal(deleted.status, 200);
  assert.equal(await ClientRosterEntry.countDocuments({ clientId: A().client._id }), 0);
  assert.equal(await ClientRosterEntry.countDocuments({ clientId: B().client._id }), 1);
});

test("gallery: admin uploads per client; clients read only their own (ids and ?userId ignored)", async () => {
  const uploadAuth = await request(app)
    .get(`/api/client/${A().client._id}/gallery/upload-auth`)
    .set(auth(fx.admin));
  assert.equal(uploadAuth.status, 200);
  assert.equal(uploadAuth.body.publicKey, "test_public");
  assert.ok(uploadAuth.body.authenticationParameters.signature);
  assert.equal(uploadAuth.body.folder, "client-gallery");

  const uploadedFile = (fileId, overrides = {}) => ({
    fileId,
    filePath: `/client-gallery/${fileId}.png`,
    url: `${process.env.IMAGEKIT_URL_ENDPOINT}/client-gallery/${fileId}.png`,
    fileType: "image",
    size: 50 * 1024 * 1024,
    ...overrides,
  });
  ikLog.files.push(uploadedFile("gallery-image"));
  const up = await request(app)
    .post(`/api/client/${A().client._id}/gallery`)
    .set(auth(fx.admin))
    .send({ fileId: "gallery-image", caption: "Opening ceremony" });
  assert.equal(up.status, 201);
  assert.equal(up.body.image.caption, "Opening ceremony");
  assert.equal(up.body.image.fileId, "gallery-image");

  ikLog.files.push(uploadedFile("not-image", { fileType: "non-image" }));
  const notImage = await request(app)
    .post(`/api/client/${A().client._id}/gallery`)
    .set(auth(fx.admin))
    .send({ fileId: "not-image" });
  assert.equal(notImage.status, 415);

  const clientUpload = await request(app)
    .post(`/api/client/${A().client._id}/gallery`)
    .set(auth(A().user))
    .send({ fileId: "gallery-image" });
  assert.equal(clientUpload.status, 403);

  ikLog.files.push(uploadedFile("too-large", { size: 50 * 1024 * 1024 + 1 }));
  const oversized = await request(app)
    .post(`/api/client/${A().client._id}/gallery`)
    .set(auth(fx.admin))
    .send({ fileId: "too-large" });
  assert.equal(oversized.status, 413);

  const meA = await request(app).get("/api/client/me/gallery").set(auth(A().user));
  assert.equal(meA.body.images.length, 1);
  assert.equal(meA.body.images[0].url, up.body.image.url);
  const meB = await request(app).get("/api/client/me/gallery").set(auth(B().user));
  assert.equal(meB.body.images.length, 0);

  // Legacy: B asking for A's images via ?userId gets B's own (empty) data.
  const legacyB = await request(app).get(`/api/client/images?userId=${A().user._id}`).set(auth(B().user));
  assert.equal(legacyB.status, 200);
  assert.deepEqual(legacyB.body.images, []);
  const legacyA = await request(app).get(`/api/client/images?userId=${B().user._id}`).set(auth(A().user));
  assert.deepEqual(legacyA.body.images, [up.body.image.url]);

  const adminLegacy = await request(app).get(`/api/client/images?userId=${A().user._id}`).set(auth(fx.admin));
  assert.deepEqual(adminLegacy.body.images, [up.body.image.url]);
  const adminNoUser = await request(app).get(`/api/client/images`).set(auth(fx.admin));
  assert.equal(adminNoUser.status, 400);

  assert.equal(
    (await request(app).get(`/api/client/${A().client._id}/gallery/upload-auth`).set(auth(A().user))).status,
    403
  );

  // B cannot use the admin gallery endpoints for A.
  assert.equal((await request(app).get(`/api/client/${A().client._id}/gallery`).set(auth(B().user))).status, 403);
  const wrongClientDelete = await request(app)
    .delete(`/api/client/${B().client._id}/gallery/${up.body.image._id}`)
    .set(auth(fx.admin));
  assert.equal(wrongClientDelete.status, 404);
  const del = await request(app).delete(`/api/client/${A().client._id}/gallery/${up.body.image._id}`).set(auth(fx.admin));
  assert.equal(del.status, 200);
  assert.ok(ikLog.deletes.includes("gallery-image"));
});

test("shared gallery: admins publish month-scoped images visible to every client", async () => {
  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.ORG_TIMEZONE || "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const previousMonth = new Date(Date.UTC(
    Number(nowParts.find((part) => part.type === "year").value),
    Number(nowParts.find((part) => part.type === "month").value) - 2,
    1
  ));
  const month = `${previousMonth.getUTCFullYear()}-${String(previousMonth.getUTCMonth() + 1).padStart(2, "0")}`;
  const image = {
    fileId: "shared-last-month",
    filePath: "/client-gallery/shared-last-month.png",
    url: `${process.env.IMAGEKIT_URL_ENDPOINT}/client-gallery/shared-last-month.png`,
    fileType: "image",
    size: 50 * 1024 * 1024,
  };
  ikLog.files.push(image);

  const credentials = await request(app)
    .get("/api/client/gallery/shared/upload-auth")
    .set(auth(fx.admin));
  assert.equal(credentials.status, 200);
  assert.equal(credentials.body.maxFileBytes, 50 * 1024 * 1024);
  assert.equal((await request(app).get("/api/client/gallery/shared/upload-auth").set(auth(A().user))).status, 403);

  const uploaded = await request(app)
    .post("/api/client/gallery/shared")
    .set(auth(fx.admin))
    .send({ fileId: image.fileId, month, caption: "Tournament finals" });
  assert.equal(uploaded.status, 201);
  assert.equal(uploaded.body.image.audience, "allClients");
  assert.equal(uploaded.body.image.galleryMonth, month);

  for (const client of [A(), B()]) {
    const gallery = await request(app).get("/api/client/me/gallery").set(auth(client.user));
    assert.equal(gallery.status, 200);
    assert.deepEqual(gallery.body.sharedImages.map((entry) => entry.fileId), [image.fileId]);
    assert.equal(gallery.body.galleryMonth, month);
  }

  const adminGallery = await request(app)
    .get(`/api/client/gallery/shared?month=${month}`)
    .set(auth(fx.admin));
  assert.equal(adminGallery.status, 200);
  assert.equal(adminGallery.body.images.length, 1);
  assert.equal((await request(app).get("/api/client/gallery/shared?month=invalid").set(auth(fx.admin))).status, 400);
  assert.equal(
    (await request(app).delete(`/api/client/gallery/shared/${uploaded.body.image._id}`).set(auth(fx.admin))).status,
    200
  );
});

test("performance: empty until entered (no sample data); admin PUT replaces; isolation", async () => {
  const emptyA = await request(app).get("/api/client/me/performance").set(auth(A().user));
  assert.equal(emptyA.status, 200);
  assert.deepEqual(emptyA.body.standings, []);
  assert.equal(emptyA.body.updatedAt, null);
  const legacyEmpty = await request(app).get(`/api/client/performance?userId=${A().user._id}`).set(auth(A().user));
  assert.deepEqual(legacyEmpty.body.performance, []);

  const standings = [
    { teamName: "Super Teacher", played: 12, won: 10, lost: 2, points: 30 },
    { teamName: "Delta Strikers", played: 12, won: 5, lost: 6, points: 16 },
  ];
  const put = await request(app).put(`/api/client/${A().client._id}/performance`).set(auth(fx.admin)).send({ standings });
  assert.equal(put.status, 200);
  assert.equal(put.body.standings.length, 2);
  assert.ok(put.body.updatedAt);

  for (const bad of [
    [{ teamName: "X", played: -1, won: 0, lost: 0, points: 0 }],
    [{ teamName: "X", played: 1.5, won: 0, lost: 0, points: 0 }],
    [{ teamName: "X", played: 2, won: 2, lost: 1, points: 6 }],
    [{ teamName: "", played: 1, won: 1, lost: 0, points: 3 }],
    [{ teamName: "X", played: 1, won: 1, lost: 0, points: 3 }, { teamName: "x", played: 1, won: 0, lost: 1, points: 0 }],
    "not-an-array",
  ]) {
    const r = await request(app).put(`/api/client/${A().client._id}/performance`).set(auth(fx.admin)).send({ standings: bad });
    assert.equal(r.status, 400, JSON.stringify(bad).slice(0, 60));
  }

  const meA = await request(app).get("/api/client/me/performance").set(auth(A().user));
  assert.deepEqual(meA.body.standings.map((s) => s.teamName), ["Super Teacher", "Delta Strikers"]);
  const meB = await request(app).get("/api/client/me/performance").set(auth(B().user));
  assert.deepEqual(meB.body.standings, []);
  const legacyBforA = await request(app).get(`/api/client/performance?userId=${A().user._id}`).set(auth(B().user));
  assert.deepEqual(legacyBforA.body.performance, []);
  const adminLegacy = await request(app).get(`/api/client/performance?userId=${A().user._id}`).set(auth(fx.admin));
  assert.equal(adminLegacy.body.performance.length, 2);

  assert.equal((await request(app).put(`/api/client/${A().client._id}/performance`).set(auth(A().user)).send({ standings })).status, 403);
  assert.equal((await request(app).get(`/api/client/performance`).set(auth(fx.itDev1.user))).status, 403);

  // Replace with an empty table.
  const cleared = await request(app).put(`/api/client/${A().client._id}/performance`).set(auth(fx.admin)).send({ standings: [] });
  assert.deepEqual(cleared.body.standings, []);
});

test("shared performance standings are visible to every client and editable by admins only", async () => {
  const empty = await request(app).get("/api/client/shared/performance").set(auth(A().user));
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.standings, []);
  assert.equal(empty.body.updatedAt, null);

  const standings = [
    { teamName: "Champions", played: 8, won: 6, lost: 2, points: 18 },
  ];
  const saved = await request(app)
    .put("/api/client/shared/performance")
    .set(auth(fx.admin))
    .send({ standings });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.standings.length, 1);
  assert.ok(saved.body.updatedAt);

  const clientA = await request(app).get("/api/client/shared/performance").set(auth(A().user));
  const clientB = await request(app).get("/api/client/shared/performance").set(auth(B().user));
  const expected = standings.map(({ teamName, played, won, lost, points }) => ({ teamName, played, won, lost, points }));
  assert.deepEqual(clientA.body.standings.map(({ teamName, played, won, lost, points }) => ({ teamName, played, won, lost, points })), expected);
  assert.deepEqual(clientB.body.standings.map(({ teamName, played, won, lost, points }) => ({ teamName, played, won, lost, points })), expected);
  assert.equal((await request(app).put("/api/client/shared/performance").set(auth(A().user)).send({ standings })).status, 403);
  assert.equal((await request(app).get("/api/client/shared/performance").set(auth(fx.itDev1.user))).status, 403);
});

test("admin add client validates input; delete removes roster, gallery and standings", async () => {
  const missingLogo = await request(app).post("/api/client/add").set(auth(fx.admin))
    .field("name", "Client C").field("email", "c@test.local").field("password", "Passw0rd!!")
    .field("planType", "Annual").field("budget", "1000").field("dateOfJoining", "2026-03-01");
  assert.equal(missingLogo.status, 400);
  const missingClientId = await request(app).post("/api/client/add").set(auth(fx.admin))
    .field("name", "Client C").field("email", "c@test.local").field("password", "Passw0rd!!")
    .field("planType", "Annual").field("budget", "1000").field("dateOfJoining", "2026-03-01")
    .attach("companyLogo", PNG_BYTES, { filename: "l.png", contentType: "image/png" });
  assert.equal(missingClientId.status, 400);
  const shortPw = await request(app).post("/api/client/add").set(auth(fx.admin))
    .field("name", "Client C").field("email", "c@test.local").field("password", "short")
    .field("planType", "Annual").field("budget", "1000").field("dateOfJoining", "2026-03-01")
    .attach("companyLogo", PNG_BYTES, { filename: "l.png", contentType: "image/png" });
  assert.equal(shortPw.status, 400);
  const added = await request(app).post("/api/client/add").set(auth(fx.admin))
    .field("name", "Client C").field("email", "C@Test.local").field("password", "Passw0rd!!")
    .field("clientId", "  club-001 ")
    .field("planType", "Annual").field("budget", "1000").field("dateOfJoining", "2026-03-01")
    .attach("companyLogo", PNG_BYTES, { filename: "l.png", contentType: "image/png" });
  assert.equal(added.status, 201);
  assert.equal(added.body.client.userId.email, "c@test.local");
  assert.equal(added.body.client.clientId, "CLUB-001");
  const duplicateClientId = await request(app).post("/api/client/add").set(auth(fx.admin))
    .field("name", "Client D").field("email", "d@test.local").field("password", "Passw0rd!!")
    .field("clientId", "club-001")
    .field("planType", "Annual").field("budget", "1000").field("dateOfJoining", "2026-03-01")
    .attach("companyLogo", PNG_BYTES, { filename: "l.png", contentType: "image/png" });
  assert.equal(duplicateClientId.status, 409);
  const invalidClientId = await request(app).post("/api/client/add").set(auth(fx.admin))
    .field("name", "Client E").field("email", "e@test.local").field("password", "Passw0rd!!")
    .field("clientId", "invalid id!")
    .field("planType", "Annual").field("budget", "1000").field("dateOfJoining", "2026-03-01")
    .attach("companyLogo", PNG_BYTES, { filename: "l.png", contentType: "image/png" });
  assert.equal(invalidClientId.status, 400);
  const dupEmail = await request(app).post("/api/client/add").set(auth(fx.admin))
    .field("name", "Client D").field("email", "c@test.local").field("password", "Passw0rd!!")
    .field("clientId", "CLUB-002")
    .field("planType", "Annual").field("budget", "1000").field("dateOfJoining", "2026-03-01")
    .attach("companyLogo", PNG_BYTES, { filename: "l.png", contentType: "image/png" });
  assert.equal(dupEmail.status, 409);

  await request(app).post("/api/client/me/roster").set(auth(A().user)).send({ name: "P", jerseySize: "M" });
  await request(app).post(`/api/client/${A().client._id}/gallery`).set(auth(fx.admin))
    .attach("image", PNG_BYTES, { filename: "p.png", contentType: "image/png" });
  await request(app).put(`/api/client/${A().client._id}/performance`).set(auth(fx.admin))
    .send({ standings: [{ teamName: "T", played: 1, won: 1, lost: 0, points: 3 }] });
  await request(app).post("/api/client/me/roster").set(auth(B().user)).send({ name: "Q", jerseySize: "S" });

  const del = await request(app).delete(`/api/client/${A().client._id}`).set(auth(fx.admin));
  assert.equal(del.status, 200);
  assert.equal(await Client.countDocuments({ _id: A().client._id }), 0);
  assert.equal(await User.countDocuments({ _id: A().user._id }), 0);
  assert.equal(await ClientRosterEntry.countDocuments({ clientId: A().client._id }), 0);
  assert.equal(await ClientGalleryImage.countDocuments({ clientId: A().client._id }), 0);
  assert.equal(await ClientStanding.countDocuments({ clientId: A().client._id }), 0);
  // Client B's data is untouched.
  assert.equal(await ClientRosterEntry.countDocuments({ clientId: B().client._id }), 1);
});

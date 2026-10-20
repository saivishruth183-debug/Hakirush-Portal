import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearDb, getApp, seedFixtures, auth } from "./helpers/testEnv.js";
import { __testHooks } from "../services/emailService.js";

let app, fx, ExpenseClaim, Notification;
let capturedEmails;

before(async () => {
  await startTestDb();
  app = await getApp();
  ExpenseClaim = (await import("../models/ExpenseClaim.js")).default;
  Notification = (await import("../models/Notification.js")).default;
});

after(async () => {
  __testHooks.captureExpenseStatusEmail = null;
  await stopTestDb();
});

beforeEach(async () => {
  await clearDb();
  fx = await seedFixtures();
  capturedEmails = [];
  __testHooks.captureExpenseStatusEmail = async (email) => capturedEmails.push(email);
});

const makeClaim = (employee) => ExpenseClaim.create({
  employeeId: employee._id,
  title: "Taxi to client",
  category: "Travel",
  amount: 850,
  date: "2026-10-19",
  receiptUrl: "https://example.test/receipt.png",
});

const review = (user, claimId, decision, remarks = "") =>
  request(app)
    .put(`/api/expenses/${claimId}/review`)
    .set(auth(user))
    .send({ decision, remarks });

test("reviewing an expense notifies and emails the employee for approval and rejection", async () => {
  for (const decision of ["Approved", "Rejected"]) {
    const claim = await makeClaim(fx.itDev1.employee);
    const result = await review(fx.admin, claim._id, decision, "Reviewed receipt");

    assert.equal(result.status, 200);
    assert.equal(result.body.claim.status, decision);

    const notification = await Notification.findOne({
      type: "expense-status",
      "data.userId": fx.itDev1.user._id,
      "data.claimId": claim._id,
    });
    assert.ok(notification);
    assert.match(notification.message, new RegExp(`was ${decision.toLowerCase()}`));
    assert.equal(notification.seen, false);

    const email = capturedEmails.at(-1);
    assert.equal(email.employeeUser.email, fx.itDev1.user.email);
    assert.equal(email.claim.title, claim.title);
    assert.equal(email.status, decision);
    assert.equal(email.remarks, "Reviewed receipt");
  }
});

test("an expense review can only be submitted once", async () => {
  const claim = await makeClaim(fx.itDev1.employee);

  assert.equal((await review(fx.admin, claim._id, "Approved")).status, 200);
  const duplicate = await review(fx.admin, claim._id, "Rejected");

  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "ALREADY_REVIEWED");
  assert.equal(capturedEmails.length, 1);
  assert.equal(await Notification.countDocuments({ type: "expense-status" }), 1);
});

// Optional `Idempotency-Key` support for state-changing requests.
// - First request with a key: runs, and a 2xx response is stored for ~48h.
// - Retried request (same user + key + operation): the stored response is replayed.
// - Same key used for a different operation: 409 CONFLICT.
// - Concurrent duplicate while the first is still running: waits briefly for
//   it to finish, then replays (or 409 if it is still running).
// Failed (non-2xx) executions are not stored, so a retry re-executes; the
// attendance transitions themselves are idempotent, so this is safe.
import IdempotencyRecord from "../models/IdempotencyRecord.js";
import { badRequest, conflict } from "../middleware/errorHandler.js";

const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/;
const WAIT_STEPS = 20;
const WAIT_MS = 100;
// A "pending" claim older than this is treated as abandoned (e.g. the process
// died mid-request) and may be taken over by a retry.
const STALE_PENDING_MS = 30 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const readIdempotencyKey = (req) => {
  const raw = req.get("Idempotency-Key");
  if (raw === undefined) return null;
  const key = String(raw).trim();
  if (!KEY_PATTERN.test(key)) {
    throw badRequest("Idempotency-Key must be 8-128 characters of letters, digits, '-', '_', '.', ':'");
  }
  return key;
};

const toJson = (body) => JSON.parse(JSON.stringify(body));

/**
 * @param {{userId, key: string|null, scope: string}} ctx
 * @param {() => Promise<{status:number, body:object}>} run
 * @returns {Promise<{status:number, body:object, replayed:boolean}>}
 */
export const withIdempotency = async ({ userId, key, scope }, run) => {
  if (!key) {
    const result = await run();
    return { ...result, replayed: false };
  }

  let claimed = false;
  try {
    await IdempotencyRecord.create({ userId, key, scope, state: "pending" });
    claimed = true;
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }

  if (!claimed) {
    for (let i = 0; i < WAIT_STEPS; i += 1) {
      const rec = await IdempotencyRecord.findOne({ userId, key }).lean();
      if (!rec) break; // the first attempt failed and released the key: execute now
      if (rec.scope !== scope) {
        throw conflict("Idempotency-Key was already used for a different request", "CONFLICT");
      }
      if (rec.state === "done") {
        return { status: rec.statusCode, body: rec.body, replayed: true };
      }
      if (Date.now() - new Date(rec.createdAt).getTime() > STALE_PENDING_MS) {
        await IdempotencyRecord.deleteOne({ _id: rec._id, state: "pending" });
        break;
      }
      await sleep(WAIT_MS);
    }
    const rec = await IdempotencyRecord.findOne({ userId, key }).lean();
    if (rec) {
      if (rec.state === "done" && rec.scope === scope) {
        return { status: rec.statusCode, body: rec.body, replayed: true };
      }
      throw conflict("A request with this Idempotency-Key is still in progress", "CONFLICT");
    }
    // Released: try to claim again (once).
    try {
      await IdempotencyRecord.create({ userId, key, scope, state: "pending" });
      claimed = true;
    } catch (err) {
      if (err?.code !== 11000) throw err;
      throw conflict("A request with this Idempotency-Key is still in progress", "CONFLICT");
    }
  }

  let result;
  try {
    result = await run();
  } catch (err) {
    await IdempotencyRecord.deleteOne({ userId, key, state: "pending" }).catch(() => {});
    throw err;
  }

  if (result.status >= 200 && result.status < 300) {
    const body = toJson(result.body);
    await IdempotencyRecord.updateOne(
      { userId, key },
      { $set: { state: "done", statusCode: result.status, body } }
    );
    return { status: result.status, body, replayed: false };
  }
  await IdempotencyRecord.deleteOne({ userId, key, state: "pending" }).catch(() => {});
  return { ...result, replayed: false };
};

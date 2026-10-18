// Helpers for the attendance / leave / payslip / client integration tests.
// Uses only the in-memory DB from testEnv.js; no network, no real ImageKit.

// Build every index the domain tests rely on (unique keys etc.) before use.
export const ensureDomainIndexes = async () => {
  const models = await Promise.all([
    import("../../models/Attendance.js"),
    import("../../models/AttendanceRequest.js"),
    import("../../models/Leave.js"),
    import("../../models/Payslip.js"),
    import("../../models/IdempotencyRecord.js"),
    import("../../models/ClientRosterEntry.js"),
    import("../../models/ClientGalleryImage.js"),
    import("../../models/ClientStanding.js"),
  ]);
  for (const m of models) await m.default.init();
};

// Pins the server clock used by the domain services (services/clock.js).
export const setClock = async (value) => {
  const clock = await import("../../services/clock.js");
  clock.setClock(value);
};

// Every seeded employee joined on 2026-01-01 (fixtures default to "now").
export const setJoiningDates = async (ymd = "2026-01-01") => {
  const Employee = (await import("../../models/Employee.js")).default;
  await Employee.updateMany({}, { $set: { dateOfJoining: new Date(`${ymd}T00:00:00.000Z`) } });
};

// IST helper: "2026-09-15 09:00" (Asia/Kolkata) -> Date.
export const ist = (ymdHm) => new Date(`${ymdHm.replace(" ", "T")}:00+05:30`);

export const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);
export const pdfBytes = (size = 1024) => {
  const head = Buffer.from("%PDF-1.4\n", "latin1");
  return Buffer.concat([head, Buffer.alloc(Math.max(0, size - head.length), 0x20)]);
};

/**
 * Replaces the ImageKit client with an in-memory fake. Signing uses the real
 * SDK URL builder (pure computation with the test keys). Returns the call log.
 */
export const installFakeImageKit = async () => {
  const { setImageKitClient } = await import("../../utils/uploadToImageKit.js");
  const real = (await import("../../config/imagekit.js")).default;
  // `files` simulates objects already in the ImageKit library (for listFiles).
  const log = { uploads: [], deletes: [], listCalls: [], files: [] };
  let n = 0;
  setImageKitClient({
    upload: async (params) => {
      n += 1;
      log.uploads.push({ ...params, file: undefined, size: params.file?.length });
      const filePath = `/${params.folder}/${n}-${params.fileName}`;
      return { url: `${process.env.IMAGEKIT_URL_ENDPOINT}${filePath}`, fileId: `file_${n}`, filePath };
    },
    getAuthenticationParameters: (...args) => real.getAuthenticationParameters(...args),
    getFileDetails: async (fileId) => {
      const file = log.files.find((item) => item.fileId === fileId);
      if (!file) throw new Error("File not found");
      return file;
    },
    deleteFile: async (fileId) => {
      log.deletes.push(fileId);
      return {};
    },
    listFiles: async (opts) => {
      log.listCalls.push(opts);
      return log.files.filter((f) => f.filePath.startsWith(`${opts.path}/`));
    },
    url: (opts) => real.url(opts),
  });
  return log;
};

// A fetch Response whose body is streamed in chunks without a content-length header.
export const streamedResponse = (chunks, { status = 200, onPull } = {}) => {
  let i = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (typeof chunks === "function") {
        const next = chunks(i++);
        if (next === null) controller.close();
        else {
          onPull?.(next.length);
          controller.enqueue(next);
        }
        return;
      }
      if (i >= chunks.length) return controller.close();
      onPull?.(chunks[i].length);
      controller.enqueue(chunks[i++]);
    },
  });
  return new Response(stream, { status, headers: { "content-type": "application/pdf" } });
};

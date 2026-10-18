import Client from "../models/Client.js";
import User from "../models/User.js";
import ClientRosterEntry, { JERSEY_SIZES, ROSTER_MAX_ENTRIES, ROSTER_NAME_MAX } from "../models/ClientRosterEntry.js";
import ClientGalleryImage, { GALLERY_CAPTION_MAX } from "../models/ClientGalleryImage.js";
import ClientStanding, { STANDINGS_MAX_ROWS, TEAM_NAME_MAX } from "../models/ClientStanding.js";
import bcrypt from "bcrypt";
import uploadToImageKit, { deleteFromImageKit, getImageKitClient } from "../utils/uploadToImageKit.js";
import { ApiError, asyncHandler } from "../middleware/errorHandler.js";

const CLIENT_GALLERY_MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const CLIENT_GALLERY_FOLDER = "client-gallery";

const lastMonthKey = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.ORG_TIMEZONE || "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
};

const isValidMonth = (month) => typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

const getImageKitUploadAuth = () => {
  if (!process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_PRIVATE_KEY) {
    throw new ApiError(503, "Image uploads are not configured", "UPLOAD_UNAVAILABLE");
  }
  const expire = Math.floor(Date.now() / 1000) + 5 * 60;
  const authenticationParameters = getImageKitClient().getAuthenticationParameters(undefined, expire);
  if (!authenticationParameters.signature) {
    throw new ApiError(503, "Image uploads are not configured", "UPLOAD_UNAVAILABLE");
  }
  return {
    success: true,
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    uploadEndpoint: "https://upload.imagekit.io/api/v1/files/upload",
    folder: CLIENT_GALLERY_FOLDER,
    maxFileBytes: CLIENT_GALLERY_MAX_IMAGE_BYTES,
    authenticationParameters,
  };
};

const verifyGalleryUpload = async (fileId) => {
  let stored;
  try {
    stored = await getImageKitClient().getFileDetails(fileId);
  } catch (error) {
    console.error("[IMAGEKIT] gallery file verification failed:", error?.message || "unknown error");
    throw new ApiError(502, "Could not verify uploaded image", "UPLOAD_VERIFICATION_FAILED");
  }

  if (
    stored.fileId !== fileId ||
    typeof stored.filePath !== "string" ||
    !stored.filePath.startsWith(`/${CLIENT_GALLERY_FOLDER}/`)
  ) {
    throw new ApiError(400, "Uploaded file is not in the client gallery", "INVALID_UPLOAD");
  }
  if (stored.fileType !== "image") {
    await deleteFromImageKit(fileId);
    throw new ApiError(415, "Only image files are allowed", "UNSUPPORTED_FILE");
  }
  if (!Number.isSafeInteger(stored.size) || stored.size > CLIENT_GALLERY_MAX_IMAGE_BYTES) {
    await deleteFromImageKit(fileId);
    throw new ApiError(413, "Image must be 50 MB or smaller", "FILE_TOO_LARGE");
  }

  try {
    const endpoint = new URL(process.env.IMAGEKIT_URL_ENDPOINT);
    const uploadedUrl = new URL(stored.url);
    const endpointPath = endpoint.pathname.replace(/\/+$/, "");
    if (
      endpoint.protocol !== "https:" ||
      uploadedUrl.origin !== endpoint.origin ||
      !uploadedUrl.pathname.startsWith(`${endpointPath}/${CLIENT_GALLERY_FOLDER}/`)
    ) {
      throw new Error("Uploaded image URL is outside the configured ImageKit gallery");
    }
    return { filePath: stored.filePath, url: uploadedUrl.toString() };
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError(503, "Image uploads are not configured", "UPLOAD_UNAVAILABLE");
    }
    throw new ApiError(400, "Uploaded image URL is invalid", "INVALID_UPLOAD");
  }
};

const getStandingsForClient = async (clientId) => {
  const record = await ClientStanding.findOne({ clientId }).lean();
  return {
    success: true,
    standings: record?.standings || [],
    updatedAt: record?.updatedAt || null,
  };
};

const validateRosterEntry = (body = {}) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > ROSTER_NAME_MAX) {
    throw new ApiError(400, `Name must be 1-${ROSTER_NAME_MAX} characters`, "VALIDATION_ERROR");
  }

  const jerseySize = typeof body.jerseySize === "string" ? body.jerseySize.trim().toUpperCase() : "";
  if (!JERSEY_SIZES.includes(jerseySize)) {
    throw new ApiError(400, "Choose a valid jersey size", "VALIDATION_ERROR");
  }

  const event = body.event === undefined ? "" : typeof body.event === "string" ? body.event.trim() : null;
  if (event === null || event.length > ROSTER_NAME_MAX) {
    throw new ApiError(400, `Event must be at most ${ROSTER_NAME_MAX} characters`, "VALIDATION_ERROR");
  }

  return { name, event, jerseySize };
};

const getMyRosterClient = async (userId) => {
  const client = await Client.findOne({ userId });
  if (!client) throw new ApiError(404, "Client not found", "NOT_FOUND");
  return client;
};

const getMyClientRoster = asyncHandler(async (req, res) => {
  const client = await getMyRosterClient(req.user._id);
  const entries = await ClientRosterEntry.find({ clientId: client._id }).sort({ createdAt: -1, _id: -1 });
  return res.json({ success: true, entries });
});

const addMyClientRosterEntry = asyncHandler(async (req, res) => {
  const client = await getMyRosterClient(req.user._id);
  const entryData = validateRosterEntry(req.body);
  const count = await ClientRosterEntry.countDocuments({ clientId: client._id });
  if (count >= ROSTER_MAX_ENTRIES) {
    throw new ApiError(409, `Roster is limited to ${ROSTER_MAX_ENTRIES} entries`, "ROSTER_LIMIT_REACHED");
  }
  const entry = await ClientRosterEntry.create({
    clientId: client._id,
    ...entryData,
    createdBy: req.user._id,
  });
  return res.status(201).json({ success: true, entry });
});

const deleteMyClientRosterEntry = asyncHandler(async (req, res) => {
  const client = await getMyRosterClient(req.user._id);
  const entry = await ClientRosterEntry.findOneAndDelete({
    _id: req.params.entryId,
    clientId: client._id,
  });
  if (!entry) throw new ApiError(404, "Roster entry not found", "NOT_FOUND");
  return res.json({ success: true, message: "Roster entry deleted" });
});

const validateStandings = (standings) => {
  if (!Array.isArray(standings) || standings.length > STANDINGS_MAX_ROWS) {
    throw new ApiError(400, `Standings must contain 0-${STANDINGS_MAX_ROWS} rows`, "VALIDATION_ERROR");
  }
  const seen = new Set();
  return standings.map((row, index) => {
    const teamName = typeof row?.teamName === "string" ? row.teamName.trim() : "";
    if (!teamName || teamName.length > TEAM_NAME_MAX) {
      throw new ApiError(400, `Row ${index + 1}: team name must be 1-${TEAM_NAME_MAX} characters`, "VALIDATION_ERROR");
    }
    const key = teamName.toLocaleLowerCase();
    if (seen.has(key)) throw new ApiError(400, `Row ${index + 1}: duplicate team name`, "VALIDATION_ERROR");
    seen.add(key);

    const numbers = {};
    for (const field of ["played", "won", "lost", "points"]) {
      if (!Number.isSafeInteger(row[field]) || row[field] < 0) {
        throw new ApiError(400, `Row ${index + 1}: ${field} must be a non-negative whole number`, "VALIDATION_ERROR");
      }
      numbers[field] = row[field];
    }
    if (numbers.won + numbers.lost > numbers.played) {
      throw new ApiError(400, `Row ${index + 1}: won + lost cannot exceed played`, "VALIDATION_ERROR");
    }
    return { teamName, ...numbers };
  });
};

/* ================= ADD CLIENT ================= */
const addClient = async (req, res) => {
  try {
    const {
      name,
      clientId: submittedClientId,
      email,
      password,
      dateOfJoining,
      planType,
      budget,
    } = req.body;

    /* ===== VALIDATION ===== */
    if (!name || !email || !password || !submittedClientId) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const clientId = String(submittedClientId).trim().toUpperCase();
    if (clientId.length > 32 || !/^[A-Z0-9][A-Z0-9_-]*$/.test(clientId)) {
      return res.status(400).json({
        error: "Client ID must be 1-32 characters and use only letters, numbers, hyphens, or underscores",
      });
    }
    if (await Client.exists({ clientId })) {
      return res.status(409).json({ error: "Client ID already exists" });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ error: "Company logo required" });
    }

    /* ===== CHECK USER ===== */
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already exists" });
    }

    /* ===== HASH PASSWORD ===== */
    const hashedPassword = await bcrypt.hash(password, 10);

    /* ===== CREATE USER ===== */
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "client",
    });

    /* ===== UPLOAD LOGO ===== */
    const logoUrl = await uploadToImageKit(req.file, "clients");

    /* ===== CREATE CLIENT ===== */
    const createdClient = await Client.create({
      userId: user._id,
      clientId,
      name,
      email,
      dateOfJoining,
      planType,
      budget,
      companyLogo: logoUrl,
    });
    const client = await Client.findById(createdClient._id).populate("userId", "-password");

    res.status(201).json({
      success: true,
      client,
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.clientId) {
      return res.status(409).json({ error: "Client ID already exists" });
    }
    console.error("ADD CLIENT ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

/* ================= GET ALL CLIENTS ================= */
const getClients = async (req, res) => {
  try {
    const clients = await Client.find().populate("userId", "-password");
    res.json({ success: true, clients });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ================= GET SINGLE CLIENT ================= */
const getClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).populate(
      "userId",
      "-password"
    );
    if (!client) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }
    res.json({ success: true, client });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ================= GET LOGGED-IN CLIENT ================= */
const getMyClient = async (req, res) => {
  try {
    const client = await Client.findOne({ userId: req.user.id }).populate(
      "userId",
      "-password"
    );
    if (!client) {
      return res.status(404).json({ success: false });
    }
    res.json({ success: true, client });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ================= UPDATE CLIENT ================= */
const updateClient = async (req, res) => {
  try {
    const { budget, planType } = req.body;

    const update = {};

    if (budget !== undefined) update.budget = budget;

    if (planType !== undefined) {
      if (!["Annual", "Quarterly"].includes(planType)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid plan type" });
      }
      update.planType = planType;
    }

    if (req.file?.buffer) {
      update.companyLogo = await uploadToImageKit(req.file, "clients");
    }

    update.updatedAt = new Date();

    await Client.findByIdAndUpdate(req.params.id, update);

    res.json({ success: true, message: "Client updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ================= DELETE CLIENT ================= */
const deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }

    await User.findByIdAndDelete(client.userId);
    await ClientRosterEntry.deleteMany({ clientId: client._id });
    await ClientGalleryImage.deleteMany({ clientId: client._id });
    await ClientStanding.deleteMany({ clientId: client._id });
    await Client.findByIdAndDelete(client._id);

    res.json({ success: true, message: "Client deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getClientPerformance = async (req, res) => {
  try {
    const userId = req.user.role === "admin" ? req.query.userId : req.user._id;
    if (!userId) return res.status(400).json({ success: false, error: "userId is required" });
    const client = await Client.findOne({ userId });
    if (!client) return res.status(404).json({ success: false, error: "Client not found" });
    const result = await getStandingsForClient(client._id);
    return res.json({ success: true, performance: result.standings, updatedAt: result.updatedAt });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ================= GET CLIENT IMAGES ================= */
const getClientImages = async (req, res) => {
  try {
    const requestedUserId = req.query.userId;
    const userId = req.user.role === "admin" ? requestedUserId : req.user.id;
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }
    if (req.user.role !== "admin" && String(userId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, error: "Access denied", code: "FORBIDDEN" });
    }
    const client = await Client.findOne({ userId });
    if (!client) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }
    const images = await ClientGalleryImage.find({ clientId: client._id })
      .sort({ createdAt: -1 })
      .select("url");
    res.json({ success: true, images: images.map((image) => image.url) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getClientGallery = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) throw new ApiError(404, "Client not found", "NOT_FOUND");
  const images = await ClientGalleryImage.find({
    clientId: req.params.id,
    $or: [{ audience: "client" }, { audience: { $exists: false } }],
  }).sort({ createdAt: -1 });
  return res.json({ success: true, images });
});

const getClientGalleryUploadAuth = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) throw new ApiError(404, "Client not found", "NOT_FOUND");
  return res.json(getImageKitUploadAuth());
});

const getSharedGalleryUploadAuth = asyncHandler(async (req, res) =>
  res.json(getImageKitUploadAuth())
);

const getMyClientGallery = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ userId: req.user._id });
  if (!client) throw new ApiError(404, "Client not found", "NOT_FOUND");
  const galleryMonth = lastMonthKey();
  const [images, sharedImages] = await Promise.all([
    ClientGalleryImage.find({
      clientId: client._id,
      $or: [{ audience: "client" }, { audience: { $exists: false } }],
    }).sort({ createdAt: -1 }),
    ClientGalleryImage.find({ audience: "allClients", galleryMonth }).sort({ createdAt: -1 }),
  ]);
  return res.json({ success: true, images, sharedImages, galleryMonth });
});

const uploadClientGalleryImage = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) throw new ApiError(404, "Client not found", "NOT_FOUND");

  const caption = req.body.caption ?? "";
  if (typeof caption !== "string" || caption.trim().length > GALLERY_CAPTION_MAX) {
    throw new ApiError(400, `Caption must be ${GALLERY_CAPTION_MAX} characters or fewer`, "VALIDATION_ERROR");
  }

  const fileId = req.body.fileId;
  if (typeof fileId !== "string" || !fileId.trim()) {
    throw new ApiError(400, "Uploaded image is required", "VALIDATION_ERROR");
  }

  const stored = await verifyGalleryUpload(fileId);

  try {
    const image = await ClientGalleryImage.create({
      clientId: client._id,
      url: stored.url,
      fileId,
      filePath: stored.filePath,
      caption: caption.trim(),
      uploadedBy: req.user._id,
    });
    return res.status(201).json({ success: true, image });
  } catch (error) {
    await deleteFromImageKit(fileId);
    throw error;
  }
});

const getSharedGallery = asyncHandler(async (req, res) => {
  const month = req.query.month;
  if (!isValidMonth(month)) throw new ApiError(400, "month must use YYYY-MM format", "VALIDATION_ERROR");
  const images = await ClientGalleryImage.find({ audience: "allClients", galleryMonth: month }).sort({ createdAt: -1 });
  return res.json({ success: true, images, galleryMonth: month });
});

const uploadSharedGalleryImage = asyncHandler(async (req, res) => {
  const { fileId, caption = "", month } = req.body;
  if (!isValidMonth(month)) throw new ApiError(400, "month must use YYYY-MM format", "VALIDATION_ERROR");
  if (typeof caption !== "string" || caption.trim().length > GALLERY_CAPTION_MAX) {
    throw new ApiError(400, `Caption must be ${GALLERY_CAPTION_MAX} characters or fewer`, "VALIDATION_ERROR");
  }
  if (typeof fileId !== "string" || !fileId.trim()) {
    throw new ApiError(400, "Uploaded image is required", "VALIDATION_ERROR");
  }

  const stored = await verifyGalleryUpload(fileId);
  try {
    const image = await ClientGalleryImage.create({
      audience: "allClients",
      galleryMonth: month,
      url: stored.url,
      fileId,
      filePath: stored.filePath,
      caption: caption.trim(),
      uploadedBy: req.user._id,
    });
    return res.status(201).json({ success: true, image });
  } catch (error) {
    await deleteFromImageKit(fileId);
    throw error;
  }
});

const deleteSharedGalleryImage = asyncHandler(async (req, res) => {
  const image = await ClientGalleryImage.findOneAndDelete({
    _id: req.params.imageId,
    audience: "allClients",
  });
  if (!image) throw new ApiError(404, "Shared gallery image not found", "NOT_FOUND");
  await deleteFromImageKit(image.fileId);
  return res.json({ success: true, message: "Image deleted" });
});

const getMyClientPerformance = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ userId: req.user._id });
  if (!client) throw new ApiError(404, "Client not found", "NOT_FOUND");
  return res.json(await getStandingsForClient(client._id));
});

const getClientStandings = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) throw new ApiError(404, "Client not found", "NOT_FOUND");
  return res.json(await getStandingsForClient(client._id));
});

const updateClientStandings = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) throw new ApiError(404, "Client not found", "NOT_FOUND");
  const standings = validateStandings(req.body?.standings);
  const record = await ClientStanding.findOneAndUpdate(
    { clientId: client._id },
    { $set: { standings, updatedBy: req.user._id } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return res.json({ success: true, standings: record.standings, updatedAt: record.updatedAt });
});

const deleteClientGalleryImage = asyncHandler(async (req, res) => {
  const image = await ClientGalleryImage.findOneAndDelete({
    _id: req.params.imageId,
    clientId: req.params.id,
  });
  if (!image) throw new ApiError(404, "Gallery image not found", "NOT_FOUND");
  await deleteFromImageKit(image.fileId);
  return res.json({ success: true, message: "Image deleted" });
});

export {
  addClient,
  getClients,
  getClient,
  getMyClient,
  updateClient,
  deleteClient,
  getClientPerformance,
  getClientImages,
  getClientGallery,
  getClientGalleryUploadAuth,
  getSharedGalleryUploadAuth,
  getMyClientGallery,
  uploadClientGalleryImage,
  getSharedGallery,
  uploadSharedGalleryImage,
  deleteSharedGalleryImage,
  getMyClientPerformance,
  getMyClientRoster,
  addMyClientRosterEntry,
  deleteMyClientRosterEntry,
  getClientStandings,
  updateClientStandings,
  deleteClientGalleryImage,
} 

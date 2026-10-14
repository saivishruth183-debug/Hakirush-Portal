import Client from "../models/Client.js";
import User from "../models/User.js";
import bcrypt from "bcrypt";
import uploadToImageKit from "../utils/uploadToImageKit.js";

/* ================= ADD CLIENT ================= */
const addClient = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      dateOfJoining,
      planType,
      budget,
    } = req.body;

    /* ===== VALIDATION ===== */
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ error: "Company logo required" });
    }

    /* ===== CHECK USER ===== */
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
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
    const client = await Client.create({
      userId: user._id,
      name,
      email,
      dateOfJoining,
      planType,
      budget,
      companyLogo: logoUrl,
    });

    res.status(201).json({
      success: true,
      client,
    });
  } catch (error) {
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
    await Client.findByIdAndDelete(client._id);

    res.json({ success: true, message: "Client deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getClientPerformance = async (req, res) => {
  try {
    const { userId } = req.query;
    const performanceData = [
      { teamName: "Super Teacher", played: 12, won: 10, lost: 2, points: 30 },
      { teamName: "Delta Strikers", played: 12, won: 5, lost: 7, points: 15 },
      { teamName: "Titan Shadows", played: 12, won: 8, lost: 4, points: 24 },
      { teamName: "Omega Blitz", played: 12, won: 3, lost: 9, points: 9 },
      { teamName: "Apex Predators", played: 12, won: 9, lost: 3, points: 27 },
    ];
    res.json({ success: true, performance: performanceData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ================= GET CLIENT IMAGES ================= */
const getClientImages = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }
    const client = await Client.findOne({ userId });
    if (!client) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }
    // If images field does not exist, return empty array
    res.json({ success: true, images: client.images || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export {
  addClient,
  getClients,
  getClient,
  getMyClient,
  updateClient,
  deleteClient,
  getClientPerformance,
  getClientImages,
} 

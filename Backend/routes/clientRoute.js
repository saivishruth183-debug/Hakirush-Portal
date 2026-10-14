import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";


import {
  addClient,
  getClients,
  getClient,
  getMyClient,
  updateClient,
  deleteClient,
  getClientPerformance,
  getClientImages,
} from "../controllers/clientController.js";

const router = express.Router();
// GET /api/client/performance?userId=xxx

// GET /api/client/images?userId=xxx
router.get("/images", authMiddleware, getClientImages);

router.get("/performance", authMiddleware, getClientPerformance);

router.get("/", authMiddleware, getClients);
router.get("/me", authMiddleware, getMyClient);
router.get("/:id", authMiddleware, getClient);

router.post(
  "/add",
  authMiddleware,
  upload.single("companyLogo"),
  addClient
);

router.put(
  "/:id",
  authMiddleware,
  upload.single("companyLogo"),
  updateClient
);

router.delete("/:id", authMiddleware, deleteClient);

export default router;

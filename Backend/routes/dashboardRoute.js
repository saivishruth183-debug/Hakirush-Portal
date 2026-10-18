import express from 'express'
import authMiddleware from '../middleware/authMiddleware.js'
import { requireAdmin } from '../middleware/roleMiddleware.js'
import { getSummary } from '../controllers/dashboardController.js';

const router = express.Router()

// Org-wide HR summary (includes birthdays/ages): admin only.
router.get('/summary', authMiddleware, requireAdmin, getSummary)

export default router;

import express from 'express';
import { getDashboardStats } from '../controllers/statsController';

const router = express.Router();

// @route   GET /api/stats
// @desc    Get dashboard stats for cards
// @access  Private (can add auth middleware if needed)
router.get('/', getDashboardStats);

export default router;

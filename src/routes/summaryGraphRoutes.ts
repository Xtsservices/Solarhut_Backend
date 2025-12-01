import express from 'express';
import { getSummaryGraphStats } from '../controllers/statsController';

const router = express.Router();

// @route   GET /api/summary/graph
// @desc    Get summary graph stats (leadCount, jobCount)
// @access  Private (can add auth middleware if needed)
router.get('/graph', getSummaryGraphStats);

export default router;

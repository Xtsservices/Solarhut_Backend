import express from 'express';
import { getPaymentsStats } from '../controllers/paymentsStatsController';

const router = express.Router();

// @route   GET /api/payments/stats
// @desc    Get payments stats for dashboard
router.get('/', getPaymentsStats);

export default router;

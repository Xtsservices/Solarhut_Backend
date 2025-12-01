import express from 'express';
import { getPaymentsSummary } from '../controllers/paymentsStatsController';

const router = express.Router();

// @route   GET /api/payments/summary
// @desc    Get payment summary for dashboard pie chart
// @access  Private (can add auth middleware if needed)
router.get('/summary', getPaymentsSummary);

export default router;

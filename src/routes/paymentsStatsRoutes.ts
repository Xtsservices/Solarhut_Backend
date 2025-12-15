import express from 'express';
import { getPaymentsStats, getPaymentsSummary, listPayments } from '../controllers/paymentsStatsController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// @route   GET /api/payments/stats
// @desc    Get payments stats for dashboard (today, week, pending)
router.get('/', getPaymentsStats);

// @route   GET /api/payments/summary
// @desc    Get payments summary for pie chart (paid vs pending count)
router.get('/summary', getPaymentsSummary);

// @route   GET /api/payments/list
// @desc    Get all payments with pagination and filters
// @query   page, limit, status, payment_type, payment_method, job_id, date_from, date_to, search
router.get('/list', listPayments);

export default router;

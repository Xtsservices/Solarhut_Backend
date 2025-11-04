import { Router } from 'express';
import { 
    createLead,
    getAllLeads,
    getLeadById,
    getLeadsByDateRange,
    getLeadsByServiceType,
    getLeadsByHomeType,
    getLeadStats
} from '../controllers/leadController';

const router = Router();

// @route   POST /api/leads
// @desc    Create a new lead
// @access  Public
router.post('/', createLead);

// @route   GET /api/leads
// @desc    Get all leads
// @access  Private
router.get('/', getAllLeads);

// @route   GET /api/leads/stats
// @desc    Get lead statistics
// @access  Private
router.get('/stats', getLeadStats);

// @route   GET /api/leads/date
// @desc    Get leads by date range
// @access  Private
router.get('/date', getLeadsByDateRange);

// @route   GET /api/leads/service/:serviceType
// @desc    Get leads by service type
// @access  Private
router.get('/service/:serviceType', getLeadsByServiceType);

// @route   GET /api/leads/home/:homeType
// @desc    Get leads by home type
// @access  Private
router.get('/home/:homeType', getLeadsByHomeType);

// @route   GET /api/leads/:id
// @desc    Get lead by ID
// @access  Private
router.get('/:id', getLeadById);

export default router;
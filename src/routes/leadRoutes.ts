import { Router } from 'express';
import { 
    createLead,
    getAllLeads,
    getLeadById,
    getLeadsByDateRange,
    getLeadsByServiceType,
    getLeadsByPropertyType,
    getLeadsBySolarService,
    getPropertyTypesForSolarService,
    updateLeadStatus,
    assignLead,
    getLeadCandidates,
    getLeadStats
} from '../controllers/leadController';
import { authenticate, authorizeRoles } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required)
// @route   POST /api/leads
// @desc    Create a new lead
// @access  Public
router.post('/', createLead);

// @route   GET /api/leads/solar/:solarService/property-types
// @desc    Get valid property types for a solar service
// @access  Public
router.get('/solar/:solarService/property-types', getPropertyTypesForSolarService);

// All other routes require authentication and SuperAdmin/Admin role
router.use(authenticate);
router.use(authorizeRoles(['SuperAdmin', 'Admin']));

// @route   GET /api/leads
// @desc    Get all leads
// @access  Private (SuperAdmin/Admin only)
router.get('/', getAllLeads);

// @route   GET /api/leads/stats
// @desc    Get lead statistics
// @access  Private (SuperAdmin/Admin only)
router.get('/stats', getLeadStats);

// @route   GET /api/leads/date
// @desc    Get leads by date range
// @access  Private (SuperAdmin/Admin only)
router.get('/date', getLeadsByDateRange);

// @route   GET /api/leads/service/:serviceType
// @desc    Get leads by service type
// @access  Private (SuperAdmin/Admin only)
router.get('/service/:serviceType', getLeadsByServiceType);

// @route   GET /api/leads/property/:propertyType
// @desc    Get leads by property type
// @access  Private (SuperAdmin/Admin only)
router.get('/property/:propertyType', getLeadsByPropertyType);

// @route   GET /api/leads/solar/:solarService
// @desc    Get leads by solar service type
// @access  Private (SuperAdmin/Admin only)
router.get('/solar/:solarService', getLeadsBySolarService);

// @route   GET /api/leads/solar/:solarService/property-types
// @desc    Get valid property types for a solar service
// @access  Public (but should be moved before authentication middleware)
// This route needs to be moved above authentication middleware

// @route   PATCH /api/leads/:id/status
// @desc    Update lead status
// @access  Private (SuperAdmin/Admin only)
router.patch('/:id/status', updateLeadStatus);
router.put('/:id/status', updateLeadStatus);

// @route   PATCH /api/leads/:id/assign
// @desc    Assign lead to an employee (sets status to Assigned)
// @access  Private (SuperAdmin/Admin only, Admin needs SuperAdmin permission)
router.patch('/:id/assign', assignLead);

// @route   GET /api/leads/:id/candidates
// @desc    Get candidate employees for lead assignment
// @access  Private (SuperAdmin/Admin only)
router.get('/:id/candidates', getLeadCandidates);

// @route   GET /api/leads/:id
// @desc    Get lead by ID
// @access  Private (SuperAdmin/Admin only)
router.get('/:id', getLeadById);

export default router;
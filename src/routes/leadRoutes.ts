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

// @route   GET /api/leads/property/:propertyType
// @desc    Get leads by property type
// @access  Private
router.get('/property/:propertyType', getLeadsByPropertyType);

// @route   GET /api/leads/solar/:solarService
// @desc    Get leads by solar service type
// @access  Private
router.get('/solar/:solarService', getLeadsBySolarService);

// @route   GET /api/leads/solar/:solarService/property-types
// @desc    Get valid property types for a solar service
// @access  Public
router.get('/solar/:solarService/property-types', getPropertyTypesForSolarService);

// @route   PATCH /api/leads/:id/status
// @desc    Update lead status
// @access  Private
router.patch('/:id/status', updateLeadStatus);
router.put('/:id/status', updateLeadStatus);


// @route   PATCH /api/leads/:id/assign
// @desc    Assign lead to an employee (sets status to Assigned)
// @access  Private
router.patch('/:id/assign', authenticate, authorizeRoles(['Admin']), assignLead);

// @route   GET /api/leads/:id/candidates
// @desc    Get candidate employees for lead assignment (admin)
// @access  Private
router.get('/:id/candidates', authenticate, authorizeRoles(['Admin']), getLeadCandidates);

// @route   GET /api/leads/:id
// @desc    Get lead by ID
// @access  Private
router.get('/:id', getLeadById);

export default router;
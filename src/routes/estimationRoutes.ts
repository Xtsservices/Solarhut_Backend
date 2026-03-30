import express from 'express';
import {
    createEstimation,
    getAllEstimations,
    getEstimationById,
    getEstimationsByMobile,
    updateEstimation,
    deleteEstimation,
    downloadEstimationPDF,
    getMyRunningEstimations,
    getMyPendingEstimations,
    getMyWaitingForApprovalEstimations,
    getMyCompletedEstimations,
    getMyEstimationsSummary,
    // Conversion endpoint
    convertEstimationToJob,
    // Approval workflow functions
    createEmployeeEstimation,
    getPendingApprovalEstimations,
    approveEstimation,
    rejectEstimation,
    getMyEstimationsByStatus,
    getEstimationApprovalHistory
} from '../controllers/estimationController';
import { authenticate, authorizeRoles } from '../middleware/auth';

const router = express.Router();

// ============ CONVERSION ROUTES ============

// @route   POST /api/estimations/:id/convert-to-job
// @desc    Convert estimation to job (SuperAdmin/Admin only, no approvals needed)
// @access  SuperAdmin/Admin
router.post('/:id/convert-to-job', authenticate, authorizeRoles(['SuperAdmin', 'Admin']), convertEstimationToJob);

// ============ APPROVAL WORKFLOW ROUTES ============

// @route   POST /api/estimations/employee
// @desc    Create estimation by employee (no GST, auto-request approval)
// @access  Employee only
router.post('/employee', authenticate, createEmployeeEstimation);

// @route   GET /api/estimations/pending-approval
// @desc    Get estimations pending approval (SuperAdmin/Admin only)
// @access  SuperAdmin/Admin
router.get('/pending-approval', authenticate, authorizeRoles(['SuperAdmin', 'Admin']), getPendingApprovalEstimations);

// @route   PUT /api/estimations/:id/approve
// @desc    Approve estimation (SuperAdmin/Admin only)
// @access  SuperAdmin/Admin
router.put('/:id/approve', authenticate, authorizeRoles(['SuperAdmin', 'Admin']), approveEstimation);

// @route   PUT /api/estimations/:id/reject
// @desc    Reject estimation (SuperAdmin/Admin only)
// @access  SuperAdmin/Admin
router.put('/:id/reject', authenticate, authorizeRoles(['SuperAdmin', 'Admin']), rejectEstimation);

// @route   GET /api/estimations/my-status/:status
// @desc    Get my estimations by approval status (Draft, Pending_Approval, Approved, Rejected)
// @access  Employee
router.get('/my-status/:status', authenticate, getMyEstimationsByStatus);

// @route   GET /api/estimations/:id/approval-history
// @desc    Get estimation approval history
// @access  Private (employee can see own, admin can see all)
router.get('/:id/approval-history', authenticate, getEstimationApprovalHistory);

// ============ EXISTING ROUTES ============

// @route   POST /api/estimations
// @desc    Create a new estimation
// @access  Public (for customers to submit estimation forms) - no auth required
router.post('/', createEstimation);

// @route   GET /api/estimations
// @desc    Get all estimations with optional filters
// @access  Private
router.get('/', authenticate, getAllEstimations);

// My Estimations - 4 Tab System
// @route   GET /api/estimations/my-summary
// @desc    Get summary counts for all 4 estimation tabs
// @access  Private
router.get('/my-summary', authenticate, getMyEstimationsSummary);

// @route   GET /api/estimations/my-running
// @desc    Get running estimations (Site Visit, Estimation Generated, Processed, Partial Payment Done, Payment Done, Invoice Generated)
// @access  Private
router.get('/my-running', authenticate, getMyRunningEstimations);

// @route   GET /api/estimations/my-pending
// @desc    Get pending estimations (Pending on Portal, Payment Pending)
// @access  Private
router.get('/my-pending', authenticate, getMyPendingEstimations);

// @route   GET /api/estimations/my-waiting-approval
// @desc    Get estimations waiting for approval (Active status jobs created by employee)
// @access  Private
router.get('/my-waiting-approval', authenticate, getMyWaitingForApprovalEstimations);

// @route   GET /api/estimations/my-completed
// @desc    Get completed estimations (Job Done)
// @access  Private
router.get('/my-completed', authenticate, getMyCompletedEstimations);

// @route   GET /api/estimations/:id
// @desc    Get estimation by ID
// @access  Private
router.get('/:id', authenticate, getEstimationById);

// @route   GET /api/estimations/mobile/:mobile
// @desc    Get estimations by mobile number
// @access  Private
router.get('/mobile/:mobile', authenticate, getEstimationsByMobile);

// @route   PUT /api/estimations/:id
// @desc    Update an estimation
// @access  Private
router.put('/:id', authenticate, updateEstimation);

// @route   DELETE /api/estimations/:id
// @desc    Delete an estimation
// @access  Private
router.delete('/:id', authenticate, deleteEstimation);

// @route   GET /api/estimations/:id/download
// @desc    Download estimation as PDF
// @access  Public (for customers to download their estimation)
router.get('/:id/download', downloadEstimationPDF);

export default router;

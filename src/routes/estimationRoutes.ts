import express from 'express';
import {
    createEstimation,
    getAllEstimations,
    getEstimationById,
    getEstimationsByMobile,
    updateEstimation,
    deleteEstimation,
    downloadEstimationPDF
} from '../controllers/estimationController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// @route   POST /api/estimations
// @desc    Create a new estimation
// @access  Public (for customers to submit estimation forms)
router.post('/', authenticate, createEstimation);

// @route   GET /api/estimations
// @desc    Get all estimations with optional filters
// @access  Private
router.get('/', authenticate, getAllEstimations);

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

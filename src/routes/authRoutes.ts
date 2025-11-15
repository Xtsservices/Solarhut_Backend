import express, { Router } from 'express';
import { requestOTP, verifyOTP, myProfile } from '../controllers/authController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/auth';
import { authSchema } from '../utils/validations';

const router: Router = express.Router();

// @route   POST /api/auth/request-otp
// @desc    Request OTP for mobile login
// @access  Public
router.post('/request-otp', validateRequest(authSchema.requestOTP), requestOTP);

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and login
// @access  Public
router.post('/verify-otp', validateRequest(authSchema.verifyOTP), verifyOTP);

// @route   GET /api/auth/my-profile
// @desc    Get current user profile (for page refresh)
// @access  Private (requires JWT token)
router.get('/my-profile', authenticate, myProfile);

export default router;
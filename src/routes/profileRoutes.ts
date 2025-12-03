import express from 'express';
import { getMyProfile, updateMyProfile } from '../controllers/profileController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import Joi from 'joi';

const router = express.Router();

// Validation schema for profile update
const profileUpdateSchema = Joi.object({
    first_name: Joi.string()
        .regex(/^[A-Za-z]{2,50}$/)
        .messages({
            'string.pattern.base': 'First name must contain only alphabets and be between 2-50 characters'
        }),
    last_name: Joi.string()
        .regex(/^[A-Za-z]{2,50}$/)
        .messages({
            'string.pattern.base': 'Last name must contain only alphabets and be between 2-50 characters'
        }),
    email: Joi.string()
        .email()
        .messages({
            'string.email': 'Invalid email format'
        }),
    mobile: Joi.string()
        .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
        .messages({
            'string.pattern.base': 'Invalid mobile number format. Use 10-digit Indian format or international format with country code'
        })
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});

// @route   GET /api/profile
// @desc    Get current logged-in employee's profile
// @access  Private (Authenticated employees only)
router.get('/', authenticate, getMyProfile);

// @route   PUT /api/profile
// @desc    Update current logged-in employee's profile
// @access  Private (Authenticated employees only)
router.put('/', authenticate, validateRequest(profileUpdateSchema), updateMyProfile);

export default router;

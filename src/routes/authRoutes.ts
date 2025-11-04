import express, { Router } from 'express';
import { login } from '../controllers/authController';
import { validateRequest } from '../middleware/validateRequest';
import { authSchema } from '../utils/validations';

const router: Router = express.Router();

// @route   POST /api/auth/login
// @desc    Login employee
// @access  Public
// @route   POST /api/auth/login
// @desc    Login employee
// @access  Public
router.post('/login', validateRequest(authSchema.login), login);

export default router;
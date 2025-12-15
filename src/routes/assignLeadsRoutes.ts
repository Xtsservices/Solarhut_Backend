import { Router } from 'express';
import { createAssignment, getAssignment } from '../controllers/assignLeadsController';
import { authenticate, authorizeRoles } from '../middleware/auth';

const router = Router();

// Admin-only: assign a lead to an employee
router.post('/', authenticate,  createAssignment);

// Get assignment info for a lead
router.get('/:leadId', authenticate, getAssignment);

export default router;

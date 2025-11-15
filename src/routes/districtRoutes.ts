import express from 'express';
import districtController from '../controllers/districtController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { districtSchema } from '../utils/validations';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all districts with optional active filter (must be before /:id route)
router.get('/allDistricts', districtController.listDistricts);

// Create a new district
router.post('/create', districtController.createDistrict);

// Edit a district
router.put('/:id', districtController.editDistrict);

// Delete (deactivate) a district
router.delete('/delete/:id', districtController.deleteDistrict);

// Get a specific district by ID
router.get('/:id', districtController.getDistrict);


export default router;

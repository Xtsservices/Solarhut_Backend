import { Router } from 'express';
import { createPackage, editPackage, deletePackage, getPackage, listPackages } from '../controllers/packageController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { packageSchema } from '../utils/validations';

const router = Router();

// Public: list packages (optionally only active via ?active=true)
router.get('/', listPackages);
// Public: get package by id
router.get('/:id', getPackage);

// Create: allowed for any authenticated user
router.post('/', authenticate, validateRequest(packageSchema.create), createPackage);
router.put('/:id', authenticate, validateRequest(packageSchema.update), editPackage);
router.delete('/:id', authenticate, deletePackage);

export default router;

import { Router } from 'express';
import { createFeature, editFeature, deleteFeature, getFeature, listFeatures, listMyFeatures } from '../controllers/featureController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { featureSchema } from '../utils/validations';

const router = Router();

// Public: list all features (optionally only active via ?active=true)
router.get('/', listFeatures);
// Public: get feature by id
router.get('/:id', getFeature);

// Authenticated: get current user's features
router.get('/my/features', authenticate, listMyFeatures);

// Authenticated: create, edit, delete features
router.post('/', authenticate, validateRequest(featureSchema.create), createFeature);
router.put('/:id', authenticate, validateRequest(featureSchema.update), editFeature);
router.delete('/:id', authenticate, deleteFeature);

export default router;
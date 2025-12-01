import { Router } from 'express';
import { createFeature, editFeature, deleteFeature, getFeature, listFeatures, listMyFeatures, allfeatures } from '../controllers/featureController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { featureSchema } from '../utils/validations';

const router = Router();

// Public: list all features (optionally only active via ?active=true)
router.get('/', listFeatures);

//get static features (must be before /:id route)
router.get('/allfeatures', allfeatures);

// Authenticated: get current user's features
router.get('/my/features', authenticate, listMyFeatures);

// Public: get feature by id (must be after specific routes)
router.get('/:id', getFeature);



// Authenticated: create, edit, delete features
router.post('/', authenticate, validateRequest(featureSchema.create), createFeature);
router.put('/:id', authenticate, validateRequest(featureSchema.update), editFeature);
router.delete('/:id', authenticate, deleteFeature);

export default router;
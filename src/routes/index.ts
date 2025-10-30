import { Router } from 'express';
import leadRoutes from './leadRoutes';

const router = Router();

// Mount all routes
router.use('/leads', leadRoutes);

export default router;
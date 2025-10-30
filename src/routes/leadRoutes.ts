import { Router } from 'express';
import { createLead } from '../controllers/leadController';

const router = Router();

router.post('/', createLead);

export default router;
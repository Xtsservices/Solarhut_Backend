import { Router } from 'express';
import { 
    createState, 
    editState, 
    deleteState, 
  
    listStates,
    getState,
} from '../controllers/stateController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { stateSchema } from '../utils/validations';

const router = Router();

// Public routes: list and get states
router.get('/allStates', authenticate, listStates);
router.get('/get/:id', authenticate, getState);

// Authenticated routes: create, edit, delete states
router.post('/create', authenticate, createState);
router.put('/edit/:id', authenticate, editState);
router.delete('/delete/:id', authenticate, deleteState);

export default router;

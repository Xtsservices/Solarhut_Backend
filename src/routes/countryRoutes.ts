import { Router } from 'express';
import { 
    createCountry, 
    editCountry, 
    deleteCountry, 
    listCountries,
    getCountry,
  
} from '../controllers/countryController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { countrySchema } from '../utils/validations';

const router = Router();

// Public routes: list and get countries
router.get('/allCountries', authenticate, listCountries);
router.get('/get/:id', authenticate, getCountry);

// Authenticated routes: create, edit, delete countries
router.post('/create', authenticate, createCountry);
router.put('/edit/:id', authenticate, editCountry);
router.delete('/delete/:id', authenticate, deleteCountry);

export default router;

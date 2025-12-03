import express from 'express';
import * as roleController from '../controllers/roleController';
import { validateRequest } from '../middleware/validateRequest';
import { roleSchema } from '../utils/validations';

const router = express.Router();

// Get all roles
router.get('/', roleController.getAllRoles);

// Create new role
router.post('/', validateRequest(roleSchema.create), roleController.createRole);

// Update role by ID
router.put('/:id', validateRequest(roleSchema.update), roleController.updateRole);

// Delete role by name
router.delete('/:roleName', roleController.deleteRole);

export default router;
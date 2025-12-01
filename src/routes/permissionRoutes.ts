import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { permissionSchema } from '../utils/validations';
import {
    createRoleFeaturePermissions,
    bulkCreatePermissions,
    updatePermission,
    deletePermission,
    deleteRoleFeaturePermissions,
    getPermission,
    listPermissions,
    getPermissionsByRole,
    getPermissionsByFeature,
    checkPermission
} from '../controllers/permissionController';

const router = Router();

// Debug middleware to check body parsing
router.use((req, res, next) => {
    console.log(`Permission route - ${req.method} ${req.path}`);
    console.log('Body parsed:', !!req.body);
    console.log('Content-Type:', req.headers['content-type']);
    
    // Handle text/plain content-type for JSON data
    if (req.headers['content-type'] === 'text/plain' && req.method !== 'GET') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                req.body = JSON.parse(body);
                console.log('Parsed body from text/plain:', req.body);
                next();
            } catch (error) {
                console.log('Failed to parse JSON from text/plain:', error);
                next();
            }
        });
    } else {
        next();
    }
});

// Apply authentication middleware to all routes
router.use(authenticate);

// Create permissions for a role-feature combination
router.post('/create', 
    validateRequest(permissionSchema.create), 
    createRoleFeaturePermissions
);

// Bulk create permissions for multiple role-feature combinations
router.post('/bulk-create', 
    validateRequest(permissionSchema.bulkCreate), 
    bulkCreatePermissions
);

// Update a specific permission
router.put('/:id', 
    validateRequest(permissionSchema.update), 
    updatePermission
);

// Delete a specific permission
router.delete('/:id', deletePermission);

// Delete all permissions for a role-feature combination
router.delete('/role/:roleId/feature/:featureId', deleteRoleFeaturePermissions);

// Get a specific permission by ID
router.get('/:id', getPermission);

// List all permissions with optional filtering
// Query params: role_id, feature_id, permission, status, active
router.get('/', listPermissions);

// Get all permissions for a specific role
// Query param: active (default true)
router.get('/role/:roleId', getPermissionsByRole);

// Get all permissions for a specific feature
// Query param: active (default true)  
router.get('/feature/:featureId', getPermissionsByFeature);

// Check if a role has a specific permission for a feature
router.get('/check/:roleId/:featureId/:permission', checkPermission);

export default router;
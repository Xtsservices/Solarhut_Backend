import { Request, Response } from 'express';
import * as permissionQueries from '../queries/permissionQueries';
import * as roleQueries from '../queries/roleQueries';
import * as featureQueries from '../queries/featureQueries';
import { permissionSchema } from '../utils/validations';

export const createRoleFeaturePermissions = async (req: Request, res: Response) => {
    try {
        const { error, value } = permissionSchema.create.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const { role_id, feature_id, permissions } = value;

        // Validate role exists
        const role = await roleQueries.getRoleById(role_id);
        if (!role) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }

        // Validate feature exists
        const feature = await featureQueries.getFeatureById(feature_id);
        if (!feature) {
            return res.status(404).json({ success: false, message: 'Feature not found' });
        }

        // Create permissions
        const insertedIds = await permissionQueries.createRoleFeaturePermissions(
            role_id, 
            feature_id, 
            permissions, 
            user.id
        );

        // Get created permissions with details
        const createdPermissions = [];
        for (const id of insertedIds) {
            const permission = await permissionQueries.getPermissionById(id);
            if (permission) createdPermissions.push(permission);
        }

        res.status(201).json({
            success: true,
            message: 'Permissions created successfully',
            data: createdPermissions
        });

    } catch (err) {
        console.error('Error creating permissions:', err);
        res.status(500).json({
            success: false,
            message: 'Error creating permissions',
            error: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};

export const bulkCreatePermissions = async (req: Request, res: Response) => {
    try {
        const { error, value } = permissionSchema.bulkCreate.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const { permissions } = value;
        const results = [];

        for (const permissionSet of permissions) {
            const { role_id, feature_id, permissions: perms } = permissionSet;

            // Validate role and feature exist (basic validation)
            const role = await roleQueries.getRoleById(role_id);
            const feature = await featureQueries.getFeatureById(feature_id);

            if (!role || !feature) {
                results.push({
                    role_id,
                    feature_id,
                    success: false,
                    message: `${!role ? 'Role' : 'Feature'} not found`
                });
                continue;
            }

            try {
                const insertedIds = await permissionQueries.createRoleFeaturePermissions(
                    role_id, 
                    feature_id, 
                    perms, 
                    user.id
                );

                results.push({
                    role_id,
                    feature_id,
                    success: true,
                    permissions_created: insertedIds.length,
                    permission_ids: insertedIds
                });
            } catch (err) {
                results.push({
                    role_id,
                    feature_id,
                    success: false,
                    message: 'Failed to create permissions'
                });
            }
        }

        res.status(201).json({
            success: true,
            message: 'Bulk permission creation completed',
            data: results
        });

    } catch (err) {
        console.error('Error in bulk create permissions:', err);
        res.status(500).json({
            success: false,
            message: 'Error in bulk permission creation',
            error: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};

export const updatePermission = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid permission id' });

        console.log('Raw request details:');
        console.log('- Content-Type:', req.headers['content-type']);
        console.log('- Request method:', req.method);
        console.log('- Request body:', req.body);
        console.log('- Body type:', typeof req.body);
        console.log('- Body keys:', req.body ? Object.keys(req.body) : 'none');
        
        const { error, value } = permissionSchema.update.validate(req.body, { abortEarly: false, allowUnknown: false });
        
        console.log('Validation result:', { error, value });
        
        if (error) {
            console.log('Validation errors:', error.details);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map(d => d.message)
            });
        }

        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        console.log('Update permission request:', { id, body: req.body, user: user.id });
        console.log('Validation value:', value);

        // Ensure validation passed and has valid data
        if (!value || (Object.keys(value).length === 0)) {
            return res.status(400).json({ 
                success: false, 
                message: 'No valid data provided. Please provide either permissions array or status.' 
            });
        }

        // Check if permission exists
        const existingPermission = await permissionQueries.getPermissionById(id);
        if (!existingPermission) {
            return res.status(404).json({ success: false, message: 'Permission not found' });
        }

        console.log('Existing permission:', existingPermission);

        // If permissions array is provided, update the entire role-feature permission set
        if (value.permissions && Array.isArray(value.permissions)) {
            try {
                // Validate that role and feature still exist
                const role = await roleQueries.getRoleById(existingPermission.role_id);
                const feature = await featureQueries.getFeatureById(existingPermission.feature_id);
                
                if (!role) {
                    return res.status(404).json({ success: false, message: 'Role not found' });
                }
                
                if (!feature) {
                    return res.status(404).json({ success: false, message: 'Feature not found' });
                }

                // Update permissions for the role-feature combination
                const insertedIds = await permissionQueries.createRoleFeaturePermissions(
                    existingPermission.role_id,
                    existingPermission.feature_id,
                    value.permissions,
                    user.id
                );

                // Get updated permissions with details
                const updatedPermissions = [];
                for (const newId of insertedIds) {
                    const permission = await permissionQueries.getPermissionById(newId);
                    if (permission) updatedPermissions.push(permission);
                }

                return res.json({
                    success: true,
                    message: 'Permissions updated successfully',
                    data: updatedPermissions
                });
            } catch (permError: any) {
                console.error('Error updating permissions array:', permError);
                return res.status(500).json({
                    success: false,
                    message: 'Error updating permissions',
                    error: process.env.NODE_ENV === 'development' ? {
                        message: permError?.message || 'Unknown error',
                        stack: permError?.stack,
                        code: permError?.code
                    } : undefined
                });
            }
        } 
        
        // If only status is being updated (legacy behavior)
        if (value.status) {
            try {
                const updates = { status: value.status, updated_by: user.id };
                const updated = await permissionQueries.updatePermission(id, updates);
                
                if (!updated) {
                    return res.status(400).json({ success: false, message: 'Failed to update permission status' });
                }

                const permission = await permissionQueries.getPermissionById(id);
                return res.json({ success: true, message: 'Permission status updated', data: permission });
            } catch (statusError) {
                console.error('Error updating permission status:', statusError);
                return res.status(500).json({
                    success: false,
                    message: 'Error updating permission status',
                    error: process.env.NODE_ENV === 'development' ? statusError : undefined
                });
            }
        }

        // If no valid updates provided
        return res.status(400).json({ 
            success: false, 
            message: 'No valid updates provided. Please provide either permissions array or status.' 
        });

    } catch (err: any) {
        console.error('Error updating permission:', err);
        res.status(500).json({
            success: false,
            message: 'Error updating permission',
            error: process.env.NODE_ENV === 'development' ? {
                message: err?.message || 'Unknown error',
                stack: err?.stack,
                code: err?.code
            } : undefined
        });
    }
};

export const deletePermission = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid permission id' });

        const existingPermission = await permissionQueries.getPermissionById(id);
        if (!existingPermission) {
            return res.status(404).json({ success: false, message: 'Permission not found' });
        }

        const deleted = await permissionQueries.deletePermission(id);
        if (!deleted) {
            return res.status(400).json({ success: false, message: 'Failed to delete permission' });
        }

        res.json({ success: true, message: 'Permission deleted successfully' });

    } catch (err) {
        console.error('Error deleting permission:', err);
        res.status(500).json({
            success: false,
            message: 'Error deleting permission',
            error: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};

export const deleteRoleFeaturePermissions = async (req: Request, res: Response) => {
    try {
        const { roleId, featureId } = req.params;
        
        if (!roleId || !featureId) {
            return res.status(400).json({ success: false, message: 'Role ID and Feature ID are required' });
        }

        const deletedCount = await permissionQueries.deleteRoleFeaturePermissions(
            parseInt(roleId), 
            parseInt(featureId)
        );

        res.json({
            success: true,
            message: `${deletedCount} permissions deleted successfully`,
            deleted_count: deletedCount
        });

    } catch (err) {
        console.error('Error deleting role-feature permissions:', err);
        res.status(500).json({
            success: false,
            message: 'Error deleting permissions',
            error: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};

export const getPermission = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid permission id' });

        const permission = await permissionQueries.getPermissionById(id);
        if (!permission) return res.status(404).json({ success: false, message: 'Permission not found' });

        res.json({ success: true, data: permission });

    } catch (err) {
        console.error('Error fetching permission:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching permission',
            error: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};

export const listPermissions = async (req: Request, res: Response) => {
    try {
        const { role_id, feature_id, permission, status, active } = req.query;

        const filters = {
            roleId: role_id ? parseInt(role_id as string) : undefined,
            featureId: feature_id ? parseInt(feature_id as string) : undefined,
            permission: permission as string,
            status: status as string,
            onlyActive: active === 'true'
        };

        const permissions = await permissionQueries.getAllPermissions(filters);
        res.json({ success: true, data: permissions });

    } catch (err) {
        console.error('Error listing permissions:', err);
        res.status(500).json({
            success: false,
            message: 'Error listing permissions',
            error: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};

export const getPermissionsByRole = async (req: Request, res: Response) => {
    try {
        const roleId = parseInt(req.params.roleId);
        if (!roleId) return res.status(400).json({ success: false, message: 'Invalid role id' });

        const onlyActive = req.query.active !== 'false';
        const permissions = await permissionQueries.getPermissionsByRole(roleId, onlyActive);
        
        res.json({ success: true, data: permissions });

    } catch (err) {
        console.error('Error fetching role permissions:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching role permissions',
            error: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};

export const getPermissionsByFeature = async (req: Request, res: Response) => {
    try {
        const featureId = parseInt(req.params.featureId);
        if (!featureId) return res.status(400).json({ success: false, message: 'Invalid feature id' });

        const onlyActive = req.query.active !== 'false';
        const permissions = await permissionQueries.getPermissionsByFeature(featureId, onlyActive);
        
        res.json({ success: true, data: permissions });

    } catch (err) {
        console.error('Error fetching feature permissions:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching feature permissions',
            error: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};

export const checkPermission = async (req: Request, res: Response) => {
    try {
        const { roleId, featureId, permission } = req.params;

        if (!roleId || !featureId || !permission) {
            return res.status(400).json({ 
                success: false, 
                message: 'Role ID, Feature ID, and Permission are required' 
            });
        }

        const hasAccess = await permissionQueries.hasPermission(
            parseInt(roleId), 
            parseInt(featureId), 
            permission
        );

        res.json({ 
            success: true, 
            has_permission: hasAccess,
            data: {
                role_id: parseInt(roleId),
                feature_id: parseInt(featureId),
                permission,
                granted: hasAccess
            }
        });

    } catch (err) {
        console.error('Error checking permission:', err);
        res.status(500).json({
            success: false,
            message: 'Error checking permission',
            error: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};

export default { 
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
};
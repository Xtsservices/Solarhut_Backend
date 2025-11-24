import { Request, Response } from 'express';
import * as roleQueries from '../queries/roleQueries';

export const createRole = async (req: Request, res: Response) => {
    try {
        const { role_name, status = 'Active' } = req.body;
        
        // Basic validation for role name
        if (!role_name || typeof role_name !== 'string' || role_name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Role name is required and must be a non-empty string'
            });
        }

        // Validate status if provided
        if (status && !['Active', 'Inactive'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be either Active or Inactive'
            });
        }

        const roleId = await roleQueries.createRole(role_name.trim(), status);
        const role = await roleQueries.getRoleById(roleId);
        
        res.status(201).json({
            success: true,
            message: 'Role created successfully',
            data: role
        });
    } catch (error: any) {
        console.error('Error creating role:', error);

        // Handle duplicate role name error
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'Role name already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error creating role',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getAllRoles = async (req: Request, res: Response) => {
    try {
        const { only_active } = req.query;
        const onlyActive = only_active === 'true';
        
        const roles = await roleQueries.getAllRoles(onlyActive);
        
        res.json({
            success: true,
            data: roles
        });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching roles',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const updateRole = async (req: Request, res: Response) => {
    try {
        const roleId = parseInt(req.params.id);
        const { role_name, status } = req.body;
        
        // Validate role ID
        if (isNaN(roleId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid role ID is required'
            });
        }

        // Check if role exists
        const existingRole = await roleQueries.getRoleById(roleId);
        if (!existingRole) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        // Validate inputs
        const updates: any = {};
        if (role_name !== undefined) {
            if (!role_name || typeof role_name !== 'string' || role_name.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Role name must be a non-empty string'
                });
            }
            updates.role_name = role_name.trim();
        }

        if (status !== undefined) {
            if (!['Active', 'Inactive'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Status must be either Active or Inactive'
                });
            }
            updates.status = status;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        const updated = await roleQueries.updateRole(roleId, updates);
        if (!updated) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update role'
            });
        }

        const updatedRole = await roleQueries.getRoleById(roleId);
        res.json({
            success: true,
            message: 'Role updated successfully',
            data: updatedRole
        });
    } catch (error: any) {
        console.error('Error updating role:', error);

        // Handle duplicate role name error
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                message: 'Role name already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error updating role',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const deleteRole = async (req: Request, res: Response) => {
    try {
        const roleName = req.params.roleName;
        
        // Validate role name
        if (!roleName || typeof roleName !== 'string' || roleName.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid role name is required'
            });
        }

        try {
            const deleted = await roleQueries.removeRoleByName(roleName);
            if (!deleted) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found'
                });
            }

            res.json({
                success: true,
                message: `Role "${roleName}" deleted successfully`
            });
        } catch (err: any) {
            if (err.message.includes('Cannot delete role')) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }
            throw err;
        }
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting role',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};
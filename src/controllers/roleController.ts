import { Request, Response } from 'express';
import * as roleQueries from '../queries/roleQueries';

export const createRole = async (req: Request, res: Response) => {
    try {
        const { role_name } = req.body;
        
        // Basic validation for role name
        if (!role_name || typeof role_name !== 'string' || role_name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Role name is required and must be a non-empty string'
            });
        }

        const roleId = await roleQueries.createRole(role_name.trim());
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
        const roles = await roleQueries.getAllRoles();
        
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
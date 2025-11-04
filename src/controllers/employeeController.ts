import { Request, Response } from 'express';
import * as employeeQueries from '../queries/employeeQueries';
import { hashPassword } from '../utils/authUtils';

export const createEmployee = async (req: Request, res: Response) => {
    try {
        // Check if email already exists
        const existingEmployee = await employeeQueries.getEmployeeByEmail(req.body.email);
        if (existingEmployee) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Hash password
        const hashedPassword = await hashPassword(req.body.password);

        // Create employee
        const { insertId, userId } = await employeeQueries.createEmployee({
            ...req.body,
            password: hashedPassword
        });

        // Get complete employee data with roles
        const employee = await employeeQueries.getEmployeeById(insertId);

        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            data: {
                ...employee,
                password: undefined // Remove password from response
            }
        });
    } catch (error) {
        console.error('Error creating employee:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating employee',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getAllEmployees = async (req: Request, res: Response) => {
    try {
        const employees = await employeeQueries.getAllEmployees();
        res.json({
            success: true,
            data: employees.map(emp => ({ ...emp, password: undefined }))
        });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching employees',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getEmployeeById = async (req: Request, res: Response) => {
    try {
        const employee = await employeeQueries.getEmployeeById(parseInt(req.params.id));
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        res.json({
            success: true,
            data: {
                ...employee,
                password: undefined
            }
        });
    } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching employee',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getEmployeeByUserId = async (req: Request, res: Response) => {
    try {
        const employee = await employeeQueries.getEmployeeByUserId(req.params.userId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        res.json({
            success: true,
            data: {
                ...employee,
                password: undefined
            }
        });
    } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching employee',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const updateEmployee = async (req: Request, res: Response) => {
    try {
        const employeeId = parseInt(req.params.id);
        const employee = await employeeQueries.getEmployeeById(employeeId);
        
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Check if email is being updated and is not already taken
        if (req.body.email && req.body.email !== employee.email) {
            const emailExists = await employeeQueries.getEmployeeByEmail(req.body.email);
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already registered'
                });
            }
        }

        // Extract role IDs from request if present
        const { roles, ...updateData } = req.body;
        const roleIds = roles ? roles.map((r: any) => r.role_id) : undefined;

        const updated = await employeeQueries.updateEmployee(employeeId, { ...updateData, roles: roleIds } as any);
        if (!updated) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        const updatedEmployee = await employeeQueries.getEmployeeById(employeeId);
        res.json({
            success: true,
            message: 'Employee updated successfully',
            data: {
                ...updatedEmployee,
                password: undefined
            }
        });
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating employee',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getEmployeesByRole = async (req: Request, res: Response) => {
    try {
        const roleId = parseInt(req.params.roleId);
        // Fallback: fetch all employees and filter by role because getEmployeesByRole is not exported
        const employees = await employeeQueries.getAllEmployees();

        const filtered = employees.filter(emp => {
            if (!Array.isArray(emp.roles)) return false;
            return emp.roles.some((r: any) => {
                // roles may be objects with role_id or plain role IDs
                if (r && typeof r === 'object') return r.role_id === roleId;
                return r === roleId;
            });
        });

        res.json({
            success: true,
            data: filtered.map(emp => ({ ...emp, password: undefined }))
        });
    } catch (error) {
        console.error('Error fetching employees by role:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching employees',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const assignRoles = async (req: Request, res: Response) => {
    try {
        const employeeId = parseInt(req.params.id);
        const employee = await employeeQueries.getEmployeeById(employeeId);
        
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const { roles } = req.body;
        const roleIds = roles.map((role: any) => role.role_id);

        await employeeQueries.updateEmployee(employeeId, { roles: roleIds } as any);
        const updatedEmployee = await employeeQueries.getEmployeeById(employeeId);

        res.json({
            success: true,
            message: 'Roles assigned successfully',
            data: {
                ...updatedEmployee,
                password: undefined
            }
        });
    } catch (error) {
        console.error('Error assigning roles:', error);
        res.status(500).json({
            success: false,
            message: 'Error assigning roles',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};
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

        const updated = await employeeQueries.updateEmployee(employeeId, req.body);
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
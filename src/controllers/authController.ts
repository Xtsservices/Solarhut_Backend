import { Request, Response } from 'express';
import * as employeeQueries from '../queries/employeeQueries';
import { comparePassword, generateToken } from '../utils/authUtils';

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Find employee by email
        const employee = await employeeQueries.getEmployeeByEmail(email);
        if (!employee) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if employee is active
        if (employee.status !== 'Active') {
            return res.status(403).json({
                success: false,
                message: 'Account is inactive. Please contact administrator.'
            });
        }

        // Verify password
        const isValidPassword = await comparePassword(password, employee.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = generateToken(employee);

        // Send response
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                employee: {
                    id: employee.id,
                    title: employee.title,
                    first_name: employee.first_name,
                    last_name: employee.last_name,
                    email: employee.email,
                    mobile: employee.mobile,
                    status: employee.status
                }
            }
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({
            success: false,
            message: 'Error during login',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};
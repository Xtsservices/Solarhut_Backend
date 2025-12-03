import { Request, Response } from 'express';
import * as employeeQueries from '../queries/employeeQueries';

// Get current logged-in employee's profile
export const getMyProfile = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        
        if (!user || !user.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const employee = await employeeQueries.getEmployeeById(user.id);
        
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found'
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
        console.error('Error fetching profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching profile',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

// Update current logged-in employee's profile
export const updateMyProfile = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        
        if (!user || !user.id) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const employeeId = user.id;
        const { first_name, last_name, email, mobile } = req.body;

        // Get current employee data
        const employee = await employeeQueries.getEmployeeById(employeeId);
        
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found'
            });
        }

        // Check if email is being updated and is not already taken by another employee
        if (email && email !== employee.email) {
            const emailExists = await employeeQueries.getEmployeeByEmail(email);
            if (emailExists && emailExists.id !== employeeId) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already registered to another employee'
                });
            }
        }

        // Check if mobile is being updated and is not already taken by another employee
        if (mobile && mobile !== employee.mobile) {
            const mobileExists = await employeeQueries.getEmployeeByMobile(mobile);
            if (mobileExists && mobileExists.id !== employeeId) {
                return res.status(400).json({
                    success: false,
                    message: 'Mobile number already registered to another employee'
                });
            }
        }

        // Only allow updating specific fields
        const updateData: any = {};
        if (first_name !== undefined) updateData.first_name = first_name;
        if (last_name !== undefined) updateData.last_name = last_name;
        if (email !== undefined) updateData.email = email;
        if (mobile !== undefined) updateData.mobile = mobile;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        const updated = await employeeQueries.updateEmployee(employeeId, updateData);
        
        if (!updated) {
            return res.status(400).json({
                success: false,
                message: 'Failed to update profile'
            });
        }

        const updatedEmployee = await employeeQueries.getEmployeeById(employeeId);
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                ...updatedEmployee,
                password: undefined
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

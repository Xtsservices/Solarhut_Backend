import { Request, Response } from 'express';
import * as employeeQueries from '../queries/employeeQueries';
import * as otpQueries from '../queries/otpQueries';
import * as permissionQueries from '../queries/permissionQueries';
import { generateToken } from '../utils/authUtils';
import { generateOTP, sendSMS, formatMobile } from '../utils/otpUtils';
import { sendOTPSMS } from '../utils/smsUtils';
import { TokenPayload } from '../interfaces/auth';

export const requestOTP = async (req: Request, res: Response) => {
    try {
        const { mobile } = req.body;
        const formattedMobile = formatMobile(mobile);

        // Check if employee exists with this mobile number
        const employee = await employeeQueries.getEmployeeByMobile(formattedMobile);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Check if employee is active
        if (employee.status !== 'Active') {
            return res.status(403).json({
                success: false,
                message: 'Account is inactive. Please contact administrator.'
            });
        }

        // Check if there's an active OTP
        const activeOTP = await otpQueries.getActiveOTP(formattedMobile);
        // if (activeOTP) {
        //     return res.status(400).json({
        //         success: false,
        //         message: 'An OTP is already active. Please wait before requesting a new one.'
        //     });
        // }

        // Generate and save new OTP
        // const otp = generateOTP();
        const otp = "123456";
        await otpQueries.createOTP(formattedMobile, otp);

        // Send OTP via SMS with user details
        console.log(`Sending OTP to ${employee.first_name} ${employee.last_name} at ${formattedMobile}`);
        try {
            const smsResult = await sendOTPSMS(employee.first_name, employee.last_name, formattedMobile, otp);
            console.log('SMS sent successfully:', smsResult);
            
            res.json({
                success: true,
                message: 'OTP sent successfully. Valid for 3 minutes',
                debug: {
                    mobile: formattedMobile,
                    smsApiResponse: smsResult
                }
            });
        } catch (smsError) {
            console.error('SMS sending failed:', smsError);
            // Still save OTP to database even if SMS fails for testing
            res.json({
                success: false,
                message: 'OTP generated but SMS delivery failed. Please try again.',
                error: smsError instanceof Error ? smsError.message : 'SMS delivery failed'
            });
        }
    } catch (error) {
        console.error('Error in requestOTP:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending OTP',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const verifyOTP = async (req: Request, res: Response) => {
    try {
        const { mobile, otp } = req.body;
        const formattedMobile = formatMobile(mobile);

        // Verify OTP
        const isValid = await otpQueries.verifyOTP(formattedMobile, otp);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        // Get employee details
        const employee = await employeeQueries.getEmployeeByMobile(formattedMobile);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Check if employee is active
        if (employee.status !== 'Active') {
            return res.status(403).json({
                success: false,
                message: 'Account is inactive. Please contact administrator.'
            });
        }

        // Get employee permissions based on their roles
        const permissions = await permissionQueries.getEmployeePermissions(employee.id);

        // Create token payload with required employee data
        const tokenPayload: TokenPayload = {
            id: employee.id,
            user_id: employee.user_id,
            first_name: employee.first_name,
            last_name: employee.last_name,
            email: employee.email,
            mobile: employee.mobile,
            roles: employee.roles?.map(role => role.role_name) || []
        };

        // Generate JWT token with complete employee data
        const token = generateToken(tokenPayload);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                employee: {
                    id: employee.id,
                    user_id: employee.user_id,
                    first_name: employee.first_name,
                    last_name: employee.last_name,
                    email: employee.email,
                    mobile: employee.mobile,
                    status: employee.status,
                    roles: employee.roles || [],
                    permissions: permissions
                }
            }
        });
    } catch (error) {
        console.error('Error in verifyOTP:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying OTP',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const myProfile = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user; // Extract user from JWT token (set by auth middleware)

        if (!user || !user.id) {
            return res.status(401).json({
                success: false,
                message: 'User information not found in token'
            });
        }

        // Get fresh employee details from database
        const employee = await employeeQueries.getEmployeeById(user.id);
        
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found or account may have been deleted'
            });
        }

        // Check if employee is still active
        if (employee.status !== 'Active') {
            return res.status(403).json({
                success: false,
                message: 'Account is inactive. Please contact administrator.'
            });
        }

        // Get employee permissions based on their roles
        const permissions = await permissionQueries.getEmployeePermissions(employee.id);

        // Return the same format as login response
        res.json({
            success: true,
            message: 'Profile retrieved successfully',
            data: {
                employee: {
                    id: employee.id,
                    user_id: employee.user_id,
                    first_name: employee.first_name,
                    last_name: employee.last_name,
                    email: employee.email,
                    mobile: employee.mobile,
                    address: employee.address,
                    joining_date: employee.joining_date,
                    status: employee.status,
                    created_at: employee.created_at,
                    updated_at: employee.updated_at,
                    roles: employee.roles || [],
                    permissions: permissions
                }
            }
        });

    } catch (error) {
        console.error('Error in myProfile:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving profile',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};
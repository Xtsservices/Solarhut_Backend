import { Request, Response } from 'express';
import * as employeeQueries from '../queries/employeeQueries';
import * as otpQueries from '../queries/otpQueries';
import { generateToken } from '../utils/authUtils';
import { generateOTP, sendSMS, formatMobile } from '../utils/otpUtils';
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
        if (activeOTP) {
            return res.status(400).json({
                success: false,
                message: 'An OTP is already active. Please wait before requesting a new one.'
            });
        }

        // Generate and save new OTP
        const otp = generateOTP();
        await otpQueries.createOTP(formattedMobile, otp);

        // Send OTP via SMS
        const message = `Your Solar Hut login OTP is: ${otp}. Valid for 3 minutes.`;
        await sendSMS(formattedMobile, message);

        res.json({
            success: true,
            message: 'OTP sent successfully. Valid for 3 minutes'
        });
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
                    roles: employee.roles
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
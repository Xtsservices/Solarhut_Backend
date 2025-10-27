import { Request, Response } from 'express';
import { db } from '../db';
import { contactQueries } from '../queries/contactQueries';
import { validations, ValidationResult } from '../utils/validations';

interface ContactRequest {
    first_name: string;
    last_name: string;
    mobile: string;
    email?: string;
    service_type: 'Installation' | 'Maintenance';
    capacity: string;
    message: string;
    location: string;
    home_type: string;
}

export const createContact = async (req: Request, res: Response) => {
    try {
        const {
            first_name,
            last_name,
            mobile,
            email,
            service_type,
            capacity,
            message,
            location,
            home_type
        }: ContactRequest = req.body;

        // Validate all fields
        const validationResult = new ValidationResult();

        // Required fields validation
        if (!first_name) validationResult.addError('first_name', 'First name is required');
        if (!last_name) validationResult.addError('last_name', 'Last name is required');
        if (!mobile) validationResult.addError('mobile', 'Mobile number is required');
        if (!service_type) validationResult.addError('service_type', 'Service type is required');
        if (!location) validationResult.addError('location', 'Location is required');
        if (!home_type) validationResult.addError('home_type', 'Home type is required');
        if (!message) validationResult.addError('message', 'Message is required');
        if (!capacity) validationResult.addError('capacity', 'Capacity is required');

        // Format validations (only if fields are provided)
        if (first_name && !validations.isValidName(first_name)) {
            validationResult.addError('first_name', 'First name must contain only alphabets and be between 2-50 characters');
        }

        if (last_name && !validations.isValidName(last_name)) {
            validationResult.addError('last_name', 'Last name must contain only alphabets and be between 2-50 characters');
        }

        if (mobile && !validations.isValidMobile(mobile)) {
            validationResult.addError('mobile', 'Invalid mobile number format. Use 10-digit Indian format or international format with country code');
        }

        if (email && !validations.isValidEmail(email)) {
            validationResult.addError('email', 'Invalid email format');
        }

        if (service_type && !validations.isValidServiceType(service_type)) {
            validationResult.addError('service_type', 'Service type must be either Installation or Maintenance');
        }

        if (capacity && !validations.isValidCapacity(capacity)) {
            validationResult.addError('capacity', 'Invalid capacity format. Use format like "2 Tons" or "10 KW"');
        }

        if (message && !validations.isValidMessage(message)) {
            validationResult.addError('message', 'Message must be between 5 and 500 characters');
        }

        if (location && !validations.isValidLocation(location)) {
            validationResult.addError('location', 'Location cannot be empty');
        }

        if (home_type && !validations.isValidHomeType(home_type)) {
            validationResult.addError('home_type', 'Invalid home type selected');
        }

        // Check if there are any validation errors
        if (validationResult.hasErrors()) {
            return res.status(400).json({
                success: false,
                errors: validationResult.getErrors()
            });
        }

        const values = [
            first_name,
            last_name,
            mobile,
            email || null,
            service_type,
            capacity,
            message,
            location,
            home_type
        ];

        const [result] = await db.execute(contactQueries.createContact, values);

        res.status(201).json({
            success: true,
            message: 'Contact request submitted successfully'
        });

    } catch (error) {
        console.error('Error in contact submission:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
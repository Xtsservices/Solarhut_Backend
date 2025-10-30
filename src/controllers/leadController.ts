import { Request, Response } from 'express';
import { db } from '../db';
import { leadQueries } from '../queries/leadQueries';
import { leadSchema } from '../utils/validations';

interface LeadRequest {
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

export const createLead = async (req: Request, res: Response) => {
    try {
        // Validate request body using Joi
        const { error, value } = leadSchema.create.validate(req.body, { abortEarly: false });

        if (error) {
            return res.status(400).json({
                success: false,
                errors: error.details.map(detail => ({
                    field: detail.context?.key,
                    message: detail.message
                }))
            });
        }

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
        }: LeadRequest = value;

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

        const [result] = await db.execute(leadQueries.createLead, values);

        res.status(200).json({
            success: true,
            message: 'Lead created successfully'
        });

    } catch (error) {
        console.error('Error in lead creation:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
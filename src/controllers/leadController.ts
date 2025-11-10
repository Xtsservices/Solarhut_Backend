import { Request, Response } from 'express';
import * as leadQueries from '../queries/leadQueries';
import { leadSchema } from '../utils/validations';
import { getPropertyTypesBySolarService, validatePropertyTypeForSolarService } from '../utils/propertyTypes';

interface LeadRequest {
    first_name: string;
    last_name: string;
    mobile: string;
    email?: string;
    service_type: 'Installation' | 'Maintenance';
    solar_service: 'Residential Solar' | 'Commercial Solar' | 'Industrial Solar';
    capacity: string;
    message: string;
    location: string;
    property_type: string;
}

export const createLead = async (req: Request, res: Response) => {
    try {
        // Validate request body using Joi
        console.log("1")
        const { error, value } = leadSchema.create.validate(req.body, { abortEarly: false });
        console.log("Checking error:", error);
        console.log("Validated value:", value);
        if (error) {
            return res.status(400).json({
                success: false,
                errors: error.details.map(detail => ({
                    field: detail.context?.key,
                    message: detail.message
                }))
            });
        }
        console.log("1")
        const {
            first_name,
            last_name,
            mobile,
            email,
            service_type,
            solar_service,
            capacity,
            message,
            location,
            property_type
        }: LeadRequest = value;
        console.log("2")        
        const values = [
            first_name,
            last_name,
            mobile,
            email || null,
            service_type,
            solar_service,
            capacity,
            message,
            location,
            property_type
        ];

        console.log("3")

        const id = await leadQueries.createLead({
            first_name,
            last_name,
            mobile,
            email,
            service_type,
            solar_service,
            capacity,
            message,
            location,
            property_type
        });
        console.log("4")

        const lead = await leadQueries.getLeadById(id);

        res.status(201).json({
            success: true,
            message: 'Lead created successfully',
            data: lead
        });

    } catch (error) {
        console.error('Error in lead creation:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getAllLeads = async (req: Request, res: Response) => {
    try {
        const leads = await leadQueries.getAllLeads();
        res.json({
            success: true,
            data: leads
        });
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching leads',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getLeadById = async (req: Request, res: Response) => {
    try {
        const lead = await leadQueries.getLeadById(parseInt(req.params.id));
        if (!lead) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found'
            });
        }
        res.json({
            success: true,
            data: lead
        });
    } catch (error) {
        console.error('Error fetching lead:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching lead',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getLeadsByDateRange = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }

        const leads = await leadQueries.getLeadsByDateRange(
            new Date(startDate as string),
            new Date(endDate as string)
        );
        
        res.json({
            success: true,
            data: leads
        });
    } catch (error) {
        console.error('Error fetching leads by date range:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching leads',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getLeadsByServiceType = async (req: Request, res: Response) => {
    try {
        const { serviceType } = req.params;
        if (serviceType !== 'Installation' && serviceType !== 'Maintenance') {
            return res.status(400).json({
                success: false,
                message: 'Invalid service type. Must be either Installation or Maintenance'
            });
        }

        const leads = await leadQueries.getLeadsByServiceType(serviceType);
        res.json({
            success: true,
            data: leads
        });
    } catch (error) {
        console.error('Error fetching leads by service type:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching leads',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getPropertyTypesForSolarService = async (req: Request, res: Response) => {
    try {
        const { solarService } = req.params;
        const validSolarServices = ['Residential Solar', 'Commercial Solar', 'Industrial Solar'];

        if (!validSolarServices.includes(solarService)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid solar service type'
            });
        }

        const propertyTypes = getPropertyTypesBySolarService(solarService);
        res.json({
            success: true,
            data: propertyTypes
        });
    } catch (error) {
        console.error('Error getting property types:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting property types',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getLeadsByPropertyType = async (req: Request, res: Response) => {
    try {
        const { propertyType } = req.params;
        const { solarService } = req.query;

        if (!solarService) {
            return res.status(400).json({
                success: false,
                message: 'Solar service type is required'
            });
        }

        if (!validatePropertyTypeForSolarService(propertyType, solarService as string)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid property type for selected solar service'
            });
        }

        const leads = await leadQueries.getLeadsByPropertyType(propertyType as leadQueries.Lead['property_type']);
        res.json({
            success: true,
            data: leads
        });
    } catch (error) {
        console.error('Error fetching leads by home type:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching leads',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getLeadsBySolarService = async (req: Request, res: Response) => {
    try {
        const { solarService } = req.params;
        const validSolarServices = ['Residential Solar', 'Commercial Solar', 'Industrial Solar'];

        if (!validSolarServices.includes(solarService)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid solar service type. Must be Residential Solar, Commercial Solar, or Industrial Solar'
            });
        }

        const leads = await leadQueries.getLeadsBySolarService(solarService as leadQueries.Lead['solar_service']);
        res.json({
            success: true,
            data: leads
        });
    } catch (error) {
        console.error('Error fetching leads by solar service:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching leads',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getLeadStats = async (req: Request, res: Response) => {
    try {
        const stats = await leadQueries.getLeadStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching lead statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching lead statistics',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};
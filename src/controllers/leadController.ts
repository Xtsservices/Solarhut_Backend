import { Request, Response } from 'express';
import * as leadQueries from '../queries/leadQueries';
import { leadSchema } from '../utils/validations';
import { getPropertyTypesBySolarService, validatePropertyTypeForSolarService } from '../utils/propertyTypes';
import * as employeeQueries from '../queries/employeeQueries';
import { notifyAssignment } from '../utils/notification';

// Default mapping from solar_service to suggested roles (admin can override)
const defaultRoleMapping: Record<string, string[]> = {
    'Residential Solar': ['Sales Person'],
    'Commercial Solar': ['Sales Person'],
    'Industrial Solar': ['Field Executive', 'Installation Technician']
};

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
        console.log("4 - insert id:", id);

        const lead = await leadQueries.getLeadById(id);
        console.log('fetched lead after insert:', lead);

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

// Update lead status
export const updateLeadStatus = async (req: Request, res: Response) => {
    try {
        const leadId = parseInt(req.params.id);
        const { status } = req.body;

    const validStatuses = ['New', 'Assigned', 'In Progress', 'Closed', 'Rejected', 'Complete', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Valid values: ${validStatuses.join(', ')}`
            });
        }

        const updated = await leadQueries.updateLeadStatus(leadId, status as any);
        if (!updated) {
            return res.status(400).json({ success: false, message: 'Failed to update status or lead not found' });
        }

        const lead = await leadQueries.getLeadById(leadId);
        res.json({ success: true, message: 'Status updated', data: lead });
    } catch (error) {
        console.error('Error updating lead status:', error);
        res.status(500).json({ success: false, message: 'Error updating lead status', error: process.env.NODE_ENV === 'development' ? error : undefined });
    }
};

// Assign lead to employee (sets assigned_to and status = 'Assigned')
export const assignLead = async (req: Request, res: Response) => {
    try {
        const leadId = parseInt(req.params.id);
        const { employeeId } = req.body;

        if (!employeeId || typeof employeeId !== 'number') {
            return res.status(400).json({ success: false, message: 'employeeId is required and must be a number' });
        }

        // verify employee exists
        const employee = await employeeQueries.getEmployeeById(employeeId);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        const updated = await leadQueries.assignLeadToEmployee(leadId, employeeId);
        if (!updated) {
            return res.status(400).json({ success: false, message: 'Failed to assign lead or lead not found' });
        }

        const lead = await leadQueries.getLeadById(leadId);
                // send notification to employee (sms/email) - best-effort
                try {
                    await notifyAssignment(employee.mobile, employee.email, leadId);
                } catch (e) {
                    console.error('Notification sending failed:', e);
                }

                res.json({ success: true, message: 'Lead assigned', data: lead });
    } catch (error) {
        console.error('Error assigning lead:', error);
        res.status(500).json({ success: false, message: 'Error assigning lead', error: process.env.NODE_ENV === 'development' ? error : undefined });
    }
};

// Get candidate employees for a lead based on role or lead.solar_service
export const getLeadCandidates = async (req: Request, res: Response) => {
    try {
        const leadId = parseInt(req.params.id);
        const { roleName } = req.query as { roleName?: string };

        const lead = await leadQueries.getLeadById(leadId);
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        let rolesToUse: string[] = [];
        if (roleName) {
            rolesToUse = [roleName];
        } else {
            rolesToUse = defaultRoleMapping[lead.solar_service] || ['Sales Person'];
        }

        // Collect employees for each role
        const candidates: any[] = [];
        for (const r of rolesToUse) {
            const emps = await employeeQueries.getEmployeesByRoleName(r);
            for (const e of emps) {
                // format employee minimal info and include matched role
                candidates.push({
                    id: e.id,
                    user_id: e.user_id,
                    first_name: e.first_name,
                    last_name: e.last_name,
                    email: e.email,
                    mobile: e.mobile,
                    roles: e.roles || [],
                    matchedRole: r
                });
            }
        }

        res.json({ success: true, data: candidates });
    } catch (error) {
        console.error('Error getting lead candidates:', error);
        res.status(500).json({ success: false, message: 'Error getting lead candidates', error: process.env.NODE_ENV === 'development' ? error : undefined });
    }
};
import { Request, Response } from 'express';
import * as estimationQueries from '../queries/estimationQueries';
import * as customerQueries from '../queries/customerQueries';
// Import PDF generator and employee queries
const { generateEstimationPDF } = require('../utils/pdfgenerate');
const employeeQueries = require('../queries/employeeQueries');
import { 
    estimationSchema, 
    estimationUpdateSchema, 
    autoCustomerSchema,
    employeeEstimationSchema,
    estimationApprovalSchema,
    estimationRejectionSchema 
} from '../utils/validations';
import { db } from '../db';
import { PoolConnection } from 'mysql2/promise';

export const createEstimation = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        // Public endpoint - created_by is optional (customer submissions)
        const userId = res.locals?.user?.id;

        // Validate request body
        const { error, value } = estimationSchema.validate({
            ...req.body,
            created_by: userId || null
        }, { abortEarly: false });

        if (error) {
            const errorMessages = error.details.map((d) => {
                // Enhanced error messages for frontend
                const field = d.context?.key || 'Unknown';
                const type = d.type;
                
                switch(type) {
                    case 'string.empty':
                        return `${field} is required and cannot be empty`;
                    case 'any.required':
                        return `${field} is required`;
                    case 'string.pattern.base':
                        return d.message; // Use custom message from schema
                    case 'string.max':
                        return `${field} cannot exceed ${d.context?.limit} characters`;
                    case 'number.min':
                        return `${field} must be a positive number`;
                    case 'string.email':
                        return `${field} must be a valid email address`;
                    case 'any.only':
                        return `${field} is invalid. Valid options are: ${d.context?.valids?.join(', ')}`;
                    default:
                        return d.message;
                }
            });

            return res.status(400).json({
                success: false,
                message: 'Validation error - Please check the following fields',
                field_errors: error.details.reduce((acc, err) => {
                    const field = err.context?.key || 'unknown';
                    acc[field] = err.message;
                    return acc;
                }, {} as Record<string, string>),
                errors: errorMessages
            });
        }

        // Map inverter_capacity to requested_watts (field name mapping)
        if (value.inverter_capacity && !value.requested_watts) {
            value.requested_watts = value.inverter_capacity;
        }
        delete value.inverter_capacity;

        // Get database connection and start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            let customerId = null;
            let existingCustomerResult = null;
            let customerServiceCreated = false;

            // Step 1: Handle customer creation/lookup (required for estimation)
            if (!value.first_name || !value.mobile) {
                throw new Error('First name and mobile are required to create an estimation');
            }

            // Check if we can find an existing customer by mobile
            existingCustomerResult = await customerQueries.findCustomerByMobileWithServices(
                value.mobile, 
                value.solar_service || 'Residential', 
                connection
            );

            if (existingCustomerResult && existingCustomerResult.customer) {
                // Existing customer found
                customerId = existingCustomerResult.customer.id;
                console.log(`✅ Found existing customer: ${customerId} (${existingCustomerResult.customer.customer_code})`);
                
                // Check if this is a returning customer for a different service
                if (existingCustomerResult.is_returning_customer) {
                    console.log(`📊 Returning customer with ${existingCustomerResult.total_services} previous service(s)`);
                }
            } else {
                // Create new customer from estimation data
                const customerData = {
                    first_name: value.first_name,
                    last_name: value.last_name || null,
                    mobile: value.mobile,
                    email: value.email || null,
                    customer_type: 'Individual',
                    company_name: null,
                    lead_source: 'Estimation Request'
                };

                // Validate customer data
                const { error: customerError, value: customerValue } = autoCustomerSchema.create.validate(customerData, { abortEarly: false });
                if (customerError) {
                    throw new Error(`Customer validation error: ${customerError.details.map(d => d.message).join(', ')}`);
                }

                // Create customer
                const customer = await customerQueries.createOrFindCustomer(customerValue, userId || 1, connection);
                customerId = customer.id;
                
                console.log(`✅ Created new customer: ${customerId} (${customer.customer_code})`);
            }

            // Step 2: Set customer_id in estimation data
            value.customer_id = customerId;

            // Step 3: Create the estimation with customer_id
            const estimation = await estimationQueries.createEstimation(value, connection);
            const estimationId = estimation.id;
            console.log(`✅ Created estimation: ${estimationId} linked to customer: ${customerId}`);

            // Step 4: Create customer service record (optional enhancement)
            try {
                await customerQueries.createCustomerService({
                    customer_id: customerId,
                    service_type: value.solar_service || 'Residential',
                    service_status: 'Quotation',
                    solar_service: value.solar_service || 'Residential',
                    estimated_capacity: value.requested_watts || undefined,
                    estimated_cost: value.amount,
                    service_description: `Estimation request for ${value.service_type || 'Installation'} - ${value.solar_service || 'Residential'}`,
                    estimation_id: estimationId,
                    priority: 'Medium',
                    source: 'Estimation Request',
                    notes: `Estimation created for ${value.first_name} ${value.last_name}: ${estimationId}`
                }, userId || 1, connection);

                console.log(`✅ Created customer service record for estimation: ${estimationId}`);
                customerServiceCreated = true;
            } catch (serviceError: any) {
                console.warn(`⚠️ Customer service creation skipped:`, serviceError.message);
                // Don't fail the entire request - estimation is already created
            }

            await connection.commit();

            res.status(201).json({
                success: true,
                message: 'Estimation created successfully with customer reference',
                data: {
                    estimation,
                    customer_info: {
                        customer_id: customerId,
                        is_new_customer: !existingCustomerResult?.is_returning_customer,
                        total_services: existingCustomerResult?.total_services || 1,
                        service_created: customerServiceCreated
                    }
                }
            });

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

    } catch (error: any) {
        console.error('Error creating estimation:', error);

        res.status(500).json({
            success: false,
            message: 'Error creating estimation',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

export const getAllEstimations = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const { status, state, district, includeInactive } = req.query;
        const filters: any = {};

        if (status && typeof status === 'string') {
            filters.status = status;
        }

        if (state && typeof state === 'string') {
            filters.state = state;
        }

        if (district && typeof district === 'string') {
            filters.district = district;
        }

        // Support includeInactive parameter
        if (includeInactive === 'true') {
            filters.includeInactive = true;
        }

        let estimations;
        let accessInfo;

        // Role-based access control
        if (user.roles?.includes('SuperAdmin') || user.roles?.includes('Admin')) {
            estimations = await estimationQueries.getAllEstimations(filters);
            accessInfo = {
                role: user.role,
                access_level: 'all_estimations'
            };
        } else {
            // Employee: only see estimations for customers they have jobs assigned to
            estimations = await estimationQueries.getEstimationsForEmployee(user.id, filters);
            accessInfo = {
                role: 'Employee',
                access_level: 'assigned_customers_only',
                employee_id: user.id
            };
        }

        res.json({
            success: true,
            count: estimations.length,
            data: estimations,
            access_info: accessInfo
        });
    } catch (error) {
        console.error('Error fetching estimations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching estimations',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getEstimationById = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const estimationId = parseInt(req.params.id);
        const { includeInactive } = req.query;
        const includeInactiveFlag = includeInactive === 'true';
        
        const estimation = await estimationQueries.getEstimationById(estimationId, includeInactiveFlag);
        if (!estimation) {
            return res.status(404).json({
                success: false,
                message: 'Estimation not found'
            });
        }

        // Role-based access control
        if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
            // Employee: check if they have access to this estimation
            const hasAccess = await estimationQueries.hasEstimationAccess(user.id, estimationId);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: You are not authorized to view this estimation'
                });
            }
        }

        res.json({
            success: true,
            data: estimation
        });
    } catch (error) {
        console.error('Error fetching estimation:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching estimation',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getEstimationsByMobile = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const { mobile } = req.params;
        let estimations;
        let accessInfo;

        // Role-based access control
        if (user.roles?.includes('SuperAdmin') || user.roles?.includes('Admin')) {
            estimations = await estimationQueries.getEstimationsByMobile(mobile);
            accessInfo = {
                role: user.role,
                access_level: 'all_estimations'
            };
        } else {
            // Employee: only see estimations for customers they have jobs assigned to
            estimations = await estimationQueries.getEstimationsByMobileForEmployee(user.id, mobile);
            accessInfo = {
                role: 'Employee',
                access_level: 'assigned_customers_only',
                employee_id: user.id
            };
        }

        res.json({
            success: true,
            count: estimations.length,
            data: estimations,
            mobile: mobile,
            access_info: accessInfo
        });
    } catch (error) {
        console.error('Error fetching estimations by mobile:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching estimations',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const updateEstimation = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const user = (res.locals as any).user;
        
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const updatedBy = user?.employee_id || req.body.updated_by || user.id;

        console.log('DEBUG - UpdateEstimation called with:');
        console.log('ID:', id);
        console.log('Request Body:', JSON.stringify(req.body, null, 2));
        console.log('Updated By:', updatedBy);

        // Check if estimation exists
        const existingEstimation = await estimationQueries.getEstimationById(id, true);
        if (!existingEstimation) {
            return res.status(404).json({
                success: false,
                message: 'Estimation not found'
            });
        }

        // Role-based access control
        if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
            // Employee: check if they have access to this estimation
            const hasAccess = await estimationQueries.hasEstimationAccess(user.id, id);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: You are not authorized to update this estimation'
                });
            }
        }

        // Validate update data
        const { error, value } = estimationUpdateSchema.validate(req.body, { stripUnknown: true });
        if (error) {
            console.log('DEBUG - Validation error:', error.details);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map((d) => d.message)
            });
        }

        console.log('DEBUG - Validated data:', JSON.stringify(value, null, 2));

        const updated = await estimationQueries.updateEstimation(id, value, updatedBy);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Estimation not found or no changes made'
            });
        }

        const estimation = await estimationQueries.getEstimationById(id);
        console.log('DEBUG - Updated estimation:', JSON.stringify(estimation, null, 2));
        
        res.json({
            success: true,
            message: 'Estimation updated successfully',
            data: estimation
        });
    } catch (error) {
        console.error('Error updating estimation:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating estimation',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const deleteEstimation = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const id = parseInt(req.params.id);

        // Check if estimation exists
        const existingEstimation = await estimationQueries.getEstimationById(id, true);
        if (!existingEstimation) {
            return res.status(404).json({
                success: false,
                message: 'Estimation not found'
            });
        }

        // Role-based access control
        if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
            // Employee: check if they have access to this estimation
            const hasAccess = await estimationQueries.hasEstimationAccess(user.id, id);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: You are not authorized to delete this estimation'
                });
            }
        }

        const deleted = await estimationQueries.deleteEstimation(id);

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Estimation not found or already deleted'
            });
        }

        res.json({
            success: true,
            message: 'Estimation deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting estimation:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting estimation',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};



export const downloadEstimationPDF = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        // Note: This endpoint may be accessed without authentication (public for customer downloads)
        // Check if user exists and apply access control accordingly
        
        const id = parseInt(req.params.id);
        // For downloads, include inactive records so users can still download previously deleted estimations
        const estimation = await estimationQueries.getEstimationById(id, true);

        if (!estimation) {
            return res.status(404).json({
                success: false,
                message: 'Estimation not found'
            });
        }

        // Role-based access control (only if user is authenticated)
        if (user && user.id && !user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
            // Employee: check if they have access to this estimation
            const hasAccess = await estimationQueries.hasEstimationAccess(user.id, id);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: You are not authorized to download this estimation'
                });
            }
        }

        // Fetch employee data if created_by exists
        let employee: any = null;
        if (estimation.created_by) {
            employee = await employeeQueries.getEmployeeById(estimation.created_by);
        }

        // Generate PDF with employee data
        const doc = generateEstimationPDF(estimation, employee);

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=estimation-${estimation.id}.pdf`);

        // Pipe the PDF to response
        doc.pipe(res);
        doc.end();

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating PDF',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

// My Estimations - 4 Tab System based on Job Status
export const getMyRunningEstimations = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const isEmployee = !user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin');
        const estimations = await estimationQueries.getRunningEstimations(user.id, isEmployee);

        res.json({
            success: true,
            count: estimations.length,
            data: estimations,
            tab: 'running_estimations',
            description: 'All new estimations (without job assigned) and estimations with active jobs',
            statuses_included: ['Active (new estimations without jobs)', 'Site Visit', 'Estimation Generated', 'Processed', 'Partial Payment Done', 'Payment Done', 'Invoice Generated']
        });
    } catch (error) {
        console.error('Error fetching running estimations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching running estimations',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getMyPendingEstimations = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const isEmployee = !user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin');
        const estimations = await estimationQueries.getPendingEstimations(user.id, isEmployee);

        res.json({
            success: true,
            count: estimations.length,
            data: estimations,
            tab: 'pending_estimations',
            statuses_included: ['Pending on Portal', 'Payment Pending']
        });
    } catch (error) {
        console.error('Error fetching pending estimations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching pending estimations',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getMyWaitingForApprovalEstimations = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const isEmployee = !user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin');
        const estimations = await estimationQueries.getWaitingForApprovalEstimations(user.id, isEmployee);

        res.json({
            success: true,
            count: estimations.length,
            data: estimations,
            tab: 'waiting_for_approval',
            statuses_included: ['Active'],
            note: isEmployee ? 'Only shows estimations for jobs you created' : 'Shows all jobs waiting for approval'
        });
    } catch (error) {
        console.error('Error fetching waiting for approval estimations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching waiting for approval estimations',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getMyCompletedEstimations = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const isEmployee = !user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin');
        const estimations = await estimationQueries.getCompletedEstimations(user.id, isEmployee);

        res.json({
            success: true,
            count: estimations.length,
            data: estimations,
            tab: 'completed_estimations',
            statuses_included: ['Job Done']
        });
    } catch (error) {
        console.error('Error fetching completed estimations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching completed estimations',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

// Get summary counts for all 4 estimation tabs
export const getMyEstimationsSummary = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const isEmployee = !user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin');

        // Get counts for all 4 tabs
        const [runningEstimations, pendingEstimations, waitingForApprovalEstimations, completedEstimations] = await Promise.all([
            estimationQueries.getRunningEstimations(user.id, isEmployee),
            estimationQueries.getPendingEstimations(user.id, isEmployee),
            estimationQueries.getWaitingForApprovalEstimations(user.id, isEmployee),
            estimationQueries.getCompletedEstimations(user.id, isEmployee)
        ]);

        res.json({
            success: true,
            summary: {
                running: {
                    count: runningEstimations.length,
                    description: 'All new estimations + estimations with active jobs',
                    statuses: ['Active (new estimations without jobs)', 'Site Visit', 'Estimation Generated', 'Processed', 'Partial Payment Done', 'Payment Done', 'Invoice Generated']
                },
                pending: {
                    count: pendingEstimations.length,
                    statuses: ['Pending on Portal', 'Payment Pending']
                },
                waiting_for_approval: {
                    count: waitingForApprovalEstimations.length,
                    statuses: ['Active'],
                    note: isEmployee ? 'Jobs you created needing approval' : 'All jobs waiting for approval'
                },
                completed: {
                    count: completedEstimations.length,
                    statuses: ['Job Done']
                }
            },
            total_estimations: runningEstimations.length + pendingEstimations.length + waitingForApprovalEstimations.length + completedEstimations.length,
            access_level: isEmployee ? 'assigned_jobs_only' : 'all_estimations'
        });
    } catch (error) {
        console.error('Error fetching estimations summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching estimations summary',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

// ============ CONVERT ESTIMATION TO JOB ============

// Convert Estimation to Job (SuperAdmin/Admin only, no approvals needed)
export const convertEstimationToJob = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required - User information not found',
                error_code: 'AUTH_REQUIRED'
            });
        }

        // Only SuperAdmin/Admin can convert estimations to jobs
        if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied - Only SuperAdmin and Admin users can convert estimations to jobs',
                error_code: 'INSUFFICIENT_PERMISSIONS',
                user_roles: user.roles
            });
        }

        const estimationId = parseInt(req.params.id);
        
        if (!estimationId || estimationId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid estimation ID provided',
                error_code: 'INVALID_ID'
            });
        }

        // Check if estimation exists
        const estimation = await estimationQueries.getEstimationById(estimationId, true);
        if (!estimation) {
            return res.status(404).json({
                success: false,
                message: `Estimation with ID ${estimationId} not found`,
                error_code: 'ESTIMATION_NOT_FOUND',
                estimation_id: estimationId
            });
        }

        // Check if job already exists for this estimation
        const existingJob = await estimationQueries.checkExistingJobForEstimation(estimationId);
        if (existingJob) {
            return res.status(409).json({
                success: false,
                message: `A job has already been created for this estimation. Cannot create duplicate job.`,
                error_code: 'JOB_ALREADY_EXISTS',
                existing_job_id: existingJob,
                estimation_id: estimationId
            });
        }

        // Convert estimation to job
        const result = await estimationQueries.convertEstimationToJob(estimationId, user.id);

        if (!result.success) {
            const statusCode = result.error?.includes('not found') ? 404 : 500;
            return res.status(statusCode).json({
                success: false,
                message: result.message,
                details: result.error,
                error_code: 'CONVERSION_FAILED',
                estimation_id: estimationId
            });
        }

        // Fetch the created job
        const jobQueries = require('../queries/jobQueries');
        const job = await jobQueries.getJobById(result.job_id);

        res.status(201).json({
            success: true,
            message: result.message,
            data: {
                job,
                estimation_id: estimationId,
                conversion_info: {
                    converted_by: user.id,
                    converted_by_name: user.name || 'Admin User',
                    converted_at: new Date(),
                    status: 'Active',
                    job_status_tracking_created: true,
                    job_locations_created: true,
                    customer_auto_created: !estimation.customer_id,
                    location_auto_created: true
                }
            }
        });

    } catch (error: any) {
        console.error('Error converting estimation to job:', error);
        res.status(500).json({
            success: false,
            message: 'Error converting estimation to job',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            error_code: 'CONVERSION_ERROR'
        });
    }
};

// ============ APPROVAL WORKFLOW ENDPOINTS ============

// Employee: Create estimation (without GST) and automatically request approval if job is self-created
export const createEmployeeEstimation = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Only employees can use this endpoint (SuperAdmin/Admin use the regular createEstimation)
        if (user.roles?.includes('SuperAdmin') || user.roles?.includes('Admin')) {
            return res.status(403).json({
                success: false,
                message: 'SuperAdmin and Admin should use the regular estimation creation endpoint'
            });
        }

        // Validate using employee schema (no GST allowed)
        const { error, value } = employeeEstimationSchema.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map((d) => d.message)
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            let customerId = null;
            let existingCustomerResult = null;

            // Auto-customer creation logic (same as before)
            if (value.customer_name && value.mobile) {
                existingCustomerResult = await customerQueries.findCustomerByMobileWithServices(
                    value.mobile, 
                    value.service_type || 'Installation', 
                    connection
                );

                if (existingCustomerResult && existingCustomerResult.customer) {
                    customerId = existingCustomerResult.customer.id;
                    console.log(`Found existing customer: ${customerId} (${existingCustomerResult.customer.customer_code})`);
                    
                    if (existingCustomerResult.is_returning_customer) {
                        console.log(`Returning customer with ${existingCustomerResult.total_services} previous service(s)`);
                    }
                } else {
                    // Create new customer
                    const customerData = {
                        first_name: value.customer_name.split(' ')[0],
                        last_name: value.customer_name.split(' ').slice(1).join(' ') || null,
                        mobile: value.mobile,
                        email: null,
                        customer_type: 'Individual',
                        lead_source: 'Estimation Request'
                    };

                    const { error: customerError, value: customerValue } = autoCustomerSchema.create.validate(customerData, { abortEarly: false });
                    if (customerError) {
                        throw new Error(`Customer validation error: ${customerError.details.map(d => d.message).join(', ')}`);
                    }

                    const customer = await customerQueries.createOrFindCustomer(customerValue, user.id, connection);
                    customerId = customer.id;
                    
                    console.log(`Created new customer from estimation: ${customerId} (${customer.customer_code})`);
                }
            }

            // Create estimation with Draft status (employee cannot set GST)
            const estimationData = {
                ...value,
                gst: null, // GST will be set during approval
                status: 'Active',
                created_by: user.id
            };

            const estimationId = await estimationQueries.createEstimation(estimationData);
            
            // Create customer service record if customer was created/found
            if (customerId) {
                await customerQueries.createCustomerService({
                    customer_id: customerId,
                    service_type: value.service_type || 'Installation',
                    service_status: 'Quotation',
                    solar_service: value.service_type,
                    estimated_capacity: value.requested_watts,
                    estimated_cost: value.amount,
                    service_description: `Employee estimation request for ${value.service_type}`,
                    estimation_id: estimationId,
                    priority: 'Medium',
                    source: 'Employee Estimation',
                    notes: `Employee estimation created: ${estimationId}`
                }, user.id, connection);

                console.log(`Created customer service record for estimation: ${estimationId}`);
            }

            // Automatically request approval (employee estimations always need approval)
            const approvalRequested = await estimationQueries.requestEstimationApproval(estimationId, user.id);
            
            if (!approvalRequested) {
                throw new Error('Failed to request approval for estimation');
            }

            const estimation = await estimationQueries.getEstimationById(estimationId);

            await connection.commit();

            res.status(201).json({
                success: true,
                message: 'Estimation created successfully with Active status',
                data: {
                    estimation,
                    note: 'Estimation created. Status: Active. GST and final amount can be set during updates.',
                    customer_info: customerId ? {
                        customer_id: customerId,
                        is_new_customer: !existingCustomerResult?.is_returning_customer,
                        total_services: existingCustomerResult?.total_services || 1
                    } : null
                }
            });

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

    } catch (error: any) {
        console.error('Error creating employee estimation:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating estimation',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// SuperAdmin/Admin: Get pending approval estimations
export const getPendingApprovalEstimations = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Only SuperAdmin and Admin can access this
        if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only SuperAdmin and Admin can view pending approval estimations.'
            });
        }

        const estimations = await estimationQueries.getPendingApprovalEstimations();

        res.json({
            success: true,
            count: estimations.length,
            data: estimations,
            message: estimations.length === 0 ? 'No estimations pending approval' : `${estimations.length} estimation(s) pending approval`
        });
    } catch (error) {
        console.error('Error fetching pending approval estimations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching pending approval estimations',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

// SuperAdmin/Admin: Approve estimation
export const approveEstimation = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Only SuperAdmin and Admin can approve
        if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only SuperAdmin and Admin can approve estimations.'
            });
        }

        const estimationId = parseInt(req.params.id);
        if (!estimationId) {
            return res.status(400).json({ success: false, message: 'Invalid estimation ID' });
        }

        // Validate approval data
        const { error, value } = estimationApprovalSchema.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map((d) => d.message)
            });
        }

        // Check if estimation exists and is pending approval
        const existingEstimation = await estimationQueries.getEstimationById(estimationId);
        if (!existingEstimation) {
            return res.status(404).json({
                success: false,
                message: 'Estimation not found'
            });
        }

        if (existingEstimation.status !== 'Active') {
            return res.status(400).json({
                success: false,
                message: `Cannot approve estimation with status: ${existingEstimation.status}. Only estimations with 'Active' status can be approved.`
            });
        }

        // Approve the estimation
        const approved = await estimationQueries.approveEstimation(estimationId, value, user.id);

        if (!approved) {
            return res.status(400).json({
                success: false,
                message: 'Failed to approve estimation. It may have been modified by another user.'
            });
        }

        // Get updated estimation
        const updatedEstimation = await estimationQueries.getEstimationById(estimationId);

        // TODO: Send notification to the employee who created the estimation
        try {
            const notificationData = {
                type: 'estimation_approved',
                estimation_id: estimationId,
                employee_id: existingEstimation.created_by,
                approved_by: user.id,
                approver_name: `${user.first_name} ${user.last_name}`,
                final_amount: value.final_amount,
                gst: value.gst
            };
            
            console.log('Estimation approval notification:', notificationData);
            // await notificationService.notifyEstimationApproval(notificationData);
        } catch (notificationError) {
            console.error('Failed to send approval notification:', notificationError);
        }

        res.json({
            success: true,
            message: 'Estimation approved successfully',
            data: updatedEstimation
        });

    } catch (error) {
        console.error('Error approving estimation:', error);
        res.status(500).json({
            success: false,
            message: 'Error approving estimation',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

// SuperAdmin/Admin: Reject estimation
export const rejectEstimation = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Only SuperAdmin and Admin can reject
        if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only SuperAdmin and Admin can reject estimations.'
            });
        }

        const estimationId = parseInt(req.params.id);
        if (!estimationId) {
            return res.status(400).json({ success: false, message: 'Invalid estimation ID' });
        }

        // Validate rejection data
        const { error, value } = estimationRejectionSchema.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map((d) => d.message)
            });
        }

        // Check if estimation exists and is pending approval
        const existingEstimation = await estimationQueries.getEstimationById(estimationId);
        if (!existingEstimation) {
            return res.status(404).json({
                success: false,
                message: 'Estimation not found'
            });
        }

        if (existingEstimation.status !== 'Active') {
            return res.status(400).json({
                success: false,
                message: `Cannot reject estimation with status: ${existingEstimation.status}. Only estimations with 'Active' status can be rejected.`
            });
        }

        // Reject the estimation
        const rejected = await estimationQueries.rejectEstimation(estimationId, value.rejection_reason, user.id);

        if (!rejected) {
            return res.status(400).json({
                success: false,
                message: 'Failed to reject estimation. It may have been modified by another user.'
            });
        }

        // Get updated estimation
        const updatedEstimation = await estimationQueries.getEstimationById(estimationId);

        // TODO: Send rejection notification to the employee
        try {
            const notificationData = {
                type: 'estimation_rejected',
                estimation_id: estimationId,
                employee_id: existingEstimation.created_by,
                rejected_by: user.id,
                rejector_name: `${user.first_name} ${user.last_name}`,
                rejection_reason: value.rejection_reason
            };
            
            console.log('Estimation rejection notification:', notificationData);
            // await notificationService.notifyEstimationRejection(notificationData);
        } catch (notificationError) {
            console.error('Failed to send rejection notification:', notificationError);
        }

        res.json({
            success: true,
            message: 'Estimation rejected successfully',
            data: updatedEstimation
        });

    } catch (error) {
        console.error('Error rejecting estimation:', error);
        res.status(500).json({
            success: false,
            message: 'Error rejecting estimation',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

// Employee: Get my estimations by approval status
export const getMyEstimationsByStatus = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const { status } = req.params;
        const validStatuses = ['Draft', 'Pending_Approval', 'Approved', 'Rejected'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Valid statuses: ${validStatuses.join(', ')}`
            });
        }

        const estimations = await estimationQueries.getMyEstimationsByApprovalStatus(user.id, status);

        res.json({
            success: true,
            count: estimations.length,
            data: estimations,
            status: status,
            message: estimations.length === 0 ? `No estimations with status: ${status}` : `${estimations.length} estimation(s) with status: ${status}`
        });

    } catch (error) {
        console.error('Error fetching estimations by status:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching estimations by status',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

// Get estimation approval history
export const getEstimationApprovalHistory = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const estimationId = parseInt(req.params.id);
        if (!estimationId) {
            return res.status(400).json({ success: false, message: 'Invalid estimation ID' });
        }

        // Check access rights (employees can only see their own estimations, admin can see all)
        if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
            const estimation = await estimationQueries.getEstimationById(estimationId);
            if (!estimation || estimation.created_by !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. You can only view approval history of your own estimations.'
                });
            }
        }

        const history = await estimationQueries.getEstimationApprovalHistory(estimationId);

        if (!history) {
            return res.status(404).json({
                success: false,
                message: 'Estimation not found'
            });
        }

        res.json({
            success: true,
            data: history
        });

    } catch (error) {
        console.error('Error fetching estimation approval history:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching estimation approval history',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};


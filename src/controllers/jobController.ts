import { Request, Response } from 'express';
import * as jobQueries from '../queries/jobQueries';
import * as customerQueries from '../queries/customerQueries';
import { jobSchema, jobLocationSchema, jobAssignmentSchema, jobStatusTrackingSchema, jobPaymentSchema } from '../utils/validations';
import { db } from '../db';
import { PoolConnection } from 'mysql2/promise';

// Job CRUD Operations
export const createJob = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        // Validate request data
        const { error, value } = jobSchema.create.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map((d: any) => d.message) 
            });
        }

        // Get user ID from token payload
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Get database connection and start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Generate job code if not provided
            let jobCode = value.job_code;
            if (!jobCode) {
                jobCode = await jobQueries.generateJobCode(connection);
            }

            // Check if job code already exists
            const existingJob = await jobQueries.getJobByCode(jobCode, connection);
            if (existingJob) {
                throw new Error('Job code already exists. Please try again or provide a different job code.');
            }

            let customerId = value.customer_id;
            let locationId = value.location_id;

            // Handle customer creation or validation
            if (!customerId && value.customer) {
                // Check if customer with same mobile already exists
                const existingCustomerByMobile = await customerQueries.getCustomerByMobile(value.customer.mobile, connection);
                if (existingCustomerByMobile) {
                    throw new Error(`Customer with mobile ${value.customer.mobile} already exists. Use customer_id: ${existingCustomerByMobile.id} instead.`);
                }

                // Generate customer code if not provided
                const customerCode = await customerQueries.generateCustomerCode(connection);
                
                // Create new customer
                customerId = await customerQueries.createCustomer({
                    ...value.customer,
                    customer_code: customerCode
                }, user.id, connection);
                
                console.log(`Created new customer with ID: ${customerId}`);
            } else if (customerId) {
                // Verify existing customer
                const existingCustomer = await customerQueries.getCustomerById(customerId, connection);
                if (!existingCustomer) {
                    throw new Error('Customer not found. Please provide a valid customer ID.');
                }
            }

            // Handle location creation or validation
            if (!locationId && value.location && customerId) {
                // Create new customer location
                locationId = await customerQueries.createCustomerLocation({
                    ...value.location,
                    customer_id: customerId
                }, user.id, connection);
                
                console.log(`Created new customer location with ID: ${locationId}`);
            } else if (locationId && customerId) {
                // Verify existing location belongs to customer
                const customerLocations = await customerQueries.getCustomerLocations(customerId, connection);
                const locationExists = customerLocations.some(loc => loc.id === locationId);
                if (!locationExists) {
                    throw new Error('Location not found for this customer. Please provide a valid location ID.');
                }
            }

            // Prepare job data
            const jobData = {
                ...value,
                job_code: jobCode,
                customer_id: customerId,
                location_id: locationId
            };

            // Remove customer and location objects from job data
            delete jobData.customer;
            delete jobData.location;

            // Create the job
            const jobId = await jobQueries.createJob(jobData, user.id, connection);
            
            // Create initial status tracking entry
            await jobQueries.createJobStatusTracking({
                job_id: jobId,
                new_status: value.status || 'Created',
                status_reason: 'Job created',
                comments: value.customer ? 'Job created with new customer' : 'Job created with existing customer'
            }, user.id, connection);
            
            // Fetch the created job with details
            const job = await jobQueries.getJobById(jobId, connection);
            
            // Commit the transaction
            await connection.commit();

            res.status(201).json({ 
                success: true, 
                message: 'Job created successfully', 
                data: job,
                created_records: {
                    job_id: jobId,
                    job_code: jobCode,
                    customer_id: customerId,
                    location_id: locationId,
                    new_customer_created: !!value.customer,
                    new_location_created: !!value.location,
                    job_code_generated: !value.job_code
                },
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error creating job:', err);
        
        if (err.message.includes('already exists') || err.message.includes('not found')) {
            return res.status(400).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error creating job - transaction rolled back', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            transaction_status: 'rolled_back'
        });
    } finally {
        if (connection) connection.release();
    }
};

export const getJob = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid job id' });

        const job = await jobQueries.getJobById(id);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }

        // Get related data
        const [locations, assignments, statusHistory, payments] = await Promise.all([
            jobQueries.getJobLocationsByJobId(id),
            jobQueries.getJobAssignmentsByJobId(id),
            jobQueries.getJobStatusTrackingByJobId(id),
            jobQueries.getJobPaymentsByJobId(id)
        ]);

        const jobDetails = {
            ...job,
            locations,
            assignments,
            statusHistory,
            payments
        };

        res.json({ success: true, data: jobDetails });
    } catch (err) {
        console.error('Error fetching job:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching job', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const listJobs = async (req: Request, res: Response) => {
    try {
        const onlyActive = req.query.active !== 'false';
        const jobs = await jobQueries.getJobsWithDetails(onlyActive);
        
        // Structure each job into organized objects
        const structuredJobs = jobs.map(job => ({
            job_info: {
                id: job.id,
                job_code: job.job_code,
                service_type: job.service_type,
                solar_service: job.solar_service,
                capacity: job.capacity,
                estimated_cost: job.estimated_cost,
                actual_cost: job.actual_cost,
                job_priority: job.job_priority,
                scheduled_date: job.scheduled_date,
                completion_date: job.completion_date,
                job_description: job.job_description,
                special_instructions: job.special_instructions,
                status: job.status,
                created_at: job.created_at,
                updated_at: job.updated_at
            },
            customer_info: {
                customer_id: job.customer_id,
                customer_code: job.customer_code,
                customer_name: job.customer_name,
                customer_mobile: job.customer_mobile,
                customer_email: job.customer_email,
                customer_type: job.customer_type,
                company_name: job.company_name
            },
            location_info: {
                location_id: job.location_id,
                location_type: job.location_type,
                address_line_1: job.address_line_1,
                address_line_2: job.address_line_2,
                city: job.city,
                district_name: job.district_name,
                state_name: job.state_name,
                country_name: job.country_name,
                pincode: job.pincode,
                landmark: job.landmark,
                latitude: job.latitude,
                longitude: job.longitude
            },
            package_info: job.package_name ? {
                package_id: job.package_id,
                package_name: job.package_name,
                package_capacity: job.package_capacity,
                package_price: job.package_price
            } : null,
            payment_summary: {
                total_advance: job.total_advance || 0,
                total_milestone: job.total_milestone || 0,
                total_final: job.total_final || 0,
                total_paid: job.total_paid || 0,
                pending_amount: (job.estimated_cost || 0) - (job.total_paid || 0),
                payment_status: job.payment_status || 'Not Started'
            },
            status_info: {
                current_status: job.status,
                last_status_change: job.last_status_change,
                last_changed_by: job.last_changed_by,
                status_reason: job.last_status_reason,
                total_status_changes: job.total_status_changes || 0
            },
            assignment_info: {
                assigned_employees: job.assigned_employees || 0,
                lead_technician: job.lead_technician_name || null,
                assignment_status: job.assignment_status || 'Not Assigned'
            },
            creator_info: {
                created_by: job.created_by,
                created_by_name: job.created_by_name,
                updated_by: job.updated_by,
                updated_by_name: job.updated_by_name
            }
        }));
        
        res.json({ 
            success: true, 
            data: structuredJobs
        });
    } catch (err) {
        console.error('Error listing jobs:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error listing jobs', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const listJobsWithDetails = async (req: Request, res: Response) => {
    try {
        const onlyActive = req.query.active !== 'false';
        const jobs = await jobQueries.getJobsWithDetails(onlyActive);
        
        res.json({ 
            success: true, 
            data: jobs,
            filter: onlyActive ? 'active_only' : 'all_jobs',
            message: 'Jobs with comprehensive details retrieved successfully'
        });
    } catch (err) {
        console.error('Error listing jobs with details:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error listing jobs with details', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const updateJob = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid job id' });

        const { error, value } = jobSchema.update.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map((d: any) => d.message) 
            });
        }

        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if job exists
            const existingJob = await jobQueries.getJobById(id, connection);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            // Check for status change to create tracking entry
            if (value.status && value.status !== existingJob.status) {
                await jobQueries.createJobStatusTracking({
                    job_id: id,
                    previous_status: existingJob.status,
                    new_status: value.status,
                    status_reason: 'Status updated',
                    comments: `Status changed from ${existingJob.status} to ${value.status}`
                }, user.id, connection);
            }

            // Update the job
            const updated = await jobQueries.updateJob(id, value, user.id, connection);
            if (!updated) {
                throw new Error('Failed to update job or no changes provided');
            }

            // Fetch updated job
            const job = await jobQueries.getJobById(id, connection);
            
            await connection.commit();

            res.json({ 
                success: true, 
                message: 'Job updated successfully', 
                data: job,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error updating job:', err);
        
        if (err.message.includes('not found') || err.message.includes('Failed to update')) {
            const statusCode = err.message.includes('not found') ? 404 : 400;
            return res.status(statusCode).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error updating job - transaction rolled back', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            transaction_status: 'rolled_back'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// Job Location Operations
export const createJobLocation = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const { error, value } = jobLocationSchema.create.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map((d: any) => d.message) 
            });
        }

        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Verify job exists
            const existingJob = await jobQueries.getJobById(value.job_id, connection);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            const locationId = await jobQueries.createJobLocation(value, user.id, connection);
            
            // Get created location with details
            const [locations] = await Promise.all([
                jobQueries.getJobLocationsByJobId(value.job_id, connection)
            ]);
            
            const createdLocation = locations.find(loc => loc.id === locationId);
            
            await connection.commit();

            res.status(201).json({ 
                success: true, 
                message: 'Job location created successfully', 
                data: createdLocation,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error creating job location:', err);
        
        if (err.message.includes('not found')) {
            return res.status(404).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error creating job location - transaction rolled back', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            transaction_status: 'rolled_back'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// Job Assignment Operations
export const createJobAssignment = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const { error, value } = jobAssignmentSchema.create.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map((d: any) => d.message) 
            });
        }

        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Verify job exists
            const existingJob = await jobQueries.getJobById(value.job_id, connection);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            const assignmentId = await jobQueries.createJobAssignment(value, user.id, connection);
            
            // Update job status to Assigned if it was Created
            if (existingJob.status === 'Created') {
                await jobQueries.updateJob(value.job_id, { status: 'Assigned' }, user.id, connection);
                await jobQueries.createJobStatusTracking({
                    job_id: value.job_id,
                    previous_status: 'Created',
                    new_status: 'Assigned',
                    status_reason: 'Employee assigned to job',
                    comments: `Employee assigned with role: ${value.role_type}`
                }, user.id, connection);
            }
            
            // Get created assignment with details
            const [assignments] = await Promise.all([
                jobQueries.getJobAssignmentsByJobId(value.job_id, connection)
            ]);
            
            const createdAssignment = assignments.find(assign => assign.id === assignmentId);
            
            await connection.commit();

            res.status(201).json({ 
                success: true, 
                message: 'Job assignment created successfully', 
                data: createdAssignment,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error creating job assignment:', err);
        
        if (err.message.includes('not found') || err.message.includes('Duplicate entry')) {
            return res.status(400).json({ 
                success: false, 
                message: err.message.includes('Duplicate') ? 'Employee already assigned to this job with this role' : err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error creating job assignment - transaction rolled back', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            transaction_status: 'rolled_back'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// Job Payment Operations
export const createJobPayment = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const { error, value } = jobPaymentSchema.create.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map((d: any) => d.message) 
            });
        }

        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Verify job exists
            const existingJob = await jobQueries.getJobById(value.job_id, connection);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            const paymentId = await jobQueries.createJobPayment(value, user.id, connection);
            
            // Get created payment with details
            const [payments] = await Promise.all([
                jobQueries.getJobPaymentsByJobId(value.job_id, connection)
            ]);
            
            const createdPayment = payments.find(pay => pay.id === paymentId);
            
            await connection.commit();

            res.status(201).json({ 
                success: true, 
                message: 'Job payment created successfully', 
                data: createdPayment,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error creating job payment:', err);
        
        if (err.message.includes('not found')) {
            return res.status(404).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error creating job payment - transaction rolled back', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            transaction_status: 'rolled_back'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// Status Tracking Operations
export const updateJobStatus = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid job id' });

        const { error, value } = jobStatusTrackingSchema.create.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map((d: any) => d.message) 
            });
        }

        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Get current job
            const existingJob = await jobQueries.getJobById(id, connection);
            if (!existingJob) {
                throw new Error('Job not found');
            }

            // Create status tracking entry
            await jobQueries.createJobStatusTracking({
                job_id: id,
                previous_status: existingJob.status,
                new_status: value.new_status,
                status_reason: value.status_reason,
                comments: value.comments,
                attachment_url: value.attachment_url
            }, user.id, connection);

            // Update job status
            await jobQueries.updateJob(id, { status: value.new_status }, user.id, connection);
            
            // Get updated job
            const updatedJob = await jobQueries.getJobById(id, connection);
            
            await connection.commit();

            res.json({ 
                success: true, 
                message: 'Job status updated successfully', 
                data: updatedJob,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error updating job status:', err);
        
        if (err.message.includes('not found')) {
            return res.status(404).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error updating job status - transaction rolled back', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            transaction_status: 'rolled_back'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// Search and Filter Operations
export const searchJobs = async (req: Request, res: Response) => {
    try {
        const searchTerm = req.query.search as string;
        if (!searchTerm) {
            return res.status(400).json({ success: false, message: 'Search term is required' });
        }

        const filters = {
            status: req.query.status as string,
            service_type: req.query.service_type as string,
            date_from: req.query.date_from as string,
            date_to: req.query.date_to as string
        };

        const jobs = await jobQueries.searchJobs(searchTerm, filters);
        
        res.json({ 
            success: true, 
            data: jobs,
            search_term: searchTerm,
            filters_applied: Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
        });
    } catch (err) {
        console.error('Error searching jobs:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error searching jobs', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const getJobsByEmployee = async (req: Request, res: Response) => {
    try {
        const employeeId = parseInt(req.params.employeeId);
        if (!employeeId) {
            return res.status(400).json({ success: false, message: 'Invalid employee id' });
        }

        const jobs = await jobQueries.getJobsByEmployee(employeeId);
        
        res.json({ 
            success: true, 
            data: jobs
        });
    } catch (err) {
        console.error('Error fetching jobs by employee:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching jobs by employee', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export default { 
    createJob,
    getJob,
    listJobs,
    listJobsWithDetails,
    updateJob,
    createJobLocation,
    createJobAssignment,
    createJobPayment,
    updateJobStatus,
    searchJobs,
    getJobsByEmployee
};

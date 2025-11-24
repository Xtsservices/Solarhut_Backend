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
        // Pagination parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;
        
        // Filter parameter
        const onlyActive = req.query.active === 'true';
        
        // Get total count for pagination metadata
        const connection = await db.getConnection();
        let jobsWithAssignments: any[] = [];
        let totalJobs = 0;
        
        try {
            // Count total jobs based on filter
            let countQuery = 'SELECT COUNT(*) as total FROM jobs';
            if (onlyActive) {
                countQuery += ` WHERE status NOT IN ('Cancelled', 'Completed')`;
            }
            
            const [countResult] = await connection.execute(countQuery) as any;
            totalJobs = countResult[0].total;
            
            // Get paginated jobs with details
            let jobsQuery = `
                SELECT j.*, 
                       p.name as package_name, p.capacity as package_capacity, p.price as package_price,
                       p.original_price as package_original_price, p.savings as package_savings,
                       c.customer_code, c.full_name as customer_name, c.mobile as customer_mobile,
                       c.email as customer_email, c.customer_type, c.company_name,
                       cl.location_type, cl.address_line_1, cl.address_line_2, cl.city, 
                       cl.pincode, cl.landmark, cl.latitude, cl.longitude,
                       d.name as district_name, s.name as state_name, co.name as country_name,
                       l.first_name as lead_first_name, l.last_name as lead_last_name,
                       cb.first_name as created_by_name, ub.first_name as updated_by_name,
                       -- Latest status tracking
                       (SELECT jst.new_status FROM job_status_tracking jst 
                        WHERE jst.job_id = j.id 
                        ORDER BY jst.changed_at DESC LIMIT 1) as latest_status,
                       (SELECT jst.changed_at FROM job_status_tracking jst 
                        WHERE jst.job_id = j.id 
                        ORDER BY jst.changed_at DESC LIMIT 1) as latest_status_date,
                       (SELECT jst.comments FROM job_status_tracking jst 
                        WHERE jst.job_id = j.id 
                        ORDER BY jst.changed_at DESC LIMIT 1) as latest_status_comments,
                       -- Payment summary
                       (SELECT COUNT(*) FROM job_payments jp 
                        WHERE jp.job_id = j.id) as total_payments,
                       (SELECT COALESCE(SUM(jp.amount), 0) FROM job_payments jp 
                        WHERE jp.job_id = j.id AND jp.payment_status = 'Completed') as total_paid_amount,
                       (SELECT COALESCE(SUM(jp.amount), 0) FROM job_payments jp 
                        WHERE jp.job_id = j.id AND jp.payment_status = 'Pending') as pending_payment_amount,
                       -- Assignment summary
                       (SELECT COUNT(*) FROM job_assignments ja 
                        WHERE ja.job_id = j.id AND ja.assignment_status = 'Active') as active_assignments
                FROM jobs j
                LEFT JOIN packages p ON j.package_id = p.id
                LEFT JOIN customers c ON j.customer_id = c.id
                LEFT JOIN customer_locations cl ON j.location_id = cl.id
                LEFT JOIN districts d ON cl.district_id = d.id
                LEFT JOIN states s ON cl.state_id = s.id
                LEFT JOIN countries co ON cl.country_id = co.id
                LEFT JOIN leads l ON j.lead_id = l.id
                LEFT JOIN employees cb ON j.created_by = cb.id
                LEFT JOIN employees ub ON j.updated_by = ub.id
            `;
            
            if (onlyActive) {
                jobsQuery += ` WHERE j.status NOT IN ('Cancelled', 'Completed')`;
            }
            
            jobsQuery += ` ORDER BY j.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
            
            const [jobsResult] = await connection.execute(jobsQuery) as any;
            
            // Get assigned employees for each job
            jobsWithAssignments = await Promise.all(jobsResult.map(async (job: any) => {
                const assignments = await jobQueries.getJobAssignmentsByJobId(job.id, connection);
                // Sort by created_at descending and get only the latest assignment (most recent one)
                const sortedAssignments = assignments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const latestAssignment = sortedAssignments.length > 0 ? sortedAssignments[0] : null;
                return {
                    ...job,
                    assigned_employees_details: latestAssignment
                };
            }));
            
        } finally {
            connection.release();
        }
        
        // Structure each job into organized objects
        const structuredJobs = jobsWithAssignments.map((job: any) => ({
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
                assigned_employees: job.assigned_employees_details ? 1 : 0,
                lead_technician: job.lead_technician_name || null,
                assignment_status: job.assignment_status || 'Not Assigned',
                employees_details: job.assigned_employees_details || null
            },
            creator_info: {
                created_by: job.created_by,
                created_by_name: job.created_by_name,
                updated_by: job.updated_by,
                updated_by_name: job.updated_by_name
            }
        }));
        
        // Calculate pagination metadata
        const totalPages = Math.ceil(totalJobs / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
        res.json({ 
            success: true, 
            data: structuredJobs,
            pagination: {
                current_page: page,
                per_page: limit,
                total_items: totalJobs,
                total_pages: totalPages,
                has_next: hasNext,
                has_previous: hasPrev,
                next_page: hasNext ? page + 1 : null,
                previous_page: hasPrev ? page - 1 : null
            },
            filters: {
                active_only: onlyActive
            }
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

export const getJobsCount = async (req: Request, res: Response) => {
    try {
        // This function appears to be unused since getJobsCounts is the main implementation
        // Redirecting to getJobsCounts for consistency
        await getJobsCounts(req, res);
    } catch (err) {
        console.error('Error getting job counts:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error getting job counts', 
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

            // Check if employee exists and is active
            const [employeeRows] = await connection.execute(
                `SELECT id, status, first_name, last_name FROM employees WHERE id = ?`,
                [value.employee_id]
            ) as any;
            
            if (employeeRows.length === 0) {
                throw new Error('Employee not found');
            }
            
            const employee = employeeRows[0];
            if (employee.status !== 'Active') {
                throw new Error(`Cannot assign employee "${employee.first_name} ${employee.last_name}" with status "${employee.status}". Employee must be Active to be assigned to jobs.`);
            }

            // Check if job status is "Created" - only allow assignments for new jobs
            if (existingJob.status !== 'Created') {
                throw new Error(`Cannot assign employees to job with status "${existingJob.status}". Job must have "Created" status to add assignments.`);
            }

            // Check if there are existing assignments for this job
            const existingAssignments = await jobQueries.getJobAssignmentsByJobId(value.job_id, connection);
            if (existingAssignments && existingAssignments.length > 0) {
                throw new Error('Job already has existing assignments. Cannot add more assignments to a job that already has assigned employees.');
            }

            const assignmentId = await jobQueries.createJobAssignment(value, user.id, connection);
            
            // Update job status to Assigned since we're adding the first assignment
            await jobQueries.updateJob(value.job_id, { status: 'Assigned' }, user.id, connection);
            await jobQueries.createJobStatusTracking({
                job_id: value.job_id,
                previous_status: 'Created',
                new_status: 'Assigned',
                status_reason: 'Employee assigned to job',
                comments: `Employee assigned${value.role_type ? ` with role: ${value.role_type}` : ''}`
            }, user.id, connection);
            
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
        
        if (err.message.includes('not found') || 
            err.message.includes('Duplicate entry') || 
            err.message.includes('Cannot assign employees') || 
            err.message.includes('already has existing assignments')) {
            
            let message = err.message;
            if (err.message.includes('Duplicate')) {
                message = 'Employee already assigned to this job with this role';
            }
            
            return res.status(400).json({ 
                success: false, 
                message: message,
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

        const { error, value } = jobStatusTrackingSchema.update.validate(req.body, { abortEarly: false });
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

            // Check if job is already in a final status (Cancelled or Completed)
            if (existingJob.status === 'Completed') {
                throw new Error(`Job is already completed and cannot be modified. Completed jobs have final status and cannot be changed.`);
            }
            
            if (existingJob.status === 'Cancelled') {
                throw new Error(`Cannot update status of cancelled job. Cancelled jobs cannot be modified.`);
            }

            // If status is being set to "Completed", create final payment record
            let paymentRecord = null;
            if (value.new_status === 'Completed' && value.payment_details) {
                const paymentData = value.payment_details;
                
                // Amount is inclusive of GST - calculate backwards
                const totalAmountInclusiveGST = paymentData.amount;
                const discountAmount = paymentData.discount_amount || 0;
                const amountAfterDiscount = totalAmountInclusiveGST - discountAmount;
                
                // Default GST rate to 18% if not provided
                const defaultGstRate = 18;
                const gstRate = paymentData.gst_rate || defaultGstRate;
                
                let cgstAmount = 0, sgstAmount = 0, igstAmount = 0, totalTaxAmount = 0;
                let cgstRate = 0, sgstRate = 0, igstRate = 0;
                let taxableAmount = 0;
                
                // Calculate tax amounts from inclusive amount
                if (paymentData.igst_rate && paymentData.igst_rate > 0) {
                    // Interstate transaction - use IGST
                    igstRate = paymentData.igst_rate;
                    // Formula: Taxable Amount = Amount Inclusive / (1 + Tax Rate/100)
                    taxableAmount = Math.round((amountAfterDiscount / (1 + igstRate / 100)) * 100) / 100;
                    igstAmount = Math.round((amountAfterDiscount - taxableAmount) * 100) / 100;
                    totalTaxAmount = igstAmount;
                } else {
                    // Intrastate transaction - use CGST + SGST (auto-split GST rate)
                    cgstRate = paymentData.cgst_rate || (gstRate / 2);
                    sgstRate = paymentData.sgst_rate || (gstRate / 2);
                    
                    // Formula: Taxable Amount = Amount Inclusive / (1 + Total GST Rate/100)
                    taxableAmount = Math.round((amountAfterDiscount / (1 + gstRate / 100)) * 100) / 100;
                    totalTaxAmount = Math.round((amountAfterDiscount - taxableAmount) * 100) / 100;
                    
                    // Split total tax between CGST and SGST
                    cgstAmount = Math.round((totalTaxAmount / 2) * 100) / 100;
                    sgstAmount = Math.round((totalTaxAmount / 2) * 100) / 100;
                }
                
                // Create final payment record with calculated values
                const paymentId = await jobQueries.createJobPayment({
                    job_id: id,
                    payment_type: 'Final',
                    amount: totalAmountInclusiveGST, // Original amount (inclusive)
                    discount_amount: discountAmount,
                    taxable_amount: taxableAmount, // Calculated base amount
                    gst_rate: gstRate,
                    cgst_rate: cgstRate,
                    sgst_rate: sgstRate,
                    igst_rate: igstRate,
                    cgst_amount: cgstAmount,
                    sgst_amount: sgstAmount,
                    igst_amount: igstAmount,
                    total_tax_amount: totalTaxAmount,
                    total_amount: amountAfterDiscount, // Amount after discount (still inclusive)
                    payment_method: paymentData.payment_method,
                    payment_status: paymentData.payment_status || 'Completed',
                    transaction_id: paymentData.transaction_id || null,
                    payment_reference: paymentData.payment_reference || null,
                    payment_date: new Date().toISOString().split('T')[0], // Today's date
                    receipt_url: paymentData.receipt_url || null
                }, user.id, connection);
                
                // Get created payment details for response
                const payments = await jobQueries.getJobPaymentsByJobId(id, connection);
                paymentRecord = payments.find(p => p.id === paymentId);
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

            const responseMessage = value.new_status === 'Completed' && paymentRecord 
                ? 'Job completed successfully with final payment recorded' 
                : 'Job status updated successfully';

            res.json({ 
                success: true, 
                message: responseMessage, 
                data: {
                    job: updatedJob,
                    ...(paymentRecord && { payment: paymentRecord })
                },
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

export const getJobsCounts = async (req: Request, res: Response) => {
    try {
        const connection = await db.getConnection();
        
        try {
            // Get total counts by status
            const [statusCounts] = await connection.execute(`
                SELECT 
                    status,
                    COUNT(*) as count
                FROM jobs 
                GROUP BY status
            `) as any;

            // Get overall statistics
            const [overallStats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total_jobs,
                    COUNT(CASE WHEN status = 'Created' THEN 1 END) as created,
                    COUNT(CASE WHEN status = 'Assigned' THEN 1 END) as assigned,
                    COUNT(CASE WHEN status = 'In Progress' THEN 1 END) as in_progress,
                    COUNT(CASE WHEN status = 'On Hold' THEN 1 END) as on_hold,
                    COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed,
                    COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) as cancelled,
                    COUNT(CASE WHEN status IN ('Created', 'Assigned', 'In Progress', 'On Hold') THEN 1 END) as active_jobs,
                    COUNT(CASE WHEN status IN ('Completed', 'Cancelled') THEN 1 END) as closed_jobs
                FROM jobs
            `) as any;

            // Get counts by service type
            const [serviceTypeCounts] = await connection.execute(`
                SELECT 
                    service_type,
                    COUNT(*) as count
                FROM jobs 
                GROUP BY service_type
            `) as any;

            // Get counts by solar service
            const [solarServiceCounts] = await connection.execute(`
                SELECT 
                    solar_service,
                    COUNT(*) as count
                FROM jobs 
                GROUP BY solar_service
            `) as any;

            // Get counts by priority
            const [priorityCounts] = await connection.execute(`
                SELECT 
                    job_priority,
                    COUNT(*) as count
                FROM jobs 
                WHERE job_priority IS NOT NULL
                GROUP BY job_priority
            `) as any;

            // Get monthly job creation trend (last 12 months)
            const [monthlyTrend] = await connection.execute(`
                SELECT 
                    DATE_FORMAT(created_at, '%Y-%m') as month,
                    COUNT(*) as count,
                    COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_in_month
                FROM jobs 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
                GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                ORDER BY month DESC
            `) as any;

            const stats = overallStats[0];
            
            // Organize status counts into an object
            const statusBreakdown: any = {};
            statusCounts.forEach((row: any) => {
                statusBreakdown[row.status.toLowerCase().replace(' ', '_')] = row.count;
            });

            // Organize service type counts
            const serviceTypeBreakdown: any = {};
            serviceTypeCounts.forEach((row: any) => {
                serviceTypeBreakdown[row.service_type] = row.count;
            });

            // Organize solar service counts
            const solarServiceBreakdown: any = {};
            solarServiceCounts.forEach((row: any) => {
                solarServiceBreakdown[row.solar_service] = row.count;
            });

            // Organize priority counts
            const priorityBreakdown: any = {};
            priorityCounts.forEach((row: any) => {
                priorityBreakdown[row.job_priority] = row.count;
            });

            const response = {
                overall_statistics: {
                    total_jobs: parseInt(stats.total_jobs) || 0,
                    active_jobs: parseInt(stats.active_jobs) || 0,
                    closed_jobs: parseInt(stats.closed_jobs) || 0,
                    completion_rate: stats.total_jobs > 0 ? 
                        Math.round((stats.completed / stats.total_jobs) * 100 * 100) / 100 : 0
                },
                status_breakdown: {
                    created: parseInt(stats.created) || 0,
                    assigned: parseInt(stats.assigned) || 0,
                    in_progress: parseInt(stats.in_progress) || 0,
                    on_hold: parseInt(stats.on_hold) || 0,
                    completed: parseInt(stats.completed) || 0,
                    cancelled: parseInt(stats.cancelled) || 0,
                    ...statusBreakdown
                },
                service_type_breakdown: serviceTypeBreakdown,
                solar_service_breakdown: solarServiceBreakdown,
                priority_breakdown: priorityBreakdown,
                monthly_trend: monthlyTrend,
                generated_at: new Date().toISOString()
            };

            res.json({
                success: true,
                message: 'Job counts retrieved successfully',
                data: response
            });

        } finally {
            connection.release();
        }
        
    } catch (err) {
        console.error('Error fetching job counts:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching job counts', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export default { 
    createJob,
    getJob,
    listJobs,
    updateJob,
    createJobLocation,
    createJobAssignment,
    createJobPayment,
    updateJobStatus,
    searchJobs,
    getJobsByEmployee,
    getJobsCounts
};
import { Request, Response } from "express";
import * as jobQueries from "../queries/jobQueries";
import * as customerQueries from "../queries/customerQueries";
import * as leadQueries from "../queries/leadQueries";
import * as statusHistoryUtils from "../utils/statusHistoryUtils";
import { parseCapacity } from "../utils/capacityUtils";
import { uploadToS3 } from "../utils/s3Utils";
import {
  jobSchema,
  jobLocationSchema,
  jobAssignmentSchema,
  jobStatusTrackingSchema,
  jobPaymentSchema,
  jobNotesSchema,
  jobStatusAttachmentSchema,
  autoCustomerSchema,
} from "../utils/validations";
import { db } from "../db";
import { PoolConnection } from "mysql2/promise";

// Job CRUD Operations
export const createJob = async (req: Request, res: Response) => {
  let connection: PoolConnection | null = null;

  try {
    // Validate request data
    const { error, value } = jobSchema.create.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((d: any) => d.message),
      });
    }

    // Get user ID from token payload
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
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
        throw new Error(
          "Job code already exists. Please try again or provide a different job code.",
        );
      }

      let customerId = value.customer_id;
      let locationId = value.location_id;

      // Enhanced customer creation or validation with service tracking
      if (!customerId && value.customer) {
        // Validate customer data using auto customer schema
        const { error: customerError, value: customerValue } =
          autoCustomerSchema.create.validate(value.customer, {
            abortEarly: false,
          });
        if (customerError) {
          throw new Error(
            `Customer validation error: ${customerError.details.map((d) => d.message).join(", ")}`,
          );
        }

        // Create or find existing customer
        const customer = await customerQueries.createOrFindCustomer(
          customerValue,
          user.id,
          connection,
        );
        customerId = customer.id;

        console.log(
          `Customer handled with ID: ${customerId} (${customer.customer_code})`,
        );
      } else if (customerId) {
        // Verify existing customer
        const existingCustomer = await customerQueries.getCustomerById(
          customerId,
          connection,
        );
        if (!existingCustomer) {
          throw new Error(
            "Customer not found. Please provide a valid customer ID.",
          );
        }
      }

      // Normalize capacity: preserve raw and store normalized capacity (default unit kW)
      const parsed = parseCapacity(value.capacity as any);

      // Create job first
      const jobData = {
        ...value,
        job_code: jobCode,
        customer_id: customerId,
        location_id: locationId,
        capacity: parsed?.normalized || (value.capacity as any) || null,
        capacity_raw: (value.capacity as any) || null,
      };

      // Remove customer and location objects from job data
      delete jobData.customer;
      delete jobData.location;

      const createdJob = await jobQueries.createJob(
        jobData,
        user.id,
        connection,
      );
      const jobId = createdJob.id;

      console.log(`Created job with ID: ${jobId}`);

      // Map job service_type (e.g. 'Installation') to customer_services.service_type enum (e.g. 'Solar Installation')
      const serviceTypeMap: Record<string, string> = {
        Installation: "Solar Installation",
        Maintenance: "Solar Maintenance",
        Repair: "System Repair",
      };

      const serviceTypeForCustomer =
        serviceTypeMap[value.service_type as string] ||
        serviceTypeMap[jobData.service_type as string] ||
        value.service_type ||
        "Solar Installation";

      // Create customer service record to track this service
      await customerQueries.createCustomerService(
        {
          customer_id: customerId,
          service_type: serviceTypeForCustomer,
          service_status: "In Progress",
          solar_service: value.solar_service,
          estimated_capacity: value.capacity,
          estimated_cost: value.estimated_cost,
          service_description: value.job_description,
          job_id: jobId,
          package_id: value.package_id,
          priority: value.job_priority || "Medium",
          source: "Job Creation",
          notes: `Job created: ${jobCode}`,
        },
        user.id,
        connection,
      );

      console.log(`Created customer service record for job ${jobId}`);

      // Handle location creation or validation
      if (!locationId && value.location && customerId) {
        // Create new customer location
        const createdLocation = await customerQueries.createCustomerLocation(
          {
            ...value.location,
            customer_id: customerId,
          },
          user.id,
          connection,
        );
        locationId = createdLocation.id;

        // Update job with location_id
        await jobQueries.updateJob(
          jobId,
          { location_id: locationId },
          user.id,
          connection,
        );

        console.log(`Created new customer location with ID: ${locationId}`);
      } else if (locationId && customerId) {
        // Verify existing location belongs to customer
        const customerLocations = await customerQueries.getCustomerLocations(
          customerId,
          connection,
        );
        const locationExists = customerLocations.some(
          (loc) => loc.id === locationId,
        );
        if (!locationExists) {
          throw new Error(
            "Location not found for this customer. Please provide a valid location ID.",
          );
        }
      }

      // Create initial status tracking entry
      await jobQueries.createJobStatusTracking(
        {
          job_id: jobId,
          new_status: value.status || "Active",
          status_reason: "Job created",
          comments: value.customer
            ? "Job created with new customer"
            : "Job created with existing customer",
        },
        user.id,
        connection,
      );

      // Fetch the created job with details
      const job = await jobQueries.getJobById(jobId, connection);

      // Commit the transaction
      await connection.commit();

      res.status(201).json({
        success: true,
        message: "Job created successfully",
        data: job,
        created_records: {
          job_id: jobId,
          job_code: jobCode,
          customer_id: customerId,
          location_id: locationId,
          new_customer_created: !!value.customer,
          new_location_created: !!value.location,
          job_code_generated: !value.job_code,
        },
        transaction_status: "committed",
      });
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    }
  } catch (err: any) {
    console.error("Error creating job:", err);

    if (
      err.message.includes("already exists") ||
      err.message.includes("not found")
    ) {
      return res.status(400).json({
        success: false,
        message: err.message,
        transaction_status: "rolled_back",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating job - transaction rolled back",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
      transaction_status: "rolled_back",
    });
  } finally {
    if (connection) connection.release();
  }
};

export const getJob = async (req: Request, res: Response) => {
  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const id = parseInt(req.params.id);
    if (!id)
      return res
        .status(400)
        .json({ success: false, message: "Invalid job id" });

    // Check access permission for this job
    const hasAccess = await checkJobAccess(id, user.id, user.roles);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission to view this job.",
        error_code: "JOB_ACCESS_DENIED",
      });
    }

    const job = await jobQueries.getJobById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Get related data
    const [locations, assignments, statusHistory, payments] = await Promise.all(
      [
        jobQueries.getJobLocationsByJobId(id),
        jobQueries.getJobAssignmentsByJobId(id),
        jobQueries.getJobStatusTrackingByJobId(id),
        jobQueries.getJobPaymentsByJobId(id),
      ],
    );

    const jobDetails = {
      ...job,
      locations,
      assignments,
      statusHistory,
      payments,
    };

    res.json({ success: true, data: jobDetails });
  } catch (err) {
    console.error("Error fetching job:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching job",
      error: process.env.NODE_ENV === "development" ? err : undefined,
    });
  }
};

export const listJobs = async (req: Request, res: Response) => {
  try {
    // Get user information for role-based access control
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    console.log("🔍 LIST JOBS DEBUG - User authenticated:", {
      user_id: user.id,
      user_roles: user.roles,
      isSuperAdmin: user.roles?.includes("SuperAdmin"),
    });

    const userRoles = user.roles || [];
    const isSuperAdmin = userRoles.includes("SuperAdmin");

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Filter parameter
    const onlyActive = req.query.active === "true";

    // Get total count for pagination metadata
    const connection = await db.getConnection();
    let jobsWithAssignments: any[] = [];
    let totalJobs = 0;

    try {
      // Build WHERE clauses for role-based access using parameterized queries
      let whereConditions = [];
      let params: any[] = [];

      if (onlyActive) {
        whereConditions.push(`j.status != 'Job Done'`);
      }

      // If not SuperAdmin, only show jobs assigned to the user
      if (!isSuperAdmin) {
        whereConditions.push(`EXISTS (
                    SELECT 1 FROM job_assignments ja 
                    WHERE ja.job_id = j.id 
                    AND ja.employee_id = ? 
                    AND ja.assignment_status = 'Active'
                )`);
        params.push(user.id);
        console.log(
          "🔍 LIST JOBS DEBUG - Non-SuperAdmin filter applied for employee:",
          user.id,
        );
      } else {
        console.log("🔍 LIST JOBS DEBUG - SuperAdmin filter, showing all jobs");
      }

      const whereClause =
        whereConditions.length > 0
          ? ` WHERE ${whereConditions.join(" AND ")}`
          : "";
      console.log("🔍 LIST JOBS DEBUG - WHERE clause:", whereClause);
      console.log("🔍 LIST JOBS DEBUG - Query params:", params);

      // Count total jobs based on filter and user access
      let countQuery = `SELECT COUNT(*) as total FROM jobs j${whereClause}`;
      console.log("🔍 LIST JOBS DEBUG - Count query:", countQuery);

      const [countResult] = (await connection.execute(
        countQuery,
        params,
      )) as any;
      totalJobs = countResult[0].total;
      console.log("✅ LIST JOBS DEBUG - Total jobs found:", totalJobs);

      // If employee sees 0 jobs, check if there are ANY jobs in job_assignments table
      if (!isSuperAdmin && totalJobs === 0) {
        console.log(
          "⚠️ LIST JOBS DEBUG - Employee has 0 jobs! Checking job_assignments...",
        );
        const [assignmentCheck] = (await connection.execute(
          `SELECT COUNT(*) as total FROM job_assignments WHERE employee_id = ?`,
          [user.id],
        )) as any;
        console.log(
          "📊 LIST JOBS DEBUG - Job assignments for this employee:",
          assignmentCheck[0].total,
        );

        // Also check if ANY jobs exist at all
        const [allJobsCheck] = (await connection.execute(
          `SELECT COUNT(*) as total FROM jobs`,
        )) as any;
        console.log(
          "📊 LIST JOBS DEBUG - Total jobs in system:",
          allJobsCheck[0].total,
        );

        // Check job_assignments status values
        const [statusCheck] = (await connection.execute(
          `SELECT DISTINCT assignment_status FROM job_assignments`,
        )) as any;
        console.log(
          "📊 LIST JOBS DEBUG - Assignment statuses in DB:",
          statusCheck.map((r: any) => r.assignment_status),
        );
      }

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

      // Apply the same WHERE clause to the jobs query
      jobsQuery += whereClause;

      jobsQuery += ` ORDER BY j.created_at DESC LIMIT ? OFFSET ?`;
      const queryParams = [...params, limit, offset];

      const [jobsResult] = (await connection.execute(
        jobsQuery,
        queryParams,
      )) as any;

      // Get assigned employees for each job
      jobsWithAssignments = await Promise.all(
        jobsResult.map(async (job: any) => {
          const assignments = await jobQueries.getJobAssignmentsByJobId(
            job.id,
            connection,
          );
          // Sort by created_at descending and get only the latest assignment (most recent one)
          const sortedAssignments = assignments.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          );
          const latestAssignment =
            sortedAssignments.length > 0 ? sortedAssignments[0] : null;
          return {
            ...job,
            assigned_employees_details: latestAssignment,
          };
        }),
      );
    } finally {
      connection.release();
    }

    // Structure each job into organized objects with attachment details
    const structuredJobs = await Promise.all(
      jobsWithAssignments.map(async (job: any) => {
        try {
          // Fetch attachments with signed URLs for this job
          const attachments = await statusHistoryUtils.getAllJobAttachments(
            job.id,
          );
          if (attachments.length > 0) {
            console.log(
              `✓ listJobs - Job ${job.id}: fetched ${attachments.length} attachments with details:`,
              JSON.stringify(attachments.slice(0, 1), null, 2),
            ); // Log first attachment
          } else {
            console.log(
              `✗ listJobs - Job ${job.id}: NO attachments found (check if status updates include files or if s3_key is populated)`,
            );
          }

          return {
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
              updated_at: job.updated_at,
            },
            customer_info: {
              customer_id: job.customer_id,
              customer_code: job.customer_code,
              customer_name: job.customer_name,
              customer_mobile: job.customer_mobile,
              customer_email: job.customer_email,
              customer_type: job.customer_type,
              company_name: job.company_name,
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
              longitude: job.longitude,
            },
            package_info: job.package_name
              ? {
                  package_id: job.package_id,
                  package_name: job.package_name,
                  package_capacity: job.package_capacity,
                  package_price: job.package_price,
                }
              : null,
            payment_summary: {
              total_advance: job.total_advance || 0,
              total_milestone: job.total_milestone || 0,
              total_final: job.total_final || 0,
              total_paid: job.total_paid || 0,
              pending_amount: (job.estimated_cost || 0) - (job.total_paid || 0),
              payment_status: job.payment_status || "Not Started",
            },
            status_info: {
              current_status: job.status,
              last_status_change: job.last_status_change,
              last_changed_by: job.last_changed_by,
              status_reason: job.last_status_reason,
              total_status_changes: job.total_status_changes || 0,
              attachments: attachments,
            },
            assignment_info: {
              assigned_employees: job.assigned_employees_details ? 1 : 0,
              lead_technician: job.lead_technician_name || null,
              assignment_status: job.assignment_status || "Not Assigned",
              employees_details: job.assigned_employees_details || null,
            },
            creator_info: {
              created_by: job.created_by,
              created_by_name: job.created_by_name,
              updated_by: job.updated_by,
              updated_by_name: job.updated_by_name,
            },
          };
        } catch (err) {
          console.error(`Error fetching attachments for job ${job.id}:`, err);
          // Return job without attachments if error occurs
          return {
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
              updated_at: job.updated_at,
            },
            customer_info: {
              customer_id: job.customer_id,
              customer_code: job.customer_code,
              customer_name: job.customer_name,
              customer_mobile: job.customer_mobile,
              customer_email: job.customer_email,
              customer_type: job.customer_type,
              company_name: job.company_name,
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
              longitude: job.longitude,
            },
            package_info: job.package_name
              ? {
                  package_id: job.package_id,
                  package_name: job.package_name,
                  package_capacity: job.package_capacity,
                  package_price: job.package_price,
                }
              : null,
            payment_summary: {
              total_advance: job.total_advance || 0,
              total_milestone: job.total_milestone || 0,
              total_final: job.total_final || 0,
              total_paid: job.total_paid || 0,
              pending_amount: (job.estimated_cost || 0) - (job.total_paid || 0),
              payment_status: job.payment_status || "Not Started",
            },
            status_info: {
              current_status: job.status,
              last_status_change: job.last_status_change,
              last_changed_by: job.last_changed_by,
              status_reason: job.last_status_reason,
              total_status_changes: job.total_status_changes || 0,
              attachments: [],
            },
            assignment_info: {
              assigned_employees: job.assigned_employees_details ? 1 : 0,
              lead_technician: job.lead_technician_name || null,
              assignment_status: job.assignment_status || "Not Assigned",
              employees_details: job.assigned_employees_details || null,
            },
            creator_info: {
              created_by: job.created_by,
              created_by_name: job.created_by_name,
              updated_by: job.updated_by,
              updated_by_name: job.updated_by_name,
            },
          };
        }
      }),
    );

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
        previous_page: hasPrev ? page - 1 : null,
      },
      filters: {
        active_only: onlyActive,
      },
    });
  } catch (err) {
    console.error("Error listing jobs:", err);
    res.status(500).json({
      success: false,
      message: "Error listing jobs",
      error: process.env.NODE_ENV === "development" ? err : undefined,
    });
  }
};

export const getJobsCount = async (req: Request, res: Response) => {
  try {
    // This function appears to be unused since getJobsCounts is the main implementation
    // Redirecting to getJobsCounts for consistency
    await getJobsCounts(req, res);
  } catch (err) {
    console.error("Error getting job counts:", err);
    res.status(500).json({
      success: false,
      message: "Error getting job counts",
      error: process.env.NODE_ENV === "development" ? err : undefined,
    });
  }
};

export const updateJob = async (req: Request, res: Response) => {
  let connection: PoolConnection | null = null;

  try {
    const id = parseInt(req.params.id);
    if (!id)
      return res
        .status(400)
        .json({ success: false, message: "Invalid job id" });

    const { error, value } = jobSchema.update.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((d: any) => d.message),
      });
    }

    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Check if job exists
      const existingJob = await jobQueries.getJobById(id, connection);
      if (!existingJob) {
        throw new Error("Job not found");
      }

      // Check for status change to create tracking entry
      if (value.status && value.status !== existingJob.status) {
        await jobQueries.createJobStatusTracking(
          {
            job_id: id,
            previous_status: existingJob.status,
            new_status: value.status,
            status_reason: "Status updated",
            comments: `Status changed from ${existingJob.status} to ${value.status}`,
          },
          user.id,
          connection,
        );
      }

      // Update the job
      const updated = await jobQueries.updateJob(
        id,
        value,
        user.id,
        connection,
      );
      if (!updated) {
        throw new Error("Failed to update job or no changes provided");
      }

      // Fetch updated job
      const job = await jobQueries.getJobById(id, connection);

      await connection.commit();

      res.json({
        success: true,
        message: "Job updated successfully",
        data: job,
        transaction_status: "committed",
      });
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    }
  } catch (err: any) {
    console.error("Error updating job:", err);

    if (
      err.message.includes("not found") ||
      err.message.includes("Failed to update")
    ) {
      const statusCode = err.message.includes("not found") ? 404 : 400;
      return res.status(statusCode).json({
        success: false,
        message: err.message,
        transaction_status: "rolled_back",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating job - transaction rolled back",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
      transaction_status: "rolled_back",
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
    const { error, value } = jobLocationSchema.create.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((d: any) => d.message),
      });
    }

    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Verify job exists
      const existingJob = await jobQueries.getJobById(value.job_id, connection);
      if (!existingJob) {
        throw new Error("Job not found");
      }

      const locationId = await jobQueries.createJobLocation(
        value,
        user.id,
        connection,
      );

      // Get created location with details
      const [locations] = await Promise.all([
        jobQueries.getJobLocationsByJobId(value.job_id, connection),
      ]);

      const createdLocation = locations.find((loc) => loc.id === locationId);

      await connection.commit();

      res.status(201).json({
        success: true,
        message: "Job location created successfully",
        data: createdLocation,
        transaction_status: "committed",
      });
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    }
  } catch (err: any) {
    console.error("Error creating job location:", err);

    if (err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: err.message,
        transaction_status: "rolled_back",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating job location - transaction rolled back",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
      transaction_status: "rolled_back",
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
    const { error, value } = jobAssignmentSchema.create.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((d: any) => d.message),
      });
    }

    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Verify job exists
      const existingJob = await jobQueries.getJobById(value.job_id, connection);
      if (!existingJob) {
        throw new Error("Job not found");
      }

      // Check if employee exists and is active
      const [employeeRows] = (await connection.execute(
        `SELECT id, status, first_name, last_name FROM employees WHERE id = ?`,
        [value.employee_id],
      )) as any;

      if (employeeRows.length === 0) {
        throw new Error("Employee not found");
      }

      const employee = employeeRows[0];
      if (employee.status !== "Active") {
        throw new Error(
          `Cannot assign employee "${employee.first_name} ${employee.last_name}" with status "${employee.status}". Employee must be Active to be assigned to jobs.`,
        );
      }

      // Check if job status is "Active" - only allow assignments for new jobs
      if (existingJob.status !== "Active") {
        throw new Error(
          `Cannot assign employees to job with status "${existingJob.status}". Job must have "Active" status to add assignments.`,
        );
      }

      // Check if there are existing assignments for this job
      const existingAssignments = await jobQueries.getJobAssignmentsByJobId(
        value.job_id,
        connection,
      );
      if (existingAssignments && existingAssignments.length > 0) {
        throw new Error(
          "Job already has existing assignments. Cannot add more assignments to a job that already has assigned employees.",
        );
      }

      const assignmentId = await jobQueries.createJobAssignment(
        value,
        user.id,
        connection,
      );

      // Update job status to Site Visit since we're adding the first assignment
      await jobQueries.updateJob(
        value.job_id,
        { status: "Site Visit" },
        user.id,
        connection,
      );
      await jobQueries.createJobStatusTracking(
        {
          job_id: value.job_id,
          previous_status: "Active",
          new_status: "Site Visit",
          status_reason: "Employee assigned to job",
          comments: `Employee assigned${value.role_type ? ` with role: ${value.role_type}` : ""}`,
        },
        user.id,
        connection,
      );

      // Get created assignment with details
      const [assignments] = await Promise.all([
        jobQueries.getJobAssignmentsByJobId(value.job_id, connection),
      ]);

      const createdAssignment = assignments.find(
        (assign) => assign.id === assignmentId,
      );

      await connection.commit();

      res.status(201).json({
        success: true,
        message: "Job assignment created successfully",
        data: createdAssignment,
        transaction_status: "committed",
      });
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    }
  } catch (err: any) {
    console.error("Error creating job assignment:", err);

    if (
      err.message.includes("not found") ||
      err.message.includes("Duplicate entry") ||
      err.message.includes("Cannot assign employees") ||
      err.message.includes("already has existing assignments")
    ) {
      let message = err.message;
      if (err.message.includes("Duplicate")) {
        message = "Employee already assigned to this job with this role";
      }

      return res.status(400).json({
        success: false,
        message: message,
        transaction_status: "rolled_back",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating job assignment - transaction rolled back",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
      transaction_status: "rolled_back",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Assign job to employee using route parameter for job_id
export const assignJobToEmployee = async (req: Request, res: Response) => {
  let connection: PoolConnection | null = null;

  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid job ID" });
    }

    // Merge job_id from route param with request body
    const requestData = {
      ...req.body,
      job_id: jobId,
    };

    const { error, value } = jobAssignmentSchema.create.validate(requestData, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((d: any) => d.message),
      });
    }

    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Verify job exists
      const existingJob = await jobQueries.getJobById(value.job_id, connection);
      if (!existingJob) {
        throw new Error("Job not found");
      }

      // Check if employee exists and is active
      const [employeeRows] = (await connection.execute(
        `SELECT id, status, first_name, last_name FROM employees WHERE id = ?`,
        [value.employee_id],
      )) as any;

      if (employeeRows.length === 0) {
        throw new Error("Employee not found");
      }

      const employee = employeeRows[0];
      if (employee.status !== "Active") {
        throw new Error(
          `Cannot assign employee "${employee.first_name} ${employee.last_name}" with status "${employee.status}". Employee must be Active to be assigned to jobs.`,
        );
      }

      // Check if job status is "Active" - only allow assignments for new jobs
      if (existingJob.status !== "Active") {
        throw new Error(
          `Cannot assign employees to job with status "${existingJob.status}". Job must have "Active" status to add assignments.`,
        );
      }

      // Check if there are existing assignments for this job
      const existingAssignments = await jobQueries.getJobAssignmentsByJobId(
        value.job_id,
        connection,
      );
      if (existingAssignments && existingAssignments.length > 0) {
        throw new Error(
          "Job already has existing assignments. Cannot add more assignments to a job that already has assigned employees.",
        );
      }

      const assignmentId = await jobQueries.createJobAssignment(
        value,
        user.id,
        connection,
      );

      // Update job status to Site Visit since we're adding the first assignment
      await jobQueries.updateJob(
        value.job_id,
        { status: "Site Visit" },
        user.id,
        connection,
      );
      await jobQueries.createJobStatusTracking(
        {
          job_id: value.job_id,
          previous_status: "Active",
          new_status: "Site Visit",
          status_reason: "Employee assigned to job",
          comments: `Employee assigned${value.role_type ? ` with role: ${value.role_type}` : ""}`,
        },
        user.id,
        connection,
      );

      // Get created assignment with details
      const [assignments] = await Promise.all([
        jobQueries.getJobAssignmentsByJobId(value.job_id, connection),
      ]);

      const createdAssignment = assignments.find(
        (assign) => assign.id === assignmentId,
      );

      await connection.commit();

      res.status(201).json({
        success: true,
        message: "Job assignment created successfully",
        data: createdAssignment,
        transaction_status: "committed",
      });
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    }
  } catch (err: any) {
    console.error("Error assigning job to employee:", err);

    if (
      err.message.includes("not found") ||
      err.message.includes("Duplicate entry") ||
      err.message.includes("Cannot assign employees") ||
      err.message.includes("already has existing assignments")
    ) {
      let message = err.message;
      if (err.message.includes("Duplicate")) {
        message = "Employee already assigned to this job with this role";
      }

      return res.status(400).json({
        success: false,
        message: message,
        transaction_status: "rolled_back",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error assigning job to employee - transaction rolled back",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
      transaction_status: "rolled_back",
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
    const { error, value } = jobPaymentSchema.create.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((d: any) => d.message),
      });
    }

    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Verify job exists
      const existingJob = await jobQueries.getJobById(value.job_id, connection);
      if (!existingJob) {
        throw new Error("Job not found");
      }

      const paymentId = await jobQueries.createJobPayment(
        value,
        user.id,
        connection,
      );

      // Get created payment with details
      const [payments] = await Promise.all([
        jobQueries.getJobPaymentsByJobId(value.job_id, connection),
      ]);

      const createdPayment = payments.find((pay) => pay.id === paymentId);

      await connection.commit();

      res.status(201).json({
        success: true,
        message: "Job payment created successfully",
        data: createdPayment,
        transaction_status: "committed",
      });
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    }
  } catch (err: any) {
    console.error("Error creating job payment:", err);

    if (err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: err.message,
        transaction_status: "rolled_back",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating job payment - transaction rolled back",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
      transaction_status: "rolled_back",
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
    if (!id)
      return res
        .status(400)
        .json({ success: false, message: "Invalid job id" });

    const { error, value } = jobStatusTrackingSchema.update.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      const errorMessages = error.details.map((d) => {
        const field = d.context?.key || "Unknown";
        const type = d.type;

        switch (type) {
          case "string.empty":
            return `${field} is required and cannot be empty`;
          case "any.required":
            return `${field} is required`;
          case "any.only":
            return `${field} must be one of: ${d.context?.valids?.join(", ")}`;
          case "number.min":
            return `${field} must be a positive number`;
          case "string.max":
            return `${field} cannot exceed ${d.context?.limit} characters`;
          case "array.base":
            return `${field} must be an array`;
          default:
            return d.message;
        }
      });

      return res.status(400).json({
        success: false,
        message: "Validation error - Please check the following fields",
        field_errors: error.details.reduce(
          (acc, err) => {
            const field = err.context?.key || "unknown";
            acc[field] = err.message;
            return acc;
          },
          {} as Record<string, string>,
        ),
        errors: errorMessages,
      });
    }

    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    // DIAGNOSTIC: Log attachment details
    console.log(`\n=== updateJobStatus - Job ${id} ===`);
    console.log(`Received ${value.attachments?.length || 0} attachments`);
    if (value.attachments && value.attachments.length > 0) {
      const att = value.attachments[0];
      console.log("First attachment details:", {
        file_exists: !!att.file,
        file_type: typeof att.file,
        file_keys: att.file ? Object.keys(att.file) : "N/A",
        file_path: att.file_path,
        file_name: att.file_name,
        attachment_type: att.attachment_type,
        s3_key: att.s3_key,
      });

      // Check multer file properties
      if (att.file) {
        console.log("File object properties:", {
          fieldname: att.file.fieldname,
          originalname: att.file.originalname,
          filename: att.file.filename,
          path: att.file.path,
          destination: att.file.destination,
          size: att.file.size,
          mimetype: att.file.mimetype,
        });
      }
    }

    // Check access permission for this job using enhanced access control
    const hasAccess = await checkJobAccess(id, user.id, user.roles);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You can only update status of jobs assigned to you.",
        error_code: "JOB_ACCESS_DENIED",
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Get current job
      const existingJob = await jobQueries.getJobById(id, connection);
      if (!existingJob) {
        throw new Error("Job not found");
      }

      // Only prevent updates if job is already marked as Job Done (final status)
      if (
        existingJob.status === "Job Done" &&
        value.new_status !== "Job Done"
      ) {
        throw new Error(
          `Job is already completed and marked as done. Cannot change status from a completed job.`,
        );
      }

      // Handle payment creation for payment-related status updates
      let paymentRecord = null;

      // Enhanced payment handling with new fields
      if (
        value.new_status === "Partial Payment Done" &&
        value.payment_details
      ) {
        const paymentData = value.payment_details;

        // Validate required fields for partial payment
        if (!paymentData.amount || !paymentData.payment_method) {
          throw new Error(
            "Amount and payment method are required for partial payment",
          );
        }

        // Create enhanced payment record with new fields
        const paymentId = await jobQueries.createJobPayment(
          {
            job_id: id,
            payment_type: "Partial",
            amount: paymentData.amount,
            discount_amount: paymentData.discount_amount || 0,
            taxable_amount: paymentData.amount, // For simplicity, using amount as taxable
            gst_rate: paymentData.gst_rate || 0,
            cgst_rate: paymentData.cgst_rate || 0,
            sgst_rate: paymentData.sgst_rate || 0,
            igst_rate: paymentData.igst_rate || 0,
            cgst_amount: paymentData.cgst_amount || 0,
            sgst_amount: paymentData.sgst_amount || 0,
            igst_amount: paymentData.igst_amount || 0,
            total_tax_amount: paymentData.total_tax_amount || 0,
            total_amount: paymentData.amount,
            payment_method: paymentData.payment_method,
            payment_status: "Completed",
            transaction_id: paymentData.transaction_id || null,
            payment_reference: paymentData.payment_reference || null,
            payment_date:
              paymentData.payment_date ||
              new Date().toISOString().split("T")[0],
            milestone_description: `Partial payment received via ${paymentData.payment_method}${paymentData.bank_name ? ` (${paymentData.bank_name})` : ""} - ${paymentData.notes || ""}`,
            receipt_url: paymentData.receipt_url || null,
          },
          user.id,
          connection,
        );

        const payments = await jobQueries.getJobPaymentsByJobId(id, connection);
        paymentRecord = payments.find((p) => p.id === paymentId);

        // Store payment time if provided
        if (paymentData.payment_time && paymentRecord) {
          paymentRecord.payment_time = paymentData.payment_time;
          paymentRecord.bank_name = paymentData.bank_name;
          paymentRecord.payment_notes = paymentData.notes;
        }
      }

      // Enhanced full payment handling
      else if (value.new_status === "Payment Done" && value.payment_details) {
        const paymentData = value.payment_details;

        if (!paymentData.amount || !paymentData.payment_method) {
          throw new Error("Amount and payment method are required for payment");
        }

        // Create enhanced payment record for full payment
        const paymentId = await jobQueries.createJobPayment(
          {
            job_id: id,
            payment_type: "Final",
            amount: paymentData.amount,
            discount_amount: paymentData.discount_amount || 0,
            taxable_amount: paymentData.taxable_amount || paymentData.amount,
            gst_rate: paymentData.gst_rate || 0,
            cgst_rate: paymentData.cgst_rate || 0,
            sgst_rate: paymentData.sgst_rate || 0,
            igst_rate: paymentData.igst_rate || 0,
            cgst_amount: paymentData.cgst_amount || 0,
            sgst_amount: paymentData.sgst_amount || 0,
            igst_amount: paymentData.igst_amount || 0,
            total_tax_amount: paymentData.total_tax_amount || 0,
            total_amount: paymentData.amount,
            payment_method: paymentData.payment_method,
            payment_status: "Completed",
            transaction_id: paymentData.transaction_id || null,
            payment_reference: paymentData.payment_reference || null,
            payment_date:
              paymentData.payment_date ||
              new Date().toISOString().split("T")[0],
            milestone_description: `Final payment received via ${paymentData.payment_method}${paymentData.bank_name ? ` (${paymentData.bank_name})` : ""} - ${paymentData.notes || ""}`,
            receipt_url: paymentData.receipt_url || null,
          },
          user.id,
          connection,
        );

        const payments = await jobQueries.getJobPaymentsByJobId(id, connection);
        paymentRecord = payments.find((p) => p.id === paymentId);

        // Store enhanced payment details
        if (paymentData.payment_time && paymentRecord) {
          paymentRecord.payment_time = paymentData.payment_time;
          paymentRecord.bank_name = paymentData.bank_name;
          paymentRecord.payment_notes = paymentData.notes;
        }
      }

      // Legacy: Handle completion with payment (Invoice Generated status)
      else if (
        value.new_status === "Invoice Generated" &&
        value.payment_details
      ) {
        const paymentData = value.payment_details;

        // Amount is inclusive of GST - calculate backwards
        const totalAmountInclusiveGST = paymentData.amount;
        const discountAmount = paymentData.discount_amount || 0;
        const amountAfterDiscount = totalAmountInclusiveGST - discountAmount;

        // Default GST rate to 18% if not provided
        const defaultGstRate = 18;
        const gstRate = paymentData.gst_rate || defaultGstRate;

        let cgstAmount = 0,
          sgstAmount = 0,
          igstAmount = 0,
          totalTaxAmount = 0;
        let cgstRate = 0,
          sgstRate = 0,
          igstRate = 0;
        let taxableAmount = 0;

        // Calculate tax amounts from inclusive amount
        if (paymentData.igst_rate && paymentData.igst_rate > 0) {
          // Interstate transaction - use IGST
          igstRate = paymentData.igst_rate;
          // Formula: Taxable Amount = Amount Inclusive / (1 + Tax Rate/100)
          taxableAmount =
            Math.round((amountAfterDiscount / (1 + igstRate / 100)) * 100) /
            100;
          igstAmount =
            Math.round((amountAfterDiscount - taxableAmount) * 100) / 100;
          totalTaxAmount = igstAmount;
        } else {
          // Intrastate transaction - use CGST + SGST (auto-split GST rate)
          cgstRate = paymentData.cgst_rate || gstRate / 2;
          sgstRate = paymentData.sgst_rate || gstRate / 2;

          // Formula: Taxable Amount = Amount Inclusive / (1 + Total GST Rate/100)
          taxableAmount =
            Math.round((amountAfterDiscount / (1 + gstRate / 100)) * 100) / 100;
          totalTaxAmount =
            Math.round((amountAfterDiscount - taxableAmount) * 100) / 100;

          // Split total tax between CGST and SGST
          cgstAmount = Math.round((totalTaxAmount / 2) * 100) / 100;
          sgstAmount = Math.round((totalTaxAmount / 2) * 100) / 100;
        }

        // Create final payment record with calculated values
        const paymentId = await jobQueries.createJobPayment(
          {
            job_id: id,
            payment_type: "Final",
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
            payment_status: paymentData.payment_status || "Completed",
            transaction_id: paymentData.transaction_id || null,
            payment_reference: paymentData.payment_reference || null,
            payment_date: new Date().toISOString().split("T")[0], // Today's date
            receipt_url: paymentData.receipt_url || null,
          },
          user.id,
          connection,
        );

        // Get created payment details for response
        const payments = await jobQueries.getJobPaymentsByJobId(id, connection);
        paymentRecord = payments.find((p) => p.id === paymentId);
      }

      // Final status: Job Done - indicates complete job closure
      else if (value.new_status === "Job Done") {
        // Job Done doesn't require payments - it's just marking the job as completely finished
        // All payments should have been handled in previous status updates (Invoice Generated, Payment Done, etc.)
        // This is purely a status change to move the job to "Jobs Done" tab
      }

      // Create status tracking entry
      const statusTrackingId = await jobQueries.createJobStatusTracking(
        {
          job_id: id,
          previous_status: existingJob.status,
          new_status: value.new_status,
          status_reason: value.status_reason,
          comments: value.comments,
          attachment_url: value.attachment_url,
        },
        user.id,
        connection,
      );

      // Handle multiple attachments for specific statuses (Site Visit, Job Done)
      let attachmentRecords: any[] = [];
      if (value.attachments && value.attachments.length > 0) {
        console.log(
          `\n📦 Processing ${value.attachments.length} attachments for status update`,
        );

        // Debug: Show structure of first attachment
        if (value.attachments.length > 0) {
          const firstAtt = value.attachments[0];
          console.log(`\n🔍 First attachment structure:`, {
            keys: Object.keys(firstAtt),
            file_name: firstAtt.file_name,
            s3_key: firstAtt.s3_key,
            file_exists: !!firstAtt.file,
            file_type: typeof firstAtt.file,
            file_keys: firstAtt.file ? Object.keys(firstAtt.file) : undefined,
          });

          if (firstAtt.file) {
            console.log(`📄 Multer file object details:`, {
              path: firstAtt.file.path,
              originalname: firstAtt.file.originalname,
              mimetype: firstAtt.file.mimetype,
              size: firstAtt.file.size,
            });
          }
        }

        for (const attachment of value.attachments) {
          let s3Key = attachment.s3_key;
          let s3Bucket = attachment.s3_bucket;
          let fileSize = attachment.file_size;

          // Upload to S3 only if we have an actual file object with path
          // Skip if it's just metadata (file_path without actual file)
          const hasActualFile = attachment.file && attachment.file.path;

          console.log(`\n📋 Processing attachment: ${attachment.file_name}`);
          console.log(`  - Has file object: ${!!attachment.file}`);
          console.log(`  - File path: ${attachment.file?.path}`);
          console.log(`  - Has S3 key already: ${!!s3Key}`);
          console.log(`  - Will upload to S3: ${hasActualFile && !s3Key}`);

          if (hasActualFile && !s3Key) {
            try {
              const timestamp = Date.now();
              const randomString = Math.random().toString(36).substring(2, 8);
              const fileName =
                attachment.file.originalname || attachment.file_name;
              const s3KeyPath = `job-${id}/status-${statusTrackingId}/${timestamp}-${randomString}-${fileName}`;

              const filePathToUpload = attachment.file.path;
              console.log(
                `📤 Uploading actual file from: ${filePathToUpload} → ${s3KeyPath}`,
              );

              const uploadResult = await uploadToS3(
                filePathToUpload,
                s3KeyPath,
                attachment.mime_type ||
                  attachment.file.mimetype ||
                  "application/octet-stream",
              );

              s3Key = uploadResult.s3Key;
              s3Bucket = uploadResult.s3Bucket;
              fileSize = uploadResult.fileSize;

              console.log(`✅ S3 upload successful: ${s3Key}`);
            } catch (uploadError) {
              console.error(`❌ Failed to upload file to S3: ${uploadError}`);
              throw new Error(
                `Failed to upload attachment: ${(uploadError as any).message}`,
              );
            }
          } else if (s3Key) {
            console.log(`⏭️  Attachment already has s3_key: ${s3Key}`);
          } else {
            // VALIDATION: Reject metadata-only attachments without actual files
            // This ensures data quality and prevents orphaned records
            throw new Error(
              `Attachment '${attachment.file_name}' requires an actual file upload. ` +
                `Metadata-only attachments are not supported. Please provide the file in multipart/form-data format.`,
            );
          }

          // Create attachment record only for files that have been uploaded to S3
          const attachmentId = await jobQueries.createJobStatusAttachment(
            {
              job_status_tracking_id: statusTrackingId,
              job_id: id,
              attachment_type: attachment.attachment_type,
              file_name: attachment.file_name,
              file_path: attachment.file_path || attachment.file?.path || "",
              file_size: fileSize,
              mime_type: attachment.mime_type,
              s3_key: s3Key,
              s3_bucket: s3Bucket,
            },
            user.id,
            connection,
          );

          attachmentRecords.push({
            id: attachmentId,
            ...attachment,
            s3_key: s3Key,
            s3_bucket: s3Bucket,
            uploaded_by: user.id,
            uploaded_at: new Date(),
          });
        }
      }

      // Handle payment receipt attachments separately
      let receiptAttachments: any[] = [];
      if (value.payment_details && value.payment_details.receipt_attachments) {
        for (const receipt of value.payment_details.receipt_attachments) {
          let s3Key = receipt.s3_key;
          let s3Bucket = receipt.s3_bucket;
          let fileSize = receipt.file_size;

          // Upload to S3 only if we have an actual file object with path
          const hasActualFile = receipt.file && receipt.file.path;

          if (hasActualFile && !s3Key) {
            try {
              const timestamp = Date.now();
              const randomString = Math.random().toString(36).substring(2, 8);
              const fileName = receipt.file.originalname || receipt.file_name;
              const s3KeyPath = `job-${id}/payment-${statusTrackingId}/${timestamp}-${randomString}-${fileName}`;

              const filePathToUpload = receipt.file.path;
              console.log(
                `📤 Uploading receipt from: ${filePathToUpload} → ${s3KeyPath}`,
              );

              const uploadResult = await uploadToS3(
                filePathToUpload,
                s3KeyPath,
                receipt.mime_type ||
                  receipt.file.mimetype ||
                  "application/octet-stream",
              );

              s3Key = uploadResult.s3Key;
              s3Bucket = uploadResult.s3Bucket;
              fileSize = uploadResult.fileSize;

              console.log(`✅ Receipt S3 upload successful: ${s3Key}`);
            } catch (uploadError) {
              console.error(
                `❌ Failed to upload receipt to S3: ${uploadError}`,
              );
              throw new Error(
                `Failed to upload receipt attachment: ${(uploadError as any).message}`,
              );
            }
          } else if (s3Key) {
            console.log(`⏭️  Receipt already has s3_key: ${s3Key}`);
          } else {
            // VALIDATION: Reject metadata-only receipts without actual files
            // This ensures data quality and prevents orphaned records
            throw new Error(
              `Receipt '${receipt.file_name}' requires an actual file upload. ` +
                `Metadata-only receipts are not supported. Please provide the file in multipart/form-data format.`,
            );
          }

          const receiptId = await jobQueries.createJobStatusAttachment(
            {
              job_status_tracking_id: statusTrackingId,
              job_id: id,
              attachment_type: receipt.attachment_type,
              file_name: receipt.file_name,
              file_path: receipt.file_path || receipt.file?.path || "",
              file_size: fileSize,
              s3_key: s3Key,
              s3_bucket: s3Bucket,
            },
            user.id,
            connection,
          );

          receiptAttachments.push({
            id: receiptId,
            ...receipt,
            s3_key: s3Key,
            s3_bucket: s3Bucket,
            uploaded_by: user.id,
            uploaded_at: new Date(),
          });
        }
      }

      // Update job status
      await jobQueries.updateJob(
        id,
        { status: value.new_status },
        user.id,
        connection,
      );

      // If status changed to 'Job Done', update end_date for all active job assignments
      if (value.new_status === "Job Done") {
        const today = new Date().toISOString().split("T")[0];
        await connection.execute(
          `UPDATE job_assignments SET end_date = ? WHERE job_id = ? AND end_date IS NULL`,
          [today, id],
        );
        console.log(
          `Updated end_date for job assignments of job ${id} to ${today}`,
        );
      }

      // Get updated job
      const updatedJob = await jobQueries.getJobById(id, connection);

      // Create job note if notes provided during status update
      if (value.comments) {
        await jobQueries.createJobNote(
          {
            job_id: id,
            note_content: value.comments,
            employee_id: user.id,
          },
          connection,
        );

        console.log(`Created job note for job ${id}: ${value.comments}`);
      }

      // Sync estimation status with job status if estimation exists for this job
      const estimations = await db.execute<any[]>(
        `SELECT id FROM estimations WHERE job_id = ? LIMIT 1`,
        [id],
      );

      if (estimations[0] && estimations[0].length > 0) {
        const estimationId = estimations[0][0].id;
        const syncResult =
          await require("../queries/estimationQueries").syncEstimationStatusWithJobStatus(
            estimationId,
            id,
            value.new_status,
            connection,
          );

        if (syncResult) {
          console.log(
            `Synced estimation ${estimationId} status with job ${id} status: ${value.new_status}`,
          );
        }
      }

      // Sync lead status with job status if this job was created from a lead
      if (updatedJob && updatedJob.lead_id) {
        // The lead status will show as "Assigned" to indicate it's converted to a job
        // The actual display status will be the job status (shown via display_status field in queries)
        await leadQueries.syncLeadStatusWithJobStatus(
          updatedJob.lead_id,
          value.new_status,
        );
        console.log(
          `Synced lead status for lead ${updatedJob.lead_id} with job status: ${value.new_status}`,
        );
      }

      // Update customer service status based on job status
      if (updatedJob.customer_id) {
        let serviceStatus = "In Progress"; // default
        let completionDate: string | undefined = undefined;
        let actualCost: number | undefined = undefined;

        // Map job statuses to service statuses
        switch (value.new_status) {
          case "Active":
          case "Site Visit":
          case "Estimation Generated":
            serviceStatus = "In Progress";
            break;
          case "Processed":
          case "Pending on Portal":
            serviceStatus = "Quotation";
            break;
          case "Payment Pending":
          case "Partial Payment Done":
          case "Payment Done":
          case "Invoice Generated":
            serviceStatus = "In Progress";
            break;
          case "Job Done":
            serviceStatus = "Completed";
            completionDate = new Date().toISOString().split("T")[0];
            // Get actual cost from payments if available
            if (paymentRecord) {
              actualCost = paymentRecord.total_amount;
            }
            break;
        }

        // Update customer service record
        await customerQueries.updateCustomerServiceStatus(
          updatedJob.customer_id,
          id, // job_id
          serviceStatus,
          completionDate,
          actualCost,
          user.id,
          connection,
        );

        console.log(
          `Updated customer service status to: ${serviceStatus} for customer: ${updatedJob.customer_id}`,
        );
      }

      await connection.commit();

      // Generate appropriate response message based on status, payment, and attachments
      let responseMessage = "Job status updated successfully";
      const responseData: any = {
        job: updatedJob,
        status_tracking_id: statusTrackingId,
      };

      // Add payment information if available
      if (paymentRecord) {
        responseData.payment = paymentRecord;
        switch (value.new_status) {
          case "Partial Payment Done":
            responseMessage =
              "Job status updated and partial payment recorded successfully";
            if (paymentRecord.payment_time) {
              responseMessage += ` at ${paymentRecord.payment_time}`;
            }
            break;
          case "Payment Done":
            responseMessage =
              "Job status updated and payment recorded successfully";
            if (paymentRecord.payment_time) {
              responseMessage += ` at ${paymentRecord.payment_time}`;
            }
            break;
          case "Invoice Generated":
            responseMessage =
              "Job completed successfully with final payment recorded";
            break;
          default:
            responseMessage = "Job status updated with payment recorded";
        }
      } else if (value.new_status === "Job Done") {
        responseMessage =
          "Job marked as done successfully and moved to completed jobs";
      } else if (value.new_status === "Site Visit") {
        responseMessage = "Site visit status updated successfully";
        if (attachmentRecords.length > 0) {
          responseMessage += ` with ${attachmentRecords.length} media file(s)`;
        }
      }

      // Add attachment information
      if (attachmentRecords.length > 0) {
        responseData.attachments = attachmentRecords.map((att) => ({
          ...att,
          // Generate S3 signed URL placeholder - implement actual S3 logic
          signed_url: att.s3_key
            ? `https://your-bucket.s3.amazonaws.com/${att.s3_key}?signature=placeholder`
            : att.file_path,
        }));
      }

      if (receiptAttachments.length > 0) {
        responseData.receipt_attachments = receiptAttachments.map(
          (receipt) => ({
            ...receipt,
            // Generate S3 signed URL placeholder - implement actual S3 logic
            signed_url: receipt.s3_key
              ? `https://your-bucket.s3.amazonaws.com/${receipt.s3_key}?signature=placeholder`
              : receipt.file_path,
          }),
        );
      }

      // Notify admins and super admins about the status update
      try {
        // TODO: Implement notification logic for admins
        // This could be:
        // 1. Real-time notifications via WebSocket
        // 2. Email notifications
        // 3. SMS notifications
        // 4. Push notifications
        console.log(
          `Status update notification: Job ${id} status changed to ${value.new_status} by ${user.first_name} ${user.last_name}`,
        );

        // Example notification data structure for future implementation
        const notificationData = {
          type: "job_status_update",
          job_id: id,
          job_code: updatedJob.job_code,
          previous_status: existingJob.status,
          new_status: value.new_status,
          updated_by: {
            id: user.id,
            name: `${user.first_name} ${user.last_name}`,
            role: user.roles?.[0] || "Employee",
          },
          timestamp: new Date(),
          has_payments: !!paymentRecord,
          has_attachments: attachmentRecords.length > 0,
          priority: ["Job Done", "Payment Done", "Invoice Generated"].includes(
            value.new_status,
          )
            ? "high"
            : "normal",
        };

        // Add to notification queue or send immediately
        // await notificationService.notifyAdmins(notificationData);
      } catch (notificationError) {
        // Log notification errors but don't fail the main operation
        console.error("Failed to send admin notification:", notificationError);
      }

      res.json({
        success: true,
        message: responseMessage,
        data: responseData,
        transaction_status: "committed",
      });
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    }
  } catch (err: any) {
    console.error("Error updating job status:", err);

    if (err.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: err.message,
        transaction_status: "rolled_back",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating job status - transaction rolled back",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
      transaction_status: "rolled_back",
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
      return res
        .status(400)
        .json({ success: false, message: "Search term is required" });
    }

    const filters = {
      status: req.query.status as string,
      service_type: req.query.service_type as string,
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
    };

    const jobs = await jobQueries.searchJobs(searchTerm, filters);

    res.json({
      success: true,
      data: jobs,
      search_term: searchTerm,
      filters_applied: Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v),
      ),
    });
  } catch (err) {
    console.error("Error searching jobs:", err);
    res.status(500).json({
      success: false,
      message: "Error searching jobs",
      error: process.env.NODE_ENV === "development" ? err : undefined,
    });
  }
};

export const getJobsByEmployee = async (req: Request, res: Response) => {
  try {
    // Get user information for role-based access control
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const userRoles = user.roles || [];
    const isSuperAdmin = userRoles.includes("SuperAdmin");

    const employeeId = parseInt(req.params.employeeId);
    if (!employeeId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid employee id" });
    }

    // Role-based access control: Non-SuperAdmin users can only see their own jobs
    if (!isSuperAdmin && employeeId !== user.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own jobs.",
        error_code: "EMPLOYEE_ACCESS_DENIED",
      });
    }

    const jobs = await jobQueries.getJobsByEmployee(employeeId);

    res.json({
      success: true,
      data: jobs,
    });
  } catch (err) {
    console.error("Error fetching jobs by employee:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching jobs by employee",
      error: process.env.NODE_ENV === "development" ? err : undefined,
    });
  }
};

export const getJobsCounts = async (req: Request, res: Response) => {
  try {
    // Get user information for role-based access control
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const userRoles = user.roles || [];
    const isSuperAdmin = userRoles.includes("SuperAdmin");

    const connection = await db.getConnection();

    try {
      // Build WHERE clause for role-based access
      let joinAndWhere = "";
      if (!isSuperAdmin) {
        joinAndWhere = ` WHERE EXISTS (
                    SELECT 1 FROM job_assignments ja 
                    WHERE ja.job_id = jobs.id 
                    AND ja.employee_id = ${user.id} 
                    AND ja.assignment_status IN ('Assigned', 'Active')
                )`;
      }

      // Get total counts by status
      const [statusCounts] = (await connection.execute(`
                SELECT 
                    status,
                    COUNT(*) as count
                FROM jobs ${joinAndWhere}
                GROUP BY status
            `)) as any;

      // Get overall statistics
      const [overallStats] = (await connection.execute(`
                SELECT 
                    COUNT(*) as total_jobs,
                    COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_new,
                    COUNT(CASE WHEN status = 'Site Visit' THEN 1 END) as site_visit,
                    COUNT(CASE WHEN status = 'Estimation Generated' THEN 1 END) as estimation_generated,
                    COUNT(CASE WHEN status = 'Processed' THEN 1 END) as processed,
                    COUNT(CASE WHEN status = 'Pending on Portal' THEN 1 END) as pending_on_portal,
                    COUNT(CASE WHEN status = 'Payment Pending' THEN 1 END) as payment_pending,
                    COUNT(CASE WHEN status = 'Partial Payment Done' THEN 1 END) as partial_payment_done,
                    COUNT(CASE WHEN status = 'Payment Done' THEN 1 END) as payment_done,
                    COUNT(CASE WHEN status = 'Invoice Generated' THEN 1 END) as invoice_generated,
                    COUNT(CASE WHEN status = 'Job Done' THEN 1 END) as job_done,
                    COUNT(CASE WHEN status IN ('Active', 'Site Visit', 'Estimation Generated', 'Processed', 'Pending on Portal', 'Payment Pending', 'Partial Payment Done', 'Payment Done', 'Invoice Generated') THEN 1 END) as active_jobs,
                    COUNT(CASE WHEN status = 'Job Done' THEN 1 END) as completed_jobs
                FROM jobs${joinAndWhere}
            `)) as any;

      // Get counts by service type
      const [serviceTypeCounts] = (await connection.execute(`
                SELECT 
                    service_type,
                    COUNT(*) as count
                FROM jobs ${joinAndWhere}
                GROUP BY service_type
            `)) as any;

      // Get counts by solar service
      const [solarServiceCounts] = (await connection.execute(`
                SELECT 
                    solar_service,
                    COUNT(*) as count
                FROM jobs ${joinAndWhere}
                GROUP BY solar_service
            `)) as any;

      // Get counts by priority
      const [priorityCounts] = (await connection.execute(`
                SELECT 
                    job_priority,
                    COUNT(*) as count
                FROM jobs 
                WHERE job_priority IS NOT NULL${joinAndWhere ? " AND" + joinAndWhere.substring(6) : ""}
                GROUP BY job_priority
            `)) as any;

      // Get monthly job creation trend (last 12 months)
      const [monthlyTrend] = (await connection.execute(`
                SELECT 
                    DATE_FORMAT(created_at, '%Y-%m') as month,
                    COUNT(*) as count,
                    COUNT(CASE WHEN status = 'Job Done' THEN 1 END) as completed_in_month
                FROM jobs 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)${joinAndWhere ? " AND" + joinAndWhere.substring(6) : ""}
                GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                ORDER BY month DESC
            `)) as any;

      const stats = overallStats[0];

      // Organize status counts into an object
      const statusBreakdown: any = {};
      statusCounts.forEach((row: any) => {
        statusBreakdown[row.status.toLowerCase().replace(" ", "_")] = row.count;
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
          completion_rate:
            stats.total_jobs > 0
              ? Math.round((stats.completed / stats.total_jobs) * 100 * 100) /
                100
              : 0,
        },
        status_breakdown: {
          created: parseInt(stats.created) || 0,
          assigned: parseInt(stats.assigned) || 0,
          in_progress: parseInt(stats.in_progress) || 0,
          on_hold: parseInt(stats.on_hold) || 0,
          completed: parseInt(stats.completed) || 0,
          cancelled: parseInt(stats.cancelled) || 0,
          ...statusBreakdown,
        },
        service_type_breakdown: serviceTypeBreakdown,
        solar_service_breakdown: solarServiceBreakdown,
        priority_breakdown: priorityBreakdown,
        monthly_trend: monthlyTrend,
        generated_at: new Date().toISOString(),
      };

      res.json({
        success: true,
        message: "Job counts retrieved successfully",
        data: response,
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Error fetching job counts:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching job counts",
      error: process.env.NODE_ENV === "development" ? err : undefined,
    });
  }
};

// Convert Lead to Job and create Customer
export const convertLeadToJob = async (req: Request, res: Response) => {
  let connection: PoolConnection | null = null;

  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const leadId = parseInt(req.params.leadId);
    if (!leadId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID" });
    }

    // Start transaction
    connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Get the lead details
      const lead = await leadQueries.getLeadById(leadId);
      if (!lead) {
        throw new Error("Lead not found");
      }

      if (lead.status === "Job Done") {
        throw new Error("Lead has already been completed");
      }

      // Generate customer code
      const customerCode =
        await customerQueries.generateCustomerCode(connection);

      // Create customer from lead data
      const customerData = {
        customer_code: customerCode,
        first_name: lead.first_name,
        last_name: lead.last_name || "",
        mobile: lead.mobile,
        email: lead.email || undefined,
        customer_type: "Individual" as const,
        lead_source: "WEB",
        notes: `Converted from lead #${leadId}. Original message: ${lead.message || "N/A"}`,
        created_by: user.id,
        status: "Active" as const,
      };

      const customer = await customerQueries.createCustomer(
        customerData,
        user.id,
        connection,
      );

      // Create customer location if location is provided
      let locationId = null;
      if (lead.location) {
        const locationData = {
          customer_id: customer.id,
          location_type: "Installation" as const,
          address_line_1: lead.location,
          is_primary: true,
          status: "Active" as const,
        };
        const location = await customerQueries.createCustomerLocation(
          locationData,
          user.id,
          connection,
        );
        locationId = location.id;
      }

      // Generate job code
      const jobCode = await jobQueries.generateJobCode(connection);

      // Create job from lead data
      const parsedCapacity = parseCapacity(lead.capacity as any);
      const jobData = {
        job_code: jobCode,
        lead_id: leadId,
        customer_id: customer.id,
        location_id: locationId,
        service_type: lead.service_type,
        solar_service: lead.solar_service,
        capacity: parsedCapacity?.normalized || lead.capacity || undefined,
        capacity_raw: lead.capacity || undefined,
        job_description: `Job created from lead #${leadId}. ${lead.message || ""}`,
        status: "Active" as const, // Using default active status
        created_by: user.id,
      };

      const job = await jobQueries.createJob(jobData, user.id, connection);
      console.log("✅ CONVERT LEAD DEBUG - Job created:", {
        job_id: job.id,
        job_code: jobCode,
        status: "Active",
      });

      // Update lead status to 'Active' - this marks that the lead has been converted to a job
      // The actual display status will be the job status (shown via display_status field)
      await leadQueries.updateLeadStatus(leadId, "Active");

      // Determine which employee to assign the job to
      // Priority: 1) assigned_to from request body, 2) assigned_to from lead, 3) none
      let employeeToAssign = req.body.assigned_to || lead.assigned_to;

      console.log("🔍 CONVERT LEAD DEBUG - Assignment check:", {
        request_assigned_to: req.body.assigned_to,
        lead_assigned_to: lead.assigned_to,
        final_employee_to_assign: employeeToAssign,
      });

      if (employeeToAssign) {
        // Validate employee exists and is active
        const [employeeRows] = (await connection.execute(
          `SELECT id, status, first_name, last_name FROM employees WHERE id = ?`,
          [employeeToAssign],
        )) as any;

        if (employeeRows.length === 0) {
          throw new Error("Employee not found");
        }

        const employee = employeeRows[0];
        console.log("🔍 CONVERT LEAD DEBUG - Employee found:", {
          employee_id: employee.id,
          name: `${employee.first_name} ${employee.last_name}`,
          status: employee.status,
        });

        if (employee.status !== "Active") {
          throw new Error(
            `Cannot assign employee "${employee.first_name} ${employee.last_name}" with status "${employee.status}". Employee must be Active to be assigned to jobs.`,
          );
        }

        const assignmentData = {
          job_id: job.id,
          employee_id: employeeToAssign,
          assignment_status: "Active" as const,
          start_date: undefined,
        };

        await jobQueries.createJobAssignment(
          assignmentData,
          user.id,
          connection,
        );
        console.log("✅ CONVERT LEAD DEBUG - Job assignment created:", {
          job_id: job.id,
          employee_id: employeeToAssign,
          assignment_status: "Active",
        });

        // Update job status to Site Visit since we're adding the first assignment
        await jobQueries.updateJob(
          job.id,
          { status: "Site Visit" },
          user.id,
          connection,
        );
        await jobQueries.createJobStatusTracking(
          {
            job_id: job.id,
            previous_status: "Active",
            new_status: "Site Visit",
            status_reason: "Employee assigned to job",
            comments: `Employee ${employee.first_name} ${employee.last_name} assigned to job`,
          },
          user.id,
          connection,
        );

        console.log("✅ CONVERT LEAD DEBUG - Job status updated to Site Visit");

        // Sync lead display status to show the job's Site Visit status
        await leadQueries.syncLeadStatusWithJobStatus(leadId, "Site Visit");
      } else {
        console.log(
          "⚠️ CONVERT LEAD DEBUG - No employee assigned, job created without assignment",
        );
      }

      // Commit transaction
      await connection.commit();

      res.status(201).json({
        success: true,
        message: "Lead successfully converted to job",
        data: {
          job: job,
          customer: customer,
          lead_id: leadId,
          assignment_created: !!employeeToAssign,
        },
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error: any) {
    console.error("Error converting lead to job:", error);
    res.status(500).json({
      success: false,
      message: "Error converting lead to job",
      error: error.message || "Unknown error occurred",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Get all payments for a specific job
export const getJobPayments = async (req: Request, res: Response) => {
  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const jobId = parseInt(req.params.jobId);
    if (!jobId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid job ID" });
    }

    // Check access permission for this job
    const hasAccess = await checkJobAccess(jobId, user.id, user.roles);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission to view this job.",
        error_code: "JOB_ACCESS_DENIED",
      });
    }

    // Get all payments for the job
    const payments = await jobQueries.getJobPaymentsByJobId(jobId);

    // Calculate payment summary
    const summary = payments.reduce(
      (acc, payment) => {
        if (payment.payment_status === "Completed") {
          acc.total_paid += payment.amount;
          acc.completed_payments++;
        } else if (payment.payment_status === "Pending") {
          acc.pending_amount += payment.amount;
          acc.pending_payments++;
        }
        return acc;
      },
      {
        total_paid: 0,
        pending_amount: 0,
        completed_payments: 0,
        pending_payments: 0,
        total_payments: payments.length,
      },
    );

    res.json({
      success: true,
      data: {
        payments: payments,
        summary: summary,
      },
    });
  } catch (err: any) {
    console.error("Error fetching job payments:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching job payments",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Grant monitoring permission to an admin for a specific job
export const grantJobMonitoringAccess = async (req: Request, res: Response) => {
  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    // Only SuperAdmin can grant monitoring access
    const userRoles = user.roles || [];
    if (!userRoles.includes("SuperAdmin")) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only SuperAdmin can grant job monitoring permissions.",
        error_code: "INSUFFICIENT_PRIVILEGES",
      });
    }

    const jobId = parseInt(req.params.jobId);
    const { employee_id, permission_type = "monitor", notes } = req.body;

    if (!jobId || !employee_id) {
      return res.status(400).json({
        success: false,
        message: "Job ID and employee ID are required",
      });
    }

    // Verify the job exists
    const job = await jobQueries.getJobById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Grant monitoring access
    const monitoringId = await jobQueries.createJobMonitoring({
      job_id: jobId,
      employee_id: employee_id,
      permission_type: permission_type,
      notes: notes,
      granted_by: user.id,
    });

    res.json({
      success: true,
      message: "Job monitoring access granted successfully",
      data: { monitoring_id: monitoringId },
    });
  } catch (err: any) {
    console.error("Error granting job monitoring access:", err);

    if (err.message.includes("Duplicate entry")) {
      return res.status(409).json({
        success: false,
        message: "Employee already has monitoring access to this job",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error granting job monitoring access",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Revoke monitoring permission
export const revokeJobMonitoringAccess = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    // Only SuperAdmin can revoke monitoring access
    const userRoles = user.roles || [];
    if (!userRoles.includes("SuperAdmin")) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only SuperAdmin can revoke job monitoring permissions.",
        error_code: "INSUFFICIENT_PRIVILEGES",
      });
    }

    const jobId = parseInt(req.params.jobId);
    const employeeId = parseInt(req.params.employeeId);

    if (!jobId || !employeeId) {
      return res.status(400).json({
        success: false,
        message: "Job ID and employee ID are required",
      });
    }

    // Revoke monitoring access
    await jobQueries.revokeJobMonitoring(jobId, employeeId);

    res.json({
      success: true,
      message: "Job monitoring access revoked successfully",
    });
  } catch (err: any) {
    console.error("Error revoking job monitoring access:", err);
    res.status(500).json({
      success: false,
      message: "Error revoking job monitoring access",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// My Tasks endpoints for the 3-tab structure
export const getMyLeads = async (req: Request, res: Response) => {
  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    // Only SuperAdmin and Admin can see leads
    const userRoles = user.roles || [];
    if (!userRoles.includes("SuperAdmin") && !userRoles.includes("Admin")) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only SuperAdmin and Admin can view leads.",
        error_code: "LEAD_ACCESS_DENIED",
      });
    }

    // Get all unassigned leads (not converted to jobs yet)
    const leads = await leadQueries.getAllLeads();
    const filteredLeads = leads.filter((lead) =>
      ["New", "In Progress"].includes(lead.status),
    );

    res.json({
      success: true,
      data: filteredLeads,
      total: filteredLeads.length,
      tab: "leads",
    });
  } catch (err: any) {
    console.error("Error fetching my leads:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching leads",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const getMyActiveJobs = async (req: Request, res: Response) => {
  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const userRoles = user.roles || [];
    const isSuperAdmin = userRoles.includes("SuperAdmin");

    const connection = await db.getConnection();

    try {
      let jobsQuery = `
                SELECT j.*, 
                       c.customer_code, c.full_name as customer_name, c.mobile as customer_mobile,
                       p.name as package_name, p.capacity as package_capacity
                FROM jobs j
                LEFT JOIN customers c ON j.customer_id = c.id
                LEFT JOIN packages p ON j.package_id = p.id
                WHERE j.status != 'Job Done'
            `;

      // If not SuperAdmin, only show jobs assigned to the user or with monitoring permission
      if (!isSuperAdmin) {
        jobsQuery += ` AND (
                    EXISTS (
                        SELECT 1 FROM job_assignments ja 
                        WHERE ja.job_id = j.id 
                        AND ja.employee_id = ${user.id} 
                        AND ja.assignment_status IN ('Assigned', 'Active')
                    )`;

        // Add monitoring permission check for Admin users
        if (userRoles.includes("Admin")) {
          jobsQuery += ` OR EXISTS (
                        SELECT 1 FROM job_monitoring_permissions jmp
                        WHERE jmp.job_id = j.id 
                        AND jmp.employee_id = ${user.id} 
                        AND jmp.status = 'Active'
                    )`;
        }

        jobsQuery += ")";
      }

      jobsQuery += " ORDER BY j.updated_at DESC";

      const [jobsResult] = (await connection.execute(jobsQuery)) as any;

      res.json({
        success: true,
        data: jobsResult,
        total: jobsResult.length,
        tab: "active_jobs",
      });
    } finally {
      connection.release();
    }
  } catch (err: any) {
    console.error("Error fetching my active jobs:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching active jobs",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const getMyCompletedJobs = async (req: Request, res: Response) => {
  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const userRoles = user.roles || [];
    const isSuperAdmin = userRoles.includes("SuperAdmin");

    const connection = await db.getConnection();

    try {
      let jobsQuery = `
                SELECT j.*, 
                       c.customer_code, c.full_name as customer_name, c.mobile as customer_mobile,
                       p.name as package_name, p.capacity as package_capacity,
                       (SELECT SUM(amount) FROM job_payments jp WHERE jp.job_id = j.id AND jp.payment_status = 'Completed') as total_payments
                FROM jobs j
                LEFT JOIN customers c ON j.customer_id = c.id
                LEFT JOIN packages p ON j.package_id = p.id
                WHERE j.status = 'Job Done'
            `;

      // If not SuperAdmin, only show jobs assigned to the user
      if (!isSuperAdmin) {
        jobsQuery += ` AND EXISTS (
                    SELECT 1 FROM job_assignments ja 
                    WHERE ja.job_id = j.id 
                    AND ja.employee_id = ${user.id} 
                    AND ja.assignment_status IN ('Assigned', 'Active')
                )`;
      }

      jobsQuery += " ORDER BY j.updated_at DESC";

      const [jobsResult] = (await connection.execute(jobsQuery)) as any;

      res.json({
        success: true,
        data: jobsResult,
        total: jobsResult.length,
        tab: "completed_jobs",
      });
    } finally {
      connection.release();
    }
  } catch (err: any) {
    console.error("Error fetching my completed jobs:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching completed jobs",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Helper function to check job access permissions (moved from inside other function)
const checkJobAccess = async (
  jobId: number,
  userId: number,
  userRoles: string[],
): Promise<boolean> => {
  try {
    // SuperAdmin and Admin have access to all jobs
    if (userRoles.includes("SuperAdmin") || userRoles.includes("Admin")) {
      return true;
    }

    // Check if user is assigned to the job
    const jobAssignments = await jobQueries.getJobAssignmentsByJobId(jobId);
    const isAssigned = jobAssignments.some(
      (assignment) =>
        assignment.employee_id === userId &&
        (assignment.assignment_status === "Active" ||
          assignment.assignment_status === "Assigned"),
    );

    if (isAssigned) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking job access:", error);
    return false;
  }
};

// Job Notes Operations
export const addJobNote = async (req: Request, res: Response) => {
  try {
    // Get user info
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const jobId = parseInt(req.params.jobId);

    // Validate request data
    const { error, value } = jobNotesSchema.create.validate(
      {
        job_id: jobId,
        employee_id: user.id,
        ...req.body,
      },
      { abortEarly: false },
    );

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((d: any) => d.message),
      });
    }

    const { note_content, employee_id } = value;

    // Ensure employee_id matches authenticated user (security check)
    if (employee_id !== user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only create notes with your own employee ID",
        error_code: "EMPLOYEE_ID_MISMATCH",
      });
    }

    // Check if user has access to this job
    const hasAccess = await checkJobAccess(jobId, user.id, user.roles);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You can only add notes to jobs assigned to you.",
        error_code: "JOB_ACCESS_DENIED",
      });
    }

    // Verify job exists
    const job = await jobQueries.getJobById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Create the note
    const noteId = await jobQueries.createJobNote({
      job_id: jobId,
      employee_id: employee_id,
      note_content: note_content.trim(),
    });

    // Get the created note with employee details
    const notes = await jobQueries.getJobNotesByJobId(jobId);
    const createdNote = notes.find((note) => note.id === noteId);

    res.status(201).json({
      success: true,
      message: "Note added successfully",
      data: createdNote,
    });
  } catch (err: any) {
    console.error("Error adding job note:", err);
    res.status(500).json({
      success: false,
      message: "Error adding note",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const getJobNotes = async (req: Request, res: Response) => {
  try {
    // Get user info
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const jobId = parseInt(req.params.jobId);
    if (!jobId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid job ID" });
    }

    // Check if user has access to this job
    const hasAccess = await checkJobAccess(jobId, user.id, user.roles);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You can only view notes for jobs assigned to you.",
        error_code: "JOB_ACCESS_DENIED",
      });
    }

    // Verify job exists
    const job = await jobQueries.getJobById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Get all notes for this job
    const notes = await jobQueries.getJobNotesByJobId(jobId);

    res.json({
      success: true,
      data: {
        job_id: jobId,
        job_code: job.job_code,
        notes: notes,
        total_notes: notes.length,
      },
    });
  } catch (err: any) {
    console.error("Error fetching job notes:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching notes",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Get job attachments
export const getJobAttachments = async (req: Request, res: Response) => {
  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const jobId = parseInt(req.params.jobId);
    if (!jobId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid job ID" });
    }

    // Check if user has access to this job
    const hasAccess = await checkJobAccess(jobId, user.id, user.roles);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. You can only view attachments for jobs assigned to you.",
        error_code: "JOB_ACCESS_DENIED",
      });
    }

    // Verify job exists
    const job = await jobQueries.getJobById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Get all attachments for this job
    const attachments = await jobQueries.getJobStatusAttachmentsByJobId(jobId);

    // Group attachments by status and add signed URLs
    const groupedAttachments = attachments.reduce(
      (acc: any, attachment: any) => {
        const status = attachment.new_status || "unknown";
        if (!acc[status]) {
          acc[status] = [];
        }

        // Add S3 signed URL (placeholder - implement actual S3 logic)
        acc[status].push({
          ...attachment,
          signed_url: attachment.s3_key
            ? `https://your-bucket.s3.amazonaws.com/${attachment.s3_key}?signature=placeholder`
            : attachment.file_path,
        });
        return acc;
      },
      {},
    );

    res.json({
      success: true,
      data: {
        job_id: jobId,
        job_code: job.job_code,
        attachments_by_status: groupedAttachments,
        total_attachments: attachments.length,
      },
    });
  } catch (err: any) {
    console.error("Error fetching job attachments:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching attachments",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Get attachments for a specific status update
export const getStatusAttachments = async (req: Request, res: Response) => {
  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const statusTrackingId = parseInt(req.params.statusTrackingId);
    if (!statusTrackingId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status tracking ID" });
    }

    // Get attachments for this status update
    const attachments =
      await jobQueries.getJobStatusAttachmentsByStatusId(statusTrackingId);

    if (attachments.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: "No attachments found for this status update",
      });
    }

    // Check access to the job (using first attachment's job_id)
    const jobId = attachments[0].job_id;
    const hasAccess = await checkJobAccess(jobId, user.id, user.roles);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
        error_code: "JOB_ACCESS_DENIED",
      });
    }

    // Add signed URLs to attachments
    const attachmentsWithUrls = attachments.map((attachment: any) => ({
      ...attachment,
      signed_url: attachment.s3_key
        ? `https://your-bucket.s3.amazonaws.com/${attachment.s3_key}?signature=placeholder`
        : attachment.file_path,
    }));

    res.json({
      success: true,
      data: attachmentsWithUrls,
    });
  } catch (err: any) {
    console.error("Error fetching status attachments:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching attachments",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// DEBUG: Diagnostic endpoint to check job availability for logged-in employee
export const debugEmployeeJobs = async (req: Request, res: Response) => {
  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const connection = await db.getConnection();

    try {
      // Check 1: Get employee details
      const [employee] = (await connection.execute(
        `SELECT id, first_name, last_name, mobile FROM employees WHERE id = ?`,
        [user.id],
      )) as any;

      // Check 2: Count job assignments for this employee
      const [assignments] = (await connection.execute(
        `SELECT COUNT(*) as total, json_arrayagg(json_object('job_id', job_id, 'assignment_status', assignment_status)) as assignments 
                 FROM job_assignments WHERE employee_id = ?`,
        [user.id],
      )) as any;

      // Check 3: Get details of assigned jobs
      const [assignedJobs] = (await connection.execute(
        `SELECT j.id, j.job_code, j.status, ja.assignment_status, 
                         c.full_name as customer_name, ja.created_at
                 FROM jobs j
                 INNER JOIN job_assignments ja ON j.id = ja.job_id
                 LEFT JOIN customers c ON j.customer_id = c.id
                 WHERE ja.employee_id = ?
                 ORDER BY ja.created_at DESC`,
        [user.id],
      )) as any;

      // Check 4: Test the actual listJobs query
      const [jobsFromListJobsQuery] = (await connection.execute(
        `SELECT COUNT(DISTINCT j.id) as total FROM jobs j
                 WHERE EXISTS (
                     SELECT 1 FROM job_assignments ja 
                     WHERE ja.job_id = j.id 
                     AND ja.employee_id = ? 
                     AND ja.assignment_status IN ('Assigned', 'Active')
                 )`,
        [user.id],
      )) as any;

      // Check 5: Get all distinct assignment statuses in the system
      const [allStatuses] = (await connection.execute(
        `SELECT DISTINCT assignment_status FROM job_assignments`,
      )) as any;

      // NEW Check 6: Check leads assigned to this employee
      const [assignedLeads] = (await connection.execute(
        `SELECT l.id, l.first_name, l.last_name, l.status, l.assigned_to
                 FROM leads l
                 WHERE l.assigned_to = ?
                 ORDER BY l.created_at DESC`,
        [user.id],
      )) as any;

      // NEW Check 7: Check which leads have been converted to jobs
      const [convertedLeads] = (await connection.execute(
        `SELECT l.id as lead_id, l.first_name, l.status as lead_status,
                         j.id as job_id, j.job_code, j.status as job_status,
                         COUNT(ja.id) as assignment_count
                 FROM leads l
                 LEFT JOIN jobs j ON l.id = j.lead_id
                 LEFT JOIN job_assignments ja ON j.id = ja.job_id
                 WHERE l.assigned_to = ?
                 GROUP BY l.id, j.id
                 ORDER BY l.created_at DESC`,
        [user.id],
      )) as any;

      // NEW Check 8: Check for jobs created from leads with no assignments
      const [orphanedJobs] = (await connection.execute(
        `SELECT j.id, j.job_code, j.lead_id, j.status,
                         l.first_name as lead_first_name, l.assigned_to as lead_assigned_to
                 FROM jobs j
                 LEFT JOIN leads l ON j.lead_id = l.id
                 WHERE j.lead_id IS NOT NULL
                 AND NOT EXISTS (
                     SELECT 1 FROM job_assignments ja WHERE ja.job_id = j.id
                 )`,
      )) as any;

      res.status(200).json({
        success: true,
        debug_info: {
          employee: employee[0] || null,
          assignment_count: assignments[0]?.total || 0,
          assignment_summary: assignments[0]?.assignments || [],
          assigned_jobs_list: assignedJobs,
          jobs_matching_filter: jobsFromListJobsQuery[0]?.total || 0,
          all_assignment_statuses_in_db: allStatuses.map(
            (r: any) => r.assignment_status,
          ),

          // NEW CHECKS
          leads_assigned_to_employee: assignedLeads || [],
          leads_conversion_status: convertedLeads || [],
          orphaned_jobs_without_assignment: orphanedJobs || [],

          query_explanation: {
            check_1: "Employee details - verify employee exists",
            check_2:
              "Job assignments count - how many jobs are assigned to this employee",
            check_3: "Assigned jobs details - list of jobs and their statuses",
            check_4:
              "Jobs matching listJobs filter - jobs that SHOULD appear in /api/jobs/allJobs",
            check_5:
              "All possible assignment statuses - verify correct status values used",
            check_6: "Leads assigned to this employee - which leads are theirs",
            check_7:
              "Lead conversion status - which leads were converted to jobs and if assignments exist",
            check_8:
              "Orphaned jobs - jobs created from leads but with NO job_assignments entry (this is the problem!)",
          },
          action_if_orphaned_jobs_exist:
            "These jobs exist but have no assignments! They need manual assignment via /api/jobs/assignment/create OR lead.assigned_to needs to be set before conversion",
        },
      });
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Error in debugEmployeeJobs:", error);
    res.status(500).json({
      success: false,
      message: "Debug error",
      error: error.message,
    });
  }
};

// FIX: Manual assignment endpoint for jobs created without assignments
export const fixJobAssignment = async (req: Request, res: Response) => {
  let connection: PoolConnection | null = null;

  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    // Only SuperAdmin can use this endpoint
    const userRoles = user.roles || [];
    if (!userRoles.includes("SuperAdmin")) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only SuperAdmin can use this endpoint.",
      });
    }

    const { job_id, employee_id } = req.body;

    if (!job_id || !employee_id) {
      return res.status(400).json({
        success: false,
        message: "job_id and employee_id are required",
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Check if job exists
      const [jobs] = (await connection.execute(
        `SELECT id, job_code, status FROM jobs WHERE id = ?`,
        [job_id],
      )) as any;

      if (!jobs || jobs.length === 0) {
        throw new Error("Job not found");
      }

      const job = jobs[0];

      // Check if employee exists and is active
      const [employees] = (await connection.execute(
        `SELECT id, status, first_name, last_name FROM employees WHERE id = ?`,
        [employee_id],
      )) as any;

      if (!employees || employees.length === 0) {
        throw new Error("Employee not found");
      }

      const employee = employees[0];

      if (employee.status !== "Active") {
        throw new Error(
          `Employee "${employee.first_name} ${employee.last_name}" is not Active`,
        );
      }

      // Check if assignment already exists
      const [existingAssignments] = (await connection.execute(
        `SELECT id FROM job_assignments WHERE job_id = ? AND employee_id = ?`,
        [job_id, employee_id],
      )) as any;

      if (existingAssignments && existingAssignments.length > 0) {
        throw new Error("Assignment already exists for this job and employee");
      }

      // Create the assignment
      const assignmentData = {
        job_id: job_id,
        employee_id: employee_id,
        assignment_status: "Active" as const,
        start_date: undefined,
      };

      const assignmentId = await jobQueries.createJobAssignment(
        assignmentData,
        user.id,
        connection,
      );

      // Update job status to Site Visit if currently Active
      if (job.status === "Active") {
        await jobQueries.updateJob(
          job_id,
          { status: "Site Visit" },
          user.id,
          connection,
        );
        await jobQueries.createJobStatusTracking(
          {
            job_id: job_id,
            previous_status: "Active",
            new_status: "Site Visit",
            status_reason: "Employee assigned to job (manual fix)",
            comments: `Employee ${employee.first_name} ${employee.last_name} assigned to job via manual fix`,
          },
          user.id,
          connection,
        );

        console.log(
          "✅ FIX JOB ASSIGNMENT DEBUG - Job status updated to Site Visit",
        );
      }

      await connection.commit();

      res.status(201).json({
        success: true,
        message: "Job assignment created successfully",
        data: {
          assignment_id: assignmentId,
          job_id: job_id,
          job_code: job.job_code,
          employee_id: employee_id,
          employee_name: `${employee.first_name} ${employee.last_name}`,
          assignment_status: "Assigned",
          job_status_updated:
            job.status === "Active" ? "Active → Site Visit" : job.status,
        },
      });
    } catch (error: any) {
      await connection.rollback();
      throw error;
    }
  } catch (error: any) {
    console.error("Error in fixJobAssignment:", error);

    let statusCode = 500;
    let message = error.message;

    if (message.includes("not found") || message.includes("not Active")) {
      statusCode = 400;
    } else if (message.includes("already exists")) {
      statusCode = 409;
    }

    res.status(statusCode).json({
      success: false,
      message: "Error creating job assignment",
      error: message,
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * Get comprehensive job details with complete status history including notes and attachments with signed URLs
 */
export const getJobWithCompleteStatusHistory = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const id = parseInt(req.params.id);
    if (!id)
      return res
        .status(400)
        .json({ success: false, message: "Invalid job id" });

    // Check access permission for this job
    const hasAccess = await checkJobAccess(id, user.id, user.roles);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission to view this job.",
        error_code: "JOB_ACCESS_DENIED",
      });
    }

    // Import status history utilities
    const statusHistoryUtils = await import("../utils/statusHistoryUtils");

    const job = await jobQueries.getJobById(id);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Get comprehensive status history with all related details
    const statusHistory = await statusHistoryUtils.getJobStatusHistory(id);

    // Get all attachments across all status changes
    const allAttachments = await statusHistoryUtils.getAllJobAttachments(id);

    // Get related data
    const [locations, assignments, payments] = await Promise.all([
      jobQueries.getJobLocationsByJobId(id),
      jobQueries.getJobAssignmentsByJobId(id),
      jobQueries.getJobPaymentsByJobId(id),
    ]);

    const jobDetails = {
      ...job,
      locations,
      assignments,
      payments,
      status_history: statusHistory,
      all_attachments: allAttachments,
      status_history_summary: {
        total_status_changes: statusHistory.length,
        total_attachments: allAttachments.length,
        latest_status:
          statusHistory.length > 0
            ? {
                status: statusHistory[0].new_status,
                changed_at: statusHistory[0].changed_at,
                changed_by: statusHistory[0].changed_by_name,
              }
            : null,
      },
    };

    res.json({
      success: true,
      data: jobDetails,
      message:
        "Job details with comprehensive status history retrieved successfully",
    });
  } catch (err) {
    console.error("Error fetching job with complete status history:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching job details",
      error: process.env.NODE_ENV === "development" ? err : undefined,
    });
  }
};

/**
 * Get only the status history for a job with all details
 */
export const getJobStatusHistoryDetails = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const id = parseInt(req.params.id);
    if (!id)
      return res
        .status(400)
        .json({ success: false, message: "Invalid job id" });

    // Check access permission for this job
    const hasAccess = await checkJobAccess(id, user.id, user.roles);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission to view this job.",
        error_code: "JOB_ACCESS_DENIED",
      });
    }

    // Import status history utilities
    const statusHistoryUtils = await import("../utils/statusHistoryUtils");

    // Get comprehensive status history
    const statusHistory = await statusHistoryUtils.getJobStatusHistory(id);

    if (statusHistory.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No status history found for this job",
      });
    }

    res.json({
      success: true,
      data: {
        job_id: id,
        total_status_changes: statusHistory.length,
        status_history: statusHistory,
      },
      message: "Job status history retrieved successfully",
    });
  } catch (err) {
    console.error("Error fetching job status history:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching job status history",
      error: process.env.NODE_ENV === "development" ? err : undefined,
    });
  }
};

/**
 * Get all attachments for a job with signed URLs
 */
export const getJobCompleteAttachments = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = (res.locals as any).user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ success: false, message: "User information not found" });
    }

    const id = parseInt(req.params.id);
    if (!id)
      return res
        .status(400)
        .json({ success: false, message: "Invalid job id" });

    // Check access permission for this job
    const hasAccess = await checkJobAccess(id, user.id, user.roles);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission to view this job.",
        error_code: "JOB_ACCESS_DENIED",
      });
    }

    // Import status history utilities
    const statusHistoryUtils = await import("../utils/statusHistoryUtils");

    // Get all attachments with signed URLs
    const attachments = await statusHistoryUtils.getAllJobAttachments(id);

    res.json({
      success: true,
      data: {
        job_id: id,
        total_attachments: attachments.length,
        attachments: attachments,
      },
      message: "Job attachments retrieved successfully",
    });
  } catch (err) {
    console.error("Error fetching job attachments:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching job attachments",
      error: process.env.NODE_ENV === "development" ? err : undefined,
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
  assignJobToEmployee,
  createJobPayment,
  updateJobStatus,
  searchJobs,
  getJobsByEmployee,
  getJobsCounts,
  convertLeadToJob,
  getJobPayments,
  grantJobMonitoringAccess,
  revokeJobMonitoringAccess,
  getMyLeads,
  getMyActiveJobs,
  getMyCompletedJobs,
  addJobNote,
  getJobNotes,
  getJobAttachments,
  getStatusAttachments,
  debugEmployeeJobs,
  fixJobAssignment,
  getJobWithCompleteStatusHistory,
  getJobStatusHistoryDetails,
  getJobCompleteAttachments,
};

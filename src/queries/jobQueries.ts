import { PoolConnection } from 'mysql2/promise';
import { db } from '../db';

// Job CRUD Operations
export const createJob = async (
    jobData: {
        job_code: string;
        lead_id?: number;
        customer_id: number;
        location_id?: number;
        service_type: string;
        solar_service: string;
        package_id?: number;
        capacity?: string;
        estimated_cost?: number;
        job_priority?: string;
        scheduled_date?: string;
        job_description?: string;
        special_instructions?: string;
        status?: string;
    },
    created_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        `INSERT INTO jobs (
            job_code, lead_id, customer_id, location_id, service_type, solar_service, package_id, 
            capacity, estimated_cost, job_priority, scheduled_date, job_description, 
            special_instructions, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            jobData.job_code, 
            jobData.lead_id || null, 
            jobData.customer_id, 
            jobData.location_id || null,
            jobData.service_type, 
            jobData.solar_service, 
            jobData.package_id || null, 
            jobData.capacity || null, 
            jobData.estimated_cost || null, 
            jobData.job_priority || 'Medium', 
            jobData.scheduled_date || null, 
            jobData.job_description || null, 
            jobData.special_instructions || null, 
            jobData.status || 'Created', 
            created_by
        ]
    );
    return (result as any).insertId;
};

export const getJobById = async (id: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT j.*, 
                p.name as package_name, p.capacity as package_capacity, p.price as package_price,
                c.customer_code, c.full_name as customer_name, c.mobile as customer_mobile, 
                c.email as customer_email, c.customer_type, c.company_name,
                cl.location_type, cl.address_line_1, cl.address_line_2, cl.city, cl.pincode,
                cl.landmark, cl.latitude, cl.longitude,
                d.name as district_name, s.name as state_name, co.name as country_name,
                l.first_name as lead_first_name, l.last_name as lead_last_name,
                cb.first_name as created_by_name, ub.first_name as updated_by_name
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
         WHERE j.id = ?`,
        [id]
    );
    return (rows as any[])[0];
};

export const getAllJobs = async (onlyActive: boolean = true, connection?: PoolConnection) => {
    const conn = connection || db;
    let query = `
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
                ORDER BY jst.status_date DESC LIMIT 1) as latest_status,
               (SELECT jst.status_date FROM job_status_tracking jst 
                WHERE jst.job_id = j.id 
                ORDER BY jst.status_date DESC LIMIT 1) as latest_status_date,
               (SELECT jst.comments FROM job_status_tracking jst 
                WHERE jst.job_id = j.id 
                ORDER BY jst.status_date DESC LIMIT 1) as latest_status_comments,
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
        query += ` WHERE j.status NOT IN ('Cancelled', 'Completed')`;
    }
    
    query += ` ORDER BY j.created_at DESC`;
    
    const [rows] = await conn.execute(query);
    return rows as any[];
};

// Get detailed job information with all related data
export const getJobsWithDetails = async (onlyActive: boolean = true, connection?: PoolConnection) => {
    const conn = connection || await db.getConnection();
    
    try {
        // Get basic job information
        const jobs = await getAllJobs(onlyActive, conn);
        
        // Get detailed information for each job
        const jobsWithDetails = await Promise.all(jobs.map(async (job: any) => {
            // Get job status tracking history
            const [statusHistory] = await conn.execute(
                `SELECT jst.*, e.first_name as changed_by_name 
                 FROM job_status_tracking jst
                 LEFT JOIN employees e ON jst.changed_by = e.id
                 WHERE jst.job_id = ? 
                 ORDER BY jst.status_date DESC`,
                [job.id]
            );
            
            // Get job payments
            const [payments] = await conn.execute(
                `SELECT jp.*, 
                        pb.first_name as processed_by_name,
                        vb.first_name as verified_by_name,
                        cb.first_name as created_by_name
                 FROM job_payments jp
                 LEFT JOIN employees pb ON jp.processed_by = pb.id
                 LEFT JOIN employees vb ON jp.verified_by = vb.id
                 LEFT JOIN employees cb ON jp.created_by = cb.id
                 WHERE jp.job_id = ? 
                 ORDER BY jp.created_at DESC`,
                [job.id]
            );
            
            // Get job assignments
            const [assignments] = await conn.execute(
                `SELECT ja.*, 
                        e.first_name as employee_first_name, e.last_name as employee_last_name,
                        e.mobile as employee_mobile, e.email as employee_email,
                        ab.first_name as assigned_by_name
                 FROM job_assignments ja
                 LEFT JOIN employees e ON ja.employee_id = e.id
                 LEFT JOIN employees ab ON ja.assigned_by = ab.id
                 WHERE ja.job_id = ? 
                 ORDER BY ja.assigned_date DESC`,
                [job.id]
            );
            
            // Get job locations (additional locations if any)
            const [jobLocations] = await conn.execute(
                `SELECT jl.*, 
                        d.name as district_name, s.name as state_name, co.name as country_name
                 FROM job_locations jl
                 LEFT JOIN districts d ON jl.district_id = d.id
                 LEFT JOIN states s ON jl.state_id = s.id
                 LEFT JOIN countries co ON jl.country_id = co.id
                 WHERE jl.job_id = ? 
                 ORDER BY jl.created_at ASC`,
                [job.id]
            );
            
            return {
                ...job,
                status_history: statusHistory,
                payments: payments,
                assignments: assignments,
                additional_locations: jobLocations
            };
        }));
        
        return jobsWithDetails;
    } finally {
        if (!connection && conn) {
            conn.release();
        }
    }
};

export const updateJob = async (
    id: number,
    updateData: any,
    updated_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const fields = Object.keys(updateData);
    // Convert undefined values to null for MySQL compatibility
    const values = Object.values(updateData).map(value => value === undefined ? null : value);
    
    if (fields.length === 0) return false;
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    values.push(updated_by, id);
    
    const [result] = await conn.execute(
        `UPDATE jobs SET ${setClause}, updated_by = ? WHERE id = ?`,
        values
    );
    return (result as any).affectedRows > 0;
};

export const getJobByCode = async (job_code: string, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        'SELECT * FROM jobs WHERE job_code = ?',
        [job_code]
    );
    return (rows as any[])[0];
};

// Job Location Operations
export const createJobLocation = async (
    locationData: {
        job_id: number;
        address_line_1: string;
        address_line_2?: string;
        city: string;
        district_id?: number;
        state_id?: number;
        country_id?: number;
        pincode: string;
        landmark?: string;
        latitude?: number;
        longitude?: number;
        location_type?: string;
    },
    created_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        `INSERT INTO job_locations (
            job_id, address_line_1, address_line_2, city, district_id,
            state_id, country_id, pincode, landmark, latitude, longitude,
            location_type, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            locationData.job_id, 
            locationData.address_line_1, 
            locationData.address_line_2 || null,
            locationData.city, 
            locationData.district_id || null, 
            locationData.state_id || null,
            locationData.country_id || null, 
            locationData.pincode, 
            locationData.landmark || null,
            locationData.latitude || null, 
            locationData.longitude || null,
            locationData.location_type || 'Installation', 
            created_by
        ]
    );
    return (result as any).insertId;
};

export const getJobLocationsByJobId = async (job_id: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT jl.*, 
                c.name as country_name, s.name as state_name, d.name as district_name
         FROM job_locations jl
         LEFT JOIN countries c ON jl.country_id = c.id
         LEFT JOIN states s ON jl.state_id = s.id
         LEFT JOIN districts d ON jl.district_id = d.id
         WHERE jl.job_id = ?`,
        [job_id]
    );
    return rows as any[];
};

// Job Assignment Operations
export const createJobAssignment = async (
    assignmentData: {
        job_id: number;
        employee_id: number;
        role_type?: string;
        start_date?: string;
        end_date?: string;
        notes?: string;
    },
    assigned_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        `INSERT INTO job_assignments (
            job_id, employee_id, role_type, start_date, end_date, notes, assigned_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            assignmentData.job_id, 
            assignmentData.employee_id, 
            assignmentData.role_type || null,
            assignmentData.start_date || null, 
            assignmentData.end_date || null, 
            assignmentData.notes || null,
            assigned_by
        ]
    );
    return (result as any).insertId;
};

export const getJobAssignmentsByJobId = async (job_id: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT ja.*, 
                e.first_name, e.last_name, e.mobile as employee_mobile,
                ab.first_name as assigned_by_name
         FROM job_assignments ja
         LEFT JOIN employees e ON ja.employee_id = e.id
         LEFT JOIN employees ab ON ja.assigned_by = ab.id
         WHERE ja.job_id = ? AND ja.assignment_status != 'Cancelled'`,
        [job_id]
    );
    return rows as any[];
};

export const updateJobAssignment = async (
    id: number,
    updateData: any,
    updated_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const fields = Object.keys(updateData);
    // Convert undefined values to null for MySQL compatibility
    const values = Object.values(updateData).map(value => value === undefined ? null : value);
    
    if (fields.length === 0) return false;
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    values.push(updated_by, id);
    
    const [result] = await conn.execute(
        `UPDATE job_assignments SET ${setClause}, updated_by = ? WHERE id = ?`,
        values
    );
    return (result as any).affectedRows > 0;
};

// Job Status Tracking Operations
export const createJobStatusTracking = async (
    statusData: {
        job_id: number;
        previous_status?: string;
        new_status: string;
        status_reason?: string;
        comments?: string;
        attachment_url?: string;
    },
    changed_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        `INSERT INTO job_status_tracking (
            job_id, previous_status, new_status, status_reason, comments,
            attachment_url, changed_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            statusData.job_id, 
            statusData.previous_status || null, 
            statusData.new_status,
            statusData.status_reason || null, 
            statusData.comments || null, 
            statusData.attachment_url || null,
            changed_by
        ]
    );
    return (result as any).insertId;
};

export const getJobStatusTrackingByJobId = async (job_id: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT jst.*, 
                e.first_name as changed_by_name, e.last_name as changed_by_lastname
         FROM job_status_tracking jst
         LEFT JOIN employees e ON jst.changed_by = e.id
         WHERE jst.job_id = ?
         ORDER BY jst.status_date DESC`,
        [job_id]
    );
    return rows as any[];
};

// Job Payment Operations
export const createJobPayment = async (
    paymentData: {
        job_id: number;
        payment_type: string;
        amount: number;
        discount_amount?: number;
        taxable_amount: number;
        gst_rate?: number;
        cgst_rate?: number;
        sgst_rate?: number;
        igst_rate?: number;
        cgst_amount?: number;
        sgst_amount?: number;
        igst_amount?: number;
        total_tax_amount?: number;
        total_amount: number;
        payment_method: string;
        payment_status?: string;
        transaction_id?: string;
        payment_reference?: string;
        payment_date?: string;
        due_date?: string;
        milestone_description?: string;
        receipt_url?: string;
    },
    created_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        `INSERT INTO job_payments (
            job_id, payment_type, amount, discount_amount, taxable_amount,
            gst_rate, cgst_rate, sgst_rate, igst_rate,
            cgst_amount, sgst_amount, igst_amount, total_tax_amount, total_amount,
            payment_method, payment_status, transaction_id, payment_reference, 
            payment_date, due_date, milestone_description, receipt_url, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            paymentData.job_id, 
            paymentData.payment_type, 
            paymentData.amount,
            paymentData.discount_amount || 0,
            paymentData.taxable_amount,
            paymentData.gst_rate || 0,
            paymentData.cgst_rate || 0,
            paymentData.sgst_rate || 0,
            paymentData.igst_rate || 0,
            paymentData.cgst_amount || 0,
            paymentData.sgst_amount || 0,
            paymentData.igst_amount || 0,
            paymentData.total_tax_amount || 0,
            paymentData.total_amount,
            paymentData.payment_method, 
            paymentData.payment_status || 'Pending',
            paymentData.transaction_id || null, 
            paymentData.payment_reference || null,
            paymentData.payment_date || null, 
            paymentData.due_date || null, 
            paymentData.milestone_description || null,
            paymentData.receipt_url || null, 
            created_by
        ]
    );
    return (result as any).insertId;
};

export const getJobPaymentsByJobId = async (job_id: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT jp.*, 
                cb.first_name as created_by_name, pb.first_name as processed_by_name
         FROM job_payments jp
         LEFT JOIN employees cb ON jp.created_by = cb.id
         LEFT JOIN employees pb ON jp.processed_by = pb.id
         WHERE jp.job_id = ?
         ORDER BY jp.created_at DESC`,
        [job_id]
    );
    return rows as any[];
};

export const updateJobPayment = async (
    id: number,
    updateData: any,
    updated_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const fields = Object.keys(updateData);
    // Convert undefined values to null for MySQL compatibility
    const values = Object.values(updateData).map(value => value === undefined ? null : value);
    
    if (fields.length === 0) return false;
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    values.push(updated_by, id);
    
    const [result] = await conn.execute(
        `UPDATE job_payments SET ${setClause}, updated_by = ? WHERE id = ?`,
        values
    );
    return (result as any).affectedRows > 0;
};

// Search and Filter Operations
export const searchJobs = async (searchTerm: string, filters: any = {}, connection?: PoolConnection) => {
    const conn = connection || db;
    let query = `
        SELECT j.*, 
               p.name as package_name,
               c.customer_code, c.full_name as customer_name, c.mobile as customer_mobile,
               l.first_name as lead_first_name, l.last_name as lead_last_name,
               cb.first_name as created_by_name
        FROM jobs j
        LEFT JOIN packages p ON j.package_id = p.id
        LEFT JOIN customers c ON j.customer_id = c.id
        LEFT JOIN leads l ON j.lead_id = l.id
        LEFT JOIN employees cb ON j.created_by = cb.id
        WHERE (
            j.job_code LIKE ? OR 
            c.full_name LIKE ? OR 
            c.mobile LIKE ? OR
            c.email LIKE ? OR
            c.customer_code LIKE ?
        )
    `;
    
    const params = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];
    
    if (filters.status) {
        query += ` AND j.status = ?`;
        params.push(filters.status);
    }
    
    if (filters.service_type) {
        query += ` AND j.service_type = ?`;
        params.push(filters.service_type);
    }
    
    if (filters.date_from) {
        query += ` AND DATE(j.created_at) >= ?`;
        params.push(filters.date_from);
    }
    
    if (filters.date_to) {
        query += ` AND DATE(j.created_at) <= ?`;
        params.push(filters.date_to);
    }
    
    query += ` ORDER BY j.created_at DESC`;
    
    const [rows] = await conn.execute(query, params);
    return rows as any[];
};

export const getJobsByEmployee = async (employee_id: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT DISTINCT j.*, 
                p.name as package_name,
                c.customer_code, c.full_name as customer_name, c.mobile as customer_mobile,
                ja.role_type, ja.assignment_status
         FROM jobs j
         LEFT JOIN packages p ON j.package_id = p.id
         LEFT JOIN customers c ON j.customer_id = c.id
         LEFT JOIN job_assignments ja ON j.id = ja.job_id
         WHERE ja.employee_id = ? AND ja.assignment_status = 'Active'
         ORDER BY j.scheduled_date ASC`,
        [employee_id]
    );
    return rows as any[];
};

// Generate unique job code
export const generateJobCode = async (connection?: PoolConnection) => {
    const conn = connection || db;
    const currentDate = new Date();
    const year = currentDate.getFullYear().toString().slice(-2);
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    
    // Get the count of jobs created this month
    const [countRows] = await conn.execute(
        `SELECT COUNT(*) as count FROM jobs 
         WHERE DATE_FORMAT(created_at, '%Y-%m') = ?`,
        [`${currentDate.getFullYear()}-${month}`]
    );
    
    const count = (countRows as any[])[0].count + 1;
    const sequence = count.toString().padStart(4, '0');
    
    return `JOB${year}${month}${sequence}`;
};

export default {
    createJob,
    getJobById,
    getAllJobs,
    updateJob,
    getJobByCode,
    generateJobCode,
    createJobLocation,
    getJobLocationsByJobId,
    createJobAssignment,
    getJobAssignmentsByJobId,
    updateJobAssignment,
    createJobStatusTracking,
    getJobStatusTrackingByJobId,
    createJobPayment,
    getJobPaymentsByJobId,
    updateJobPayment,
    searchJobs,
    getJobsByEmployee
};
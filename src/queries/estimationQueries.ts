import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

export interface Estimation extends RowDataPacket {
    id: number;
    customer_id?: number;
    job_id?: number;
    lead_id?: number;
    first_name: string;
    last_name: string;
    mobile: string;
    email?: string;
    customer_name?: string;
    door_no: string;
    area: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    solar_service: 'Commercial' | 'Residential' | 'Industrial';
    service_type: string;
    structure?: string;
    product_description?: string;
    requested_watts?: string;
    gst: number;
    amount: number;
    final_amount?: number;
    approval_status: 'Draft' | 'Pending_Approval' | 'Approved' | 'Rejected';
    approval_notes?: string;
    approved_by?: number;
    approval_date?: Date;
    rejection_reason?: string;
    created_by?: number;
    updated_by?: number;
    status: 'Active' | 'Site Visit' | 'Estimation Generated' | 'Processed' | 'Pending on Portal' | 'Payment Pending' | 'Partial Payment Done' | 'Payment Done' | 'Invoice Generated' | 'Job Done';
    created_at: Date;
    updated_at: Date;
}

export interface CreateEstimationData {
    first_name: string;
    last_name: string;
    mobile: string;
    email?: string;
    customer_name?: string;
    customer_id?: number;
    job_id?: number;
    lead_id?: number;
    door_no: string;
    area: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    solar_service: 'Commercial' | 'Residential' | 'Industrial';
    service_type: string;
    structure?: string;
    product_description?: string;
    requested_watts?: string;
    gst?: number;
    amount: number;
    status?: string;
    created_by: number;
    updated_by?: number;
}

export const createEstimation = async (estimationData: CreateEstimationData, connection?: PoolConnection) => {
    const conn = connection || db;
    const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO estimations 
        (customer_id, job_id, lead_id, first_name, last_name, mobile, email, customer_name, door_no, area, city, district, state, pincode, 
         solar_service, service_type, structure, product_description, requested_watts, gst, amount, created_by, updated_by, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            estimationData.customer_id ?? null,
            estimationData.job_id ?? null,
            estimationData.lead_id ?? null,
            estimationData.first_name,
            estimationData.last_name,
            estimationData.mobile,
            estimationData.email ?? null,
            estimationData.customer_name ?? `${estimationData.first_name} ${estimationData.last_name}`,
            estimationData.door_no,
            estimationData.area,
            estimationData.city,
            estimationData.district,
            estimationData.state,
            estimationData.pincode,
            estimationData.solar_service ?? 'Residential',
            estimationData.service_type ?? 'Installation',
            estimationData.structure ?? null,
            estimationData.product_description ?? null,
            estimationData.requested_watts ?? null,
            estimationData.gst ?? 18,
            estimationData.amount,
            estimationData.created_by ?? 1,
            estimationData.updated_by ?? null,
            estimationData.status ?? 'Active'
        ]
    );
    
    // Fetch and return the created estimation
    const estimationId = result.insertId;
    const [rows] = await conn.execute<any[]>(
        `SELECT * FROM estimations WHERE id = ?`,
        [estimationId]
    );
    return rows[0] || null;
};

export const getAllEstimations = async (filters?: { status?: string; state?: string; district?: string; includeInactive?: boolean }) => {
    let sql = 'SELECT * FROM estimations WHERE 1=1';
    const params: any[] = [];
    
    // If no status filter is provided and includeInactive is not true, default to Active
    if (filters?.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
    } else if (!filters?.includeInactive) {
        sql += ' AND status = ?';
        params.push('Active');
    }
    
    if (filters?.state) {
        sql += ' AND state = ?';
        params.push(filters.state);
    }
    
    if (filters?.district) {
        sql += ' AND district = ?';
        params.push(filters.district);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const [estimations] = await db.execute<Estimation[]>(sql, params);
    return estimations;
};

export const getEstimationById = async (id: number, includeInactive: boolean = false, connection?: PoolConnection) => {
    const conn = connection || db;
    let query = 'SELECT * FROM estimations WHERE id = ?';
    const params: any[] = [id];
    if (!includeInactive) {
        query += ' AND status = ?';
        params.push('Active');
    }
    const [estimations] = await conn.execute<Estimation[]>(query, params);
    return estimations[0];
};

export const getEstimationsByMobile = async (mobile: string) => {
    const [estimations] = await db.execute<Estimation[]>(
        'SELECT * FROM estimations WHERE mobile = ? ORDER BY created_at DESC',
        [mobile]
    );
    return estimations;
};

export const updateEstimation = async (
    id: number,
    updateData: Partial<Omit<Estimation, 'id' | 'created_at' | 'created_by'>>,
    updatedBy: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updateData).forEach(([key, value]) => {
        // Allow empty strings and numbers (including 0), but exclude null and undefined
        if (value !== undefined && value !== null && key !== 'updated_at') {
            fields.push(`${key} = ?`);
            values.push(value);
            console.log(`DEBUG - Adding field: ${key} = ${value}`);
        } else {
            console.log(`DEBUG - Skipping field: ${key} = ${value} (null/undefined)`);
        }
    });

    if (fields.length === 0) {
        throw new Error('No fields to update');
    }

    fields.push('updated_by = ?');
    values.push(updatedBy);
    values.push(id);

    const query = `UPDATE estimations SET ${fields.join(', ')} WHERE id = ?`;
    console.log('DEBUG - Final query:', query);
    console.log('DEBUG - Final values:', values);

    const [result] = await conn.execute<ResultSetHeader>(
        query,
        values
    );

    return result.affectedRows > 0;
};

export const deleteEstimation = async (id: number) => {
    // Soft delete - change status to 'Inactive'
    const [result] = await db.execute<ResultSetHeader>(
        'UPDATE estimations SET status = ? WHERE id = ? AND status = ?',
        ['Inactive', id, 'Active']
    );
    return result.affectedRows > 0;
};

// Get estimations filtered by employee's job assignments (for role-based access)
export const getEstimationsForEmployee = async (employeeId: number, filters?: { status?: string; state?: string; district?: string; includeInactive?: boolean }) => {
    let sql = `
        SELECT DISTINCT e.*, 
               GROUP_CONCAT(DISTINCT j.job_code SEPARATOR ', ') as related_jobs
        FROM estimations e
        INNER JOIN customers c ON (e.mobile = c.mobile OR 
            (TRIM(LOWER(e.customer_name)) = TRIM(LOWER(c.full_name)) AND e.mobile = c.mobile))
        INNER JOIN jobs j ON j.customer_id = c.id
        INNER JOIN job_assignments ja ON ja.job_id = j.id
        WHERE ja.employee_id = ? 
        AND ja.assignment_status = 'Active'
    `;
    
    const params: any[] = [employeeId];
    
    // If no status filter is provided and includeInactive is not true, default to Active
    if (filters?.status) {
        sql += ' AND e.status = ?';
        params.push(filters.status);
    } else if (!filters?.includeInactive) {
        sql += ' AND e.status = ?';
        params.push('Active');
    }
    
    if (filters?.state) {
        sql += ' AND e.state = ?';
        params.push(filters.state);
    }
    
    if (filters?.district) {
        sql += ' AND e.district = ?';
        params.push(filters.district);
    }
    
    sql += ' GROUP BY e.id ORDER BY e.created_at DESC';
    
    const [estimations] = await db.execute<Estimation[]>(sql, params);
    return estimations;
};

// Check if employee has access to a specific estimation through job assignments
export const hasEstimationAccess = async (employeeId: number, estimationId: number): Promise<boolean> => {
    const query = `
        SELECT COUNT(*) as count 
        FROM estimations e
        INNER JOIN customers c ON (e.mobile = c.mobile OR 
            (TRIM(LOWER(e.customer_name)) = TRIM(LOWER(c.full_name)) AND e.mobile = c.mobile))
        INNER JOIN jobs j ON j.customer_id = c.id
        INNER JOIN job_assignments ja ON ja.job_id = j.id
        WHERE ja.employee_id = ? 
        AND e.id = ?
        AND ja.assignment_status = 'Active'
    `;
    
    const [rows] = await db.execute<RowDataPacket[]>(query, [employeeId, estimationId]);
    return (rows as any[])[0].count > 0;
};

// Get estimations by mobile for employees with access control
export const getEstimationsByMobileForEmployee = async (employeeId: number, mobile: string) => {
    const query = `
        SELECT DISTINCT e.*, 
               GROUP_CONCAT(DISTINCT j.job_code SEPARATOR ', ') as related_jobs
        FROM estimations e
        INNER JOIN customers c ON (e.mobile = c.mobile OR 
            (TRIM(LOWER(e.customer_name)) = TRIM(LOWER(c.full_name)) AND e.mobile = c.mobile))
        INNER JOIN jobs j ON j.customer_id = c.id
        INNER JOIN job_assignments ja ON ja.job_id = j.id
        WHERE ja.employee_id = ?
        AND e.mobile = ?
        AND ja.assignment_status = 'Active'
        GROUP BY e.id 
        ORDER BY e.created_at DESC
    `;
    
    const [estimations] = await db.execute<Estimation[]>(query, [employeeId, mobile]);
    return estimations;
};

// Get Running Estimations - Job statuses: Site Visit, Estimation Generated, Processed, Partial Payment Done, Payment Done, Invoice Generated
// Also includes newly created estimations without a job assigned (job_id IS NULL)
export const getRunningEstimations = async (employeeId: number, isEmployee: boolean = true) => {
    const runningStatuses = ['Site Visit', 'Estimation Generated', 'Processed', 'Partial Payment Done', 'Payment Done', 'Invoice Generated'];
    const statusPlaceholders = runningStatuses.map(() => '?').join(',');
    
    let query = `
        SELECT DISTINCT e.*, 
               j.status as job_status,
               j.job_code,
               j.estimated_cost,
               j.actual_cost,
               c.customer_code
        FROM estimations e
        LEFT JOIN customers c ON (e.mobile = c.mobile OR 
            (TRIM(LOWER(e.customer_name)) = TRIM(LOWER(c.full_name)) AND e.mobile = c.mobile))
        LEFT JOIN jobs j ON j.customer_id = c.id AND j.id = e.job_id
    `;
    
    const params: any[] = [];
    
    if (isEmployee) {
        query += `
            LEFT JOIN job_assignments ja ON ja.job_id = j.id
            WHERE e.created_by = ?
            AND e.status = 'Active'
            AND (
                e.job_id IS NULL
                OR (
                    ja.employee_id = ? 
                    AND ja.assignment_status = 'Active'
                    AND j.status IN (${statusPlaceholders})
                )
            )
        `;
        params.push(employeeId, employeeId, ...runningStatuses);
    } else {
        query += `
            WHERE e.status = 'Active'
            AND (
                e.job_id IS NULL
                OR j.status IN (${statusPlaceholders})
            )
        `;
        params.push(...runningStatuses);
    }
    
    query += ` ORDER BY e.created_at DESC, j.updated_at DESC`;
    
    const [estimations] = await db.execute<any[]>(query, params);
    return estimations;
};

// Get Pending Estimations - Job statuses: Pending on Portal, Payment Pending
export const getPendingEstimations = async (employeeId: number, isEmployee: boolean = true) => {
    const pendingStatuses = ['Pending on Portal', 'Payment Pending'];
    const statusPlaceholders = pendingStatuses.map(() => '?').join(',');
    
    let query = `
        SELECT DISTINCT e.*, 
               j.status as job_status,
               j.job_code,
               j.estimated_cost,
               j.actual_cost,
               c.customer_code
        FROM estimations e
        INNER JOIN customers c ON (e.mobile = c.mobile OR 
            (TRIM(LOWER(e.customer_name)) = TRIM(LOWER(c.full_name)) AND e.mobile = c.mobile))
        INNER JOIN jobs j ON j.customer_id = c.id AND j.id = e.job_id
    `;
    
    const params: any[] = [];
    
    if (isEmployee) {
        query += `
            INNER JOIN job_assignments ja ON ja.job_id = j.id
            WHERE ja.employee_id = ? 
            AND ja.assignment_status = 'Active'
            AND j.status IN (${statusPlaceholders})
        `;
        params.push(employeeId, ...pendingStatuses);
    } else {
        query += `
            WHERE j.status IN (${statusPlaceholders})
        `;
        params.push(...pendingStatuses);
    }
    
    query += ` AND e.status = 'Active' ORDER BY j.updated_at DESC`;
    
    const [estimations] = await db.execute<any[]>(query, params);
    return estimations;
};

// Get Waiting for Approval Estimations - Job status: Active (newly created jobs needing approval)
// Only shows estimations that are linked to a job (job_id IS NOT NULL)
export const getWaitingForApprovalEstimations = async (employeeId: number, isEmployee: boolean = true) => {
    let query = `
        SELECT DISTINCT e.*, 
               j.status as job_status,
               j.job_code,
               j.estimated_cost,
               j.actual_cost,
               j.created_by as job_created_by,
               c.customer_code,
               emp.first_name as creator_name
        FROM estimations e
        INNER JOIN customers c ON (e.mobile = c.mobile OR 
            (TRIM(LOWER(e.customer_name)) = TRIM(LOWER(c.full_name)) AND e.mobile = c.mobile))
        INNER JOIN jobs j ON j.customer_id = c.id AND j.id = e.job_id
        LEFT JOIN employees emp ON j.created_by = emp.id
    `;
    
    const params: any[] = [];
    
    if (isEmployee) {
        query += `
            INNER JOIN job_assignments ja ON ja.job_id = j.id
            WHERE ja.employee_id = ? 
            AND ja.assignment_status = 'Active'
            AND j.status = 'Active'
            AND j.created_by = ?
        `;
        // Employee can only see estimations for jobs they created
        params.push(employeeId, employeeId);
    } else {
        query += `
            WHERE j.status = 'Active'
        `;
    }
    
    query += ` AND e.status = 'Active' ORDER BY j.created_at DESC`;
    
    const [estimations] = await db.execute<any[]>(query, params);
    return estimations;
};

// Get Completed Estimations - Job status: Job Done
export const getCompletedEstimations = async (employeeId: number, isEmployee: boolean = true) => {
    let query = `
        SELECT DISTINCT e.*, 
               j.status as job_status,
               j.job_code,
               j.estimated_cost,
               j.actual_cost,
               j.completion_date,
               c.customer_code
        FROM estimations e
        INNER JOIN customers c ON (e.mobile = c.mobile OR 
            (TRIM(LOWER(e.customer_name)) = TRIM(LOWER(c.full_name)) AND e.mobile = c.mobile))
        INNER JOIN jobs j ON j.customer_id = c.id AND j.id = e.job_id
    `;
    
    const params: any[] = [];
    
    if (isEmployee) {
        query += `
            INNER JOIN job_assignments ja ON ja.job_id = j.id
            WHERE ja.employee_id = ? 
            AND ja.assignment_status = 'Active'
            AND j.status = 'Job Done'
        `;
        params.push(employeeId);
    } else {
        query += `
            WHERE j.status = 'Job Done'
        `;
    }
    
    query += ` AND e.status = 'Active' ORDER BY j.completion_date DESC, j.updated_at DESC`;
    
    const [estimations] = await db.execute<any[]>(query, params);
    return estimations;
};

// Approval Workflow Functions

// Request approval for estimation (employee submits for approval)
export const requestEstimationApproval = async (estimationId: number, employeeId: number): Promise<boolean> => {
    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE estimations 
         SET approval_status = 'Pending_Approval', updated_by = ?, updated_at = NOW()
         WHERE id = ? AND created_by = ? AND approval_status = 'Draft'`,
        [employeeId, estimationId, employeeId]
    );
    return result.affectedRows > 0;
};

// Get pending approval estimations for SuperAdmin/Admin
export const getPendingApprovalEstimations = async (): Promise<Estimation[]> => {
    const [estimations] = await db.execute<Estimation[]>(
        `SELECT e.*, 
                emp.first_name as creator_name, emp.last_name as creator_lastname,
                CONCAT(emp.first_name, ' ', emp.last_name) as created_by_name
         FROM estimations e
         LEFT JOIN employees emp ON e.created_by = emp.id
         WHERE e.approval_status = 'Pending_Approval' AND e.status = 'Active'
         ORDER BY e.created_at ASC`
    );
    return estimations;
};

// Approve estimation (SuperAdmin/Admin)
export const approveEstimation = async (
    estimationId: number, 
    approvalData: { gst: number; final_amount: number; approval_notes?: string }, 
    approvedBy: number
): Promise<boolean> => {
    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE estimations 
         SET status = 'Site Visit', 
             gst = ?, 
             final_amount = ?,
             updated_by = ?,
             updated_at = NOW()
         WHERE id = ? AND status = 'Active'`,
        [
            approvalData.gst,
            approvalData.final_amount,
            approvedBy,
            estimationId
        ]
    );
    return result.affectedRows > 0;
};

// Reject estimation (SuperAdmin/Admin)
export const rejectEstimation = async (
    estimationId: number,
    rejectionReason: string,
    rejectedBy: number
): Promise<boolean> => {
    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE estimations 
         SET updated_by = ?,
             updated_at = NOW()
         WHERE id = ? AND status = 'Active'`,
        [rejectedBy, estimationId]
    );
    return result.affectedRows > 0;
};

// Get estimation approval history
export const getEstimationApprovalHistory = async (estimationId: number) => {
    const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT e.approval_status, e.approval_notes, e.rejection_reason, 
                e.approval_date, e.gst, e.final_amount,
                approver.first_name as approver_name, approver.last_name as approver_lastname,
                creator.first_name as creator_name, creator.last_name as creator_lastname
         FROM estimations e
         LEFT JOIN employees approver ON e.approved_by = approver.id
         LEFT JOIN employees creator ON e.created_by = creator.id
         WHERE e.id = ?`,
        [estimationId]
    );
    return rows[0];
};

// Get estimations by approval status for employee
export const getMyEstimationsByApprovalStatus = async (
    employeeId: number, 
    approvalStatus: string
): Promise<Estimation[]> => {
    const [estimations] = await db.execute<Estimation[]>(
        `SELECT e.*, 
                approver.first_name as approver_name, approver.last_name as approver_lastname
         FROM estimations e
         LEFT JOIN employees approver ON e.approved_by = approver.id
         WHERE e.created_by = ? AND e.approval_status = ? AND e.status = 'Active'
         ORDER BY e.created_at DESC`,
        [employeeId, approvalStatus]
    );
    return estimations;
};

// Check if a job already exists for this estimation
export const checkExistingJobForEstimation = async (estimationId: number, connection?: PoolConnection): Promise<number | null> => {
    const conn = connection || db;
    const [rows] = await conn.execute<any[]>(
        `SELECT id FROM jobs WHERE id IN (
            SELECT job_id FROM estimations WHERE id = ? AND job_id IS NOT NULL
        )`,
        [estimationId]
    );
    return rows.length > 0 ? rows[0].id : null;
};

// Convert Estimation to Job with complete data sync
export const convertEstimationToJob = async (
    estimationId: number,
    convertedBy: number,
    connection?: PoolConnection
): Promise<{ success: boolean; job_id?: number; message: string; error?: string }> => {
    let conn = connection;
    const isTransactionManaged = connection !== undefined;
    
    try {
        // If no connection provided, get one and manage transaction
        if (!conn) {
            conn = await db.getConnection();
            await conn.beginTransaction();
        }

        // Get the estimation
        const [estimations] = await conn.execute<any[]>(
            `SELECT * FROM estimations WHERE id = ?`,
            [estimationId]
        );
        
        if (!estimations || estimations.length === 0) {
            return { success: false, message: 'Estimation not found' };
        }
        
        const estimation = estimations[0];

        // Check if job already exists for this estimation
        if (estimation.job_id) {
            return { success: false, message: 'A job has already been created for this estimation', error: `Job ID: ${estimation.job_id}` };
        }

        // Check if customer exists, if not create from estimation data
        let customerId = estimation.customer_id;
        
        if (!customerId) {
            // Create customer from estimation data
            const [customerResult] = await conn.execute<ResultSetHeader>(
                `INSERT INTO customers (customer_code, first_name, last_name, mobile, email, customer_type, lead_source, created_by, status)
                 VALUES (?, ?, ?, ?, ?, 'Individual', 'Estimation Conversion', ?, 'Active')`,
                [
                    `CUST-${Date.now()}`,
                    estimation.first_name,
                    estimation.last_name || '',
                    estimation.mobile,
                    estimation.email || null,
                    convertedBy
                ]
            );
            customerId = customerResult.insertId;
        }

        // Get country_id (assume India)
        const countryQueries = require('./countryQueries');
        const stateQueries = require('./stateQueries');
        const districtQueries = require('./districtQueries');
        
        const country = await countryQueries.getCountryByName('India', conn);
        if (!country) {
            return { success: false, message: 'Country India not found in database', error: 'COUNTRY_NOT_FOUND' };
        }
        const countryId = country.id;

        // Get or create state
        let state = await stateQueries.getStateByName(countryId, estimation.state, conn);
        if (!state) {
            // Auto-create state if it doesn't exist
            console.log(`[Estimation ${estimationId}] Creating missing state: "${estimation.state}"`);
            // Generate state code from first 2 letters of state name + incrementing number
            const stateCodeBase = estimation.state.toUpperCase().substring(0, 2);
            const [codeResult] = await conn.execute<any[]>(
                `SELECT COUNT(*) as count FROM states WHERE country_id = ? AND state_code LIKE ?`,
                [countryId, `${stateCodeBase}%`]
            );
            const stateCode = `${stateCodeBase}${String(codeResult[0].count + 1).padStart(3, '0')}`;
            
            const [stateResult] = await conn.execute<ResultSetHeader>(
                `INSERT INTO states (country_id, state_code, name, type, created_by, status)
                 VALUES (?, ?, ?, 'State', ?, 'Active')`,
                [countryId, stateCode, estimation.state, convertedBy]
            );
            state = {
                id: stateResult.insertId,
                name: estimation.state,
                country_id: countryId,
                state_code: stateCode,
                status: 'Active'
            };
        }
        const stateId = state.id;

        // Get or create district
        let district = await districtQueries.getDistrictByName(stateId, estimation.district, conn);
        if (!district) {
            // Auto-create district if it doesn't exist
            console.log(`[Estimation ${estimationId}] Creating missing district: "${estimation.district}" in state "${estimation.state}"`);
            // Generate district code from first 2 letters of district name + incrementing number
            const districtCodeBase = estimation.district.toUpperCase().substring(0, 2);
            const [codeResult] = await conn.execute<any[]>(
                `SELECT COUNT(*) as count FROM districts WHERE state_id = ? AND district_code LIKE ?`,
                [stateId, `${districtCodeBase}%`]
            );
            const districtCode = `${districtCodeBase}${String(codeResult[0].count + 1).padStart(3, '0')}`;
            
            const [districtResult] = await conn.execute<ResultSetHeader>(
                `INSERT INTO districts (state_id, district_code, name, created_by, status)
                 VALUES (?, ?, ?, ?, 'Active')`,
                [stateId, districtCode, estimation.district, convertedBy]
            );
            district = {
                id: districtResult.insertId,
                name: estimation.district,
                state_id: stateId,
                district_code: districtCode,
                status: 'Active'
            };
        }
        const districtId = district.id;

        // Create customer location from estimation location data
        const [locationResult] = await conn.execute<ResultSetHeader>(
            `INSERT INTO customer_locations (customer_id, location_type, address_line_1, city, district_id, state_id, country_id, pincode, is_primary, created_by, status)
             VALUES (?, 'Installation', ?, ?, ?, ?, ?, ?, true, ?, 'Active')`,
            [
                customerId,
                estimation.area,
                estimation.city,
                districtId,
                stateId,
                countryId,
                estimation.pincode,
                convertedBy
            ]
        );
        const locationId = locationResult.insertId;

        // Map estimation solar_service to job solar_service
        // Estimations: 'Commercial', 'Residential', 'Industrial'
        // Jobs: 'Residential Solar', 'Commercial Solar', 'Industrial Solar'
        const solarServiceMap: { [key: string]: string } = {
            'Residential': 'Residential Solar',
            'Commercial': 'Commercial Solar',
            'Industrial': 'Industrial Solar'
        };
        const jobSolarService = solarServiceMap[estimation.solar_service] || 'Residential Solar';

        // Generate job code in format: JOB{YY}{MM}{NNNN}
        // Example: JOB26030001 (Year 26, Month 03, Sequence 0001)
        const jobQueries = require('./jobQueries');
        const jobCode = await jobQueries.generateJobCode(conn);

        // Create job
        const [jobResult] = await conn.execute<ResultSetHeader>(
            `INSERT INTO jobs (
                job_code, customer_id, location_id, service_type, solar_service, lead_id,
                capacity, estimated_cost, job_description, status, created_by
            ) VALUES (?, ?, ?, 'Installation', ?, ?, ?, ?, ?, 'Active', ?)`,
            [
                jobCode,
                customerId,
                locationId,
                jobSolarService,
                estimation.lead_id || null,
                estimation.requested_watts || null,
                estimation.amount || null,
                `Created from Estimation #${estimationId}`,
                convertedBy
            ]
        );
        const jobId = jobResult.insertId;

        // Create job locations entry (note: no status column in job_locations table)
        await conn.execute(
            `INSERT INTO job_locations (job_id, address_line_1, city, district_id, state_id, country_id, pincode, location_type, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Installation', ?)`,
            [
                jobId,
                estimation.area,
                estimation.city,
                districtId,
                stateId,
                countryId,
                estimation.pincode,
                convertedBy
            ]
        );

        // Create initial job status tracking
        await conn.execute(
            `INSERT INTO job_status_tracking (job_id, new_status, status_reason, comments, changed_by)
             VALUES (?, 'Active', 'Job created from estimation', ?, ?)`,
            [
                jobId,
                `Job created from Estimation #${estimationId} with customer ${estimation.customer_name}`,
                convertedBy
            ]
        );

        // Update estimation with job_id (keep status as 'Active' - job status tracks progress)
        await conn.execute(
            `UPDATE estimations SET job_id = ?, updated_by = ? WHERE id = ?`,
            [jobId, convertedBy, estimationId]
        );

        // Commit transaction if it was created in this function
        if (!isTransactionManaged && conn) {
            await conn.commit();
        }

        return {
            success: true,
            job_id: jobId,
            message: `Job ${jobCode} created successfully from Estimation #${estimationId}`
        };

    } catch (error: any) {
        // Rollback transaction if it was created in this function
        if (!isTransactionManaged && conn) {
            try {
                await conn.rollback();
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError);
            }
        }
        
        return {
            success: false,
            message: 'Error converting estimation to job',
            error: error.message
        };

    } finally {
        // Release connection if it was created in this function
        if (!isTransactionManaged && conn) {
            try {
                conn.release();
            } catch (releaseError) {
                console.error('Release connection error:', releaseError);
            }
        }
    }
};

// Sync estimation status with job status
export const syncEstimationStatusWithJobStatus = async (estimationId: number, jobId: number, jobStatus: string, connection?: PoolConnection): Promise<boolean> => {
    const conn = connection || db;
    const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE estimations SET status = ?, updated_at = NOW() WHERE id = ?`,
        [jobStatus, estimationId]
    );
    return result.affectedRows > 0;
};

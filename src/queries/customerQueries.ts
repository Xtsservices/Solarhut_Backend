import { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { db } from '../db';

// Customer CRUD Operations
export const createCustomer = async (
    customerData: {
        customer_code: string;
        first_name: string;
        last_name?: string;
        full_name?: string;
        mobile: string;
        email?: string;
        alternate_mobile?: string;
        date_of_birth?: string;
        gender?: string;
        customer_type?: string;
        company_name?: string;
        gst_number?: string;
        pan_number?: string;
        lead_source?: string;
        notes?: string;
        status?: string;
    },
    created_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    
    console.log('DEBUG createCustomer - Creating customer with code:', customerData.customer_code);
    
    const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO customers (
            customer_code, first_name, last_name, mobile, email,
            alternate_mobile, date_of_birth, gender, customer_type, company_name,
            gst_number, pan_number, lead_source, notes, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            customerData.customer_code,
            customerData.first_name,
            customerData.last_name || null,
            customerData.mobile,
            customerData.email || null,
            customerData.alternate_mobile || null,
            customerData.date_of_birth || null,
            customerData.gender || null,
            customerData.customer_type || 'Individual',
            customerData.company_name || null,
            customerData.gst_number || null,
            customerData.pan_number || null,
            customerData.lead_source || null,
            customerData.notes || null,
            customerData.status || 'Active',
            created_by
        ]
    );
    
    console.log('DEBUG createCustomer - Insert result:', { 
        insertId: (result as any).insertId,
        affectedRows: (result as any).affectedRows
    });
    
    const customerId = (result as any).insertId;
    
    if (!customerId || typeof customerId !== 'number' || customerId <= 0) {
        throw new Error(`Failed to create customer - invalid insertId: ${customerId}`);
    }
    
    console.log('DEBUG createCustomer - Created customer with ID:', customerId);
    
    // Read the inserted customer - use connection if available (for transactions), else use db pool
    let createdCustomer;
    if (connection) {
        // Read from transaction connection to see uncommitted row
        const query = 'SELECT id, customer_code, first_name, last_name, mobile, email, customer_type, status, created_at, updated_at FROM customers WHERE id = ?';
        const [rows] = await connection.execute(query, [customerId]);
        createdCustomer = (rows as any[])[0];
    } else {
        // Use db pool for reads
        createdCustomer = await getCustomerById(customerId);
    }
    
    if (!createdCustomer) {
        throw new Error(`Failed to retrieve newly created customer with ID ${customerId}`);
    }
    
    return createdCustomer;
};

// Customer Location CRUD Operations
export const createCustomerLocation = async (
    locationData: {
        customer_id: number;
        location_type: string;
        address_line_1?: string;
        address_line_2?: string;
        city?: string;
        district_id?: number;
        state_id?: number;
        country_id?: number;
        pincode?: string;
        landmark?: string;
        latitude?: number;
        longitude?: number;
        is_primary?: boolean;
    },
    created_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    
    // If this is set as primary, remove primary from other locations
    if (locationData.is_primary) {
        await conn.execute(
            `UPDATE customer_locations SET is_primary = false WHERE customer_id = ?`,
            [locationData.customer_id]
        );
    }

    const [result] = await conn.execute(
        `INSERT INTO customer_locations (
            customer_id, location_type, address_line_1, address_line_2, 
            city, district_id, state_id, country_id, pincode, 
            landmark, latitude, longitude, is_primary, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            locationData.customer_id,
            locationData.location_type,
            locationData.address_line_1 || null,
            locationData.address_line_2 || null,
            locationData.city || null,
            locationData.district_id || null,
            locationData.state_id || null,
            locationData.country_id || null,
            locationData.pincode || null,
            locationData.landmark || null,
            locationData.latitude || null,
            locationData.longitude || null,
            locationData.is_primary || false,
            created_by
        ]
    );
    
    const locationId = (result as any).insertId;
    
    // Fetch and return the complete location object with district, state, country info
    const createdLocation = await getCustomerLocationById(locationId, connection);
    return createdLocation;
};

export const getCustomerLocations = async (customer_id: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT cl.*, 
                d.name as district_name, d.alias_name as district_alias,
                s.name as state_name, s.alias_name as state_alias,
                co.name as country_name, co.alias_name as country_alias
         FROM customer_locations cl
         LEFT JOIN districts d ON cl.district_id = d.id
         LEFT JOIN states s ON cl.state_id = s.id
         LEFT JOIN countries co ON cl.country_id = co.id
         WHERE cl.customer_id = ?
         ORDER BY cl.is_primary DESC, cl.created_at ASC`,
        [customer_id]
    );
    return rows as any[];
};

export const getPrimaryCustomerLocation = async (customer_id: number, connection?: PoolConnection) => {
    // Read operations don't need transaction connection
    const query = `SELECT cl.*, 
                d.name as district_name, d.alias_name as district_alias,
                s.name as state_name, s.alias_name as state_alias,
                co.name as country_name, co.alias_name as country_alias
         FROM customer_locations cl
         LEFT JOIN districts d ON cl.district_id = d.id
         LEFT JOIN states s ON cl.state_id = s.id
         LEFT JOIN countries co ON cl.country_id = co.id
         WHERE cl.customer_id = ?`;
    
    const [rows] = await db.execute(query, [customer_id]);
    return (rows as any[])[0];
};

export const updateCustomerLocation = async (
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
    
    // If this is being set as primary, remove primary from other locations
    if (updateData.is_primary) {
        const [locationRows] = await conn.execute(
            'SELECT customer_id FROM customer_locations WHERE id = ?',
            [id]
        );
        const customer_id = (locationRows as any[])[0]?.customer_id;
        
        if (customer_id) {
            await conn.execute(
                `UPDATE customer_locations SET is_primary = false WHERE customer_id = ? AND id != ?`,
                [customer_id, id]
            );
        }
    }
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    values.push(updated_by, id);
    
    const [result] = await conn.execute(
        `UPDATE customer_locations SET ${setClause}, updated_by = ? WHERE id = ?`,
        values
    );
    return (result as any).affectedRows > 0;
};

export const deleteCustomerLocation = async (id: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        'DELETE FROM customer_locations WHERE id = ?',
        [id]
    );
    return (result as any).affectedRows > 0;
};

export const getCustomerById = async (id: number, connection?: PoolConnection) => {
    try {
        // Validate the ID parameter
        if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
            throw new Error(`Invalid customer ID: ${id} (type: ${typeof id})`);
        }
        
        console.log('DEBUG getCustomerById - ID:', id, 'Has connection:', !!connection);
        
        const query = 'SELECT c.id, c.customer_code, c.first_name, c.last_name, c.mobile, c.email, c.customer_type, c.status, c.created_at, c.updated_at FROM customers c WHERE c.id = ?';
        
        // Always use db pool for read operations - transactions only needed for writes
        const [rows] = await db.execute(query, [id]);
        
        const customer = (rows as any[])[0];
        
        if (!customer) {
            console.log('Customer not found with id:', id);
            return null;
        }
        
        // Get additional customer details - also use db pool for read
        try {
            customer.locations = await getCustomerLocations(id);
        } catch (locationError: any) {
            console.warn('Warning getting customer locations:', locationError.message);
            customer.locations = [];
        }
        
        return customer;
    } catch (error: any) {
        console.error('ERROR in getCustomerById:', {
            message: error.message,
            code: error.code,
            id,
            idType: typeof id
        });
        throw error;
    }
};

export const getCustomerByCode = async (customer_code: string, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        'SELECT * FROM customers WHERE customer_code = ?',
        [customer_code]
    );
    return (rows as any[])[0];
};

export const getCustomerByMobile = async (mobile: string, connection?: PoolConnection) => {
    // Read operations don't need transaction connection
    const [rows] = await db.execute(
        'SELECT * FROM customers WHERE mobile = ?',
        [mobile]
    );
    return (rows as any[])[0];
};

export const getCustomerByEmail = async (email: string, connection?: PoolConnection) => {
    // Read operations don't need transaction connection
    const [rows] = await db.execute(
        'SELECT * FROM customers WHERE email = ?',
        [email]
    );
    return (rows as any[])[0];
};

export const getAllCustomers = async (onlyActive: boolean = true, connection?: PoolConnection) => {
    const conn = connection || db;
    let query = `
        SELECT c.*, 
               cb.first_name as created_by_name
        FROM customers c
        LEFT JOIN employees cb ON c.created_by = cb.id
    `;
    
    if (onlyActive) {
        query += ` WHERE c.status = 'Active'`;
    }
    
    query += ` ORDER BY c.created_at DESC`;
    
    const [rows] = await conn.execute(query);
    return rows as any[];
};

// Get customers filtered by employee's job assignments (for role-based access)
export const getCustomersByEmployeeAssignments = async (employeeId: number, onlyActive: boolean = true, connection?: PoolConnection) => {
    const conn = connection || db;
    let query = `
        SELECT DISTINCT c.*, 
               cb.first_name as created_by_name,
               GROUP_CONCAT(DISTINCT j.job_code SEPARATOR ', ') as assigned_jobs
        FROM customers c
        LEFT JOIN employees cb ON c.created_by = cb.id
        INNER JOIN jobs j ON j.customer_id = c.id
        INNER JOIN job_assignments ja ON ja.job_id = j.id
        WHERE ja.employee_id = ? 
        AND ja.assignment_status = 'Active'
    `;
    
    if (onlyActive) {
        query += ` AND c.status = 'Active'`;
    }
    
    query += ` GROUP BY c.id ORDER BY c.created_at DESC`;
    
    const [rows] = await conn.execute(query, [employeeId]);
    return rows as any[];
};

// Check if employee has access to a specific customer through job assignments
export const hasCustomerAccess = async (employeeId: number, customerId: number, connection?: PoolConnection): Promise<boolean> => {
    const conn = connection || db;
    const query = `
        SELECT COUNT(*) as count 
        FROM customers c
        INNER JOIN jobs j ON j.customer_id = c.id
        INNER JOIN job_assignments ja ON ja.job_id = j.id
        WHERE ja.employee_id = ? 
        AND c.id = ?
        AND ja.assignment_status = 'Active'
    `;
    
    const [rows] = await conn.execute(query, [employeeId, customerId]);
    return (rows as any[])[0].count > 0;
};

// Search customers with role-based filtering for employees
export const searchCustomersForEmployee = async (employeeId: number, searchTerm: string, filters: any = {}, connection?: PoolConnection) => {
    const conn = connection || db;
    
    let query = `
        SELECT DISTINCT c.*, 
               cb.first_name as created_by_name,
               s.name as state_name, 
               d.name as district_name,
               GROUP_CONCAT(DISTINCT j.job_code SEPARATOR ', ') as assigned_jobs
        FROM customers c
        LEFT JOIN employees cb ON c.created_by = cb.id
        LEFT JOIN customer_locations cl ON c.id = cl.customer_id AND cl.is_primary = 1
        LEFT JOIN states s ON cl.state_id = s.id
        LEFT JOIN districts d ON cl.district_id = d.id
        INNER JOIN jobs j ON j.customer_id = c.id
        INNER JOIN job_assignments ja ON ja.job_id = j.id
        WHERE ja.employee_id = ? 
        AND ja.assignment_status = 'Active'
        AND (
            c.first_name LIKE ? OR 
            c.last_name LIKE ? OR 
            c.full_name LIKE ? OR 
            c.mobile LIKE ? OR 
            c.email LIKE ? OR 
            c.customer_code LIKE ? OR 
            c.company_name LIKE ?
        )
    `;

    const searchPattern = `%${searchTerm}%`;
    let queryParams = [employeeId, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern];

    // Apply filters
    if (filters.status) {
        query += ` AND c.status = ?`;
        queryParams.push(filters.status);
    }

    if (filters.customer_type) {
        query += ` AND c.customer_type = ?`;
        queryParams.push(filters.customer_type);
    }

    if (filters.state_id) {
        query += ` AND s.id = ?`;
        queryParams.push(filters.state_id);
    }

    if (filters.district_id) {
        query += ` AND d.id = ?`;
        queryParams.push(filters.district_id);
    }

    query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

    const [rows] = await conn.execute(query, queryParams);
    return rows as any[];
};

// Get customers by location with role-based filtering for employees
// Get customer location by ID with customer information
export const getCustomerLocationById = async (locationId: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const query = `
        SELECT cl.*, c.id as customer_id 
        FROM customer_locations cl 
        INNER JOIN customers c ON cl.customer_id = c.id 
        WHERE cl.id = ?
    `;
    const [rows] = await conn.execute(query, [locationId]);
    return (rows as any[]).length ? (rows as any[])[0] : null;
};

export const getCustomersByLocationForEmployee = async (employeeId: number, stateId?: number, districtId?: number, connection?: PoolConnection) => {
    const conn = connection || db;
    
    let query = `
        SELECT DISTINCT c.*, 
               cb.first_name as created_by_name,
               s.name as state_name, 
               d.name as district_name,
               GROUP_CONCAT(DISTINCT j.job_code SEPARATOR ', ') as assigned_jobs
        FROM customers c
        LEFT JOIN employees cb ON c.created_by = cb.id
        LEFT JOIN customer_locations cl ON c.id = cl.customer_id AND cl.is_primary = 1
        LEFT JOIN states s ON cl.state_id = s.id
        LEFT JOIN districts d ON cl.district_id = d.id
        INNER JOIN jobs j ON j.customer_id = c.id
        INNER JOIN job_assignments ja ON ja.job_id = j.id
        WHERE ja.employee_id = ? 
        AND ja.assignment_status = 'Active'
    `;

    let queryParams = [employeeId];

    if (stateId) {
        query += ` AND s.id = ?`;
        queryParams.push(stateId);
    }

    if (districtId) {
        query += ` AND d.id = ?`;
        queryParams.push(districtId);
    }

    query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

    const [rows] = await conn.execute(query, queryParams);
    return rows as any[];
};

export const updateCustomer = async (
    id: number,
    updateData: any,
    updated_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    
    // Date fields that need special handling
    const dateFields = ['date_of_birth'];
    
    // Filter and clean the data
    const cleanedData: any = {};
    Object.keys(updateData).forEach(key => {
        const value = updateData[key];
        
        // Skip undefined values - don't update them
        if (value === undefined) {
            return;
        }
        
        // Handle empty strings for date fields - convert to NULL
        if (dateFields.includes(key) && (value === '' || value === null)) {
            cleanedData[key] = null;
            return;
        }
        
        // Handle empty strings for other fields - convert to NULL
        if (value === '') {
            cleanedData[key] = null;
            return;
        }
        
        // Keep the value as-is
        cleanedData[key] = value;
    });
    
    const fields = Object.keys(cleanedData);
    if (fields.length === 0) return false;
    
    const values = Object.values(cleanedData);
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    values.push(updated_by, id);
    
    try {
        const [result] = await conn.execute(
            `UPDATE customers SET ${setClause}, updated_by = ? WHERE id = ?`,
            values
        );
        return (result as any).affectedRows > 0;
    } catch (error: any) {
        console.error('Error in updateCustomer query:', {
            id,
            cleanedData,
            error: error.message
        });
        throw error;
    }
};

export const deactivateCustomer = async (id: number, updated_by: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        'UPDATE customers SET status = ?, updated_by = ? WHERE id = ?',
        ['Inactive', updated_by, id]
    );
    return (result as any).affectedRows > 0;
};

export const activateCustomer = async (id: number, updated_by: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        'UPDATE customers SET status = ?, updated_by = ? WHERE id = ?',
        ['Active', updated_by, id]
    );
    return (result as any).affectedRows > 0;
};

export const blacklistCustomer = async (id: number, updated_by: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        'UPDATE customers SET status = ?, updated_by = ? WHERE id = ?',
        ['Blacklisted', updated_by, id]
    );
    return (result as any).affectedRows > 0;
};

export const searchCustomers = async (searchTerm: string, filters: any = {}, connection?: PoolConnection) => {
    const conn = connection || db;
    let query = `
        SELECT c.*, 
               cb.first_name as created_by_name
        FROM customers c
        LEFT JOIN employees cb ON c.created_by = cb.id
        WHERE (
            c.customer_code LIKE ? OR 
            c.full_name LIKE ? OR 
            c.mobile LIKE ? OR
            c.email LIKE ? OR
            c.company_name LIKE ?
        )
    `;
    
    const params = [
        `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, 
        `%${searchTerm}%`, `%${searchTerm}%`
    ];
    
    if (filters.status) {
        query += ` AND c.status = ?`;
        params.push(filters.status);
    }
    
    if (filters.customer_type) {
        query += ` AND c.customer_type = ?`;
        params.push(filters.customer_type);
    }
    
    // For location-based filters, we need to join with customer_locations
    if (filters.state_id || filters.district_id) {
        query = `
            SELECT DISTINCT c.*, 
                   cb.first_name as created_by_name
            FROM customers c
            LEFT JOIN employees cb ON c.created_by = cb.id
            INNER JOIN customer_locations cl ON c.id = cl.customer_id
            WHERE (
                c.customer_code LIKE ? OR 
                c.full_name LIKE ? OR 
                c.mobile LIKE ? OR
                c.email LIKE ? OR
                c.company_name LIKE ?
            )
        `;
        
        if (filters.status) {
            query += ` AND c.status = ?`;
        }
        
        if (filters.customer_type) {
            query += ` AND c.customer_type = ?`;
        }
        
        if (filters.state_id) {
            query += ` AND cl.state_id = ?`;
            params.push(filters.state_id);
        }
        
        if (filters.district_id) {
            query += ` AND cl.district_id = ?`;
            params.push(filters.district_id);
        }
    }
    
    query += ` ORDER BY c.created_at DESC`;
    
    const [rows] = await conn.execute(query, params);
    return rows as any[];
};

export const getCustomersByLocation = async (state_id?: number, district_id?: number, connection?: PoolConnection) => {
    const conn = connection || db;
    let query = `
        SELECT DISTINCT c.*, 
               d.name as district_name, s.name as state_name, co.name as country_name
        FROM customers c
        INNER JOIN customer_locations cl ON c.id = cl.customer_id
        LEFT JOIN districts d ON cl.district_id = d.id
        LEFT JOIN states s ON cl.state_id = s.id
        LEFT JOIN countries co ON cl.country_id = co.id
        WHERE c.status = 'Active'
    `;
    
    const params: any[] = [];
    
    if (state_id) {
        query += ` AND cl.state_id = ?`;
        params.push(state_id);
    }
    
    if (district_id) {
        query += ` AND cl.district_id = ?`;
        params.push(district_id);
    }
    
    query += ` ORDER BY c.full_name ASC`;
    
    const [rows] = await conn.execute(query, params);
    return rows as any[];
};

// Generate unique customer code
export const generateCustomerCode = async (connection?: PoolConnection) => {
    // Read operation doesn't need transaction connection
    const currentDate = new Date();
    const year = currentDate.getFullYear().toString().slice(-2);
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    
    // Get the count of customers created this month
    const [countRows] = await db.execute(
        `SELECT COUNT(*) as count FROM customers 
         WHERE DATE_FORMAT(created_at, '%Y-%m') = ?`,
        [`${currentDate.getFullYear()}-${month}`]
    );
    
    const count = (countRows as any[])[0].count + 1;
    const sequence = count.toString().padStart(4, '0');
    
    return `CUST${year}${month}${sequence}`;
};

// Customer Services Operations
export const createOrFindCustomer = async (
    customerData: {
        first_name: string;
        last_name?: string;
        mobile: string;
        email?: string;
        alternate_mobile?: string;
        customer_type?: string;
        company_name?: string;
        lead_source?: string;
    },
    created_by: number,
    connection?: PoolConnection
) => {
    // First try to find existing customer by mobile
    let existingCustomer = await getCustomerByMobile(customerData.mobile, connection);
    
    // If not found by mobile, try by email if provided
    if (!existingCustomer && customerData.email) {
        existingCustomer = await getCustomerByEmail(customerData.email, connection);
    }
    
    if (existingCustomer) {
        // Update existing customer with any new information if needed
        const updateData: any = {};
        
        if (!existingCustomer.email && customerData.email) {
            updateData.email = customerData.email;
        }
        if (!existingCustomer.alternate_mobile && customerData.alternate_mobile) {
            updateData.alternate_mobile = customerData.alternate_mobile;
        }
        if (!existingCustomer.company_name && customerData.company_name) {
            updateData.company_name = customerData.company_name;
        }
        
        // Update if we have new data
        if (Object.keys(updateData).length > 0) {
            await updateCustomer(existingCustomer.id, updateData, created_by, connection);
            // Fetch updated customer
            return await getCustomerById(existingCustomer.id, connection);
        }
        
        return existingCustomer;
    }
    
    // Create new customer if not found
    const customerCode = await generateCustomerCode(connection);
    const newCustomerData = {
        customer_code: customerCode,
        first_name: customerData.first_name,
        last_name: customerData.last_name,
        mobile: customerData.mobile,
        email: customerData.email,
        alternate_mobile: customerData.alternate_mobile,
        customer_type: customerData.customer_type || 'Individual',
        company_name: customerData.company_name,
        lead_source: customerData.lead_source || 'Direct',
        status: 'Active'
    };
    
    // createCustomer now returns the full customer object
    const createdCustomer = await createCustomer(newCustomerData, created_by, connection);
    return createdCustomer;
};

export const createCustomerService = async (
    serviceData: {
        customer_id: number;
        service_type: string;
        service_status?: string;
        solar_service?: string;
        estimated_capacity?: string;
        estimated_cost?: number;
        service_description?: string;
        lead_id?: number;
        job_id?: number;
        estimation_id?: number;
        package_id?: number;
        priority?: string;
        source?: string;
        notes?: string;
    },
    created_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        `INSERT INTO customer_services (
            customer_id, service_type, service_status, solar_service, estimated_capacity,
            estimated_cost, service_description, lead_id, job_id, estimation_id,
            package_id, priority, source, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            serviceData.customer_id,
            serviceData.service_type,
            serviceData.service_status || 'Inquiry',
            serviceData.solar_service || null,
            serviceData.estimated_capacity || null,
            serviceData.estimated_cost || null,
            serviceData.service_description || null,
            serviceData.lead_id || null,
            serviceData.job_id || null,
            serviceData.estimation_id || null,
            serviceData.package_id || null,
            serviceData.priority || 'Medium',
            serviceData.source || null,
            serviceData.notes || null,
            created_by
        ]
    );
    return (result as any).insertId;
};

export const getCustomerServices = async (customer_id: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT cs.*, 
                cb.first_name as created_by_name, 
                ub.first_name as updated_by_name,
                p.name as package_name,
                l.lead_code,
                j.job_code,
                e.id as estimation_id
         FROM customer_services cs
         LEFT JOIN employees cb ON cs.created_by = cb.id
         LEFT JOIN employees ub ON cs.updated_by = ub.id
         LEFT JOIN packages p ON cs.package_id = p.id
         LEFT JOIN leads l ON cs.lead_id = l.id
         LEFT JOIN jobs j ON cs.job_id = j.id
         LEFT JOIN estimations e ON cs.estimation_id = e.id
         WHERE cs.customer_id = ? AND cs.status = 'Active'
         ORDER BY cs.inquiry_date DESC`,
        [customer_id]
    );
    return rows as any[];
};

export const updateCustomerServiceStatus = async (
    customer_id: number,
    job_id: number,
    service_status: string,
    completion_date?: string,
    actual_cost?: number,
    updated_by?: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    
    const updateData: any[] = [service_status];
    let query = `UPDATE customer_services SET service_status = ?`;
    
    if (completion_date) {
        query += `, completion_date = ?`;
        updateData.push(completion_date);
    }
    
    if (actual_cost) {
        query += `, actual_cost = ?`;
        updateData.push(actual_cost);
    }
    
    if (updated_by) {
        query += `, updated_by = ?`;
        updateData.push(updated_by);
    }
    
    query += ` WHERE customer_id = ? AND job_id = ?`;
    updateData.push(customer_id, job_id);
    
    const [result] = await conn.execute(query, updateData);
    return (result as any).affectedRows > 0;
};

export const getCustomerWithServices = async (customer_id: number, connection?: PoolConnection) => {
    const conn = connection || db;
    
    // Get customer details
    const customer = await getCustomerById(customer_id, connection);
    if (!customer) return null;
    
    // Get all services for this customer
    customer.services = await getCustomerServices(customer_id, connection);
    
    return customer;
};

export const findCustomerByMobileWithServices = async (mobile: string, service_type?: string, connection?: PoolConnection) => {
    // Read operations don't need transaction connection
    
    // Get customer by mobile
    const customer = await getCustomerByMobile(mobile);
    if (!customer) return null;
    
    // Get services for this customer
    let servicesQuery = `
        SELECT cs.*, 
               p.name as package_name,
               j.job_code,
               j.status as job_status,
               e.id as estimation_id
        FROM customer_services cs
        LEFT JOIN packages p ON cs.package_id = p.id
        LEFT JOIN jobs j ON cs.job_id = j.id
        LEFT JOIN estimations e ON cs.estimation_id = e.id
        WHERE cs.customer_id = ? AND cs.status = 'Active'
    `;
    
    const queryParams = [customer.id];
    
    if (service_type) {
        servicesQuery += ` AND cs.service_type = ?`;
        queryParams.push(service_type);
    }
    
    servicesQuery += ` ORDER BY cs.inquiry_date DESC`;
    
    const [services] = await db.execute(servicesQuery, queryParams);
    
    return {
        customer,
        services: services as any[],
        is_returning_customer: (services as any[]).length > 0,
        total_services: (services as any[]).length
    };
};

export default {
    createCustomer,
    createCustomerLocation,
    getCustomerLocations,
    getPrimaryCustomerLocation,
    updateCustomerLocation,
    deleteCustomerLocation,
    getCustomerById,
    getCustomerByCode,
    getCustomerByMobile,
    getCustomerByEmail,
    getAllCustomers,
    getCustomersByEmployeeAssignments,
    hasCustomerAccess,
    updateCustomer,
    deactivateCustomer,
    activateCustomer,
    blacklistCustomer,
    searchCustomers,
    searchCustomersForEmployee,
    getCustomersByLocation,
    getCustomersByLocationForEmployee,
    getCustomerLocationById,
    generateCustomerCode,
    // Customer Services functions
    createOrFindCustomer,
    createCustomerService,
    getCustomerServices,
    updateCustomerServiceStatus,
    getCustomerWithServices,
    findCustomerByMobileWithServices
};
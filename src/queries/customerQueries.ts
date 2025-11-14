import { PoolConnection } from 'mysql2/promise';
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
    const [result] = await conn.execute(
        `INSERT INTO customers (
            customer_code, first_name, last_name, full_name, mobile, email,
            alternate_mobile, date_of_birth, gender, customer_type, company_name,
            gst_number, pan_number, lead_source, notes, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            customerData.customer_code,
            customerData.first_name,
            customerData.last_name || null,
            customerData.full_name || null,
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
    return (result as any).insertId;
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
    return (result as any).insertId;
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
         WHERE cl.customer_id = ? AND cl.is_primary = true`,
        [customer_id]
    );
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
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT c.*, 
                cb.first_name as created_by_name, ub.first_name as updated_by_name
         FROM customers c
         LEFT JOIN employees cb ON c.created_by = cb.id
         LEFT JOIN employees ub ON c.updated_by = ub.id
         WHERE c.id = ?`,
        [id]
    );
    
    const customer = (rows as any[])[0];
    if (customer) {
        // Get customer locations
        customer.locations = await getCustomerLocations(id, connection);
    }
    
    return customer;
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
    const conn = connection || db;
    const [rows] = await conn.execute(
        'SELECT * FROM customers WHERE mobile = ?',
        [mobile]
    );
    return (rows as any[])[0];
};

export const getCustomerByEmail = async (email: string, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
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

export const updateCustomer = async (
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
        `UPDATE customers SET ${setClause}, updated_by = ? WHERE id = ?`,
        values
    );
    return (result as any).affectedRows > 0;
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
    const conn = connection || db;
    const currentDate = new Date();
    const year = currentDate.getFullYear().toString().slice(-2);
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    
    // Get the count of customers created this month
    const [countRows] = await conn.execute(
        `SELECT COUNT(*) as count FROM customers 
         WHERE DATE_FORMAT(created_at, '%Y-%m') = ?`,
        [`${currentDate.getFullYear()}-${month}`]
    );
    
    const count = (countRows as any[])[0].count + 1;
    const sequence = count.toString().padStart(4, '0');
    
    return `CUST${year}${month}${sequence}`;
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
    updateCustomer,
    deactivateCustomer,
    activateCustomer,
    blacklistCustomer,
    searchCustomers,
    getCustomersByLocation,
    generateCustomerCode
};

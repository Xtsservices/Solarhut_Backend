import { Request, Response } from 'express';
import { db } from '../db';
import { PoolConnection } from 'mysql2/promise';

// Get all tasks (leads + jobs) for the current employee - counts only
export const getMyTasks = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const employeeId = user.id;

        // Get counts only for better performance
        const [leadsCounts, jobsCounts] = await Promise.all([
            getMyLeadsCounts(employeeId),
            getMyJobsCounts(employeeId)
        ]);

        // Ensure all values default to 0 if null/undefined
        const safeLeadsCounts = {
            assigned: leadsCounts?.assigned || 0,
            ongoing: leadsCounts?.ongoing || 0,
            closed: leadsCounts?.closed || 0,
            total: leadsCounts?.total || 0
        };

        const safeJobsCounts = {
            assigned: jobsCounts?.assigned || 0,
            ongoing: jobsCounts?.ongoing || 0,
            closed: jobsCounts?.closed || 0,
            total: jobsCounts?.total || 0
        };

        // Structure response with counts
        const tasksSummary = {
            leads: {
                assigned: safeLeadsCounts.assigned,
                ongoing: safeLeadsCounts.ongoing,
                closed: safeLeadsCounts.closed,
                total: safeLeadsCounts.total
            },
            jobs: {
                assigned: safeJobsCounts.assigned,
                ongoing: safeJobsCounts.ongoing,
                closed: safeJobsCounts.closed,
                total: safeJobsCounts.total
            }
        };

        res.json({
            success: true,
            message: 'My tasks counts retrieved successfully',
            data: {
                employee_id: employeeId,
                employee_name: user.first_name + ' ' + (user.last_name || ''),
                summary: tasksSummary
            }
        });

    } catch (err) {
        console.error('Error fetching my tasks:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching my tasks',
            error: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};

// Get all leads for current employee with pagination and filters
export const getMyAllLeads = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Extract pagination parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        // Extract filter parameters
        const {
            status,
            service_type,
            solar_service,
            property_type,
            channel,
            search,
            start_date,
            end_date
        } = req.query;

        // Build WHERE conditions - removed assigned status restriction
        let whereConditions = ['l.assigned_to = ?', "l.status != 'Rejected'"];
        let queryParams: any[] = [user.id];

        // Add filters
        if (status && status !== 'all') {
            whereConditions.push('l.status = ?');
            queryParams.push(status);
        }

        if (service_type && service_type !== 'all') {
            whereConditions.push('l.service_type = ?');
            queryParams.push(service_type);
        }

        if (solar_service && solar_service !== 'all') {
            whereConditions.push('l.solar_service = ?');
            queryParams.push(solar_service);
        }

        if (property_type && property_type !== 'all') {
            whereConditions.push('l.property_type = ?');
            queryParams.push(property_type);
        }

        if (channel && channel !== 'all') {
            whereConditions.push('l.channel = ?');
            queryParams.push(channel);
        }

        if (search) {
            whereConditions.push('(l.first_name LIKE ? OR l.last_name LIKE ? OR l.mobile LIKE ? OR l.email LIKE ?)');
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        if (start_date) {
            whereConditions.push('l.created_at >= ?');
            queryParams.push(start_date);
        }

        if (end_date) {
            whereConditions.push('l.created_at <= ?');
            queryParams.push(end_date);
        }

        const whereClause = whereConditions.join(' AND ');

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total
            FROM leads l
            WHERE ${whereClause}
        `;

        const [countResult] = await db.execute(countQuery, queryParams);
        const total = (countResult as any)[0]?.total || 0;

        // Get paginated data - use string interpolation for LIMIT/OFFSET to avoid parameter issues
        const validLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
        const validOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
        
        const dataQuery = `
            SELECT l.*
            FROM leads l
            WHERE ${whereClause}
            ORDER BY l.created_at DESC
            LIMIT ${validLimit} OFFSET ${validOffset}
        `;

        const [rows] = await db.execute(dataQuery, queryParams);

        // Calculate pagination info
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.json({
            success: true,
            message: 'My leads retrieved successfully',
            data: {
                leads: rows,
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_records: total,
                    records_per_page: limit,
                    has_next: hasNext,
                    has_previous: hasPrev
                },
                filters_applied: {
                    status: status || 'all',
                    service_type: service_type || 'all',
                    solar_service: solar_service || 'all',
                    property_type: property_type || 'all',
                    channel: channel || 'all',
                    search: search || null,
                    start_date: start_date || null,
                    end_date: end_date || null
                }
            }
        });

    } catch (err) {
        console.error('Error fetching leads:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching leads',
            error: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};



// Get all jobs for current employee with pagination and filters
export const getMyAllJobs = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Extract pagination parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        // Extract filter parameters
        const {
            status,
            customer_type,
            search,
            start_date,
            end_date,
            role_type,
            assignment_status
        } = req.query;

        // Build WHERE conditions
        let whereConditions = ['ja.employee_id = ?'];
        let queryParams: any[] = [user.id];

        // Add filters
        if (status && status !== 'all') {
            whereConditions.push('j.status = ?');
            queryParams.push(status);
        }

        if (customer_type && customer_type !== 'all') {
            whereConditions.push('c.customer_type = ?');
            queryParams.push(customer_type);
        }

        if (role_type && role_type !== 'all') {
            whereConditions.push('ja.role_type = ?');
            queryParams.push(role_type);
        }

        if (assignment_status && assignment_status !== 'all') {
            whereConditions.push('ja.assignment_status = ?');
            queryParams.push(assignment_status);
        }

        if (search) {
            whereConditions.push('(c.full_name LIKE ? OR c.customer_code LIKE ? OR c.mobile LIKE ? OR c.email LIKE ? OR j.job_code LIKE ?)');
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }

        if (start_date) {
            whereConditions.push('j.created_at >= ?');
            queryParams.push(start_date);
        }

        if (end_date) {
            whereConditions.push('j.created_at <= ?');
            queryParams.push(end_date);
        }

        const whereClause = whereConditions.join(' AND ');

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as total
            FROM jobs j
            INNER JOIN job_assignments ja ON j.id = ja.job_id
            LEFT JOIN customers c ON j.customer_id = c.id
            WHERE ${whereClause}
        `;

        const [countResult] = await db.execute(countQuery, queryParams);
        const total = (countResult as any)[0]?.total || 0;

        // Get paginated data
        const validLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
        const validOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
        
        const dataQuery = `
            SELECT j.*, 
                   ja.role_type, ja.assignment_status, ja.start_date, ja.end_date,
                   c.customer_code, c.full_name as customer_name, c.mobile as customer_mobile,
                   c.email as customer_email, c.customer_type, c.company_name,
                   cl.address_line_1, cl.city, cl.pincode,
                   d.name as district_name, s.name as state_name, co.name as country_name,
                   p.name as package_name, p.capacity as package_capacity, p.price as package_price
            FROM jobs j
            INNER JOIN job_assignments ja ON j.id = ja.job_id
            LEFT JOIN customers c ON j.customer_id = c.id
            LEFT JOIN customer_locations cl ON j.location_id = cl.id
            LEFT JOIN districts d ON cl.district_id = d.id
            LEFT JOIN states s ON cl.state_id = s.id
            LEFT JOIN countries co ON cl.country_id = co.id
            LEFT JOIN packages p ON j.package_id = p.id
            WHERE ${whereClause}
            ORDER BY j.created_at DESC
            LIMIT ${validLimit} OFFSET ${validOffset}
        `;

        const [rows] = await db.execute(dataQuery, queryParams);

        // Calculate pagination info
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.json({
            success: true,
            message: 'My jobs retrieved successfully',
            data: {
                jobs: rows,
                pagination: {
                    current_page: page,
                    total_pages: totalPages,
                    total_records: total,
                    records_per_page: limit,
                    has_next: hasNext,
                    has_previous: hasPrev
                },
               
            }
        });

    } catch (err) {
        console.error('Error fetching jobs:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching jobs',
            error: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};




// Helper function to get leads for a specific employee
const getMyLeads = async (employeeId: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT l.*
         FROM leads l
         WHERE l.assigned_to = ? AND l.status != 'Rejected'
         ORDER BY l.created_at DESC`,
        [employeeId]
    );
    return rows as any[];
};

// Helper function to get jobs for a specific employee
const getMyJobs = async (employeeId: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT j.*, 
                ja.role_type, ja.assignment_status, ja.start_date, ja.end_date,
                c.customer_code, c.full_name as customer_name, c.mobile as customer_mobile,
                c.email as customer_email, c.customer_type, c.company_name,
                cl.address_line_1, cl.city, cl.pincode,
                d.name as district_name, s.name as state_name, co.name as country_name,
                p.name as package_name, p.capacity as package_capacity, p.price as package_price
         FROM jobs j
         INNER JOIN job_assignments ja ON j.id = ja.job_id
         LEFT JOIN customers c ON j.customer_id = c.id
         LEFT JOIN customer_locations cl ON j.location_id = cl.id
         LEFT JOIN districts d ON cl.district_id = d.id
         LEFT JOIN states s ON cl.state_id = s.id
         LEFT JOIN countries co ON cl.country_id = co.id
         LEFT JOIN packages p ON j.package_id = p.id
         WHERE ja.employee_id = ?
         ORDER BY j.created_at DESC`,
        [employeeId]
    );
    return rows as any[];
};

// Helper function to get leads counts for a specific employee
const getMyLeadsCounts = async (employeeId: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN l.status IN ('New', 'Assigned') THEN 1 ELSE 0 END) as assigned,
            SUM(CASE WHEN l.status IN ('In Progress', 'Follow Up') THEN 1 ELSE 0 END) as ongoing,
            SUM(CASE WHEN l.status IN ('Converted', 'Closed', 'Lost') THEN 1 ELSE 0 END) as closed
         FROM leads l
         WHERE l.assigned_to = ? AND l.status != 'Rejected'`,
        [employeeId]
    );
    
    const result = (rows as any[])[0];
    return {
        total: result?.total || 0,
        assigned: result?.assigned || 0,
        ongoing: result?.ongoing || 0,
        closed: result?.closed || 0
    };
};

// Helper function to get jobs counts for a specific employee
const getMyJobsCounts = async (employeeId: number, connection?: PoolConnection) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN j.status = 'Assigned' THEN 1 ELSE 0 END) as assigned,
            SUM(CASE WHEN j.status IN ('In Progress', 'On Hold') THEN 1 ELSE 0 END) as ongoing,
            SUM(CASE WHEN j.status IN ('Completed', 'Cancelled') THEN 1 ELSE 0 END) as closed
         FROM jobs j
         INNER JOIN job_assignments ja ON j.id = ja.job_id
         WHERE ja.employee_id = ?`,
        [employeeId]
    );
    
    const result = (rows as any[])[0];
    return {
        total: result?.total || 0,
        assigned: result?.assigned || 0,
        ongoing: result?.ongoing || 0,
        closed: result?.closed || 0
    };
};

export default {
    getMyTasks,
    getMyAllLeads,
   
    getMyAllJobs,
   
};

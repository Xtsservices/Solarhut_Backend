import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export type ResidentialPropertyType = 'Independent House' | 'Apartment' | 'Villa' | 'Farmhouse' | 'Others';
export type CommercialPropertyType = 'Office Building' | 'Shop/Showroom' | 'Shopping Mall' | 'Hotel/Resort' | 'Hospital' | 'School/College' | 'Others';
export type IndustrialPropertyType = 'Factory' | 'Warehouse' | 'Manufacturing Unit' | 'Processing Plant' | 'Others';

export interface Lead extends RowDataPacket {
    id: number;
    first_name: string;
    last_name: string;
    mobile: string;
    email?: string;
    service_type: 'Installation' | 'Maintenance';
    solar_service: 'Residential Solar' | 'Commercial Solar' | 'Industrial Solar';
    status: 'New' | 'Assigned' | 'In Progress' | 'Closed' | 'Rejected' | 'Complete' | 'Cancelled';
    capacity: string;
    message: string;
    location: string;
    property_type: ResidentialPropertyType | CommercialPropertyType | IndustrialPropertyType;
    assigned_to?: number | null;
    assigned_to_name?: string | null;
    assigned_to_email?: string | null;
    assigned_to_mobile?: string | null;
    channel: string;
    created_at: Date;
    updated_at: Date;
}

export const createLead = async (leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'channel'>) => {
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO leads 
        (first_name, last_name, mobile, email, service_type, solar_service, capacity, message, location, property_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            leadData.first_name,
            leadData.last_name,
            leadData.mobile,
            leadData.email || null,
            leadData.service_type,
            leadData.solar_service,
            leadData.capacity,
            leadData.message,
            leadData.location,
            leadData.property_type
        ]
    );

    // Log insert result for debugging (will show insertId and affectedRows)
    try {
        // result may be typed as ResultSetHeader
        // eslint-disable-next-line no-console
        console.log('createLead result:', {
            insertId: (result as any).insertId,
            affectedRows: (result as any).affectedRows
        });
    } catch (e) {
        // ignore logging errors
    }

    return (result as any).insertId;
};

export const getLeadById = async (id: number) => {
    const [leads] = await db.execute<Lead[]>(
        `SELECT l.*, 
                CONCAT(e.first_name, ' ', e.last_name) as assigned_to_name,
                e.email as assigned_to_email,
                e.mobile as assigned_to_mobile
         FROM leads l
         LEFT JOIN employees e ON l.assigned_to = e.id
         WHERE l.id = ?`,
        [id]
    );
    return leads[0];
};

export const updateLeadStatus = async (id: number, status: Lead['status']) => {
    const [result] = await db.execute(
        'UPDATE leads SET status = ? WHERE id = ?',
        [status, id]
    );
    return (result as any).affectedRows > 0;
};

export const assignLeadToEmployee = async (id: number, employeeId: number) => {
    const [result] = await db.execute(
        'UPDATE leads SET assigned_to = ?, status = ? WHERE id = ?',
        [employeeId, 'Assigned', id]
    );
    return (result as any).affectedRows > 0;
};

export const getAllLeads = async () => {
    const [leads] = await db.execute<Lead[]>(
        `SELECT l.*, 
                CONCAT(e.first_name, ' ', e.last_name) as assigned_to_name,
                e.email as assigned_to_email,
                e.mobile as assigned_to_mobile
         FROM leads l
         LEFT JOIN employees e ON l.assigned_to = e.id
         ORDER BY l.created_at DESC`
    );
    return leads;
};

export const getLeadsByDateRange = async (startDate: Date, endDate: Date) => {
    const [leads] = await db.execute<Lead[]>(
        `SELECT l.*, 
                CONCAT(e.first_name, ' ', e.last_name) as assigned_to_name,
                e.email as assigned_to_email,
                e.mobile as assigned_to_mobile
         FROM leads l
         LEFT JOIN employees e ON l.assigned_to = e.id
         WHERE l.created_at BETWEEN ? AND ? 
         ORDER BY l.created_at DESC`,
        [startDate, endDate]
    );
    return leads;
};

export const getLeadsByServiceType = async (serviceType: Lead['service_type']) => {
    const [leads] = await db.execute<Lead[]>(
        `SELECT l.*, 
                CONCAT(e.first_name, ' ', e.last_name) as assigned_to_name,
                e.email as assigned_to_email,
                e.mobile as assigned_to_mobile
         FROM leads l
         LEFT JOIN employees e ON l.assigned_to = e.id
         WHERE l.service_type = ? 
         ORDER BY l.created_at DESC`,
        [serviceType]
    );
    return leads;
};

export const getLeadsByPropertyType = async (propertyType: Lead['property_type']) => {
    const [leads] = await db.execute<Lead[]>(
        `SELECT l.*, 
                CONCAT(e.first_name, ' ', e.last_name) as assigned_to_name,
                e.email as assigned_to_email,
                e.mobile as assigned_to_mobile
         FROM leads l
         LEFT JOIN employees e ON l.assigned_to = e.id
         WHERE l.property_type = ? 
         ORDER BY l.created_at DESC`,
        [propertyType]
    );
    return leads;
};

export const getLeadsBySolarService = async (solarService: Lead['solar_service']) => {
    const [leads] = await db.execute<Lead[]>(
        `SELECT l.*, 
                CONCAT(e.first_name, ' ', e.last_name) as assigned_to_name,
                e.email as assigned_to_email,
                e.mobile as assigned_to_mobile
         FROM leads l
         LEFT JOIN employees e ON l.assigned_to = e.id
         WHERE l.solar_service = ? 
         ORDER BY l.created_at DESC`,
        [solarService]
    );
    return leads;
};

export const getLeadStats = async () => {
    const [results] = await db.execute<RowDataPacket[]>(`
        SELECT 
            COUNT(*) as total_leads,
            COUNT(CASE WHEN service_type = 'Installation' THEN 1 END) as installation_leads,
            COUNT(CASE WHEN service_type = 'Maintenance' THEN 1 END) as maintenance_leads,
            COUNT(CASE WHEN solar_service = 'Residential Solar' THEN 1 END) as residential_leads,
            COUNT(CASE WHEN solar_service = 'Commercial Solar' THEN 1 END) as commercial_leads,
            COUNT(CASE WHEN solar_service = 'Industrial Solar' THEN 1 END) as industrial_leads,
            COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_leads
        FROM leads
    `);
    return results[0];
};
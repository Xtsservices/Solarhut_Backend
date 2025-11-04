import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Lead extends RowDataPacket {
    id: number;
    first_name: string;
    last_name: string;
    mobile: string;
    email?: string;
    service_type: 'Installation' | 'Maintenance';
    capacity: string;
    message: string;
    location: string;
    home_type: 'individual' | 'agricultural_land' | 'villa' | 'apartment' | 'commercial' | 'industrial';
    channel: string;
    created_at: Date;
    updated_at: Date;
}

export const createLead = async (leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'channel'>) => {
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO leads 
        (first_name, last_name, mobile, email, service_type, capacity, message, location, home_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            leadData.first_name,
            leadData.last_name,
            leadData.mobile,
            leadData.email || null,
            leadData.service_type,
            leadData.capacity,
            leadData.message,
            leadData.location,
            leadData.home_type
        ]
    );
    return result.insertId;
};

export const getLeadById = async (id: number) => {
    const [leads] = await db.execute<Lead[]>(
        'SELECT * FROM leads WHERE id = ?',
        [id]
    );
    return leads[0];
};

export const getAllLeads = async () => {
    const [leads] = await db.execute<Lead[]>(
        'SELECT * FROM leads ORDER BY created_at DESC'
    );
    return leads;
};

export const getLeadsByDateRange = async (startDate: Date, endDate: Date) => {
    const [leads] = await db.execute<Lead[]>(
        'SELECT * FROM leads WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC',
        [startDate, endDate]
    );
    return leads;
};

export const getLeadsByServiceType = async (serviceType: Lead['service_type']) => {
    const [leads] = await db.execute<Lead[]>(
        'SELECT * FROM leads WHERE service_type = ? ORDER BY created_at DESC',
        [serviceType]
    );
    return leads;
};

export const getLeadsByHomeType = async (homeType: Lead['home_type']) => {
    const [leads] = await db.execute<Lead[]>(
        'SELECT * FROM leads WHERE home_type = ? ORDER BY created_at DESC',
        [homeType]
    );
    return leads;
};

export const getLeadStats = async () => {
    const [results] = await db.execute<RowDataPacket[]>(`
        SELECT 
            COUNT(*) as total_leads,
            COUNT(CASE WHEN service_type = 'Installation' THEN 1 END) as installation_leads,
            COUNT(CASE WHEN service_type = 'Maintenance' THEN 1 END) as maintenance_leads,
            COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_leads
        FROM leads
    `);
    return results[0];
};
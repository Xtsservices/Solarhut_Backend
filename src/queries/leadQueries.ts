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
    capacity: string;
    message: string;
    location: string;
    property_type: ResidentialPropertyType | CommercialPropertyType | IndustrialPropertyType;
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

export const getLeadsByPropertyType = async (propertyType: Lead['property_type']) => {
    const [leads] = await db.execute<Lead[]>(
        'SELECT * FROM leads WHERE property_type = ? ORDER BY created_at DESC',
        [propertyType]
    );
    return leads;
};

export const getLeadsBySolarService = async (solarService: Lead['solar_service']) => {
    const [leads] = await db.execute<Lead[]>(
        'SELECT * FROM leads WHERE solar_service = ? ORDER BY created_at DESC',
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
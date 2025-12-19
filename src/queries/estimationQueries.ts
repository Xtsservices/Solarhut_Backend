import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Estimation extends RowDataPacket {
    id: number;
    customer_name: string;
    door_no: string;
    area: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    mobile: string;
    structure?: string;
    product_description?: string;
    requested_watts?: string;
    gst: number;
    amount: number;
    created_by?: number;
    updated_by?: number;
    status: 'Active' | 'Inactive';
    created_at: Date;
    updated_at: Date;
}

export interface CreateEstimationData {
    customer_name: string;
    door_no: string;
    area: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    mobile: string;
    structure?: string;
    product_description?: string;
    requested_watts?: string;
    gst?: number;
    amount: number;
    created_by: number;
    updated_by?: number;
}

export const createEstimation = async (estimationData: CreateEstimationData) => {
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO estimations 
        (customer_name, door_no, area, city, district, state, pincode, mobile, 
         structure, product_description, requested_watts, gst, amount, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            estimationData.customer_name ?? null,
            estimationData.door_no ?? null,
            estimationData.area ?? null,
            estimationData.city ?? null,
            estimationData.district ?? null,
            estimationData.state ?? null,
            estimationData.pincode ?? null,
            estimationData.mobile ?? null,
            estimationData.structure ?? null,
            estimationData.product_description ?? null,
            estimationData.requested_watts ?? null,
            estimationData.gst ?? 18.00,
            estimationData.amount ?? null,
            estimationData.created_by ?? 1,
            estimationData.created_by ?? null
        ]
    );
    return result.insertId;
};

export const getAllEstimations = async (filters?: { status?: string; state?: string; district?: string }) => {
    let sql = 'SELECT * FROM estimations WHERE 1=1';
    const params: any[] = [];
    
    if (filters?.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
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

export const getEstimationById = async (id: number) => {
    const [estimations] = await db.execute<Estimation[]>(
        'SELECT * FROM estimations WHERE id = ?',
        [id]
    );
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
    updatedBy: number
) => {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined && key !== 'updated_at') {
            fields.push(`${key} = ?`);
            values.push(value);
        }
    });

    if (fields.length === 0) {
        throw new Error('No fields to update');
    }

    fields.push('updated_by = ?');
    values.push(updatedBy);
    values.push(id);

    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE estimations SET ${fields.join(', ')} WHERE id = ?`,
        values
    );

    return result.affectedRows > 0;
};

export const deleteEstimation = async (id: number) => {
    const [result] = await db.execute<ResultSetHeader>(
        'DELETE FROM estimations WHERE id = ?',
        [id]
    );
    return result.affectedRows > 0;
};

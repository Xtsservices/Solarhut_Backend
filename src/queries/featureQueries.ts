import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Feature extends RowDataPacket {
    id: number;
    feature_name: string;
    created_by: number;
    status: 'Active' | 'Inactive';
    created_at: Date;
    updated_at: Date;
    creator_name?: string; // Optional joined field from employee
}

export const createFeature = async (featureName: string, createdBy: number, status = 'Active') => {
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO features (feature_name, created_by, status)
         VALUES (?, ?, ?)`,
        [featureName, createdBy, status]
    );
    return (result as ResultSetHeader).insertId;
};

export const updateFeature = async (id: number, updates: { feature_name?: string; status?: string }) => {
    const allowed = ['feature_name', 'status'];
    const keys = Object.keys(updates).filter(k => allowed.includes(k));
    if (keys.length === 0) return false;

    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => (updates as any)[k]);
    values.push(id);

    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE features SET ${setSql} WHERE id = ?`,
        values
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const deactivateFeature = async (id: number) => {
    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE features SET status = 'Inactive' WHERE id = ?`,
        [id]
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const getFeatureById = async (id: number) => {
    const [rows] = await db.execute<Feature[]>(
        `SELECT f.*, 
                CONCAT(e.first_name, ' ', e.last_name) as creator_name
         FROM features f
         LEFT JOIN employees e ON f.created_by = e.id
         WHERE f.id = ?`,
        [id]
    );
    return rows[0] || null;
};

export const getAllFeatures = async (onlyActive = false) => {
    const sql = onlyActive 
        ? `SELECT f.*, 
                  CONCAT(e.first_name, ' ', e.last_name) as creator_name
           FROM features f
           LEFT JOIN employees e ON f.created_by = e.id
           WHERE f.status = 'Active'
           ORDER BY f.created_at DESC`
        : `SELECT f.*, 
                  CONCAT(e.first_name, ' ', e.last_name) as creator_name
           FROM features f
           LEFT JOIN employees e ON f.created_by = e.id
           ORDER BY f.created_at DESC`;
    
    const [rows] = await db.execute<Feature[]>(sql);
    return rows;
};

export const getFeaturesByUser = async (createdBy: number, onlyActive = false) => {
    const sql = onlyActive
        ? `SELECT f.*, 
                  CONCAT(e.first_name, ' ', e.last_name) as creator_name
           FROM features f
           LEFT JOIN employees e ON f.created_by = e.id
           WHERE f.created_by = ? AND f.status = 'Active'
           ORDER BY f.created_at DESC`
        : `SELECT f.*, 
                  CONCAT(e.first_name, ' ', e.last_name) as creator_name
           FROM features f
           LEFT JOIN employees e ON f.created_by = e.id
           WHERE f.created_by = ?
           ORDER BY f.created_at DESC`;
    
    const [rows] = await db.execute<Feature[]>(sql, [createdBy]);
    return rows;
};

export const getFeatureByName = async (featureName: string) => {
    const [rows] = await db.execute<Feature[]>(
        `SELECT f.*, 
                CONCAT(e.first_name, ' ', e.last_name) as creator_name
         FROM features f
         LEFT JOIN employees e ON f.created_by = e.id
         WHERE f.feature_name = ?`,
        [featureName]
    );
    return rows[0] || null;
};
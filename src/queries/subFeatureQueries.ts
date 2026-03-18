import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface SubFeature extends RowDataPacket {
    id: number;
    feature_id: number;
    sub_feature_name: string;
    sub_feature_key: string;
    display_order: number;
    created_by: number;
    status: 'Active' | 'Inactive';
    created_at: Date;
    updated_at: Date;
    feature_name?: string; // Optional joined field from features
    creator_name?: string; // Optional joined field from employee
}

export const createSubFeature = async (
    featureId: number, 
    subFeatureName: string, 
    subFeatureKey: string, 
    displayOrder: number,
    createdBy: number, 
    status = 'Active'
) => {
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO sub_features (feature_id, sub_feature_name, sub_feature_key, display_order, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [featureId, subFeatureName, subFeatureKey, displayOrder, createdBy, status]
    );
    return (result as ResultSetHeader).insertId;
};

export const updateSubFeature = async (id: number, updates: { 
    sub_feature_name?: string; 
    sub_feature_key?: string;
    display_order?: number;
    status?: string 
}) => {
    const allowed = ['sub_feature_name', 'sub_feature_key', 'display_order', 'status'];
    const keys = Object.keys(updates).filter(k => allowed.includes(k));
    if (keys.length === 0) return false;

    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => (updates as any)[k]);
    values.push(id);

    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE sub_features SET ${setSql} WHERE id = ?`,
        values
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const deactivateSubFeature = async (id: number) => {
    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE sub_features SET status = 'Inactive' WHERE id = ?`,
        [id]
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const getSubFeatureById = async (id: number) => {
    const [rows] = await db.execute<SubFeature[]>(
        `SELECT sf.*, 
                f.feature_name,
                CONCAT(e.first_name, ' ', e.last_name) as creator_name
         FROM sub_features sf
         LEFT JOIN features f ON sf.feature_id = f.id
         LEFT JOIN employees e ON sf.created_by = e.id
         WHERE sf.id = ?`,
        [id]
    );
    return rows[0] || null;
};

export const getAllSubFeatures = async (onlyActive = false) => {
    const sql = onlyActive 
        ? `SELECT sf.*, 
                  f.feature_name,
                  CONCAT(e.first_name, ' ', e.last_name) as creator_name
           FROM sub_features sf
           LEFT JOIN features f ON sf.feature_id = f.id
           LEFT JOIN employees e ON sf.created_by = e.id
           WHERE sf.status = 'Active'
           ORDER BY f.feature_name, sf.display_order, sf.created_at`
        : `SELECT sf.*, 
                  f.feature_name,
                  CONCAT(e.first_name, ' ', e.last_name) as creator_name
           FROM sub_features sf
           LEFT JOIN features f ON sf.feature_id = f.id
           LEFT JOIN employees e ON sf.created_by = e.id
           ORDER BY f.feature_name, sf.display_order, sf.created_at`;
    
    const [rows] = await db.execute<SubFeature[]>(sql);
    return rows;
};

export const getSubFeaturesByFeature = async (featureId: number, onlyActive = false) => {
    const sql = onlyActive
        ? `SELECT sf.*, 
                  f.feature_name,
                  CONCAT(e.first_name, ' ', e.last_name) as creator_name
           FROM sub_features sf
           LEFT JOIN features f ON sf.feature_id = f.id
           LEFT JOIN employees e ON sf.created_by = e.id
           WHERE sf.feature_id = ? AND sf.status = 'Active'
           ORDER BY sf.display_order, sf.created_at`
        : `SELECT sf.*, 
                  f.feature_name,
                  CONCAT(e.first_name, ' ', e.last_name) as creator_name
           FROM sub_features sf
           LEFT JOIN features f ON sf.feature_id = f.id
           LEFT JOIN employees e ON sf.created_by = e.id
           WHERE sf.feature_id = ?
           ORDER BY sf.display_order, sf.created_at`;
    
    const [rows] = await db.execute<SubFeature[]>(sql, [featureId]);
    return rows;
};

export const getSubFeaturesByFeatureName = async (featureName: string, onlyActive = false) => {
    const sql = onlyActive
        ? `SELECT sf.*, 
                  f.feature_name,
                  CONCAT(e.first_name, ' ', e.last_name) as creator_name
           FROM sub_features sf
           LEFT JOIN features f ON sf.feature_id = f.id
           LEFT JOIN employees e ON sf.created_by = e.id
           WHERE f.feature_name = ? AND sf.status = 'Active'
           ORDER BY sf.display_order, sf.created_at`
        : `SELECT sf.*, 
                  f.feature_name,
                  CONCAT(e.first_name, ' ', e.last_name) as creator_name
           FROM sub_features sf
           LEFT JOIN features f ON sf.feature_id = f.id
           LEFT JOIN employees e ON sf.created_by = e.id
           WHERE f.feature_name = ?
           ORDER BY sf.display_order, sf.created_at`;
    
    const [rows] = await db.execute<SubFeature[]>(sql, [featureName]);
    return rows;
};

export const getSubFeatureByKey = async (featureId: number, subFeatureKey: string) => {
    const [rows] = await db.execute<SubFeature[]>(
        `SELECT sf.*, 
                f.feature_name,
                CONCAT(e.first_name, ' ', e.last_name) as creator_name
         FROM sub_features sf
         LEFT JOIN features f ON sf.feature_id = f.id
         LEFT JOIN employees e ON sf.created_by = e.id
         WHERE sf.feature_id = ? AND sf.sub_feature_key = ?`,
        [featureId, subFeatureKey]
    );
    return rows[0] || null;
};

export const getFeaturesWithSubFeatures = async (onlyActive = false) => {
    const sql = onlyActive
        ? `SELECT 
              f.id as feature_id,
              f.feature_name,
              f.status as feature_status,
              sf.id as sub_feature_id,
              sf.sub_feature_name,
              sf.sub_feature_key,
              sf.display_order,
              sf.status as sub_feature_status
           FROM features f
           LEFT JOIN sub_features sf ON f.id = sf.feature_id AND sf.status = 'Active'
           WHERE f.status = 'Active'
           ORDER BY f.feature_name, sf.display_order, sf.created_at`
        : `SELECT 
              f.id as feature_id,
              f.feature_name,
              f.status as feature_status,
              sf.id as sub_feature_id,
              sf.sub_feature_name,
              sf.sub_feature_key,
              sf.display_order,
              sf.status as sub_feature_status
           FROM features f
           LEFT JOIN sub_features sf ON f.id = sf.feature_id
           ORDER BY f.feature_name, sf.display_order, sf.created_at`;
    
    const [rows] = await db.execute<RowDataPacket[]>(sql);
    
    // Group the results by feature
    const featuresMap = new Map();
    
    rows.forEach(row => {
        const featureId = row.feature_id;
        
        if (!featuresMap.has(featureId)) {
            featuresMap.set(featureId, {
                id: row.feature_id,
                feature_name: row.feature_name,
                status: row.feature_status,
                sub_features: []
            });
        }
        
        if (row.sub_feature_id) {
            featuresMap.get(featureId).sub_features.push({
                id: row.sub_feature_id,
                sub_feature_name: row.sub_feature_name,
                sub_feature_key: row.sub_feature_key,
                display_order: row.display_order,
                status: row.sub_feature_status
            });
        }
    });
    
    return Array.from(featuresMap.values());
};
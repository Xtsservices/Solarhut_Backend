import { db } from '../db';
import { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';

export interface District extends RowDataPacket {
    id: number;
    state_id: number;
    district_code: string;
    name: string;
    alias_name?: string;
    created_by: number;
    updated_by?: number;
    status: 'Active' | 'Inactive';
    created_at: Date;
    updated_at: Date;
    // Joined fields
    state_name?: string;
    state_code?: string;
    country_name?: string;
    country_code?: string;
    creator_name?: string;
    updater_name?: string;
}

export const createDistrict = async (
    stateId: number,
    districtCode: string,
    name: string,
    aliasName: string | null,
    createdBy: number,
    status = 'Active',
    connection?: PoolConnection
) => {
    const executor = connection || db;
    const [result] = await executor.execute<ResultSetHeader>(
        `INSERT INTO districts (state_id, district_code, name, alias_name, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [stateId, districtCode, name, aliasName, createdBy, status]
    );
    return (result as ResultSetHeader).insertId;
};

export const updateDistrict = async (
    id: number, 
    updates: { 
        state_id?: number;
        district_code?: string; 
        name?: string; 
        alias_name?: string; 
        status?: string; 
    },
    updatedBy: number,
    connection?: PoolConnection
) => {
    const allowed = ['state_id', 'district_code', 'name', 'alias_name', 'status'];
    const keys = Object.keys(updates).filter(k => allowed.includes(k));
    if (keys.length === 0) return false;

    const setSql = keys.map(k => `${k} = ?`).join(', ') + ', updated_by = ?';
    const values = keys.map(k => (updates as any)[k]);
    values.push(updatedBy, id);

    const executor = connection || db;
    const [result] = await executor.execute<ResultSetHeader>(
        `UPDATE districts SET ${setSql} WHERE id = ?`,
        values
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const deactivateDistrict = async (id: number, updatedBy: number, connection?: PoolConnection) => {
    const executor = connection || db;
    const [result] = await executor.execute<ResultSetHeader>(
        `UPDATE districts SET status = 'Inactive', updated_by = ? WHERE id = ?`,
        [updatedBy, id]
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const activateDistrict = async (id: number, updatedBy: number, connection?: PoolConnection) => {
    const executor = connection || db;
    const [result] = await executor.execute<ResultSetHeader>(
        `UPDATE districts SET status = 'Active', updated_by = ? WHERE id = ?`,
        [updatedBy, id]
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const getDistrictById = async (id: number, connection?: PoolConnection) => {
    const executor = connection || db;
    const [rows] = await executor.execute<District[]>(
        `SELECT d.*, 
                s.name as state_name, s.state_code,
                c.name as country_name, c.country_code,
                CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
         FROM districts d
         LEFT JOIN states s ON d.state_id = s.id
         LEFT JOIN countries c ON s.country_id = c.id
         LEFT JOIN employees e1 ON d.created_by = e1.id
         LEFT JOIN employees e2 ON d.updated_by = e2.id
         WHERE d.id = ?`,
        [id]
    );
    return rows[0] || null;
};

export const getDistrictByCode = async (stateId: number, districtCode: string, connection?: PoolConnection) => {
    const executor = connection || db;
    const [rows] = await executor.execute<District[]>(
        `SELECT d.*, 
                s.name as state_name, s.state_code,
                c.name as country_name, c.country_code,
                CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
         FROM districts d
         LEFT JOIN states s ON d.state_id = s.id
         LEFT JOIN countries c ON s.country_id = c.id
         LEFT JOIN employees e1 ON d.created_by = e1.id
         LEFT JOIN employees e2 ON d.updated_by = e2.id
         WHERE d.state_id = ? AND d.district_code = ?`,
        [stateId, districtCode]
    );
    return rows[0] || null;
};

export const getDistrictByName = async (stateId: number, name: string, connection?: PoolConnection) => {
    const executor = connection || db;
    const [rows] = await executor.execute<District[]>(
        `SELECT d.*, 
                s.name as state_name, s.state_code,
                c.name as country_name, c.country_code,
                CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
         FROM districts d
         LEFT JOIN states s ON d.state_id = s.id
         LEFT JOIN countries c ON s.country_id = c.id
         LEFT JOIN employees e1 ON d.created_by = e1.id
         LEFT JOIN employees e2 ON d.updated_by = e2.id
         WHERE d.state_id = ? AND d.name = ?`,
        [stateId, name]
    );
    return rows[0] || null;
};

export const getAllDistricts = async (onlyActive = false, connection?: PoolConnection) => {
    const executor = connection || db;
    const sql = onlyActive 
        ? `SELECT d.*, 
                  s.name as state_name, s.state_code,
                  c.name as country_name, c.country_code,
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                  CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
           FROM districts d
           LEFT JOIN states s ON d.state_id = s.id
           LEFT JOIN countries c ON s.country_id = c.id
           LEFT JOIN employees e1 ON d.created_by = e1.id
           LEFT JOIN employees e2 ON d.updated_by = e2.id
           WHERE d.status = 'Active'
           ORDER BY c.name, s.name, d.name ASC`
        : `SELECT d.*, 
                  s.name as state_name, s.state_code,
                  c.name as country_name, c.country_code,
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                  CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
           FROM districts d
           LEFT JOIN states s ON d.state_id = s.id
           LEFT JOIN countries c ON s.country_id = c.id
           LEFT JOIN employees e1 ON d.created_by = e1.id
           LEFT JOIN employees e2 ON d.updated_by = e2.id
           ORDER BY c.name, s.name, d.name ASC`;
    
    const [rows] = await executor.execute<District[]>(sql);
    return rows;
};

export const getDistrictsByState = async (stateId: number, onlyActive = false, connection?: PoolConnection) => {
    const executor = connection || db;
    const baseCondition = onlyActive ? "d.status = 'Active' AND" : "";
    const sql = `SELECT d.*, 
                        s.name as state_name, s.state_code,
                        c.name as country_name, c.country_code,
                        CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                        CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
                 FROM districts d
                 LEFT JOIN states s ON d.state_id = s.id
                 LEFT JOIN countries c ON s.country_id = c.id
                 LEFT JOIN employees e1 ON d.created_by = e1.id
                 LEFT JOIN employees e2 ON d.updated_by = e2.id
                 WHERE ${baseCondition} d.state_id = ?
                 ORDER BY d.name ASC`;
    
    const [rows] = await executor.execute<District[]>(sql, [stateId]);
    return rows;
};

export const getDistrictsByCountry = async (countryId: number, onlyActive = false, connection?: PoolConnection) => {
    const executor = connection || db;
    const baseCondition = onlyActive ? "d.status = 'Active' AND" : "";
    const sql = `SELECT d.*, 
                        s.name as state_name, s.state_code,
                        c.name as country_name, c.country_code,
                        CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                        CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
                 FROM districts d
                 LEFT JOIN states s ON d.state_id = s.id
                 LEFT JOIN countries c ON s.country_id = c.id
                 LEFT JOIN employees e1 ON d.created_by = e1.id
                 LEFT JOIN employees e2 ON d.updated_by = e2.id
                 WHERE ${baseCondition} c.id = ?
                 ORDER BY s.name, d.name ASC`;
    
    const [rows] = await executor.execute<District[]>(sql, [countryId]);
    return rows;
};

export const searchDistricts = async (searchTerm: string, onlyActive = false, connection?: PoolConnection) => {
    const executor = connection || db;
    const baseCondition = onlyActive ? "d.status = 'Active' AND" : "";
    const sql = `SELECT d.*, 
                        s.name as state_name, s.state_code,
                        c.name as country_name, c.country_code,
                        CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                        CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
                 FROM districts d
                 LEFT JOIN states s ON d.state_id = s.id
                 LEFT JOIN countries c ON s.country_id = c.id
                 LEFT JOIN employees e1 ON d.created_by = e1.id
                 LEFT JOIN employees e2 ON d.updated_by = e2.id
                 WHERE ${baseCondition}
                       (d.name LIKE ? OR 
                        d.alias_name LIKE ? OR 
                        d.district_code LIKE ? OR
                        s.name LIKE ? OR
                        c.name LIKE ?)
                 ORDER BY c.name, s.name, d.name ASC`;
    
    const searchPattern = `%${searchTerm}%`;
    const [rows] = await executor.execute<District[]>(sql, [
        searchPattern, searchPattern, searchPattern, searchPattern, searchPattern
    ]);
    return rows;
};

import { db } from '../db';
import { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';

export interface State extends RowDataPacket {
    id: number;
    country_id: number;
    state_code: string;
    name: string;
    alias_name?: string;
    type: 'State' | 'UT';
    created_by: number;
    updated_by?: number;
    status: 'Active' | 'Inactive';
    created_at: Date;
    updated_at: Date;
    country_name?: string; // Optional joined field from country
    country_code?: string; // Optional joined field from country
    creator_name?: string; // Optional joined field from employee
    updater_name?: string; // Optional joined field from employee
}

export const createState = async (
    countryId: number,
    stateCode: string,
    name: string,
    aliasName: string | null,
    type: 'State' | 'UT',
    createdBy: number,
    status = 'Active',
    connection?: PoolConnection
) => {
    const executor = connection || db;
    const [result] = await executor.execute<ResultSetHeader>(
        `INSERT INTO states (country_id, state_code, name, alias_name, type, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [countryId, stateCode, name, aliasName, type, createdBy, status]
    );
    return (result as ResultSetHeader).insertId;
};

export const updateState = async (
    id: number, 
    updates: { 
        country_id?: number;
        state_code?: string; 
        name?: string; 
        alias_name?: string; 
        type?: 'State' | 'UT';
        status?: string; 
    },
    updatedBy: number,
    connection?: PoolConnection
) => {
    const allowed = ['country_id', 'state_code', 'name', 'alias_name', 'type', 'status'];
    const keys = Object.keys(updates).filter(k => allowed.includes(k));
    if (keys.length === 0) return false;

    const setSql = keys.map(k => `${k} = ?`).join(', ') + ', updated_by = ?';
    const values = keys.map(k => (updates as any)[k]);
    values.push(updatedBy, id);

    const executor = connection || db;
    const [result] = await executor.execute<ResultSetHeader>(
        `UPDATE states SET ${setSql} WHERE id = ?`,
        values
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const deactivateState = async (id: number, updatedBy: number, connection?: PoolConnection) => {
    const executor = connection || db;
    const [result] = await executor.execute<ResultSetHeader>(
        `UPDATE states SET status = 'Inactive', updated_by = ? WHERE id = ?`,
        [updatedBy, id]
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const activateState = async (id: number, updatedBy: number, connection?: PoolConnection) => {
    const executor = connection || db;
    const [result] = await executor.execute<ResultSetHeader>(
        `UPDATE states SET status = 'Active', updated_by = ? WHERE id = ?`,
        [updatedBy, id]
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const getStateById = async (id: number, connection?: PoolConnection) => {
    const executor = connection || db;
    const [rows] = await executor.execute<State[]>(
        `SELECT s.*, 
                c.name as country_name,
                c.country_code,
                CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
         FROM states s
         LEFT JOIN countries c ON s.country_id = c.id
         LEFT JOIN employees e1 ON s.created_by = e1.id
         LEFT JOIN employees e2 ON s.updated_by = e2.id
         WHERE s.id = ?`,
        [id]
    );
    return rows[0] || null;
};

export const getStateByCode = async (countryId: number, stateCode: string, connection?: PoolConnection) => {
    const executor = connection || db;
    const [rows] = await executor.execute<State[]>(
        `SELECT s.*, 
                c.name as country_name,
                c.country_code,
                CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
         FROM states s
         LEFT JOIN countries c ON s.country_id = c.id
         LEFT JOIN employees e1 ON s.created_by = e1.id
         LEFT JOIN employees e2 ON s.updated_by = e2.id
         WHERE s.country_id = ? AND s.state_code = ?`,
        [countryId, stateCode]
    );
    return rows[0] || null;
};

export const getStateByName = async (countryId: number, name: string, connection?: PoolConnection) => {
    const executor = connection || db;
    const [rows] = await executor.execute<State[]>(
        `SELECT s.*, 
                c.name as country_name,
                c.country_code,
                CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
         FROM states s
         LEFT JOIN countries c ON s.country_id = c.id
         LEFT JOIN employees e1 ON s.created_by = e1.id
         LEFT JOIN employees e2 ON s.updated_by = e2.id
         WHERE s.country_id = ? AND s.name = ?`,
        [countryId, name]
    );
    return rows[0] || null;
};

export const getAllStates = async (onlyActive = false, connection?: PoolConnection) => {
    const executor = connection || db;
    const sql = onlyActive 
        ? `SELECT s.*, 
                  c.name as country_name,
                  c.country_code,
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                  CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
           FROM states s
           LEFT JOIN countries c ON s.country_id = c.id
           LEFT JOIN employees e1 ON s.created_by = e1.id
           LEFT JOIN employees e2 ON s.updated_by = e2.id
           WHERE s.status = 'Active' AND c.status = 'Active'
           ORDER BY c.name ASC, s.name ASC`
        : `SELECT s.*, 
                  c.name as country_name,
                  c.country_code,
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                  CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
           FROM states s
           LEFT JOIN countries c ON s.country_id = c.id
           LEFT JOIN employees e1 ON s.created_by = e1.id
           LEFT JOIN employees e2 ON s.updated_by = e2.id
           ORDER BY c.name ASC, s.name ASC`;
    
    const [rows] = await executor.execute<State[]>(sql);
    return rows;
};

export const getStatesByCountry = async (countryId: number, onlyActive = false, connection?: PoolConnection) => {
    const executor = connection || db;
    const sql = onlyActive 
        ? `SELECT s.*, 
                  c.name as country_name,
                  c.country_code,
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                  CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
           FROM states s
           LEFT JOIN countries c ON s.country_id = c.id
           LEFT JOIN employees e1 ON s.created_by = e1.id
           LEFT JOIN employees e2 ON s.updated_by = e2.id
           WHERE s.country_id = ? AND s.status = 'Active'
           ORDER BY s.name ASC`
        : `SELECT s.*, 
                  c.name as country_name,
                  c.country_code,
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                  CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
           FROM states s
           LEFT JOIN countries c ON s.country_id = c.id
           LEFT JOIN employees e1 ON s.created_by = e1.id
           LEFT JOIN employees e2 ON s.updated_by = e2.id
           WHERE s.country_id = ?
           ORDER BY s.name ASC`;
    
    const [rows] = await executor.execute<State[]>(sql, [countryId]);
    return rows;
};

export const getStatesByType = async (type: 'State' | 'UT', onlyActive = false, connection?: PoolConnection) => {
    const executor = connection || db;
    const sql = onlyActive 
        ? `SELECT s.*, 
                  c.name as country_name,
                  c.country_code,
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                  CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
           FROM states s
           LEFT JOIN countries c ON s.country_id = c.id
           LEFT JOIN employees e1 ON s.created_by = e1.id
           LEFT JOIN employees e2 ON s.updated_by = e2.id
           WHERE s.type = ? AND s.status = 'Active' AND c.status = 'Active'
           ORDER BY c.name ASC, s.name ASC`
        : `SELECT s.*, 
                  c.name as country_name,
                  c.country_code,
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                  CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
           FROM states s
           LEFT JOIN countries c ON s.country_id = c.id
           LEFT JOIN employees e1 ON s.created_by = e1.id
           LEFT JOIN employees e2 ON s.updated_by = e2.id
           WHERE s.type = ?
           ORDER BY c.name ASC, s.name ASC`;
    
    const [rows] = await executor.execute<State[]>(sql, [type]);
    return rows;
};

export const searchStates = async (searchTerm: string, onlyActive = false, connection?: PoolConnection) => {
    const executor = connection || db;
    const baseCondition = onlyActive ? "s.status = 'Active' AND c.status = 'Active' AND" : "";
    const sql = `SELECT s.*, 
                        c.name as country_name,
                        c.country_code,
                        CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                        CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
                 FROM states s
                 LEFT JOIN countries c ON s.country_id = c.id
                 LEFT JOIN employees e1 ON s.created_by = e1.id
                 LEFT JOIN employees e2 ON s.updated_by = e2.id
                 WHERE ${baseCondition}
                       (s.name LIKE ? OR 
                        s.alias_name LIKE ? OR 
                        s.state_code LIKE ? OR
                        c.name LIKE ?)
                 ORDER BY c.name ASC, s.name ASC`;
    
    const searchPattern = `%${searchTerm}%`;
    const [rows] = await executor.execute<State[]>(sql, [searchPattern, searchPattern, searchPattern, searchPattern]);
    return rows;
};

import { db } from '../db';
import { ResultSetHeader, RowDataPacket, PoolConnection } from 'mysql2/promise';

export interface Country extends RowDataPacket {
    id: number;
    country_code: string;
    name: string;
    alias_name?: string;
    currency_format: string;
    created_by: number;
    updated_by?: number;
    status: 'Active' | 'Inactive';
    created_at: Date;
    updated_at: Date;
    creator_name?: string; // Optional joined field from employee
    updater_name?: string; // Optional joined field from employee
}

export const createCountry = async (
    countryCode: string,
    name: string,
    aliasName: string | null,
    currencyFormat: string,
    createdBy: number,
    status = 'Active',
    connection?: PoolConnection
) => {
    const executor = connection || db;
    const [result] = await executor.execute<ResultSetHeader>(
        `INSERT INTO countries (country_code, name, alias_name, currency_format, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [countryCode, name, aliasName, currencyFormat, createdBy, status]
    );
    return (result as ResultSetHeader).insertId;
};

export const updateCountry = async (
    id: number, 
    updates: { 
        country_code?: string; 
        name?: string; 
        alias_name?: string; 
        currency_format?: string; 
        status?: string; 
    },
    updatedBy: number,
    connection?: PoolConnection
) => {
    const allowed = ['country_code', 'name', 'alias_name', 'currency_format', 'status'];
    const keys = Object.keys(updates).filter(k => allowed.includes(k));
    if (keys.length === 0) return false;

    const setSql = keys.map(k => `${k} = ?`).join(', ') + ', updated_by = ?';
    const values = keys.map(k => (updates as any)[k]);
    values.push(updatedBy, id);

    const executor = connection || db;
    const [result] = await executor.execute<ResultSetHeader>(
        `UPDATE countries SET ${setSql} WHERE id = ?`,
        values
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const deactivateCountry = async (id: number, updatedBy: number, connection?: PoolConnection) => {
    const executor = connection || db;
    const [result] = await executor.execute<ResultSetHeader>(
        `UPDATE countries SET status = 'Inactive', updated_by = ? WHERE id = ?`,
        [updatedBy, id]
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const activateCountry = async (id: number, updatedBy: number, connection?: PoolConnection) => {
    const executor = connection || db;
    const [result] = await executor.execute<ResultSetHeader>(
        `UPDATE countries SET status = 'Active', updated_by = ? WHERE id = ?`,
        [updatedBy, id]
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const getCountryById = async (id: number, connection?: PoolConnection) => {
    const executor = connection || db;
    const [rows] = await executor.execute<Country[]>(
        `SELECT c.*, 
                CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
         FROM countries c
         LEFT JOIN employees e1 ON c.created_by = e1.id
         LEFT JOIN employees e2 ON c.updated_by = e2.id
         WHERE c.id = ?`,
        [id]
    );
    return rows[0] || null;
};

export const getCountryByCode = async (countryCode: string, connection?: PoolConnection) => {
    const executor = connection || db;
    const [rows] = await executor.execute<Country[]>(
        `SELECT c.*, 
                CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
         FROM countries c
         LEFT JOIN employees e1 ON c.created_by = e1.id
         LEFT JOIN employees e2 ON c.updated_by = e2.id
         WHERE c.country_code = ?`,
        [countryCode]
    );
    return rows[0] || null;
};

export const getCountryByName = async (name: string, connection?: PoolConnection) => {
    const executor = connection || db;
    const [rows] = await executor.execute<Country[]>(
        `SELECT c.*, 
                CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
         FROM countries c
         LEFT JOIN employees e1 ON c.created_by = e1.id
         LEFT JOIN employees e2 ON c.updated_by = e2.id
         WHERE c.name = ?`,
        [name]
    );
    return rows[0] || null;
};

export const getAllCountries = async (onlyActive = false, connection?: PoolConnection) => {
    const executor = connection || db;
    const sql = onlyActive 
        ? `SELECT c.*, 
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                  CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
           FROM countries c
           LEFT JOIN employees e1 ON c.created_by = e1.id
           LEFT JOIN employees e2 ON c.updated_by = e2.id
           WHERE c.status = 'Active'
           ORDER BY c.name ASC`
        : `SELECT c.*, 
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                  CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
           FROM countries c
           LEFT JOIN employees e1 ON c.created_by = e1.id
           LEFT JOIN employees e2 ON c.updated_by = e2.id
           ORDER BY c.name ASC`;
    
    const [rows] = await executor.execute<Country[]>(sql);
    return rows;
};

export const searchCountries = async (searchTerm: string, onlyActive = false, connection?: PoolConnection) => {
    const executor = connection || db;
    const baseCondition = onlyActive ? "c.status = 'Active' AND" : "";
    const sql = `SELECT c.*, 
                        CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                        CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
                 FROM countries c
                 LEFT JOIN employees e1 ON c.created_by = e1.id
                 LEFT JOIN employees e2 ON c.updated_by = e2.id
                 WHERE ${baseCondition}
                       (c.name LIKE ? OR 
                        c.alias_name LIKE ? OR 
                        c.country_code LIKE ?)
                 ORDER BY c.name ASC`;
    
    const searchPattern = `%${searchTerm}%`;
    const [rows] = await executor.execute<Country[]>(sql, [searchPattern, searchPattern, searchPattern]);
    return rows;
};

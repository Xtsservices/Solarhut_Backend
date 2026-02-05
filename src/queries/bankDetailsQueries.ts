import { PoolConnection } from 'mysql2/promise';
import { db } from '../db';

// Bank Details CRUD Operations

export const createBankDetail = async (
    bankData: {
        bank_name: string;
        account_name: string;
        account_number: string;
        ifsc: string;
        branch: string;
        upi_id?: string;
        qr_code_url?: string;
        qr_code_s3_key?: string;
        status?: string;
    },
    created_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        `INSERT INTO bank_details (
            bank_name, account_name, account_number, ifsc, branch,
            upi_id, qr_code_url, qr_code_s3_key, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            bankData.bank_name,
            bankData.account_name,
            bankData.account_number,
            bankData.ifsc,
            bankData.branch,
            bankData.upi_id || null,
            bankData.qr_code_url || null,
            bankData.qr_code_s3_key || null,
            bankData.status || 'Active',
            created_by
        ]
    );
    
    return result;
};

export const getAllBankDetails = async (
    activeOnly: boolean = true,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const statusCondition = activeOnly ? "WHERE status = 'Active'" : "";
    
    const [rows] = await conn.execute(
        `SELECT 
            bd.*,
            e.first_name as created_by_name,
            u.first_name as updated_by_name
        FROM bank_details bd
        LEFT JOIN employees e ON bd.created_by = e.id
        LEFT JOIN employees u ON bd.updated_by = u.id
        ${statusCondition}
        ORDER BY bd.created_at DESC`
    );
    
    return rows;
};

export const getBankDetailById = async (
    id: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT 
            bd.*,
            e.first_name as created_by_name,
            u.first_name as updated_by_name
        FROM bank_details bd
        LEFT JOIN employees e ON bd.created_by = e.id
        LEFT JOIN employees u ON bd.updated_by = u.id
        WHERE bd.id = ?`,
        [id]
    );
    
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
};

export const getActiveBankDetail = async (
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT 
            bd.*,
            e.first_name as created_by_name,
            u.first_name as updated_by_name
        FROM bank_details bd
        LEFT JOIN employees e ON bd.created_by = e.id
        LEFT JOIN employees u ON bd.updated_by = u.id
        WHERE bd.status = 'Active'
        ORDER BY bd.created_at DESC
        LIMIT 1`
    );
    
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
};

export const updateBankDetail = async (
    id: number,
    bankData: {
        bank_name?: string;
        account_name?: string;
        account_number?: string;
        ifsc?: string;
        branch?: string;
        upi_id?: string;
        qr_code_url?: string;
        qr_code_s3_key?: string;
        status?: string;
    },
    updated_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    
    const fields = [];
    const values = [];
    
    Object.entries(bankData).forEach(([key, value]) => {
        if (value !== undefined) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
    });
    
    if (fields.length === 0) {
        throw new Error('No fields to update');
    }
    
    fields.push('updated_by = ?');
    values.push(updated_by);
    values.push(id);
    
    const [result] = await conn.execute(
        `UPDATE bank_details SET ${fields.join(', ')} WHERE id = ?`,
        values
    );
    
    return result;
};

export const deleteBankDetail = async (
    id: number,
    updated_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        `UPDATE bank_details SET status = 'Inactive', updated_by = ? WHERE id = ?`,
        [updated_by, id]
    );
    
    return result;
};

export const permanentlyDeleteBankDetail = async (
    id: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        `DELETE FROM bank_details WHERE id = ?`,
        [id]
    );
    
    return result;
};

export const getBankDetailByAccountNumber = async (
    account_number: string,
    excludeId?: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    
    let query = `SELECT * FROM bank_details WHERE account_number = ?`;
    const params: (string | number)[] = [account_number];
    
    if (excludeId) {
        query += ` AND id != ?`;
        params.push(excludeId);
    }
    
    const [rows] = await conn.execute(query, params);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
};

export const getBankDetailsByIfsc = async (
    ifsc: string,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [rows] = await conn.execute(
        `SELECT * FROM bank_details WHERE ifsc = ? AND status = 'Active'`,
        [ifsc]
    );
    
    return rows;
};

export const updateBankDetailQRCode = async (
    id: number,
    qr_code_url: string,
    qr_code_s3_key: string,
    updated_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        `UPDATE bank_details SET qr_code_url = ?, qr_code_s3_key = ?, updated_by = ? WHERE id = ?`,
        [qr_code_url, qr_code_s3_key, updated_by, id]
    );
    
    return result;
};

export const deleteBankDetailQRCode = async (
    id: number,
    updated_by: number,
    connection?: PoolConnection
) => {
    const conn = connection || db;
    const [result] = await conn.execute(
        `UPDATE bank_details SET qr_code_url = NULL, qr_code_s3_key = NULL, updated_by = ? WHERE id = ?`,
        [updated_by, id]
    );
    
    return result;
};
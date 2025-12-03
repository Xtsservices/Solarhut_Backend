import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Contact extends RowDataPacket {
    id: number;
    full_name: string;
    email: string;
    mobile: string;
    reason: string;
    message?: string;
    status: 'New' | 'In Progress' | 'Resolved' | 'Closed';
    created_at: Date;
    updated_at: Date;
}

export const createContact = async (contactData: Omit<Contact, 'id' | 'created_at' | 'updated_at'>) => {
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO contacts (full_name, email, mobile, reason, message, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [contactData.full_name, contactData.email, contactData.mobile, contactData.reason, contactData.message, contactData.status || 'New']
    );
    return result.insertId;
};

export const getAllContacts = async (filters?: { status?: string; reason?: string }) => {
    let sql = 'SELECT * FROM contacts WHERE 1=1';
    const params: any[] = [];
    
    if (filters?.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
    }
    
    if (filters?.reason) {
        sql += ' AND reason = ?';
        params.push(filters.reason);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const [contacts] = await db.execute<Contact[]>(sql, params);
    return contacts;
};

export const getContactById = async (id: number) => {
    const [contacts] = await db.execute<Contact[]>(
        'SELECT * FROM contacts WHERE id = ?',
        [id]
    );
    return contacts[0];
};

export const getContactsByReason = async (reason: string) => {
    const [contacts] = await db.execute<Contact[]>(
        'SELECT * FROM contacts WHERE reason = ? ORDER BY created_at DESC',
        [reason]
    );
    return contacts;
};

export const updateContact = async (id: number, updates: { full_name?: string; email?: string; mobile?: string; reason?: string; message?: string; status?: 'New' | 'In Progress' | 'Resolved' | 'Closed' }) => {
    const allowed = ['full_name', 'email', 'mobile', 'reason', 'message', 'status'];
    const keys = Object.keys(updates).filter(k => allowed.includes(k));
    if (keys.length === 0) return false;

    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => (updates as any)[k]);
    values.push(id);

    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE contacts SET ${setSql} WHERE id = ?`,
        values
    );
    return result.affectedRows > 0;
};

export const deleteContact = async (id: number): Promise<boolean> => {
    const [result] = await db.execute<ResultSetHeader>(
        'DELETE FROM contacts WHERE id = ?',
        [id]
    );
    return result.affectedRows > 0;
};
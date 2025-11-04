import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Contact extends RowDataPacket {
    id: number;
    full_name: string;
    email: string;
    mobile: string;
    reason: string;
    message?: string;
    created_at: Date;
    updated_at: Date;
}

export const createContact = async (contactData: Omit<Contact, 'id' | 'created_at' | 'updated_at'>) => {
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO contacts (full_name, email, mobile, reason, message)
         VALUES (?, ?, ?, ?, ?)`,
        [contactData.full_name, contactData.email, contactData.mobile, contactData.reason, contactData.message]
    );
    return result.insertId;
};

export const getAllContacts = async () => {
    const [contacts] = await db.execute<Contact[]>(
        'SELECT * FROM contacts ORDER BY created_at DESC'
    );
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

export const deleteContact = async (id: number): Promise<boolean> => {
    const [result] = await db.execute<ResultSetHeader>(
        'DELETE FROM contacts WHERE id = ?',
        [id]
    );
    return result.affectedRows > 0;
};
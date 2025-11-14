import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Package extends RowDataPacket {
    id: number;
    name: string;
    capacity: string;
    price: number;
    original_price?: number;
    savings?: number;
    monthly_generation?: string;
    features?: string;
    status: 'Active' | 'Inactive';
    created_at: Date;
    updated_at: Date;
}

export const createPackage = async (pkg: Omit<Package, 'id' | 'created_at' | 'updated_at'>) => {
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO packages (name, capacity, price, original_price, savings, monthly_generation, features, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [pkg.name, pkg.capacity, pkg.price, pkg.original_price || null, pkg.savings || null, pkg.monthly_generation || null, pkg.features || null, pkg.status || 'Active']
    );
    return (result as ResultSetHeader).insertId;
};

export const updatePackage = async (id: number, updates: Partial<Package>) => {
    const allowed = ['name','capacity','price','original_price','savings','monthly_generation','features','status'];
    const keys = Object.keys(updates).filter(k => allowed.includes(k));
    if (keys.length === 0) return false;

    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => (updates as any)[k]);
    values.push(id);

    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE packages SET ${setSql} WHERE id = ?`,
        values
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const deactivatePackage = async (id: number) => {
    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE packages SET status = 'Inactive' WHERE id = ?`,
        [id]
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

export const getPackageById = async (id: number) => {
    const [rows] = await db.execute<Package[]>(`SELECT * FROM packages WHERE id = ?`, [id]);
    return rows[0] || null;
};

export const getAllPackages = async (onlyActive = false) => {
    if (onlyActive) {
        const [rows] = await db.execute<Package[]>(`SELECT * FROM packages WHERE status = 'Active' ORDER BY created_at DESC`);
        return rows;
    }
    const [rows] = await db.execute<Package[]>(`SELECT * FROM packages ORDER BY created_at DESC`);
    return rows;
};

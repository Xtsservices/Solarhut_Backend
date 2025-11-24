import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Role extends RowDataPacket {
    role_id: number;
    role_name: string;
    status: 'Active' | 'Inactive';
    created_at: Date;
    updated_at: Date;
}

export const createRole = async (roleName: Role['role_name'], status: Role['status'] = 'Active') => {
    const [result] = await db.execute<ResultSetHeader>(
        'INSERT INTO roles (role_name, status) VALUES (?, ?)',
        [roleName, status]
    );
    return result.insertId;
};

export const getAllRoles = async (onlyActive: boolean = false) => {
    const sql = onlyActive 
        ? 'SELECT role_id, role_name, status, created_at, updated_at FROM roles WHERE status = "Active" ORDER BY role_name ASC'
        : 'SELECT role_id, role_name, status, created_at, updated_at FROM roles ORDER BY role_name ASC';
    const [roles] = await db.execute<Role[]>(sql);
    return roles;
};

export const getRoleById = async (roleId: number) => {
    const [roles] = await db.execute<Role[]>(
        'SELECT * FROM roles WHERE role_id = ?',
        [roleId]
    );
    return roles[0];
};

export const updateRole = async (roleId: number, updates: { role_name?: string; status?: 'Active' | 'Inactive' }) => {
    const allowed = ['role_name', 'status'];
    const keys = Object.keys(updates).filter(k => allowed.includes(k));
    if (keys.length === 0) return false;

    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => (updates as any)[k]);
    values.push(roleId);

    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE roles SET ${setSql} WHERE role_id = ?`,
        values
    );
    return result.affectedRows > 0;
};

export const removeRoleByName = async (roleName: string) => {
    // First, check if role is assigned to any employees
    const [assignments] = await db.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM employee_roles er JOIN roles r ON er.role_id = r.role_id WHERE r.role_name = ?',
        [roleName]
    );

    if (assignments[0].count > 0) {
        throw new Error('Cannot delete role: It is assigned to one or more employees');
    }

    // If no assignments, delete the role
    const [result] = await db.execute<ResultSetHeader>(
        'DELETE FROM roles WHERE role_name = ?',
        [roleName]
    );
    return result.affectedRows > 0;
};
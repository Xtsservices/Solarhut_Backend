import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Role extends RowDataPacket {
    role_id: number;
    role_name: string;
}

export const createRole = async (roleName: Role['role_name']) => {
    const [result] = await db.execute<ResultSetHeader>(
        'INSERT INTO roles (role_name) VALUES (?)',
        [roleName]
    );
    return result.insertId;
};

export const getAllRoles = async () => {
    const [roles] = await db.execute<Role[]>('SELECT role_id, role_name FROM roles ORDER BY role_name ASC');
    return roles;
};

export const getRoleById = async (roleId: number) => {
    const [roles] = await db.execute<Role[]>(
        'SELECT * FROM roles WHERE role_id = ?',
        [roleId]
    );
    return roles[0];
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
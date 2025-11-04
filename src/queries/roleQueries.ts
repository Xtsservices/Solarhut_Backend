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
    const [roles] = await db.execute<Role[]>('SELECT * FROM roles');
    return roles;
};

export const getRoleById = async (roleId: number) => {
    const [roles] = await db.execute<Role[]>(
        'SELECT * FROM roles WHERE role_id = ?',
        [roleId]
    );
    return roles[0];
};

export const removeRole = async (roleId: number) => {
    const [result] = await db.execute<ResultSetHeader>(
        'DELETE FROM roles WHERE role_id = ?',
        [roleId]
    );
    return result.affectedRows > 0;
};
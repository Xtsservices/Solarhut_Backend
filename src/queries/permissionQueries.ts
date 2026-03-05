import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Permission extends RowDataPacket {
    id: number;
    role_id: number;
    employee_id: number;
    feature_id: number;
    permission: 'create' | 'read' | 'edit' | 'delete';
    created_by: number;
    updated_by?: number;
    status: 'Active' | 'Inactive';
    created_at: Date;
    updated_at: Date;
    role_name?: string;
    feature_name?: string;
    creator_name?: string;
    updater_name?: string;
}

// Create a single permission
export const createPermission = async (
    roleId: number,
    employeeId: number,
    featureId: number,
    permission: string,
    createdBy: number,
    status = 'Active'
) => {
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO permissions (role_id, employee_id, feature_id, permission, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [roleId, employeeId, featureId, permission, createdBy, status]
    );
    return (result as ResultSetHeader).insertId;
};

// Create multiple permissions for a role-feature combination
export const createRoleFeaturePermissions = async (
    roleId: number,
    employeeId: number,
    featureId: number,
    permissions: string[],
    createdBy: number
) => {
    // First, delete existing permissions for this role-feature combination
    await db.execute(
        `DELETE FROM permissions WHERE role_id = ? AND feature_id = ?`,
        [roleId, featureId]
    );

    // Create new permissions
    const insertedIds: number[] = [];
    for (const permission of permissions) {
        const id = await createPermission(roleId, employeeId, featureId, permission, createdBy);
        insertedIds.push(id);
    }
    return insertedIds;
};

// Update permission status
export const updatePermission = async (id: number, updates: { status?: string; updated_by?: number }) => {
    const allowed = ['status', 'updated_by'];
    const keys = Object.keys(updates).filter(k => allowed.includes(k));
    if (keys.length === 0) return false;

    const setSql = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => (updates as any)[k]);
    values.push(id);

    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE permissions SET ${setSql} WHERE id = ?`,
        values
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

// Delete permission (hard delete)
export const deletePermission = async (id: number) => {
    const [result] = await db.execute<ResultSetHeader>(
        `DELETE FROM permissions WHERE id = ?`,
        [id]
    );
    return (result as ResultSetHeader).affectedRows > 0;
};

// Delete all permissions for a role-feature combination
export const deleteRoleFeaturePermissions = async (roleId: number, featureId: number) => {
    const [result] = await db.execute<ResultSetHeader>(
        `DELETE FROM permissions WHERE role_id = ? AND feature_id = ?`,
        [roleId, featureId]
    );
    return (result as ResultSetHeader).affectedRows;
};

// Get permission by ID with related data
export const getPermissionById = async (id: number) => {
    const [rows] = await db.execute<Permission[]>(
        `SELECT p.*, 
                r.role_name,
                f.feature_name,
                CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
                CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
         FROM permissions p
         LEFT JOIN roles r ON p.role_id = r.role_id
         LEFT JOIN features f ON p.feature_id = f.id
         LEFT JOIN employees e1 ON p.created_by = e1.id
         LEFT JOIN employees e2 ON p.updated_by = e2.id
         WHERE p.id = ?`,
        [id]
    );
    return rows[0] || null;
};

// Get all permissions with filters
export const getAllPermissions = async (filters: {
    roleId?: number;
    featureId?: number;
    permission?: string;
    status?: string;
    onlyActive?: boolean;
}) => {
    let sql = `
        SELECT p.*, 
               r.role_name,
               f.feature_name,
               CONCAT(e1.first_name, ' ', e1.last_name) as creator_name,
               CONCAT(e2.first_name, ' ', e2.last_name) as updater_name
        FROM permissions p
        LEFT JOIN roles r ON p.role_id = r.role_id
        LEFT JOIN features f ON p.feature_id = f.id
        LEFT JOIN employees e1 ON p.created_by = e1.id
        LEFT JOIN employees e2 ON p.updated_by = e2.id
        WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (filters.roleId) {
        sql += ` AND p.role_id = ?`;
        params.push(filters.roleId);
    }
    
    if (filters.featureId) {
        sql += ` AND p.feature_id = ?`;
        params.push(filters.featureId);
    }
    
    if (filters.permission) {
        sql += ` AND p.permission = ?`;
        params.push(filters.permission);
    }
    
    if (filters.status) {
        sql += ` AND p.status = ?`;
        params.push(filters.status);
    }
    
    if (filters.onlyActive) {
        sql += ` AND p.status = 'Active'`;
    }
    
    sql += ` ORDER BY r.role_name, f.feature_name, p.permission`;
    
    const [rows] = await db.execute<Permission[]>(sql, params);
    return rows;
};

// Get permissions by role
export const getPermissionsByRole = async (roleId: number, onlyActive = true) => {
    const sql = onlyActive
        ? `SELECT p.*, 
                  r.role_name,
                  f.feature_name,
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name
           FROM permissions p
           LEFT JOIN roles r ON p.role_id = r.role_id
           LEFT JOIN features f ON p.feature_id = f.id
           LEFT JOIN employees e1 ON p.created_by = e1.id
           WHERE p.role_id = ? AND p.status = 'Active'
           ORDER BY f.feature_name, p.permission`
        : `SELECT p.*, 
                  r.role_name,
                  f.feature_name,
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name
           FROM permissions p
           LEFT JOIN roles r ON p.role_id = r.role_id
           LEFT JOIN features f ON p.feature_id = f.id
           LEFT JOIN employees e1 ON p.created_by = e1.id
           WHERE p.role_id = ?
           ORDER BY f.feature_name, p.permission`;
    
    const [rows] = await db.execute<Permission[]>(sql, [roleId]);
    return rows;
};

// Get permissions by feature
export const getPermissionsByFeature = async (featureId: number, onlyActive = true) => {
    const sql = onlyActive
        ? `SELECT p.*, 
                  r.role_name,
                  f.feature_name,
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name
           FROM permissions p
           LEFT JOIN roles r ON p.role_id = r.role_id
           LEFT JOIN features f ON p.feature_id = f.id
           LEFT JOIN employees e1 ON p.created_by = e1.id
           WHERE p.feature_id = ? AND p.status = 'Active'
           ORDER BY r.role_name, p.permission`
        : `SELECT p.*, 
                  r.role_name,
                  f.feature_name,
                  CONCAT(e1.first_name, ' ', e1.last_name) as creator_name
           FROM permissions p
           LEFT JOIN roles r ON p.role_id = r.role_id
           LEFT JOIN features f ON p.feature_id = f.id
           LEFT JOIN employees e1 ON p.created_by = e1.id
           WHERE p.feature_id = ?
           ORDER BY r.role_name, p.permission`;
    
    const [rows] = await db.execute<Permission[]>(sql, [featureId]);
    return rows;
};

// Check if a role has specific permission for a feature
export const hasPermission = async (roleId: number, featureId: number, permission: string) => {
    const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM permissions 
         WHERE role_id = ? AND feature_id = ? AND permission = ? AND status = 'Active'`,
        [roleId, featureId, permission]
    );
    return rows[0].count > 0;
};

// Get all permissions for an employee based on their roles
// Only returns features where the employee has at least 1 Active permission
export const getEmployeePermissions = async (employeeId: number) => {
    console.log('getEmployeePermissions called with employeeId:', employeeId);
    
    // Debug: check what raw permission rows exist for this employee
    const [debugRows] = await db.execute<RowDataPacket[]>(
        `SELECT p.employee_id, p.role_id, p.feature_id, f.feature_name, p.permission, p.status, er.status as er_status
         FROM permissions p
         INNER JOIN features f ON p.feature_id = f.id
         INNER JOIN employee_roles er ON p.role_id = er.role_id AND er.employee_id = ?
         WHERE p.employee_id = ?
         ORDER BY p.feature_id, p.permission`,
        [employeeId, employeeId]
    );
    console.log('DEBUG - All permission rows for employee:', JSON.stringify(debugRows.map(r => ({
        feature_id: r.feature_id,
        feature_name: r.feature_name,
        permission: r.permission,
        p_status: r.status,
        er_status: r.er_status
    }))));

    const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT f.feature_name, f.id AS feature_id
         FROM permissions p
         INNER JOIN features f ON p.feature_id = f.id
         INNER JOIN employee_roles er ON p.role_id = er.role_id AND er.employee_id = ?
         WHERE p.employee_id = ?
           AND p.status = 'Active'
           AND er.status = 'Active'
         GROUP BY f.id, f.feature_name`,
        [employeeId, employeeId]
    );
    console.log('DEBUG - Final filtered features:', JSON.stringify(rows));
    return rows.map(row => row.feature_name);
};

// Get all active permissions for a specific employee (by employee_id in permissions table)
export const getActivePermissionsByEmployeeId = async (employeeId: number) => {
    const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT p.id, p.role_id, p.feature_id, p.permission, p.status
         FROM permissions p
         WHERE p.employee_id = ? AND p.status = 'Active'`,
        [employeeId]
    );
    return rows;
};

// Upsert a single permission: INSERT if not exists, or UPDATE status to Active if exists
export const upsertPermission = async (
    roleId: number,
    employeeId: number,
    featureId: number,
    permission: string,
    createdBy: number
) => {
    // Use INSERT ... ON DUPLICATE KEY UPDATE to avoid duplicates
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO permissions (role_id, employee_id, feature_id, permission, created_by, status)
         VALUES (?, ?, ?, ?, ?, 'Active')
         ON DUPLICATE KEY UPDATE status = 'Active', updated_by = ?, updated_at = NOW()`,
        [roleId, employeeId, featureId, permission, createdBy, createdBy]
    );
    return result;
};

// Deactivate permissions for a specific employee + role + feature combination
export const deactivateRoleFeaturePermissions = async (
    roleId: number,
    employeeId: number,
    featureId: number
) => {
    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE permissions SET status = 'Inactive', updated_at = NOW()
         WHERE role_id = ? AND employee_id = ? AND feature_id = ? AND status = 'Active'`,
        [roleId, employeeId, featureId]
    );
    return result.affectedRows;
};

// Deactivate specific permission types for a role + employee + feature
export const deactivateSpecificPermissions = async (
    roleId: number,
    employeeId: number,
    featureId: number,
    permissions: string[]
) => {
    if (permissions.length === 0) return 0;
    const placeholders = permissions.map(() => '?').join(',');
    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE permissions SET status = 'Inactive', updated_at = NOW()
         WHERE role_id = ? AND employee_id = ? AND feature_id = ? AND permission IN (${placeholders}) AND status = 'Active'`,
        [roleId, employeeId, featureId, ...permissions]
    );
    return result.affectedRows;
};

// Sync employee permissions for update:
// - Upsert permissions that are in the payload (set Active)
// - Deactivate permissions for features in payload where boolean is false
// - Deactivate all permissions for features NOT in the payload
export const syncEmployeePermissions = async (
    employeeId: number,
    roleId: number,
    featurePermissions: Array<{ feature_id: number; read: boolean; write: boolean; edit: boolean; delete: boolean }>,
    updatedBy: number
) => {
    const allPermTypes = ['read', 'create', 'edit', 'delete'] as const;
    const payloadFeatureIds = featurePermissions.map(fp => fp.feature_id);

    // Step 1: Deactivate all active permissions for features NOT in the payload
    if (payloadFeatureIds.length > 0) {
        const placeholders = payloadFeatureIds.map(() => '?').join(',');
        await db.execute(
            `UPDATE permissions SET status = 'Inactive', updated_by = ?, updated_at = NOW()
             WHERE employee_id = ? AND role_id = ? AND feature_id NOT IN (${placeholders}) AND status = 'Active'`,
            [updatedBy, employeeId, roleId, ...payloadFeatureIds]
        );
    } else {
        // If no features in payload, deactivate all
        await db.execute(
            `UPDATE permissions SET status = 'Inactive', updated_by = ?, updated_at = NOW()
             WHERE employee_id = ? AND role_id = ? AND status = 'Active'`,
            [updatedBy, employeeId, roleId]
        );
    }

    // Step 2: For each feature in payload, upsert true permissions and deactivate false ones
    for (const fp of featurePermissions) {
        const mapping: Record<string, boolean> = {
            read: fp.read,
            create: fp.write,
            edit: fp.edit,
            delete: fp.delete
        };

        const toActivate = allPermTypes.filter(p => mapping[p]);
        const toDeactivate = allPermTypes.filter(p => !mapping[p]);

        // Upsert permissions that should be active
        for (const perm of toActivate) {
            await upsertPermission(roleId, employeeId, fp.feature_id, perm, updatedBy);
        }

        // Deactivate permissions that should be inactive
        if (toDeactivate.length > 0) {
            await deactivateSpecificPermissions(roleId, employeeId, fp.feature_id, [...toDeactivate]);
        }
    }
};
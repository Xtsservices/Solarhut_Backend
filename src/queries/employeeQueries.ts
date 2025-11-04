import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface Role extends RowDataPacket {
    role_id: number;
    role_name: string;
}

interface EmployeeRole {
    role_id: number;
    role_name: string;
    status: 'Active' | 'Inactive';
    assigned_at: Date;
    updated_at: Date;
}

export interface Employee extends RowDataPacket {
    id: number;
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    mobile: string;
    password: string;
    date_of_birth?: Date;
    address?: string;
    joining_date: Date;
    status: 'Active' | 'Inactive' | 'On Leave';
    roles?: EmployeeRole[];
    created_at: Date;
    updated_at: Date;
}

// Generate unique user ID (format: EMP + 6 digit number)
export const generateUserId = async (): Promise<string> => {
    const [result] = await db.execute<RowDataPacket[]>('SELECT MAX(user_id) as max_id FROM employees');
    const lastId = result[0].max_id || 'EMP000000';
    const numericPart = parseInt(lastId.substring(3)) + 1;
    return `EMP${numericPart.toString().padStart(6, '0')}`;
};

// Create a new employee
export const createEmployee = async (employeeData: Omit<Employee, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const userId = await generateUserId();
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO employees (
            user_id, first_name, last_name, email, mobile, password,
            role_id, date_of_birth, address, joining_date, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            userId,
            employeeData.first_name,
            employeeData.last_name,
            employeeData.email,
            employeeData.mobile,
            employeeData.password,
            employeeData.role_id,
            employeeData.date_of_birth || null,
            employeeData.address || null,
            employeeData.joining_date,
            employeeData.status || 'Active'
        ]
    );
    return { insertId: result.insertId, userId };
};

// Assign roles to an employee
export const assignRolesToEmployee = async (employeeId: number, roleIds: number[]) => {
    const values = roleIds.map(roleId => [employeeId, roleId, new Date()]);
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO employee_roles (employee_id, role_id, assigned_date)
         VALUES ?`,
        [values]
    );
    return result.affectedRows;
};

// Get employee by ID with their roles
export const getEmployeeById = async (id: number) => {
    const [employees] = await db.execute<Employee[]>(
        `SELECT e.*, 
            GROUP_CONCAT(r.name) as role_names,
            GROUP_CONCAT(er.id) as role_ids,
            GROUP_CONCAT(er.assigned_date) as role_assigned_dates,
            GROUP_CONCAT(er.status) as role_statuses
         FROM employees e
         LEFT JOIN employee_roles er ON e.id = er.employee_id
         LEFT JOIN roles r ON er.role_id = r.id
         WHERE e.id = ?
         GROUP BY e.id`,
        [id]
    );

    if (!employees[0]) return null;

    const employee = employees[0];
    
    // Format roles if they exist
    if (employee.role_names) {
        const roleNames = employee.role_names.split(',');
        const roleIds = employee.role_ids.split(',').map(Number);
        const roleDates = employee.role_assigned_dates.split(',').map((d: string) => new Date(d));
        const roleStatuses = employee.role_statuses.split(',');

        employee.roles = roleNames.map((name: string, index: number) => ({
            id: roleIds[index],
            role_name: name,
            assigned_date: roleDates[index],
            status: roleStatuses[index]
        }));
    }

    // Remove concatenated fields
    delete employee.role_names;
    delete employee.role_ids;
    delete employee.role_assigned_dates;
    delete employee.role_statuses;

    return employee;
};

// Get employee by email
export const getEmployeeByEmail = async (email: string) => {
    const [employees] = await db.execute<Employee[]>('SELECT * FROM employees WHERE email = ?', [email]);
    return employees[0];
};

// Get employee by user_id
export const getEmployeeByUserId = async (userId: string) => {
    const [employees] = await db.execute<Employee[]>('SELECT * FROM employees WHERE user_id = ?', [userId]);
    return employees[0];
};

// Update employee
export const updateEmployee = async (id: number, updates: Partial<Employee>) => {
    const allowedUpdates = [
        'first_name', 'last_name', 'email', 'mobile',
        'date_of_birth', 'address', 'status'
    ];
    
    const validUpdates = Object.entries(updates)
        .filter(([key]) => allowedUpdates.includes(key))
        .map(([key, value]) => `${key} = ?`);

    if (validUpdates.length === 0) return false;

    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE employees 
         SET ${validUpdates.join(', ')}
         WHERE id = ?`,
        [...Object.values(updates).filter((_, i) => allowedUpdates.includes(Object.keys(updates)[i])), id]
    );
    
    return result.affectedRows > 0;
};

// Get all employees with their roles
export const getAllEmployees = async () => {
    const [employees] = await db.execute<Employee[]>(
        `SELECT e.*, 
            GROUP_CONCAT(r.name) as role_names,
            GROUP_CONCAT(er.id) as role_ids,
            GROUP_CONCAT(er.assigned_date) as role_assigned_dates,
            GROUP_CONCAT(er.status) as role_statuses
         FROM employees e
         LEFT JOIN employee_roles er ON e.id = er.employee_id
         LEFT JOIN roles r ON er.role_id = r.id
         GROUP BY e.id
         ORDER BY e.created_at DESC`
    );

    return employees.map(employee => {
        if (employee.role_names) {
            const roleNames = employee.role_names.split(',');
            const roleIds = employee.role_ids.split(',').map(Number);
            const roleDates = employee.role_assigned_dates.split(',').map((d: string) => new Date(d));
            const roleStatuses = employee.role_statuses.split(',');

            employee.roles = roleNames.map((name: string, index: number) => ({
                id: roleIds[index],
                role_name: name,
                assigned_date: roleDates[index],
                status: roleStatuses[index]
            }));
        }

        delete employee.role_names;
        delete employee.role_ids;
        delete employee.role_assigned_dates;
        delete employee.role_statuses;

        return employee;
    });
};
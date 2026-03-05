import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface EmployeeSalary extends RowDataPacket {
    id: number;
    employee_id: number;
    salary: number;
    created_at: Date;
    created_by: number;
    status: number;
}

// Create a salary record for an employee
export const createSalary = async (
    employeeId: number,
    salary: number,
    createdBy: number
): Promise<number> => {
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO employee_salary (employee_id, salary, created_by, status)
         VALUES (?, ?, ?, 1)`,
        [employeeId, salary, createdBy]
    );
    return result.insertId;
};

// Get active salary for an employee
export const getActiveSalary = async (employeeId: number): Promise<EmployeeSalary | null> => {
    const [rows] = await db.execute<EmployeeSalary[]>(
        `SELECT * FROM employee_salary 
         WHERE employee_id = ? AND status = 1 
         ORDER BY created_at DESC LIMIT 1`,
        [employeeId]
    );
    return rows[0] || null;
};

// Get all salary history for an employee
export const getSalaryHistory = async (employeeId: number): Promise<EmployeeSalary[]> => {
    const [rows] = await db.execute<EmployeeSalary[]>(
        `SELECT es.*, CONCAT(e.first_name, ' ', e.last_name) as created_by_name
         FROM employee_salary es
         LEFT JOIN employees e ON es.created_by = e.id
         WHERE es.employee_id = ?
         ORDER BY es.created_at DESC`,
        [employeeId]
    );
    return rows;
};

// Update salary (deactivate old, create new)
export const updateSalary = async (
    employeeId: number,
    newSalary: number,
    createdBy: number
): Promise<number> => {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // Deactivate current active salary
        await connection.execute(
            `UPDATE employee_salary SET status = 0 
             WHERE employee_id = ? AND status = 1`,
            [employeeId]
        );

        // Create new salary record
        const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO employee_salary (employee_id, salary, created_by, status)
             VALUES (?, ?, ?, 1)`,
            [employeeId, newSalary, createdBy]
        );

        await connection.commit();
        return result.insertId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

// Deactivate salary for an employee (soft delete)
export const deactivateSalary = async (employeeId: number): Promise<boolean> => {
    const [result] = await db.execute<ResultSetHeader>(
        `UPDATE employee_salary SET status = 0 WHERE employee_id = ? AND status = 1`,
        [employeeId]
    );
    return result.affectedRows > 0;
};

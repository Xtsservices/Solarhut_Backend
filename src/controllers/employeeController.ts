import { Request, Response } from 'express';
import * as employeeQueries from '../queries/employeeQueries';
import * as permissionQueries from '../queries/permissionQueries';
import * as salaryQueries from '../queries/salaryQueries';

export const createEmployee = async (req: Request, res: Response) => {
    try {
        // Step 1: Check if email or mobile already exists
        const existingEmployee = await employeeQueries.getEmployeeByEmail(req.body.email);
        const existingMobile = await employeeQueries.getEmployeeByMobile(req.body.mobile);
        if (existingEmployee) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }
        if (existingMobile) {
            return res.status(400).json({
                success: false,
                message: 'Mobile number already registered'
            });
        }

        // Step 2: Create employee record in employees table and assign roles in employee_roles
        const { roles, salary, feature_permissions, ...employeeData } = req.body;
        const { insertId, userId } = await employeeQueries.createEmployee(employeeData);

        // Assign roles if provided
        if (Array.isArray(roles) && roles.length > 0) {
            try {
                await employeeQueries.assignRolesToEmployee(insertId, roles);
            } catch (error: any) {
                // If role assignment fails, delete the employee and throw error
                await employeeQueries.deleteEmployee(insertId);
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
        }

        // Step 3: Create permissions records in permissions table
        if (Array.isArray(feature_permissions) && feature_permissions.length > 0) {
            try {
                // Get the assigned role IDs for this employee
                const employeeRoles = await employeeQueries.getRolesByIdentifiers(roles);
                
                for (const fp of feature_permissions) {
                    const permissionsToCreate: string[] = [];
                    if (fp.read) permissionsToCreate.push('read');
                    if (fp.write) permissionsToCreate.push('create');
                    if (fp.edit) permissionsToCreate.push('edit');
                    if (fp.delete) permissionsToCreate.push('delete');

                    if (permissionsToCreate.length > 0) {
                        // Create permissions for each role assigned to the employee
                        for (const role of employeeRoles) {
                            await permissionQueries.createRoleFeaturePermissions(
                                role.role_id,
                                insertId,
                                fp.feature_id,
                                permissionsToCreate,
                                insertId
                            );
                        }
                    }
                }
            } catch (error: any) {
                console.error('Error creating feature permissions:', error);
                // Don't rollback employee creation, just log the error
            }
        }

        // Step 4: Create salary record in employee_salary table
        if (salary) {
            try {
                await salaryQueries.createSalary(insertId, salary, insertId);
            } catch (error: any) {
                console.error('Error creating salary record:', error);
                // Don't rollback employee creation, just log the error
            }
        }

        // Get complete employee data with roles
        const employee = await employeeQueries.getEmployeeById(insertId);

        // Get active salary for response
        const activeSalary = await salaryQueries.getActiveSalary(insertId);

        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            data: {
                ...employee,
                password: undefined,
                salary: activeSalary ? activeSalary.salary : null
            }
        });
    } catch (error) {
        console.error('Error creating employee:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating employee',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getAllEmployees = async (req: Request, res: Response) => {
    try {
        const employees = await employeeQueries.getAllEmployees();
        res.json({
            success: true,
            data: employees.map(emp => ({ ...emp, password: undefined }))
        });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching employees',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getEmployeeById = async (req: Request, res: Response) => {
    try {
        const employee = await employeeQueries.getEmployeeById(parseInt(req.params.id));
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const responseData = {
            ...employee,
            password: undefined
        };
        
        // Debug: Log the response data
        console.log('Employee data being sent:', JSON.stringify({
            id: responseData.id,
            joining_date: responseData.joining_date,
            roles: responseData.roles,
            role_names_display: (responseData as any).role_names_display
        }, null, 2));

        res.json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching employee',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getEmployeeByUserId = async (req: Request, res: Response) => {
    try {
        const employee = await employeeQueries.getEmployeeByUserId(req.params.userId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        res.json({
            success: true,
            data: {
                ...employee,
                password: undefined
            }
        });
    } catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching employee',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const updateEmployee = async (req: Request, res: Response) => {
    try {
        const employeeId = parseInt(req.params.id);
        const employee = await employeeQueries.getEmployeeById(employeeId);
        
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Check if email is being updated and is not already taken
        if (req.body.email && req.body.email !== employee.email) {
            const emailExists = await employeeQueries.getEmployeeByEmail(req.body.email);
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already registered'
                });
            }
        }

        // Exclude roles, salary, feature_permissions from updateData as they are handled separately
        const { roles, salary, feature_permissions, ...updateData } = req.body;

        // Update employee basic fields if any provided
        if (Object.keys(updateData).length > 0) {
            const updated = await employeeQueries.updateEmployee(employeeId, updateData);
            if (!updated) {
                // Only return error if no other fields (roles/salary/permissions) to process
                if (salary === undefined && !feature_permissions && !roles) {
                    return res.status(400).json({
                        success: false,
                        message: 'No valid fields to update'
                    });
                }
            }
        }

        // Sync roles if provided:
        // 1. Compare existing active roles with payload roles
        // 2. If same -> do nothing
        // 3. If different -> deactivate removed roles, upsert new roles as Active
        if (Array.isArray(roles) && roles.length > 0) {
            try {
                await employeeQueries.syncEmployeeRoles(employeeId, roles);
            } catch (error: any) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
        }

        // Update salary if provided
        if (salary !== undefined) {
            try {
                if (salary === null) {
                    // Deactivate salary if null is passed
                    await salaryQueries.deactivateSalary(employeeId);
                } else {
                    await salaryQueries.updateSalary(employeeId, salary, employeeId);
                }
            } catch (error: any) {
                console.error('Error updating salary:', error);
            }
        }

        // Update feature permissions if provided
        if (Array.isArray(feature_permissions)) {
            try {
                // Get the employee's current roles
                const empData = await employeeQueries.getEmployeeById(employeeId);
                const employeeRoles = empData?.roles || [];

                // Sync permissions for each role:
                // - Features in payload: upsert true permissions as Active, set false ones as Inactive
                // - Features NOT in payload but existing in DB: set to Inactive
                // - No duplicates created (uses ON DUPLICATE KEY UPDATE)
                for (const role of employeeRoles) {
                    await permissionQueries.syncEmployeePermissions(
                        employeeId,
                        role.role_id,
                        feature_permissions,
                        employeeId
                    );
                }
            } catch (error: any) {
                console.error('Error updating feature permissions:', error);
            }
        }

        const updatedEmployee = await employeeQueries.getEmployeeById(employeeId);
        const activeSalary = await salaryQueries.getActiveSalary(employeeId);

        res.json({
            success: true,
            message: 'Employee updated successfully',
            data: {
                ...updatedEmployee,
                password: undefined,
                salary: activeSalary ? activeSalary.salary : null
            }
        });
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating employee',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getEmployeesByRole = async (req: Request, res: Response) => {
    try {
        const roleId = parseInt(req.params.roleId);
        // Fallback: fetch all employees and filter by role because getEmployeesByRole is not exported
        const employees = await employeeQueries.getAllEmployees();

        const filtered = employees.filter(emp => {
            if (!Array.isArray(emp.roles)) return false;
            return emp.roles.some((r: any) => {
                // roles may be objects with role_id or plain role IDs
                if (r && typeof r === 'object') return r.role_id === roleId;
                return r === roleId;
            });
        });

        res.json({
            success: true,
            data: filtered.map(emp => ({ ...emp, password: undefined }))
        });
    } catch (error) {
        console.error('Error fetching employees by role:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching employees',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const assignRoles = async (req: Request, res: Response) => {
    try {
        const employeeId = parseInt(req.params.id);
        const employee = await employeeQueries.getEmployeeById(employeeId);
        
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const { roles } = req.body;
        if (!Array.isArray(roles) || roles.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide at least one role'
            });
        }

        const roleIds = roles.map((role: any) => role.role_id);
        if (roleIds.some((id: any) => !id || typeof id !== 'number')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role_id format'
            });
        }

        await employeeQueries.assignRolesToEmployee(employeeId, roleIds);
        const updatedEmployee = await employeeQueries.getEmployeeById(employeeId);

        res.json({
            success: true,
            message: 'Roles assigned successfully',
            data: {
                ...updatedEmployee,
                password: undefined
            }
        });
    } catch (error) {
        console.error('Error assigning roles:', error);
        res.status(500).json({
            success: false,
            message: 'Error assigning roles',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const deleteEmployee = async (req: Request, res: Response) => {
    try {
        const employeeId = parseInt(req.params.id);
        
        // Check if employee exists
        const employee = await employeeQueries.getEmployeeById(employeeId);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        // Delete employee and their role assignments
        const deleted = await employeeQueries.deleteEmployee(employeeId);

        if (!deleted) {
            return res.status(400).json({
                success: false,
                message: 'Failed to delete employee'
            });
        }

        res.json({
            success: true,
            message: 'Employee deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting employee',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};
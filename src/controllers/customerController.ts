import { Request, Response } from 'express';
import * as customerQueries from '../queries/customerQueries';
import { customerSchema, customerLocationSchema } from '../utils/validations';
import { db } from '../db';
import { PoolConnection } from 'mysql2/promise';

// Customer CRUD Operations
export const createCustomer = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        // Validate request data
        const { error, value } = customerSchema.create.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map((d: any) => d.message) 
            });
        }

        // Get user ID from token payload
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Get database connection and start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Generate customer code if not provided
            if (!value.customer_code) {
                value.customer_code = await customerQueries.generateCustomerCode(connection);
            }

            // Check if customer code already exists
            const existingCustomerByCode = await customerQueries.getCustomerByCode(value.customer_code, connection);
            if (existingCustomerByCode) {
                throw new Error('Customer code already exists. Please choose a different customer code.');
            }

            // Check if mobile already exists
            const existingCustomerByMobile = await customerQueries.getCustomerByMobile(value.mobile, connection);
            if (existingCustomerByMobile) {
                throw new Error('Mobile number already exists. Please choose a different mobile number.');
            }

            // Check if email already exists (if provided)
            if (value.email) {
                const existingCustomerByEmail = await customerQueries.getCustomerByEmail(value.email, connection);
                if (existingCustomerByEmail) {
                    throw new Error('Email already exists. Please choose a different email address.');
                }
            }

            // Create the customer
            const customerId = await customerQueries.createCustomer(value, user.id, connection);
            
            // Fetch the created customer with details
            const customer = await customerQueries.getCustomerById(customerId, connection);
            
            // Commit the transaction
            await connection.commit();

            res.status(201).json({ 
                success: true, 
                message: 'Customer created successfully', 
                data: customer,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error creating customer:', err);
        
        if (err.message.includes('already exists')) {
            return res.status(400).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error creating customer - transaction rolled back', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            transaction_status: 'rolled_back'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

export const getCustomer = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid customer id' });

        // Role-based access control
        const userRoles = user.roles || [];
        const isSuperAdmin = userRoles.includes('SuperAdmin');
        const isAdmin = userRoles.includes('Admin');
        
        // Check access for non-SuperAdmin/Admin users
        if (!isSuperAdmin && !isAdmin) {
            const hasAccess = await customerQueries.hasCustomerAccess(user.id, id);
            if (!hasAccess) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied. You can only view customers for jobs assigned to you.',
                    error_code: 'CUSTOMER_ACCESS_DENIED'
                });
            }
        }

        const customer = await customerQueries.getCustomerById(id);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        res.json({ success: true, data: customer });
    } catch (err) {
        console.error('Error fetching customer:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching customer', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const listCustomers = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const onlyActive = req.query.active !== 'false';
        
        // Role-based access control
        const userRoles = user.roles || [];
        const isSuperAdmin = userRoles.includes('SuperAdmin');
        const isAdmin = userRoles.includes('Admin');
        
        let customers;
        let accessInfo;
        
        if (isSuperAdmin || isAdmin) {
            // SuperAdmin and Admin can see all customers
            customers = await customerQueries.getAllCustomers(onlyActive);
            accessInfo = {
                role: isSuperAdmin ? 'SuperAdmin' : 'Admin',
                access_level: 'all_customers'
            };
        } else {
            // Other roles can only see customers for jobs they are assigned to
            customers = await customerQueries.getCustomersByEmployeeAssignments(user.id, onlyActive);
            accessInfo = {
                role: 'Employee',
                access_level: 'assigned_jobs_only',
                employee_id: user.id
            };
        }
        
        res.json({ 
            success: true, 
            data: customers,
            total: customers.length,
            filter: onlyActive ? 'active_only' : 'all_customers',
            access_info: accessInfo
        });
    } catch (err) {
        console.error('Error listing customers:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error listing customers', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const updateCustomer = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid customer id' });

        const { error, value } = customerSchema.update.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map((d: any) => d.message) 
            });
        }

        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if customer exists
            const existingCustomer = await customerQueries.getCustomerById(id, connection);
            if (!existingCustomer) {
                throw new Error('Customer not found');
            }

            // Role-based access control
            if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
                // Employee: check if they have access to this customer
                const hasAccess = await customerQueries.hasCustomerAccess(user.id, id, connection);
                if (!hasAccess) {
                    throw new Error('Access denied: You are not authorized to update this customer');
                }
            }

            // Check for mobile conflicts (if mobile is being updated)
            if (value.mobile && value.mobile !== existingCustomer.mobile) {
                const duplicateCustomerByMobile = await customerQueries.getCustomerByMobile(value.mobile, connection);
                if (duplicateCustomerByMobile) {
                    throw new Error('Mobile number already exists. Please choose a different mobile number.');
                }
            }

            // Check for email conflicts (if email is being updated)
            if (value.email && value.email !== existingCustomer.email) {
                const duplicateCustomerByEmail = await customerQueries.getCustomerByEmail(value.email, connection);
                if (duplicateCustomerByEmail) {
                    throw new Error('Email already exists. Please choose a different email address.');
                }
            }

            // Update the customer
            const updated = await customerQueries.updateCustomer(id, value, user.id, connection);
            if (!updated) {
                throw new Error('Failed to update customer or no changes provided');
            }

            // Fetch updated customer
            const customer = await customerQueries.getCustomerById(id, connection);
            
            await connection.commit();

            res.json({ 
                success: true, 
                message: 'Customer updated successfully', 
                data: customer,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error updating customer:', err);
        
        if (err.message.includes('not found') || err.message.includes('already exists') || err.message.includes('Failed to update')) {
            const statusCode = err.message.includes('not found') ? 404 : 400;
            return res.status(statusCode).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error updating customer - transaction rolled back', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            transaction_status: 'rolled_back'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

export const deactivateCustomer = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid customer id' });

        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if customer exists
            const existingCustomer = await customerQueries.getCustomerById(id, connection);
            if (!existingCustomer) {
                throw new Error('Customer not found');
            }

            // Role-based access control
            if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
                // Employee: check if they have access to this customer
                const hasAccess = await customerQueries.hasCustomerAccess(user.id, id, connection);
                if (!hasAccess) {
                    throw new Error('Access denied: You are not authorized to deactivate this customer');
                }
            }

            // Check if customer is already inactive
            if (existingCustomer.status === 'Inactive') {
                throw new Error('Customer is already inactive');
            }

            // Deactivate the customer
            const deactivated = await customerQueries.deactivateCustomer(id, user.id, connection);
            if (!deactivated) {
                throw new Error('Failed to deactivate customer');
            }

            // Fetch the updated customer
            const customer = await customerQueries.getCustomerById(id, connection);
            
            await connection.commit();

            res.json({ 
                success: true, 
                message: 'Customer deactivated successfully', 
                data: customer,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error deactivating customer:', err);
        
        if (err.message.includes('not found') || err.message.includes('Failed to deactivate') || err.message.includes('already inactive')) {
            const statusCode = err.message.includes('not found') ? 404 : 400;
            return res.status(statusCode).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error deactivating customer - transaction rolled back', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            transaction_status: 'rolled_back'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

export const activateCustomer = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid customer id' });

        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if customer exists
            const existingCustomer = await customerQueries.getCustomerById(id, connection);
            if (!existingCustomer) {
                throw new Error('Customer not found');
            }
            // Role-based access control
            if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
                // Employee: check if they have access to this customer
                const hasAccess = await customerQueries.hasCustomerAccess(user.id, id, connection);
                if (!hasAccess) {
                    throw new Error('Access denied: You are not authorized to deactivate this customer');
                }
            }
            // Check if customer is already active
            if (existingCustomer.status === 'Active') {
                throw new Error('Customer is already active');
            }

            // Activate the customer
            const activated = await customerQueries.activateCustomer(id, user.id, connection);
            if (!activated) {
                throw new Error('Failed to activate customer');
            }

            // Fetch the updated customer
            const customer = await customerQueries.getCustomerById(id, connection);
            
            await connection.commit();

            res.json({ 
                success: true, 
                message: 'Customer activated successfully', 
                data: customer,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error activating customer:', err);
        
        if (err.message.includes('not found') || err.message.includes('Failed to activate') || err.message.includes('already active')) {
            const statusCode = err.message.includes('not found') ? 404 : 400;
            return res.status(statusCode).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error activating customer - transaction rolled back', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            transaction_status: 'rolled_back'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

export const searchCustomers = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const searchTerm = req.query.search as string;
        if (!searchTerm) {
            return res.status(400).json({ success: false, message: 'Search term is required' });
        }

        const filters = {
            status: req.query.status as string,
            customer_type: req.query.customer_type as string,
            state_id: req.query.state_id ? parseInt(req.query.state_id as string) : undefined,
            district_id: req.query.district_id ? parseInt(req.query.district_id as string) : undefined
        };

        let customers;
        
        // Role-based access control
        if (user.roles?.includes('SuperAdmin') || user.roles?.includes('Admin')) {
            customers = await customerQueries.searchCustomers(searchTerm, filters);
        } else {
            // Employee: only see customers for jobs assigned to them
            customers = await customerQueries.searchCustomersForEmployee(user.id, searchTerm, filters);
        }
        
        res.json({ 
            success: true, 
            data: customers,
            search_term: searchTerm,
            filters_applied: Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
        });
    } catch (err) {
        console.error('Error searching customers:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error searching customers', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const getCustomersByLocation = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const state_id = req.query.state_id ? parseInt(req.query.state_id as string) : undefined;
        const district_id = req.query.district_id ? parseInt(req.query.district_id as string) : undefined;

        let customers;
        
        // Role-based access control
        if (user.roles?.includes('SuperAdmin') || user.roles?.includes('Admin')) {
            customers = await customerQueries.getCustomersByLocation(state_id, district_id);
        } else {
            // Employee: only see customers for jobs assigned to them
            customers = await customerQueries.getCustomersByLocationForEmployee(user.id, state_id, district_id);
        }
        
        res.json({ 
            success: true, 
            data: customers,
            filters: { state_id, district_id }
        });
    } catch (err) {
        console.error('Error fetching customers by location:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching customers by location', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

// Customer Location Operations
export const createCustomerLocation = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        // Validate request data
        const { error, value } = customerLocationSchema.create.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map((d: any) => d.message) 
            });
        }

        // Get user ID from token payload
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Get database connection and start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if customer exists
            const customer = await customerQueries.getCustomerById(value.customer_id, connection);
            if (!customer) {
                throw new Error('Customer not found');
            }

            const locationId = await customerQueries.createCustomerLocation(value, user.id, connection);
            
            await connection.commit();
            
            res.status(201).json({ 
                success: true, 
                message: 'Customer location created successfully',
                data: { id: locationId, ...value }
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        }
    } catch (err: any) {
        console.error('Error creating customer location:', err);
        res.status(500).json({ 
            success: false, 
            message: err.message || 'Error creating customer location'
        });
    } finally {
        if (connection) connection.release();
    }
};

export const getCustomerLocations = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const customerId = parseInt(req.params.customerId);
        
        if (isNaN(customerId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid customer ID' 
            });
        }

        // Role-based access control
        if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
            // Employee: check if they have access to this customer
            const hasAccess = await customerQueries.hasCustomerAccess(user.id, customerId);
            if (!hasAccess) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied: You are not authorized to view this customer\'s locations' 
                });
            }
        }

        const locations = await customerQueries.getCustomerLocations(customerId);
        
        res.json({ 
            success: true, 
            data: locations 
        });
    } catch (err) {
        console.error('Error fetching customer locations:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching customer locations'
        });
    }
};

export const updateCustomerLocation = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const locationId = parseInt(req.params.locationId);
        
        if (isNaN(locationId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid location ID' 
            });
        }

        // Validate request data
        const { error, value } = customerLocationSchema.update.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map((d: any) => d.message) 
            });
        }

        // Get user ID from token payload
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Get database connection and start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Get location info with customer ID
            const locationInfo = await customerQueries.getCustomerLocationById(locationId, connection);
            if (!locationInfo) {
                throw new Error('Customer location not found');
            }

            // Role-based access control
            if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
                // Employee: check if they have access to this customer
                const hasAccess = await customerQueries.hasCustomerAccess(user.id, locationInfo.customer_id, connection);
                if (!hasAccess) {
                    throw new Error('Access denied: You are not authorized to update this customer location');
                }
            }

            const updated = await customerQueries.updateCustomerLocation(locationId, value, user.id, connection);
            
            if (!updated) {
                throw new Error('Customer location not found or no changes made');
            }
            
            await connection.commit();
            
            res.json({ 
                success: true, 
                message: 'Customer location updated successfully'
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        }
    } catch (err: any) {
        console.error('Error updating customer location:', err);
        res.status(500).json({ 
            success: false, 
            message: err.message || 'Error updating customer location'
        });
    } finally {
        if (connection) connection.release();
    }
};

export const deleteCustomerLocation = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const locationId = parseInt(req.params.locationId);
        
        if (isNaN(locationId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid location ID' 
            });
        }

        // Get user ID from token payload
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Get database connection and start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Get location info with customer ID
            const locationInfo = await customerQueries.getCustomerLocationById(locationId, connection);
            if (!locationInfo) {
                throw new Error('Customer location not found');
            }

            // Role-based access control
            if (!user.roles?.includes('SuperAdmin') && !user.roles?.includes('Admin')) {
                // Employee: check if they have access to this customer
                const hasAccess = await customerQueries.hasCustomerAccess(user.id, locationInfo.customer_id, connection);
                if (!hasAccess) {
                    throw new Error('Access denied: You are not authorized to delete this customer location');
                }
            }

            const deleted = await customerQueries.deleteCustomerLocation(locationId, connection);
            
            if (!deleted) {
                throw new Error('Customer location not found');
            }
            
            await connection.commit();
            
            res.json({ 
                success: true, 
                message: 'Customer location deleted successfully'
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        }
    } catch (err: any) {
        console.error('Error deleting customer location:', err);
        res.status(500).json({ 
            success: false, 
            message: err.message || 'Error deleting customer location'
        });
    } finally {
        if (connection) connection.release();
    }
};

export default { 
    createCustomer,
    getCustomer,
    listCustomers,
    updateCustomer,
    deactivateCustomer,
    activateCustomer,
    searchCustomers,
    getCustomersByLocation,
    createCustomerLocation,
    getCustomerLocations,
    updateCustomerLocation,
    deleteCustomerLocation
};
import { Request, Response } from 'express';
import * as districtQueries from '../queries/districtQueries';
import * as stateQueries from '../queries/stateQueries';
import { districtSchema } from '../utils/validations';
import { db } from '../db';
import { PoolConnection } from 'mysql2/promise';

export const createDistrict = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        // Validate request data
        const { error, value } = districtSchema.create.validate(req.body, { abortEarly: false });
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
            // Check if state exists and is active
            const existingState = await stateQueries.getStateById(value.state_id, connection);
            if (!existingState) {
                throw new Error('State not found');
            }
            if (existingState.status !== 'Active') {
                throw new Error('Cannot create district in an inactive state. State must be active to create districts.');
            }

            // Check if district code already exists in this state
            const existingDistrictByCode = await districtQueries.getDistrictByCode(value.state_id, value.district_code, connection);
            if (existingDistrictByCode) {
                throw new Error('District code already exists in this state. Please choose a different district code.');
            }

            // Check if district name already exists in this state
            const existingDistrictByName = await districtQueries.getDistrictByName(value.state_id, value.name.toUpperCase().replace(/\s+/g, '_'), connection);
            if (existingDistrictByName) {
                throw new Error('District name already exists in this state. Please choose a different district name.');
            }

            // Set alias_name as same as input, or use original name if not provided
            const aliasName = value.alias_name || value.name;
            // Store name in uppercase with spaces replaced by underscores
            const districtName = value.name.toUpperCase().replace(/\s+/g, '_');

            // Create the district
            const id = await districtQueries.createDistrict(
                value.state_id,
                value.district_code,
                districtName,
                aliasName,
                user.id,
                value.status,
                connection
            );
            
            // Fetch the created district
            const district = await districtQueries.getDistrictById(id, connection);
            
            // Commit the transaction
            await connection.commit();

            res.status(201).json({ 
                success: true, 
                message: 'District created successfully with transaction committed', 
                data: district,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            // Rollback the transaction on any error
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error creating district:', err);
        
        // Handle specific validation errors
        if (err.message.includes('already exists') || err.message.includes('not found') || err.message.includes('inactive state')) {
            const statusCode = err.message.includes('not found') ? 404 : 400;
            return res.status(statusCode).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error creating district - transaction rolled back', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            transaction_status: 'rolled_back'
        });
    } finally {
        // Always release the connection
        if (connection) {
            connection.release();
        }
    }
};

export const editDistrict = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid district id' });

        const { error, value } = districtSchema.update.validate(req.body, { abortEarly: false });
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
            // Check if district exists
            const existingDistrict = await districtQueries.getDistrictById(id, connection);
            if (!existingDistrict) {
                throw new Error('District not found');
            }

            // If state_id is being updated, check if new state exists and is active
            if (value.state_id && value.state_id !== existingDistrict.state_id) {
                const newState = await stateQueries.getStateById(value.state_id, connection);
                if (!newState) {
                    throw new Error('New state not found');
                }
                if (newState.status !== 'Active') {
                    throw new Error('Cannot move district to an inactive state');
                }
            }

            const stateIdToCheck = value.state_id || existingDistrict.state_id;

            // Check if new district code already exists in the target state (only if code is being updated)
            if (value.district_code && (value.district_code !== existingDistrict.district_code || value.state_id)) {
                const duplicateDistrictByCode = await districtQueries.getDistrictByCode(stateIdToCheck, value.district_code, connection);
                if (duplicateDistrictByCode && duplicateDistrictByCode.id !== id) {
                    throw new Error('District code already exists in this state. Please choose a different district code.');
                }
            }

            // Check if new district name already exists in the target state (only if name is being updated)
            if (value.name && (value.name !== existingDistrict.name || value.state_id)) {
                const duplicateDistrictByName = await districtQueries.getDistrictByName(stateIdToCheck, value.name, connection);
                if (duplicateDistrictByName && duplicateDistrictByName.id !== id) {
                    throw new Error('District name already exists in this state. Please choose a different district name.');
                }
            }

            // Update the district
            const updated = await districtQueries.updateDistrict(id, value, user.id, connection);
            if (!updated) {
                throw new Error('Failed to update district or no changes provided');
            }

            // Fetch the updated district
            const district = await districtQueries.getDistrictById(id, connection);
            
            // Commit the transaction
            await connection.commit();

            res.json({ 
                success: true, 
                message: 'District updated successfully with transaction committed', 
                data: district,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            // Rollback the transaction on any error
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error updating district:', err);
        
        // Handle specific validation errors
        if (err.message.includes('not found') || err.message.includes('already exists') || err.message.includes('Failed to update') || err.message.includes('inactive state')) {
            const statusCode = err.message.includes('not found') ? 404 : 400;
            return res.status(statusCode).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error updating district - transaction rolled back', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            transaction_status: 'rolled_back'
        });
    } finally {
        // Always release the connection
        if (connection) {
            connection.release();
        }
    }
};

export const deleteDistrict = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid district id' });

        // Get user ID from token payload
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Get database connection and start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if district exists
            const existingDistrict = await districtQueries.getDistrictById(id, connection);
            if (!existingDistrict) {
                throw new Error('District not found');
            }

            // Check if district is already inactive
            if (existingDistrict.status === 'Inactive') {
                throw new Error('District is already inactive');
            }

            // Deactivate the district
            const deactivated = await districtQueries.deactivateDistrict(id, user.id, connection);
            if (!deactivated) {
                throw new Error('Failed to deactivate district');
            }

            // Fetch the updated district
            const district = await districtQueries.getDistrictById(id, connection);
            
            // Commit the transaction
            await connection.commit();

            res.json({ 
                success: true, 
                message: 'District deactivated successfully with transaction committed', 
                data: district,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            // Rollback the transaction on any error
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error deleting district:', err);
        
        // Handle specific validation errors
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
            message: 'Error deleting district - transaction rolled back', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            transaction_status: 'rolled_back'
        });
    } finally {
        // Always release the connection
        if (connection) {
            connection.release();
        }
    }
};



export const getDistrict = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid district id' });

        const district = await districtQueries.getDistrictById(id);
        if (!district) {
            return res.status(404).json({ success: false, message: 'District not found' });
        }

        res.json({ success: true, data: district });
    } catch (err) {
        console.error('Error fetching district:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching district', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const listDistricts = async (req: Request, res: Response) => {
    try {
        // Default to active districts only, unless explicitly requested otherwise
        const onlyActive = req.query.active !== 'false'; // Will be true by default
        const districts = await districtQueries.getAllDistricts(onlyActive);
        if (!districts || districts.length === 0) {
            const message = onlyActive ? 'No active districts found' : 'No districts found';
            return res.status(404).json({ success: false, message });
        }
        res.json({ 
            success: true, 
            data: districts,
            filter: onlyActive ? 'active_only' : 'all_districts'
        });
    } catch (err) {
        console.error('Error listing districts:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error listing districts', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};






export default { 
    createDistrict, 
    editDistrict, 
    deleteDistrict, 
    getDistrict, 
    listDistricts,
    
};

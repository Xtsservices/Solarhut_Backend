import { Request, Response } from 'express';
import * as stateQueries from '../queries/stateQueries';
import * as countryQueries from '../queries/countryQueries';
import { stateSchema } from '../utils/validations';
import { db } from '../db';
import { PoolConnection } from 'mysql2/promise';



export const createState = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        // Validate request data
        const { error, value } = stateSchema.create.validate(req.body, { abortEarly: false });
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
            // Check if country exists and is active
            const existingCountry = await countryQueries.getCountryById(value.country_id, connection);
            if (!existingCountry) {
                throw new Error('Country not found');
            }
            if (existingCountry.status !== 'Active') {
                throw new Error('Cannot create state in an inactive country. Country must be active to create states.');
            }

            // Check if state code already exists in this country
            const existingStateByCode = await stateQueries.getStateByCode(value.country_id, value.state_code, connection);
            if (existingStateByCode) {
                throw new Error('State code already exists in this country. Please choose a different state code.');
            }

            // Check if state name already exists in this country
            const existingStateByName = await stateQueries.getStateByName(value.country_id, value.name.toUpperCase().replace(/\s+/g, '_'), connection);
            if (existingStateByName) {
                throw new Error('State name already exists in this country. Please choose a different state name.');
            }

            // Set alias_name as same as input, or use original name if not provided
            const aliasName = value.alias_name || value.name;
            // Store name in uppercase with spaces replaced by underscores
            const stateName = value.name.toUpperCase().replace(/\s+/g, '_');

            // Create the state
            const id = await stateQueries.createState(
                value.country_id,
                value.state_code,
                stateName,
                aliasName,
                value.type,
                user.id,
                value.status,
                connection
            );
            
            // Fetch the created state
            const state = await stateQueries.getStateById(id, connection);
            
            // Commit the transaction
            await connection.commit();

            res.status(201).json({ 
                success: true, 
                message: 'State created successfully with transaction committed', 
                data: state,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            // Rollback the transaction on any error
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error creating state:', err);
        
        // Handle specific validation errors
        if (err.message.includes('already exists') || err.message.includes('not found') || err.message.includes('inactive country')) {
            const statusCode = err.message.includes('not found') ? 404 : 400;
            return res.status(statusCode).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error creating state - transaction rolled back', 
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

export const editState = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid state id' });

        const { error, value } = stateSchema.update.validate(req.body, { abortEarly: false });
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
            // Check if state exists
            const existingState = await stateQueries.getStateById(id, connection);
            if (!existingState) {
                throw new Error('State not found');
            }

            // If country_id is being updated, check if new country exists and is active
            if (value.country_id && value.country_id !== existingState.country_id) {
                const newCountry = await countryQueries.getCountryById(value.country_id, connection);
                if (!newCountry) {
                    throw new Error('New country not found');
                }
                if (newCountry.status === 'Inactive') {
                    throw new Error('Cannot move state to an inactive country');
                }
            }

            const countryIdToCheck = value.country_id || existingState.country_id;

            // Check if new state code already exists in the target country (only if code is being updated)
            if (value.state_code && (value.state_code !== existingState.state_code || value.country_id)) {
                const duplicateStateByCode = await stateQueries.getStateByCode(countryIdToCheck, value.state_code, connection);
                if (duplicateStateByCode && duplicateStateByCode.id !== id) {
                    throw new Error('State code already exists in this country. Please choose a different state code.');
                }
            }

            // Check if new state name already exists in the target country (only if name is being updated)
            if (value.name && (value.name !== existingState.name || value.country_id)) {
                const duplicateStateByName = await stateQueries.getStateByName(countryIdToCheck, value.name, connection);
                if (duplicateStateByName && duplicateStateByName.id !== id) {
                    throw new Error('State name already exists in this country. Please choose a different state name.');
                }
            }

            // Update the state
            const updated = await stateQueries.updateState(id, value, user.id, connection);
            if (!updated) {
                throw new Error('Failed to update state or no changes provided');
            }

            // Fetch the updated state
            const state = await stateQueries.getStateById(id, connection);
            
            // Commit the transaction
            await connection.commit();

            res.json({ 
                success: true, 
                message: 'State updated successfully with transaction committed', 
                data: state,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            // Rollback the transaction on any error
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error updating state:', err);
        
        // Handle specific validation errors
        if (err.message.includes('not found') || err.message.includes('already exists') || err.message.includes('Failed to update') || err.message.includes('inactive country')) {
            const statusCode = err.message.includes('not found') ? 404 : 400;
            return res.status(statusCode).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error updating state - transaction rolled back', 
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

export const deleteState = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid state id' });

        // Get user ID from token payload
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Get database connection and start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if state exists
            const existingState = await stateQueries.getStateById(id, connection);
            if (!existingState) {
                throw new Error('State not found');
            }

            // Check if state is already inactive
            if (existingState.status === 'Inactive') {
                throw new Error('State is already inactive');
            }

            // Deactivate the state
            const deactivated = await stateQueries.deactivateState(id, user.id, connection);
            if (!deactivated) {
                throw new Error('Failed to deactivate state');
            }

            // Fetch the updated state
            const state = await stateQueries.getStateById(id, connection);
            
            // Commit the transaction
            await connection.commit();

            res.json({ 
                success: true, 
                message: 'State deactivated successfully with transaction committed', 
                data: state,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            // Rollback the transaction on any error
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error deleting state:', err);
        
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
            message: 'Error deleting state - transaction rolled back', 
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

export const getState = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid state id' });

        const state = await stateQueries.getStateById(id);
        if (!state) {
            return res.status(404).json({ success: false, message: 'State not found' });
        }

        res.json({ success: true, data: state });
    } catch (err) {
        console.error('Error fetching state:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching state', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const listStates = async (req: Request, res: Response) => {
    try {
        const onlyActive = req.query.active === 'true';
        const states = await stateQueries.getAllStates(onlyActive);
        res.json({ success: true, data: states });
    } catch (err) {
        console.error('Error listing states:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error listing states', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};






export default { 
    createState, 
    editState, 
    deleteState, 
    getState,
    listStates,
    
};

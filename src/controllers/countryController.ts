import { Request, Response } from 'express';
import * as countryQueries from '../queries/countryQueries';
import { countrySchema } from '../utils/validations';
import { db } from '../db';
import { PoolConnection } from 'mysql2/promise';


export const createCountry = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        // Validate request data
        const { error, value } = countrySchema.create.validate(req.body, { abortEarly: false });
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
            // Check if country code already exists
            const existingCountryByCode = await countryQueries.getCountryByCode(value.country_code, connection);
            if (existingCountryByCode) {
                throw new Error('Country code already exists. Please choose a different country code.');
            }

            // Check if country name already exists (check against uppercase)
            const existingCountryByName = await countryQueries.getCountryByName(value.name.toUpperCase(), connection);
            if (existingCountryByName) {
                throw new Error('Country name already exists. Please choose a different country name.');
            }

            // Set alias_name as same as input, or use original name if not provided
            const aliasName = value.alias_name || value.name;
            // Store name in uppercase
            const countryName = value.name.toUpperCase();
            
            // Create the country
            const id = await countryQueries.createCountry(
                value.country_code,
                countryName,
                aliasName,
                value.currency_format,
                user.id,
                value.status,
                connection
            );
            
            // Fetch the created country
            const country = await countryQueries.getCountryById(id, connection);
            
            // Commit the transaction
            await connection.commit();

            res.status(200).json({ 
                success: true, 
                message: 'Country created successfully with transaction committed', 
                data: country,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            // Rollback the transaction on any error
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error creating country:', err);
        
        // Handle specific validation errors
        if (err.message.includes('already exists')) {
            return res.status(400).json({ 
                success: false, 
                message: err.message,
                transaction_status: 'rolled_back'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Error creating country - transaction rolled back', 
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

export const editCountry = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid country id' });

        const { error, value } = countrySchema.update.validate(req.body, { abortEarly: false });
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
            // Check if country exists
            const existingCountry = await countryQueries.getCountryById(id, connection);
            if (!existingCountry) {
                throw new Error('Country not found');
            }

            // Check if new country code already exists (only if code is being updated)
            if (value.country_code && value.country_code !== existingCountry.country_code) {
                const duplicateCountryByCode = await countryQueries.getCountryByCode(value.country_code, connection);
                if (duplicateCountryByCode) {
                    throw new Error('Country code already exists. Please choose a different country code.');
                }
            }

            // Check if new country name already exists (only if name is being updated)
            // Convert to uppercase to match database storage format
            if (value.name && value.name.toUpperCase() !== existingCountry.name) {
                const duplicateCountryByName = await countryQueries.getCountryByName(value.name.toUpperCase(), connection);
                if (duplicateCountryByName) {
                    throw new Error('Country name already exists. Please choose a different country name.');
                }
            }

            // Convert name to uppercase before updating if provided
            if (value.name) {
                value.name = value.name.toUpperCase();
            }

            // Update the country
            const updated = await countryQueries.updateCountry(id, value, user.id, connection);
            if (!updated) {
                throw new Error('Failed to update country or no changes provided');
            }

            // Fetch the updated country
            const country = await countryQueries.getCountryById(id, connection);
            
            // Commit the transaction
            await connection.commit();

            res.json({ 
                success: true, 
                message: 'Country updated successfully with transaction committed', 
                data: country,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            // Rollback the transaction on any error
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error updating country:', err);
        
        // Handle specific validation errors
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
            message: 'Error updating country - transaction rolled back', 
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

export const deleteCountry = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid country id' });

        // Get user ID from token payload
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Get database connection and start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if country exists
            const existingCountry = await countryQueries.getCountryById(id, connection);
            if (!existingCountry) {
                throw new Error('Country not found');
            }

            // Check if country is already inactive
            if (existingCountry.status === 'Inactive') {
                throw new Error('Country is already inactive');
            }

            // Deactivate the country
            const deactivated = await countryQueries.deactivateCountry(id, user.id, connection);
            if (!deactivated) {
                throw new Error('Failed to deactivate country');
            }

            // Fetch the updated country
            const country = await countryQueries.getCountryById(id, connection);
            
            // Commit the transaction
            await connection.commit();

            res.json({ 
                success: true, 
                message: 'Country deactivated successfully with transaction committed', 
                data: country,
                transaction_status: 'committed'
            });

        } catch (transactionError) {
            // Rollback the transaction on any error
            await connection.rollback();
            throw transactionError;
        }

    } catch (err: any) {
        console.error('Error deleting country:', err);
        
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
            message: 'Error deleting country - transaction rolled back', 
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

export const getCountry = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid country id' });

        const country = await countryQueries.getCountryById(id);
        if (!country) return res.status(404).json({ success: false, message: 'Country not found' });

        res.json({ success: true, data: country });
    } catch (err) {
        console.error('Error fetching country:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching country', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};



export const listCountries = async (req: Request, res: Response) => {
    try {
        // Default to active countries only, unless explicitly requested otherwise
        const onlyActive = req.query.active !== 'false'; // Will be true by default
        const countries = await countryQueries.getAllCountries(onlyActive);
        if (!countries || countries.length === 0) {
            const message = onlyActive ? 'No active countries found' : 'No countries found';
            return res.status(404).json({ success: false, message });
        }
        res.json({ 
            success: true, 
            data: countries,
            filter: onlyActive ? 'active_only' : 'all_countries'
        });
    } catch (err) {
        console.error('Error listing countries:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error listing countries', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};






export default { 
    createCountry, 
    editCountry, 
    deleteCountry, 
    getCountry, 
    listCountries,
   
};

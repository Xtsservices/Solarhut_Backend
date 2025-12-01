import { Request, Response } from 'express';
import * as contactQueries from '../queries/contactQueries';

export const createContact = async (req: Request, res: Response) => {
    try {
        const contactId = await contactQueries.createContact(req.body);
        const contact = await contactQueries.getContactById(contactId);
        
        res.status(201).json({
            success: true,
            message: 'Contact request submitted successfully',
            data: contact
        });
    } catch (error) {
        console.error('Error creating contact:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting contact request',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getAllContacts = async (req: Request, res: Response) => {
    try {
        const { status, reason } = req.query;
        const filters: any = {};
        
        if (status && typeof status === 'string') {
            filters.status = status;
        }
        
        if (reason && typeof reason === 'string') {
            filters.reason = reason;
        }
        
        const contacts = await contactQueries.getAllContacts(filters);
        res.json({
            success: true,
            data: contacts
        });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching contacts',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getContactById = async (req: Request, res: Response) => {
    try {
        const contact = await contactQueries.getContactById(parseInt(req.params.id));
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }
        res.json({
            success: true,
            data: contact
        });
    } catch (error) {
        console.error('Error fetching contact:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching contact',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getContactsByReason = async (req: Request, res: Response) => {
    try {
        const { reason } = req.params;
        const contacts = await contactQueries.getContactsByReason(reason);
        res.json({
            success: true,
            data: contacts
        });
    } catch (error) {
        console.error('Error fetching contacts by reason:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching contacts',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const updateContact = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const { full_name, email, mobile, reason, message, status } = req.body;
        
        // Validate contact ID
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Valid contact ID is required'
            });
        }

        // Check if contact exists
        const existingContact = await contactQueries.getContactById(id);
        if (!existingContact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        // Validate inputs
        const updates: any = {};
        if (full_name !== undefined) {
            if (!full_name || typeof full_name !== 'string' || full_name.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Full name must be a non-empty string'
                });
            }
            updates.full_name = full_name.trim();
        }

        if (email !== undefined) {
            if (!email || typeof email !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Valid email is required'
                });
            }
            updates.email = email.trim();
        }

        if (mobile !== undefined) {
            if (!mobile || typeof mobile !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Valid mobile number is required'
                });
            }
            updates.mobile = mobile.trim();
        }

        if (reason !== undefined) {
            if (!reason || typeof reason !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Valid reason is required'
                });
            }
            updates.reason = reason.trim();
        }

        if (message !== undefined) {
            updates.message = message;
        }

        if (status !== undefined) {
            if (!['New', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Status must be one of: New, In Progress, Resolved, Closed'
                });
            }
            updates.status = status;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        const updated = await contactQueries.updateContact(id, updates);
        if (!updated) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update contact'
            });
        }

        const updatedContact = await contactQueries.getContactById(id);
        res.json({
            success: true,
            message: 'Contact updated successfully',
            data: updatedContact
        });
    } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating contact',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const deleteContact = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        
        // Check if contact exists
        const contact = await contactQueries.getContactById(id);
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        // Delete the contact
        const deleted = await contactQueries.deleteContact(id);
        if (deleted) {
            res.json({
                success: true,
                message: 'Contact deleted successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to delete contact'
            });
        }
    } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting contact',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};
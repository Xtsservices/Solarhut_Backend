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
        const contacts = await contactQueries.getAllContacts();
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
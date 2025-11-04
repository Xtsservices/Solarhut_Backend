import express from 'express';
import { createContact, getAllContacts, getContactById, getContactsByReason, deleteContact } from '../controllers/contactController';
import { validateRequest } from '../middleware/validateRequest';
import { contactSchema } from '../utils/validations';

const router = express.Router();

// @route   POST /api/contacts
// @desc    Submit a new contact request
// @access  Public
router.post('/',  createContact);

// @route   GET /api/contacts
// @desc    Get all contacts
// @access  Private (TODO: Add authentication)
router.get('/', getAllContacts);

// @route   GET /api/contacts/:id
// @desc    Get contact by ID
// @access  Private (TODO: Add authentication)
router.get('/:id', getContactById);

// @route   GET /api/contacts/reason/:reason
// @desc    Get contacts by reason
// @access  Private (TODO: Add authentication)
router.get('/reason/:reason', getContactsByReason);

// @route   DELETE /api/contacts/:id
// @desc    Delete a contact
// @access  Private (TODO: Add authentication)
router.delete('/:id', deleteContact);

export default router;
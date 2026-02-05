import express from 'express';
import bankDetailsController from '../controllers/bankDetailsController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { bankDetailsSchema } from '../utils/validations';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Bank Details CRUD Operations

// Create a new bank detail with optional QR code upload
router.post('/create', 
    bankDetailsController.uploadMiddleware, // Handle file upload first
    validateRequest(bankDetailsSchema.create), // Then validate the form data
    bankDetailsController.createBankDetail
);

// Get all bank details with optional active filter
router.get('/all', bankDetailsController.getAllBankDetails);

// Get the active bank detail
router.get('/active', bankDetailsController.getActiveBankDetail);

// Get a specific bank detail by ID
router.get('/:id', bankDetailsController.getBankDetailById);

// Update a bank detail with optional QR code upload
router.put('/:id', 
    bankDetailsController.uploadMiddleware, // Handle file upload first
    validateRequest(bankDetailsSchema.update), // Then validate the form data
    bankDetailsController.updateBankDetail
);

// Soft delete a bank detail (set status to Inactive)
router.delete('/:id', bankDetailsController.deleteBankDetail);

// Delete the QR code reference for a specific bank detail (file preserved in S3)
router.delete('/:id/qr-code', bankDetailsController.deleteQRCode);

export default router;
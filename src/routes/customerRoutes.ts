import express from 'express';
import customerController from '../controllers/customerController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { customerSchema, customerLocationSchema } from '../utils/validations';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Customer CRUD Operations
// Create a new customer
router.post('/create', validateRequest(customerSchema.create), customerController.createCustomer);

// Get all customers with optional active filter
router.get('/allCustomers', customerController.listCustomers);

// Get a specific customer by ID
router.get('/:id', customerController.getCustomer);

// Update a customer
router.put('/:id', validateRequest(customerSchema.update), customerController.updateCustomer);

// Deactivate a customer
router.delete('/:id', customerController.deactivateCustomer);

// Activate a customer
router.patch('/:id/activate', customerController.activateCustomer);

// Search customers with filters
router.get('/search/query', customerController.searchCustomers);

// Get customers by location
router.get('/location/filter', customerController.getCustomersByLocation);

// Customer Location Operations
// Create a new customer location
router.post('/locations', validateRequest(customerLocationSchema.create), customerController.createCustomerLocation);

// Get all locations for a specific customer
router.get('/:customerId/locations', customerController.getCustomerLocations);

// Update a customer location
router.put('/locations/:locationId', validateRequest(customerLocationSchema.update), customerController.updateCustomerLocation);

// Delete a customer location
router.delete('/locations/:locationId', customerController.deleteCustomerLocation);

export default router;

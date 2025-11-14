import express from 'express';
import jobController from '../controllers/jobController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { jobSchema, jobLocationSchema, jobAssignmentSchema, jobStatusTrackingSchema, jobPaymentSchema } from '../utils/validations';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Job CRUD Operations
// Create a new job
router.post('/create', authenticate, jobController.createJob);

// Get all jobs with optional active filter
router.get('/allJobs', jobController.listJobs);

// Get all jobs with comprehensive details (customer, location, payments, status history, assignments)
router.get('/allJobsDetailed', jobController.listJobsWithDetails);

// Get a specific job by ID with all related data
router.get('/:id', jobController.getJob);

// Update a job
router.put('/:id', validateRequest(jobSchema.update), jobController.updateJob);

// Search jobs with filters
router.get('/search/query', jobController.searchJobs);

// Get jobs assigned to a specific employee
router.get('/employee/:employeeId', jobController.getJobsByEmployee);

// Job Status Operations
// Update job status with tracking
router.patch('/:id/status', validateRequest(jobStatusTrackingSchema.create), jobController.updateJobStatus);

// Job Location Operations
// Add location details to a job
router.post('/location/create', validateRequest(jobLocationSchema.create), jobController.createJobLocation);

// Job Assignment Operations
// Assign employee to a job
router.post('/assignment/create', validateRequest(jobAssignmentSchema.create), jobController.createJobAssignment);

// Job Payment Operations
// Add payment record to a job
router.post('/payment/create', validateRequest(jobPaymentSchema.create), jobController.createJobPayment);

export default router;

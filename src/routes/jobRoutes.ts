import express from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import jobController from '../controllers/jobController';
import { authenticate, authorizeRoles } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { normalizeFormDataAttachments, logAttachmentsBeforeController } from '../middleware/normalizeFormData';
import { jobSchema, jobLocationSchema, jobAssignmentSchema, jobStatusTrackingSchema, jobPaymentSchema } from '../utils/validations';

const router = express.Router();

// Configure multer for file uploads with custom storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create upload directory for job-specific files
        const jobId = req.params.id || 'temp';
        const uploadDir = path.join(process.cwd(), 'uploads', 'jobs', jobId);
        
        // Create directory if it doesn't exist
        fs.mkdirSync(uploadDir, { recursive: true });
        
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        const filename = `${timestamp}-${randomString}-${name}${ext}`;
        cb(null, filename);
    }
});

const uploads = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max file size
    },
    fileFilter: (req, file, cb) => {
        // Allow common file types for job attachments
        const allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/quicktime', 'video/x-msvideo',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} not allowed`));
        }
    }
});

// All routes require authentication
router.use(authenticate);

// Lead to Job Conversion (SuperAdmin/Admin only)
// Convert lead to job and create customer
router.post('/convert-from-lead/:leadId', authorizeRoles(['SuperAdmin', 'Admin']), jobController.convertLeadToJob);

// Job CRUD Operations (SuperAdmin/Admin can access all, employees can only access assigned jobs)
// Create a new job (SuperAdmin/Admin only)
router.post('/create', authorizeRoles(['SuperAdmin', 'Admin']), jobController.createJob);

// Get all jobs with optional active filter (SuperAdmin sees all, Admin/employees see assigned)
router.get('/allJobs', jobController.listJobs);

// Get job counts and statistics (SuperAdmin sees all, Admin/employees see assigned)
router.get('/counts', jobController.getJobsCounts);

// Get a specific job by ID (SuperAdmin sees all, Admin/employees see assigned)
router.get('/getjob/:id', jobController.getJob);

// Update a job (SuperAdmin/Admin only)
router.put('/:id', authorizeRoles(['SuperAdmin', 'Admin']), validateRequest(jobSchema.update), jobController.updateJob);

// Search jobs with filters (SuperAdmin sees all, Admin/employees see assigned)
router.get('/search/query', jobController.searchJobs);

// Get jobs assigned to a specific employee (SuperAdmin sees all, others see own)
router.get('/employee/:employeeId', jobController.getJobsByEmployee);

// Job Status Operations
// Update job status with tracking (SuperAdmin can update any, assigned employee can update their own)
router.put('/:id/status', uploads.array('attachments', 10), normalizeFormDataAttachments, logAttachmentsBeforeController, validateRequest(jobStatusTrackingSchema.update), jobController.updateJobStatus);

// Job Location Operations (SuperAdmin/Admin only)
// Add location details to a job
router.post('/location/create', authorizeRoles(['SuperAdmin', 'Admin']), validateRequest(jobLocationSchema.create), jobController.createJobLocation);

// Job Assignment Operations (SuperAdmin/Admin only)
// Assign employee to a job - using route parameter
router.post('/:id/assign', authorizeRoles(['SuperAdmin', 'Admin']), jobController.assignJobToEmployee);

// Assign employee to a job - using request body
router.post('/assignment/create', authorizeRoles(['SuperAdmin', 'Admin']), validateRequest(jobAssignmentSchema.create), jobController.createJobAssignment);

// Job Payment Operations (SuperAdmin/Admin only)
// Add payment record to a job
router.post('/payment/create', authorizeRoles(['SuperAdmin', 'Admin']), validateRequest(jobPaymentSchema.create), jobController.createJobPayment);

// Get all payments for a specific job (accessible to assigned employee and monitoring users)
router.get('/:jobId/payments', jobController.getJobPayments);

// Job Monitoring Operations (SuperAdmin only)
// Grant monitoring access to admin for a specific job
router.post('/:jobId/monitoring/grant', authorizeRoles(['SuperAdmin']), jobController.grantJobMonitoringAccess);

// Revoke monitoring access from admin for a specific job  
router.delete('/:jobId/monitoring/:employeeId', authorizeRoles(['SuperAdmin']), jobController.revokeJobMonitoringAccess);

// My Tasks endpoints for 3-tab structure
// Get leads for My Tasks - Leads tab (SuperAdmin/Admin only)
router.get('/my-tasks/leads', jobController.getMyLeads);

// Get active jobs for My Tasks - Jobs tab (role-based access)
router.get('/my-tasks/active', jobController.getMyActiveJobs);

// Get completed jobs for My Tasks - Jobs Done tab (role-based access)  
router.get('/my-tasks/completed', jobController.getMyCompletedJobs);

// Job Notes Operations
// Add a note to a job (accessible to assigned employees and SuperAdmin)
router.post('/:jobId/notes/add', jobController.addJobNote);

// Get all notes for a job (accessible to assigned employees and SuperAdmin)
router.get('/:jobId/notes', jobController.getJobNotes);

// Job Attachments Operations  
// Get all attachments for a job grouped by status (accessible to assigned employees and SuperAdmin)
router.get('/:jobId/attachments', jobController.getJobAttachments);

// GET attachments for a specific status update (accessible to assigned employees and SuperAdmin)
router.get('/status/:statusTrackingId/attachments', jobController.getStatusAttachments);

// FIX: Manual job assignment endpoint for jobs created without assignments (SuperAdmin only)
router.post('/fix/assignment', authorizeRoles(['SuperAdmin']), jobController.fixJobAssignment);

// DEBUG: Diagnostic endpoint to check job availability
router.get('/debug/employee-jobs', jobController.debugEmployeeJobs);

// Comprehensive Status History Endpoints
// Get complete job details with full status history, notes, and attachments with signed URLs
router.get('/:id/complete-details', jobController.getJobWithCompleteStatusHistory);

// Get only the status history with full details (notes, attachments, who changed status, when)
router.get('/:id/status-history-details', jobController.getJobStatusHistoryDetails);

// Get all attachments across all status changes with signed URLs
router.get('/:id/all-attachments', jobController.getJobCompleteAttachments);

export default router;
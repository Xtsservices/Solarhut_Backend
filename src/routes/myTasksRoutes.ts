import express from 'express';
import myTasksController from '../controllers/myTasksController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// My Tasks Overview
// Get all my tasks (leads + jobs) categorized by status
router.get('/overview', authenticate, myTasksController.getMyTasks);

// Get dashboard summary with counts only

// My Leads Routes
// Get all my leads with pagination and filters
router.get('/myLeads', authenticate, myTasksController.getMyAllLeads);

// Get my ongoing leads (In Progress, Follow Up status)

// Get my closed leads (Converted, Closed, Lost status)

// My Jobs Routes
// Get all my jobs with pagination and filters
router.get('/myJobs', authenticate, myTasksController.getMyAllJobs);

// Get my ongoing jobs (In Progress, On Hold status)

// Get my closed jobs (Completed, Cancelled status)

export default router;

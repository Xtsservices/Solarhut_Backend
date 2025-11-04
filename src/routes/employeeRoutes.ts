import express from 'express';
import {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    getEmployeeByUserId,
    updateEmployee
} from '../controllers/employeeController';
import { validateRequest } from '../middleware/validateRequest';
import { employeeSchema } from '../utils/validations';

const router = express.Router();

// @route   POST /api/employees
// @desc    Create a new employee
// @access  Private (Admin only)
router.post('/', validateRequest(employeeSchema.create), createEmployee);

// @route   GET /api/employees
// @desc    Get all employees
// @access  Private (Admin only)
router.get('/', getAllEmployees);

// @route   GET /api/employees/:id
// @desc    Get employee by ID
// @access  Private (Admin only)
router.get('/:id', getEmployeeById);

// @route   GET /api/employees/user/:userId
// @desc    Get employee by user ID
// @access  Private (Admin only)
router.get('/user/:userId', getEmployeeByUserId);

// @route   PUT /api/employees/:id
// @desc    Update employee details
// @access  Private (Admin only)
router.put('/:id', validateRequest(employeeSchema.update), updateEmployee);

export default router;
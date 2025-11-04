import express from 'express';
import {
    createEmployee,
    getAllEmployees,
    getEmployeeById,
    getEmployeeByUserId,
    updateEmployee,
    getEmployeesByRole,
    assignRoles
} from '../controllers/employeeController';
import { validateRequest } from '../middleware/validateRequest';
import { employeeSchema } from '../utils/validations';

const router = express.Router();

// @route   POST /api/employees
// @desc    Create a new employee with roles
// @access  Private (Admin only)
router.post('/', validateRequest(employeeSchema.create), createEmployee);

// @route   GET /api/employees
// @desc    Get all employees with their roles
// @access  Private (Admin only)
router.get('/', getAllEmployees);

// @route   GET /api/employees/role/:roleId
// @desc    Get employees by role
// @access  Private (Admin only)
router.get('/role/:roleId', getEmployeesByRole);

// @route   GET /api/employees/:id
// @desc    Get employee by ID with their roles
// @access  Private (Admin only)
router.get('/:id', getEmployeeById);

// @route   GET /api/employees/user/:userId
// @desc    Get employee by user ID with their roles
// @access  Private (Admin only)
router.get('/user/:userId', getEmployeeByUserId);

// @route   PUT /api/employees/:id
// @desc    Update employee details and roles
// @access  Private (Admin only)
router.put('/:id', validateRequest(employeeSchema.update), updateEmployee);

// @route   POST /api/employees/:id/roles
// @desc    Assign roles to an employee
// @access  Private (Admin only)
router.post('/:id/roles', validateRequest(employeeSchema.assignRoles), assignRoles);

export default router;
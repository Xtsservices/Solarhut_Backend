import { Request, Response } from 'express';
import * as estimationQueries from '../queries/estimationQueries';
 // Import PDF generator and employee queries
        const { generateEstimationPDF } = require('../utils/pdfgenerate');
        const employeeQueries = require('../queries/employeeQueries');
import { estimationSchema } from '../utils/validations';

export const createEstimation = async (req: Request, res: Response) => {
    try {
        // Public endpoint - created_by is optional (customer submissions)
        const userId = res.locals?.user?.id;

        // Validate request body
        const { error, value } = estimationSchema.validate({
            ...req.body,
            created_by: userId || null
        }, { abortEarly: false });

        if (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.details.map((d) => d.message)
            });
        }

        const estimationId = await estimationQueries.createEstimation(value);
        const estimation = await estimationQueries.getEstimationById(estimationId);

        res.status(201).json({
            success: true,
            message: 'Estimation created successfully',
            data: estimation
        });
    } catch (error: any) {
        console.error('Error creating estimation:', error);

        res.status(500).json({
            success: false,
            message: 'Error creating estimation',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const getAllEstimations = async (req: Request, res: Response) => {
    try {
        const { status, state, district } = req.query;
        const filters: any = {};
        
        if (status && typeof status === 'string') {
            filters.status = status;
        }
        
        if (state && typeof state === 'string') {
            filters.state = state;
        }
        
        if (district && typeof district === 'string') {
            filters.district = district;
        }
        
        const estimations = await estimationQueries.getAllEstimations(filters);
        res.json({
            success: true,
            count: estimations.length,
            data: estimations
        });
    } catch (error) {
        console.error('Error fetching estimations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching estimations',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getEstimationById = async (req: Request, res: Response) => {
    try {
        const estimation = await estimationQueries.getEstimationById(parseInt(req.params.id));
        if (!estimation) {
            return res.status(404).json({
                success: false,
                message: 'Estimation not found'
            });
        }
        res.json({
            success: true,
            data: estimation
        });
    } catch (error) {
        console.error('Error fetching estimation:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching estimation',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getEstimationsByMobile = async (req: Request, res: Response) => {
    try {
        const { mobile } = req.params;
        const estimations = await estimationQueries.getEstimationsByMobile(mobile);
        res.json({
            success: true,
            count: estimations.length,
            data: estimations
        });
    } catch (error) {
        console.error('Error fetching estimations by mobile:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching estimations',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const updateEstimation = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const user = (res.locals as any).user;
        const updatedBy = user?.employee_id || req.body.updated_by || null;
        
        const updated = await estimationQueries.updateEstimation(id, req.body, updatedBy);
        
        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Estimation not found'
            });
        }
        
        const estimation = await estimationQueries.getEstimationById(id);
        res.json({
            success: true,
            message: 'Estimation updated successfully',
            data: estimation
        });
    } catch (error) {
        console.error('Error updating estimation:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating estimation',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const deleteEstimation = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const deleted = await estimationQueries.deleteEstimation(id);
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Estimation not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Estimation deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting estimation:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting estimation',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};



export const downloadEstimationPDF = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const estimation = await estimationQueries.getEstimationById(id);
        
        if (!estimation) {
            return res.status(404).json({
                success: false,
                message: 'Estimation not found'
            });
        }

       
        
        // Fetch employee data if created_by exists
        let employee: any = null;
        if (estimation.created_by) {
            employee = await employeeQueries.getEmployeeById(estimation.created_by);
        }
        
      
        // Generate PDF with employee data
        const doc = generateEstimationPDF(estimation, employee);
        
        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=estimation-${estimation.id}.pdf`);
        
        // Pipe the PDF to response
        doc.pipe(res);
        doc.end();
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating PDF',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};


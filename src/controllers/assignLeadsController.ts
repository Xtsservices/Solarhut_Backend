import { Request, Response } from 'express';
import * as leadQueries from '../queries/leadQueries';
import * as employeeQueries from '../queries/employeeQueries';
import { notifyAssignment } from '../utils/notification';

// Create an assignment: assign a lead to an employee
export const createAssignment = async (req: Request, res: Response) => {
    try {
        const { leadId, employeeId } = req.body;

        if (!leadId || typeof leadId !== 'number') {
            return res.status(400).json({ success: false, message: 'leadId is required and must be a number' });
        }
        if (!employeeId || typeof employeeId !== 'number') {
            return res.status(400).json({ success: false, message: 'employeeId is required and must be a number' });
        }

        const lead = await leadQueries.getLeadById(leadId);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

        const employee = await employeeQueries.getEmployeeById(employeeId);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

        const updated = await leadQueries.assignLeadToEmployee(leadId, employeeId);
        if (!updated) return res.status(400).json({ success: false, message: 'Failed to assign lead' });

        const updatedLead = await leadQueries.getLeadById(leadId);

        // Send notification (best-effort)
        try {
            await notifyAssignment(employee.mobile, employee.email, leadId);
        } catch (e) {
            console.error('Assignment notification failed:', e);
        }

        return res.json({ success: true, message: 'Lead assigned', data: updatedLead });
    } catch (error) {
        console.error('Error creating assignment:', error);
        return res.status(500).json({ success: false, message: 'Error assigning lead', error: process.env.NODE_ENV === 'development' ? error : undefined });
    }
};

// Get assignment details for a lead (including employee info)
export const getAssignment = async (req: Request, res: Response) => {
    try {
        const leadId = parseInt(req.params.leadId);
        if (!leadId) return res.status(400).json({ success: false, message: 'Invalid lead id' });

        const lead = await leadQueries.getLeadById(leadId);
        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

        let employee = null;
        if (lead.assigned_to) {
            employee = await employeeQueries.getEmployeeById(lead.assigned_to as number);
            if (employee) {
                // remove sensitive fields
                delete (employee as any).password;
            }
        }

        return res.json({ success: true, data: { lead, assignedEmployee: employee } });
    } catch (error) {
        console.error('Error fetching assignment:', error);
        return res.status(500).json({ success: false, message: 'Error fetching assignment', error: process.env.NODE_ENV === 'development' ? error : undefined });
    }
};

export default { createAssignment, getAssignment };

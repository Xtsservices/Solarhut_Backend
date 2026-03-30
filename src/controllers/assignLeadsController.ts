import { Request, Response } from 'express';
import * as leadQueries from '../queries/leadQueries';
import * as employeeQueries from '../queries/employeeQueries';
import * as customerQueries from '../queries/customerQueries';
import * as jobQueries from '../queries/jobQueries';
import { db } from '../db';
import { notifyAssignment } from '../utils/notification';
import { PoolConnection } from 'mysql2/promise';

// Create an assignment: assign a lead to an employee AND create a job
// Enhanced to automatically convert lead to job with customer creation and job assignment
export const createAssignment = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
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

        if (employee.status !== 'Active') {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot assign employee with status "${employee.status}". Employee must be Active.` 
            });
        }

        // Start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Step 1: Assign lead to employee
            const updated = await leadQueries.assignLeadToEmployee(leadId, employeeId);
            if (!updated) throw new Error('Failed to assign lead');
            
            console.log('✅ ASSIGN LEAD DEBUG - Lead assigned to employee:', { leadId, employeeId });

            // Step 2: Create customer from lead data
            const customerCode = await customerQueries.generateCustomerCode(connection);
            const customerData = {
                customer_code: customerCode,
                first_name: lead.first_name,
                last_name: lead.last_name || '',
                mobile: lead.mobile,
                email: lead.email || undefined,
                customer_type: 'Individual' as const,
                lead_source: 'WEB',
                notes: `Converted from lead #${leadId}. Original message: ${lead.message || 'N/A'}`,
                created_by: employeeId,
                status: 'Active' as const
            };

            const customer = await customerQueries.createCustomer(customerData, employeeId, connection);
            console.log('✅ ASSIGN LEAD DEBUG - Customer created:', { customerId: customer.id, customerCode: customer.customer_code });

            // Step 3: Create customer location if location is provided
            let locationId = null;
            if (lead.location) {
                const locationData = {
                    customer_id: customer.id,
                    location_type: 'Installation' as const,
                    address_line_1: lead.location,
                    is_primary: true,
                    status: 'Active' as const
                };
                const location = await customerQueries.createCustomerLocation(locationData, employeeId, connection);
                locationId = location.id;
                console.log('✅ ASSIGN LEAD DEBUG - Customer location created:', { locationId, location: lead.location });
            }

            // Step 4: Create job from lead data
            const jobCode = await jobQueries.generateJobCode(connection);
            const jobData = {
                job_code: jobCode,
                lead_id: leadId,
                customer_id: customer.id,
                location_id: locationId,
                service_type: lead.service_type,
                solar_service: lead.solar_service,
                capacity: lead.capacity || undefined,
                job_description: `Job created from lead #${leadId}. ${lead.message || ''}`,
                status: 'Active' as const,
                created_by: employeeId
            };

            const job = await jobQueries.createJob(jobData, employeeId, connection);
            console.log('✅ ASSIGN LEAD DEBUG - Job created:', { jobId: job.id, jobCode: job.job_code, customerId: job.customer_id });

            // Step 5: Create job assignment
            const assignmentData = {
                job_id: job.id,
                employee_id: employeeId,
                assignment_status: 'Active' as const,
                start_date: undefined
            };

            await jobQueries.createJobAssignment(assignmentData, employeeId, connection);
            console.log('✅ ASSIGN LEAD DEBUG - Job assignment created:', { jobId: job.id, employeeId });

            // Job status is 'Active' when assigned to employee
            console.log('✅ ASSIGN LEAD DEBUG - Job status: Active');

            // Step 7: Sync lead status to reflect job status
            await leadQueries.syncLeadStatusWithJobStatus(leadId, 'Active');

            // Commit transaction
            await connection.commit();

            // Fetch updated lead with complete job details
            const updatedLead = await leadQueries.getLeadById(leadId);
            if (!updatedLead) throw new Error('Lead not found after assignment');

            // Build response with complete job details
            let responseData: any = updatedLead;
            if (job) {
                responseData = {
                    ...updatedLead,
                    job: job // Include comprehensive job object with all details
                };
            }

            // Send notification (best-effort)
            try {
                await notifyAssignment(employee.mobile, employee.email, leadId);
            } catch (e) {
                console.error('Assignment notification failed:', e);
            }

            return res.json({ 
                success: true, 
                message: 'Lead assigned and converted to job',
                data: responseData,
                job_creation_summary: {
                    job_code: job.job_code,
                    customer_code: customer.customer_code,
                    employee_assigned: `${employee.first_name} ${employee.last_name}`
                }
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error: any) {
        console.error('Error in assign lead with job creation:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error assigning lead and creating job', 
            error: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};


// Get assignment details for a lead (including employee and job info)
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

        let jobDetails = null;
        if (lead.job_id) {
            jobDetails = await jobQueries.getJobById(lead.job_id);
        }

        return res.json({ success: true, data: { lead, assignedEmployee: employee, job: jobDetails } });
    } catch (error) {
        console.error('Error fetching assignment:', error);
        return res.status(500).json({ success: false, message: 'Error fetching assignment', error: process.env.NODE_ENV === 'development' ? error : undefined });
    }
};

export default { createAssignment, getAssignment };

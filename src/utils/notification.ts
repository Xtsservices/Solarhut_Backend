import { sendSMS } from './otpUtils';

export const sendEmail = async (to: string, subject: string, body: string): Promise<boolean> => {
    // TODO: plug in real email provider (nodemailer / external API)
    console.log(`Email to ${to}: ${subject}\n${body}`);
    return true;
};

export const notifyAssignment = async (employeeMobile: string | undefined, employeeEmail: string | undefined, leadId: number) => {
    const smsMessage = `You have been assigned Lead #${leadId}. Please check the portal for details.`;
    if (employeeMobile) {
        try {
            await sendSMS(employeeMobile, smsMessage);
        } catch (e) {
            console.error('Failed to send SMS notification', e);
        }
    }

    if (employeeEmail) {
        try {
            await sendEmail(employeeEmail, `New Lead Assigned (#${leadId})`, `You have been assigned Lead #${leadId}. Please check the portal for details.`);
        } catch (e) {
            console.error('Failed to send email notification', e);
        }
    }
};

// Estimation Approval Notifications
export const notifyEstimationApproval = async (
    employeePhone: string | undefined, 
    employeeEmail: string | undefined, 
    estimationId: number,
    approverName: string,
    finalAmount: number
) => {
    const smsMessage = `Great news! Your estimation #${estimationId} has been approved by ${approverName}. Final amount: ₹${finalAmount}. Check the portal for details.`;
    
    if (employeePhone) {
        try {
            await sendSMS(employeePhone, smsMessage);
        } catch (e) {
            console.error('Failed to send approval SMS notification', e);
        }
    }

    if (employeeEmail) {
        try {
            const emailBody = `Dear Team Member,\n\nYour estimation #${estimationId} has been approved by ${approverName}.\n\nFinal Amount: ₹${finalAmount}\n\nPlease check the portal for complete details and proceed with the next steps.\n\nBest regards,\nSolarHut Team`;
            await sendEmail(employeeEmail, `Estimation #${estimationId} Approved`, emailBody);
        } catch (e) {
            console.error('Failed to send approval email notification', e);
        }
    }
};

export const notifyEstimationRejection = async (
    employeePhone: string | undefined, 
    employeeEmail: string | undefined, 
    estimationId: number,
    rejectorName: string,
    rejectionReason: string
) => {
    const smsMessage = `Your estimation #${estimationId} has been rejected by ${rejectorName}. Please check portal for details and create a new estimation.`;
    
    if (employeePhone) {
        try {
            await sendSMS(employeePhone, smsMessage);
        } catch (e) {
            console.error('Failed to send rejection SMS notification', e);
        }
    }

    if (employeeEmail) {
        try {
            const emailBody = `Dear Team Member,\n\nYour estimation #${estimationId} has been rejected by ${rejectorName}.\n\nReason: ${rejectionReason}\n\nPlease review the feedback and create a new estimation with the necessary corrections.\n\nBest regards,\nSolarHut Team`;
            await sendEmail(employeeEmail, `Estimation #${estimationId} Rejected`, emailBody);
        } catch (e) {
            console.error('Failed to send rejection email notification', e);
        }
    }
};

// Admin notification for new estimation approval requests
export const notifyAdminNewApprovalRequest = async (
    adminPhone: string | undefined,
    adminEmail: string | undefined,
    estimationId: number,
    employeeName: string,
    serviceType: string,
    amount: number
) => {
    const smsMessage = `New estimation #${estimationId} approval request from ${employeeName} for ${serviceType} (₹${amount}). Check admin portal.`;
    
    if (adminPhone) {
        try {
            await sendSMS(adminPhone, smsMessage);
        } catch (e) {
            console.error('Failed to send admin approval SMS notification', e);
        }
    }

    if (adminEmail) {
        try {
            const emailBody = `Dear Admin,\n\nA new estimation approval request has been submitted:\n\nEstimation ID: #${estimationId}\nEmployee: ${employeeName}\nService Type: ${serviceType}\nAmount: ₹${amount}\n\nPlease review and approve/reject the estimation in the admin portal.\n\nBest regards,\nSolarHut System`;
            await sendEmail(adminEmail, `New Estimation Approval Request #${estimationId}`, emailBody);
        } catch (e) {
            console.error('Failed to send admin approval email notification', e);
        }
    }
};

export default { 
    sendEmail, 
    notifyAssignment, 
    notifyEstimationApproval, 
    notifyEstimationRejection,
    notifyAdminNewApprovalRequest 
};

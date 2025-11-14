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

export default { sendEmail, notifyAssignment };

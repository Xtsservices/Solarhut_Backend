// Generate a random 6-digit OTP
export const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// TODO: Implement actual SMS sending logic
export const sendSMS = async (mobile: string, message: string): Promise<boolean> => {
    // For development, just log the message
    console.log(`SMS to ${mobile}: ${message}`);
    return true;
};

export const formatMobile = (mobile: string): string => {
    // Remove any non-digit characters and ensure it starts with proper format
    const cleaned = mobile.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return cleaned;
    }
    throw new Error('Invalid mobile number format');
};
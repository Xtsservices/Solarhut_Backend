import { db } from '../db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

interface OTPVerification extends RowDataPacket {
    id: number;
    mobile: string;
    otp: string;
    expires_at: Date;
    verified: boolean;
    attempts: number;
    created_at: Date;
}

export const createOTP = async (mobile: string, otp: string, expiresInMinutes: number = 3) => {
    // Delete any existing unverified OTPs for this mobile
    await db.execute(
        'DELETE FROM otp_verifications WHERE mobile = ? AND verified = FALSE',
        [mobile]
    );

    // Create new OTP
    const [result] = await db.execute<ResultSetHeader>(
        `INSERT INTO otp_verifications (mobile, otp, expires_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [mobile, otp, expiresInMinutes]
    );

    return result.insertId;
};

export const verifyOTP = async (mobile: string, otp: string): Promise<boolean> => {
    const [verifications] = await db.execute<OTPVerification[]>(
        `SELECT * FROM otp_verifications 
         WHERE mobile = ? 
         AND verified = FALSE 
         AND expires_at > NOW()
         ORDER BY created_at DESC 
         LIMIT 1`,
        [mobile]
    );

    if (!verifications.length) {
        return false;
    }

    const verification = verifications[0];

    // Increment attempts
    await db.execute(
        'UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?',
        [verification.id]
    );

    if (verification.attempts >= 3) {
        // Too many attempts, invalidate OTP
        await db.execute(
            'UPDATE otp_verifications SET verified = TRUE WHERE id = ?',
            [verification.id]
        );
        return false;
    }

    if (verification.otp !== otp) {
        return false;
    }

    // Mark as verified
    await db.execute(
        'UPDATE otp_verifications SET verified = TRUE WHERE id = ?',
        [verification.id]
    );

    return true;
};

export const getActiveOTP = async (mobile: string): Promise<OTPVerification | null> => {
    const [verifications] = await db.execute<OTPVerification[]>(
        `SELECT * FROM otp_verifications 
         WHERE mobile = ? 
         AND verified = FALSE 
         AND expires_at > NOW()
         ORDER BY created_at DESC 
         LIMIT 1`,
        [mobile]
    );

    return verifications[0] || null;
};
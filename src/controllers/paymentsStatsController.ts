import { Request, Response } from 'express';
import { db } from '../db';

export const getPaymentsStats = async (req: Request, res: Response) => {
    try {
        // 1. Today payments
        const [todayRowsRaw] = await db.execute(
            `SELECT IFNULL(SUM(amount),0) as total FROM job_payments WHERE payment_status = 'Completed' AND DATE(payment_date) = CURDATE()`
        );
        const todayRows = todayRowsRaw as any[];
        const todayPayments = todayRows[0]?.total || 0;

        // 2. This week payments
        const [weekRowsRaw] = await db.execute(
            `SELECT IFNULL(SUM(amount),0) as total FROM job_payments WHERE payment_status = 'Completed' AND YEARWEEK(payment_date, 1) = YEARWEEK(CURDATE(), 1)`
        );
        const weekRows = weekRowsRaw as any[];
        const weekPayments = weekRows[0]?.total || 0;

        // 3. Pending payments list
        const [pendingPaymentsRowsRaw] = await db.execute(
            `SELECT * FROM job_payments WHERE payment_status = 'Pending'`
        );
        const pendingPaymentsArray = pendingPaymentsRowsRaw as any[];

        // Calculate sum of pending payments
        const pendingPayments = pendingPaymentsArray.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

        res.json({
            success: true,
            data: {
                todayPayments,
                weekPayments,
                pendingPayments
            }
        });
    } catch (error) {
        console.error('Error fetching payments stats:', error);
        res.status(500).json({ success: false, message: 'Error fetching payments stats', error: process.env.NODE_ENV === 'development' ? error : undefined });
    }
};

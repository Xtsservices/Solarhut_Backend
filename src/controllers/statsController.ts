// Summary graph API: count of leads (new+assigned, not completed) and jobs
export const getSummaryGraphStats = async (req: Request, res: Response) => {
    try {
        // Parse date range from query params
        let { startDate, endDate } = req.query;
        const now = new Date();
        let start, end;
        if (startDate && endDate) {
            start = new Date(startDate as string);
            end = new Date(endDate as string);
        } else {
            // Default: last 3 months
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // End of current month
            start = new Date(now.getFullYear(), now.getMonth() - 2, 1); // Start of month 2 months ago
        }

        // Monthly leads count (New+Assigned, not Completed)
        const [leadRowsRaw] = await db.execute(
            `SELECT YEAR(created_at) as year, MONTH(created_at) as month, COUNT(*) as count
             FROM leads
             WHERE status IN ('New', 'Assigned')
               AND created_at BETWEEN ? AND ?
             GROUP BY YEAR(created_at), MONTH(created_at)
             ORDER BY year DESC, month DESC`,
            [start, end]
        );
        const leadRows = leadRowsRaw as any[];

        // Monthly jobs count
        const [jobRowsRaw] = await db.execute(
            `SELECT YEAR(created_at) as year, MONTH(created_at) as month, COUNT(*) as count
             FROM jobs
             WHERE created_at BETWEEN ? AND ?
             GROUP BY YEAR(created_at), MONTH(created_at)
             ORDER BY year DESC, month DESC`,
            [start, end]
        );
        const jobRows = jobRowsRaw as any[];

        // Helper to format date as dd-mm-yyyy
        const formatDate = (date: Date) => {
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        };

        // Add formatted month-year to each monthly result
        const formatMonthly = (arr: any[]) => arr.map(row => ({
            ...row,
            monthYear: `${String(row.month).padStart(2, '0')}-${row.year}`
        }));

        res.json({
            success: true,
            data: {
                leadsMonthly: formatMonthly(leadRows),
                jobsMonthly: formatMonthly(jobRows),
                startDate: formatDate(start),
                endDate: formatDate(end)
            }
        });
    } catch (error) {
        console.error('Error fetching summary graph stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching summary graph stats',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
}
import { Request, Response } from 'express';
import { db } from '../db';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        // 1. Pending leads (New, not assigned)

        const [pendingLeadsRowsRaw] = await db.execute(
            `SELECT COUNT(*) as count FROM leads WHERE status = 'New' AND (assigned_to IS NULL OR assigned_to = 0)`
        );
        const pendingLeadsRows = pendingLeadsRowsRaw as any[];
        const pendingLeads = pendingLeadsRows[0]?.count || 0;

        const [pendingJobsRowsRaw] = await db.execute(
            `SELECT COUNT(*) as count FROM jobs WHERE status IN ('Created', 'Assigned', 'In Progress', 'On Hold')`
        );
        const pendingJobsRows = pendingJobsRowsRaw as any[];
        const pendingJobs = pendingJobsRows[0]?.count || 0;

        const [pendingPaymentsRowsRaw] = await db.execute(
            `SELECT IFNULL(SUM(amount),0) as total FROM job_payments WHERE payment_status = 'Pending'`
        );
        const pendingPaymentsRows = pendingPaymentsRowsRaw as any[];
        const pendingPayments = pendingPaymentsRows[0]?.total || 0;

        const [todayRevenueRowsRaw] = await db.execute(
            `SELECT IFNULL(SUM(amount),0) as total FROM job_payments WHERE payment_status = 'Completed' AND DATE(payment_date) = CURDATE()`
        );
        const todayRevenueRows = todayRevenueRowsRaw as any[];
        const todayRevenue = todayRevenueRows[0]?.total || 0;

        const [weekRevenueRowsRaw] = await db.execute(
            `SELECT IFNULL(SUM(amount),0) as total FROM job_payments WHERE payment_status = 'Completed' AND YEARWEEK(payment_date, 1) = YEARWEEK(CURDATE(), 1)`
        );
        const weekRevenueRows = weekRevenueRowsRaw as any[];
        const weekRevenue = weekRevenueRows[0]?.total || 0;

        const [monthRevenueRowsRaw] = await db.execute(
            `SELECT IFNULL(SUM(amount),0) as total FROM job_payments WHERE payment_status = 'Completed' AND YEAR(payment_date) = YEAR(CURDATE()) AND MONTH(payment_date) = MONTH(CURDATE())`
        );
        const monthRevenueRows = monthRevenueRowsRaw as any[];
        const monthRevenue = monthRevenueRows[0]?.total || 0;

        res.json({
            success: true,
            data: {
                pendingLeads,
                pendingJobs,
                pendingPayments,
                todayRevenue,
                weekRevenue,
                monthRevenue
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard stats',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

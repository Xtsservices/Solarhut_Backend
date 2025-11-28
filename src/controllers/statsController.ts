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

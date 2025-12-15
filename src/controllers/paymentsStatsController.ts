 import { Request, Response } from 'express';
import { db } from '../db';

// Payment summary for dashboard pie chart
export const getPaymentsSummary = async (req: Request, res: Response) => {
    try {
        // Count completed payments
        const [completedRowsRaw] = await db.execute(
            `SELECT COUNT(*) as count FROM job_payments WHERE payment_status = 'Completed'`
        );
        const completedRows = completedRowsRaw as any[];
        const completedCount = completedRows[0]?.count || 0;

        // Count pending payments
        const [pendingRowsRaw] = await db.execute(
            `SELECT COUNT(*) as count FROM job_payments WHERE payment_status = 'Pending'`
        );
        const pendingRows = pendingRowsRaw as any[];
        const pendingCount = pendingRows[0]?.count || 0;

        res.json({
            success: true,
            data: {
                paid: completedCount,
                pending: pendingCount
            }
        });
    } catch (error) {
        console.error('Error fetching payments summary:', error);
        res.status(500).json({ success: false, message: 'Error fetching payments summary', error: process.env.NODE_ENV === 'development' ? error : undefined });
    }
};

// List all payments with pagination and filters
export const listPayments = async (req: Request, res: Response) => {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        // Filter parameters
        const status = req.query.status as string; // 'Paid', 'Pending', 'Failed', 'Refunded'
        const paymentType = req.query.payment_type as string; // 'Advance', 'Milestone', 'Final'
        const paymentMethod = req.query.payment_method as string; // 'Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'
        const jobId = req.query.job_id as string;
        const dateFrom = req.query.date_from as string;
        const dateTo = req.query.date_to as string;
        const search = req.query.search as string;

        // Build WHERE clause
        let whereConditions: string[] = [];
        let params: any[] = [];

        if (status) {
            whereConditions.push('jp.payment_status = ?');
            params.push(status);
        }

        if (paymentType) {
            whereConditions.push('jp.payment_type = ?');
            params.push(paymentType);
        }

        if (paymentMethod) {
            whereConditions.push('jp.payment_method = ?');
            params.push(paymentMethod);
        }

        if (jobId) {
            whereConditions.push('jp.job_id = ?');
            params.push(parseInt(jobId));
        }

        if (dateFrom) {
            whereConditions.push('DATE(jp.payment_date) >= ?');
            params.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push('DATE(jp.payment_date) <= ?');
            params.push(dateTo);
        }

        if (search) {
            whereConditions.push('(jp.transaction_id LIKE ? OR jp.payment_reference LIKE ? OR c.full_name LIKE ? OR j.job_code LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM job_payments jp
            LEFT JOIN jobs j ON jp.job_id = j.id
            LEFT JOIN customers c ON j.customer_id = c.id
            ${whereClause}
        `;
        const [countResult] = await db.execute(countQuery, params) as any;
        const totalPayments = countResult[0]?.total || 0;

        // Get paginated payments with details
        const paymentsQuery = `
            SELECT 
                jp.*,
                j.job_code,
                j.service_type,
                j.solar_service,
                j.status as job_status,
                c.full_name as customer_name,
                c.mobile as customer_mobile,
                c.email as customer_email,
                c.customer_code,
                cb.first_name as created_by_name,
                pb.first_name as processed_by_name,
                vb.first_name as verified_by_name
            FROM job_payments jp
            LEFT JOIN jobs j ON jp.job_id = j.id
            LEFT JOIN customers c ON j.customer_id = c.id
            LEFT JOIN employees cb ON jp.created_by = cb.id
            LEFT JOIN employees pb ON jp.processed_by = pb.id
            LEFT JOIN employees vb ON jp.verified_by = vb.id
            ${whereClause}
            ORDER BY jp.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const [paymentsRows] = await db.execute(paymentsQuery, params) as any;

        // Structure the response
        const payments = paymentsRows.map((payment: any) => ({
            payment_info: {
                id: payment.id,
                payment_type: payment.payment_type,
                amount: payment.amount,
                discount_amount: payment.discount_amount,
                taxable_amount: payment.taxable_amount,
                gst_rate: payment.gst_rate,
                cgst_rate: payment.cgst_rate,
                sgst_rate: payment.sgst_rate,
                igst_rate: payment.igst_rate,
                cgst_amount: payment.cgst_amount,
                sgst_amount: payment.sgst_amount,
                igst_amount: payment.igst_amount,
                total_tax_amount: payment.total_tax_amount,
                total_amount: payment.total_amount,
                payment_method: payment.payment_method,
                payment_status: payment.payment_status,
                transaction_id: payment.transaction_id,
                payment_reference: payment.payment_reference,
                payment_date: payment.payment_date,
                due_date: payment.due_date,
                milestone_description: payment.milestone_description,
                receipt_url: payment.receipt_url,
                created_at: payment.created_at,
                updated_at: payment.updated_at
            },
            job_info: {
                job_id: payment.job_id,
                job_code: payment.job_code,
                service_type: payment.service_type,
                solar_service: payment.solar_service,
                job_status: payment.job_status
            },
            customer_info: {
                customer_name: payment.customer_name,
                customer_mobile: payment.customer_mobile,
                customer_email: payment.customer_email,
                customer_code: payment.customer_code
            },
            processed_by_info: {
                created_by: payment.created_by_name,
                processed_by: payment.processed_by_name,
                verified_by: payment.verified_by_name
            }
        }));

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalPayments / limit);

        res.json({
            success: true,
            message: 'Payments retrieved successfully',
            data: payments,
            pagination: {
                current_page: page,
                per_page: limit,
                total_pages: totalPages,
                total_records: totalPayments,
                has_next_page: page < totalPages,
                has_previous_page: page > 1
            },
            filters_applied: {
                status: status || null,
                payment_type: paymentType || null,
                payment_method: paymentMethod || null,
                job_id: jobId || null,
                date_from: dateFrom || null,
                date_to: dateTo || null,
                search: search || null
            }
        });

    } catch (error) {
        console.error('Error fetching payments list:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching payments list', 
            error: process.env.NODE_ENV === 'development' ? error : undefined 
        });
    }
};

export const getPaymentsStats = async (req: Request, res: Response) => {
    try {
        // 1. Today's completed payments
        const [todayRowsRaw] = await db.execute(
            `SELECT COALESCE(SUM(total_amount), 0) as total FROM job_payments WHERE payment_status = 'Completed' AND DATE(payment_date) = CURDATE()`
        );
        const todayRows = todayRowsRaw as any[];
        const todayPayments = parseFloat(todayRows[0]?.total) || 0;

        // 2. This week's completed payments
        const [weekRowsRaw] = await db.execute(
            `SELECT COALESCE(SUM(total_amount), 0) as total FROM job_payments WHERE payment_status = 'Completed' AND YEARWEEK(payment_date, 1) = YEARWEEK(CURDATE(), 1)`
        );
        const weekRows = weekRowsRaw as any[];
        const weekPayments = parseFloat(weekRows[0]?.total) || 0;

        // 3. Overall pending payments (sum of all pending)
        const [pendingRowsRaw] = await db.execute(
            `SELECT COALESCE(SUM(total_amount), 0) as total FROM job_payments WHERE payment_status = 'Pending'`
        );
        const pendingRows = pendingRowsRaw as any[];
        const pendingPayments = parseFloat(pendingRows[0]?.total) || 0;

        res.json({
            success: true,
            message: 'Payments stats retrieved successfully',
            data: {
                today_payments: todayPayments,
                week_payments: weekPayments,
                pending_payments: pendingPayments
            }
        });
    } catch (error) {
        console.error('Error fetching payments stats:', error);
        res.status(500).json({ success: false, message: 'Error fetching payments stats', error: process.env.NODE_ENV === 'development' ? error : undefined });
    }
};

export default {
    getPaymentsStats,
    getPaymentsSummary,
    listPayments
};
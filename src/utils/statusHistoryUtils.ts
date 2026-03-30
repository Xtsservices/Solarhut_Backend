import { PoolConnection } from 'mysql2/promise';
import { db } from '../db';
import { getMultipleSignedUrls, generateSignedUrl } from './s3Utils';

/**
 * Interface for comprehensive status history response
 */
export interface StatusHistoryDetail {
    status_id: number;
    previous_status: string | null;
    new_status: string;
    changed_by_id: number;
    changed_by_name: string;
    changed_by_email: string;
    changed_at: string;
    status_reason: string | null;
    notes: Array<{
        note_id: number;
        content: string;
        created_by_id: number;
        created_by_name: string;
        created_at: string;
    }>;
    attachments: Array<{
        attachment_id: number;
        attachment_type: string;
        file_name: string;
        file_size: number;
        s3_key: string;
        signed_url: string;
        uploaded_at: string;
    }>;
}

/**
 * Get comprehensive status history for a job with all details
 * @param jobId Job ID
 * @param connection Optional database connection
 * @returns Array of status history with notes and attachments
 */
export const getJobStatusHistory = async (
    jobId: number,
    connection?: PoolConnection
): Promise<StatusHistoryDetail[]> => {
    const query = connection ? connection : db;

    try {
        // Get all status changes
        const [statusResults] = await query.execute(
            `
            SELECT 
                jst.id as status_id,
                jst.previous_status,
                jst.new_status,
                jst.created_by as changed_by_id,
                CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) as changed_by_name,
                e.email as changed_by_email,
                jst.created_at as changed_at,
                jst.status_reason
            FROM job_status_tracking jst
            LEFT JOIN employees e ON jst.created_by = e.id
            WHERE jst.job_id = ?
            ORDER BY jst.created_at DESC
            `,
            [jobId]
        );

        if (!Array.isArray(statusResults) || statusResults.length === 0) {
            return [];
        }

        // Process each status change and fetch related notes and attachments
        const statusHistory: StatusHistoryDetail[] = await Promise.all(
            statusResults.map(async (status: any) => ({
                ...status,
                notes: await getStatusNotesByStatusId(status.status_id, query),
                attachments: await getStatusAttachmentsByStatusIdWithSignedUrl(
                    status.status_id,
                    query
                )
            }))
        );

        return statusHistory;
    } catch (error: any) {
        console.error('Error fetching job status history:', error);
        throw new Error(`Failed to fetch status history: ${error.message}`);
    }
};

/**
 * Get notes for a specific status change
 * @param statusId Status tracking ID
 * @param connection Database connection or pool
 * @returns Array of notes
 */
export const getStatusNotesByStatusId = async (
    statusId: number,
    connection?: PoolConnection | any
): Promise<Array<{
    note_id: number;
    content: string;
    created_by_id: number;
    created_by_name: string;
    created_at: string;
}>> => {
    const query = connection ? connection : db;

    try {
        const [notes] = await query.execute(
            `
            SELECT 
                jn.id as note_id,
                jn.note_content as content,
                jn.created_by as created_by_id,
                CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) as created_by_name,
                jn.created_at
            FROM job_notes jn
            LEFT JOIN employees e ON jn.created_by = e.id
            WHERE jn.status_tracking_id = ?
            ORDER BY jn.created_at ASC
            `,
            [statusId]
        );

        return Array.isArray(notes) ? notes : [];
    } catch (error: any) {
        console.error('Error fetching status notes:', error);
        return [];
    }
};

/**
 * Get attachments for a specific status change with signed URLs
 * @param statusId Status tracking ID
 * @param connection Database connection or pool
 * @returns Array of attachments with signed URLs
 */
export const getStatusAttachmentsByStatusIdWithSignedUrl = async (
    statusId: number,
    connection?: PoolConnection | any
): Promise<Array<{
    attachment_id: number;
    attachment_type: string;
    file_name: string;
    file_size: number;
    s3_key: string;
    signed_url: string;
    uploaded_at: string;
}>> => {
    const query = connection ? connection : db;

    try {
        const [attachments] = await query.execute(
            `
            SELECT 
                id as attachment_id,
                attachment_type,
                file_name,
                file_size,
                s3_key,
                uploaded_at
            FROM job_status_attachments
            WHERE job_status_tracking_id = ?
            ORDER BY uploaded_at ASC
            `,
            [statusId]
        );

        if (!Array.isArray(attachments) || attachments.length === 0) {
            return [];
        }

        // Fetch signed URLs for all attachments
        const withSignedUrls = await Promise.all(
            attachments.map(async (attachment: any) => {
                try {
                    const signed_url = attachment.s3_key
                        ? await generateSignedUrl(attachment.s3_key)
                        : '';
                    return {
                        ...attachment,
                        signed_url
                    };
                } catch (error) {
                    console.error(`Failed to generate signed URL for ${attachment.s3_key}:`, error);
                    return {
                        ...attachment,
                        signed_url: ''
                    };
                }
            })
        );

        return withSignedUrls;
    } catch (error: any) {
        console.error('Error fetching status attachments:', error);
        return [];
    }
};

/**
 * Get only attachments for a specific status (without full history)
 * @param statusId Status tracking ID
 * @param connection Database connection or pool
 * @returns Array of attachments
 */
export const getStatusAttachmentsByStatusId = async (
    statusId: number,
    connection?: PoolConnection | any
): Promise<any[]> => {
    const query = connection ? connection : db;

    try {
        const [attachments] = await query.execute(
            `
            SELECT 
                id as attachment_id,
                attachment_type,
                file_name,
                file_size,
                s3_key,
                s3_bucket,
                uploaded_at
            FROM job_status_attachments
            WHERE job_status_tracking_id = ?
            ORDER BY uploaded_at ASC
            `,
            [statusId]
        );

        return Array.isArray(attachments) ? attachments : [];
    } catch (error: any) {
        console.error('Error fetching status attachments:', error);
        return [];
    }
};

/**
 * Get single status with complete details
 * @param statusId Status tracking ID
 * @param connection Database connection or pool
 * @returns Single status detail
 */
export const getStatusByIdWithDetails = async (
    statusId: number,
    connection?: PoolConnection | any
): Promise<StatusHistoryDetail | null> => {
    const query = connection ? connection : db;

    try {
        const [result] = await query.execute(
            `
            SELECT 
                jst.id as status_id,
                jst.previous_status,
                jst.new_status,
                jst.created_by as changed_by_id,
                CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) as changed_by_name,
                e.email as changed_by_email,
                jst.created_at as changed_at,
                jst.status_reason
            FROM job_status_tracking jst
            LEFT JOIN employees e ON jst.created_by = e.id
            WHERE jst.id = ?
            LIMIT 1
            `,
            [statusId]
        );

        if (!Array.isArray(result) || result.length === 0) {
            return null;
        }

        const status = result[0];
        return {
            ...status,
            notes: await getStatusNotesByStatusId(statusId, query),
            attachments: await getStatusAttachmentsByStatusIdWithSignedUrl(statusId, query)
        };
    } catch (error: any) {
        console.error('Error fetching status details:', error);
        return null;
    }
};

/**
 * Get latest status change for a job
 * @param jobId Job ID
 * @param connection Database connection or pool
 * @returns Latest status with full details
 */
export const getLatestJobStatus = async (
    jobId: number,
    connection?: PoolConnection | any
): Promise<StatusHistoryDetail | null> => {
    const query = connection ? connection : db;

    try {
        const [result] = await query.execute(
            `
            SELECT 
                jst.id as status_id,
                jst.previous_status,
                jst.new_status,
                jst.created_by as changed_by_id,
                CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) as changed_by_name,
                e.email as changed_by_email,
                jst.created_at as changed_at,
                jst.status_reason
            FROM job_status_tracking jst
            LEFT JOIN employees e ON jst.created_by = e.id
            WHERE jst.job_id = ?
            ORDER BY jst.created_at DESC
            LIMIT 1
            `,
            [jobId]
        );

        if (!Array.isArray(result) || result.length === 0) {
            return null;
        }

        const status = result[0];
        return {
            ...status,
            notes: await getStatusNotesByStatusId(status.status_id, query),
            attachments: await getStatusAttachmentsByStatusIdWithSignedUrl(status.status_id, query)
        };
    } catch (error: any) {
        console.error('Error fetching latest job status:', error);
        return null;
    }
};

/**
 * Get all attachments for a job (across all status changes)
 * @param jobId Job ID
 * @param connection Database connection or pool
 * @returns All attachments with signed URLs
 */
export const getAllJobAttachments = async (
    jobId: number,
    connection?: PoolConnection | any
): Promise<Array<{
    attachment_id: number;
    status_id: number;
    status: string;
    attachment_type: string;
    file_name: string;
    file_size: number;
    signed_url: string;
    uploaded_at: string;
    uploaded_by: string;
}>> => {
    const query = connection ? connection : db;

    try {
        const [attachments] = await query.execute(
            `
            SELECT 
                jsa.id as attachment_id,
                jst.id as status_id,
                jst.new_status as status,
                jsa.attachment_type,
                jsa.file_name,
                jsa.file_size,
                jsa.s3_key,
                jsa.uploaded_at,
                CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, '')) as uploaded_by
            FROM job_status_attachments jsa
            JOIN job_status_tracking jst ON jsa.job_status_tracking_id = jst.id
            LEFT JOIN employees e ON jsa.uploaded_by = e.id
            WHERE jst.job_id = ?
            ORDER BY jsa.uploaded_at DESC
            `,
            [jobId]
        );

        console.log(`getAllJobAttachments - Job ID: ${jobId}, Found ${Array.isArray(attachments) ? attachments.length : 0} attachments`);

        if (!Array.isArray(attachments) || attachments.length === 0) {
            console.log(`No attachments found for job ${jobId}`);
            return [];
        }

        console.log('Fetching signed URLs for attachments:', JSON.stringify(attachments.map(a => ({
            attachment_id: a.attachment_id,
            file_name: a.file_name,
            s3_key: a.s3_key,
            status: a.status
        })), null, 2));

        // Fetch signed URLs for all attachments with s3_key
        const withSignedUrls = await Promise.all(
            attachments.map(async (attachment: any) => {
                try {
                    // All attachments should have s3_key (validation enforced at submission)
                    if (!attachment.s3_key || !attachment.s3_key.trim()) {
                        console.error(`❌ ERROR: Attachment ${attachment.attachment_id} (${attachment.file_name}) has no s3_key! This should not happen - check data integrity.`);
                    }
                    
                    const signed_url = attachment.s3_key && attachment.s3_key.trim()
                        ? await generateSignedUrl(attachment.s3_key)
                        : '';
                    
                    console.log(`✓ Attachment ${attachment.attachment_id} (${attachment.file_name}): ${signed_url ? 'Signed URL generated (length: ' + signed_url.length + ')' : 'ERROR - No s3_key'}`);
                    
                    return {
                        attachment_id: attachment.attachment_id,
                        status_id: attachment.status_id,
                        status: attachment.status,
                        attachment_type: attachment.attachment_type,
                        file_name: attachment.file_name,
                        file_size: attachment.file_size,
                        signed_url,
                        uploaded_at: attachment.uploaded_at,
                        uploaded_by: attachment.uploaded_by
                    };
                } catch (error) {
                    console.error(`Failed to generate signed URL for attachment ${attachment.attachment_id} (s3_key: ${attachment.s3_key}):`, error);
                    return {
                        attachment_id: attachment.attachment_id,
                        status_id: attachment.status_id,
                        status: attachment.status,
                        attachment_type: attachment.attachment_type,
                        file_name: attachment.file_name,
                        file_size: attachment.file_size,
                        signed_url: '',
                        uploaded_at: attachment.uploaded_at,
                        uploaded_by: attachment.uploaded_by
                    };
                }
            })
        );

        console.log(`Returning ${withSignedUrls.length} attachments with signed URLs`);
        return withSignedUrls;
    } catch (error: any) {
        console.error('Error fetching all job attachments:', error);
        return [];
    }
};

export default {
    getJobStatusHistory,
    getStatusNotesByStatusId,
    getStatusAttachmentsByStatusId,
    getStatusAttachmentsByStatusIdWithSignedUrl,
    getStatusByIdWithDetails,
    getLatestJobStatus,
    getAllJobAttachments
};

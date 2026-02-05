import { Request, Response } from 'express';
import * as bankDetailsQueries from '../queries/bankDetailsQueries';
import { bankDetailsSchema } from '../utils/validations';
import { db } from '../db';
import { PoolConnection } from 'mysql2/promise';
import multer from 'multer';

// AWS SDK imports
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// AWS S3 Configuration
const s3Client = new S3Client({
    region: process.env.AWS_BUCKET_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_SECRET_KEY!,
    },
});

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    },
});

export const uploadMiddleware = upload.single('qr_code');

// Helper function to upload file to S3
const uploadToS3 = async (file: Express.Multer.File, key: string): Promise<string> => {
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    });

    await s3Client.send(command);
    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/${key}`;
};

// Helper function to delete file from S3
const deleteFromS3 = async (key: string): Promise<void> => {
    const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key,
    });

    await s3Client.send(command);
};

// Helper function to generate signed URL
const generateSignedUrl = async (key: string): Promise<string> => {
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour expiry
};

// Generate unique S3 key for QR code
// Files are stored in bank-qr-codes/ folder
// Old files are preserved for history, only DB references are updated
const generateS3Key = (bankDetailId: number, originalName: string): string => {
    const timestamp = Date.now();
    const fileExtension = originalName.split('.').pop();
    return `bank-qr-codes/${bankDetailId}_${timestamp}.${fileExtension}`;
};

// Bank Details CRUD Operations

export const createBankDetail = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        // Validate request data
        const { error, value } = bankDetailsSchema.create.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map((d: any) => d.message) 
            });
        }

        // Get user ID from token payload
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Get database connection and start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if account number already exists
            const existingBankDetail = await bankDetailsQueries.getBankDetailByAccountNumber(value.account_number, undefined, connection);
            if (existingBankDetail) {
                throw new Error('Account number already exists. Please choose a different account number.');
            }

            // Create bank detail
            const result = await bankDetailsQueries.createBankDetail(value, user.id, connection);
            const bankDetailId = (result as any).insertId;

            // Handle QR code upload if provided
            let qrCodeUrl = null;
            let qrCodeS3Key = null;
            
            if (req.file) {
                qrCodeS3Key = generateS3Key(bankDetailId, req.file.originalname);
                qrCodeUrl = await uploadToS3(req.file, qrCodeS3Key);
                
                // Update bank detail with QR code info
                await bankDetailsQueries.updateBankDetailQRCode(bankDetailId, qrCodeUrl, qrCodeS3Key, user.id, connection);
            }

            // Commit transaction
            await connection.commit();

            res.status(201).json({
                success: true,
                message: 'Bank detail created successfully',
                data: {
                    id: bankDetailId,
                    ...value,
                    qr_code_url: qrCodeUrl,
                    qr_code_s3_key: qrCodeS3Key,
                    created_by: user.id
                }
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Error creating bank detail:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Error creating bank detail',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

export const getAllBankDetails = async (req: Request, res: Response) => {
    try {
        const { active } = req.query;
        const activeOnly = active === 'true';
        
        const bankDetails = await bankDetailsQueries.getAllBankDetails(activeOnly);
        
        // Generate signed URLs for QR codes
        const bankDetailsWithSignedUrls = await Promise.all(
            (bankDetails as any[]).map(async (bankDetail) => {
                if (bankDetail.qr_code_s3_key) {
                    try {
                        bankDetail.qr_code_signed_url = await generateSignedUrl(bankDetail.qr_code_s3_key);
                    } catch (error) {
                        console.error(`Error generating signed URL for QR code: ${bankDetail.qr_code_s3_key}`, error);
                        bankDetail.qr_code_signed_url = null;
                    }
                }
                return bankDetail;
            })
        );

        res.json({
            success: true,
            message: 'Bank details retrieved successfully',
            data: bankDetailsWithSignedUrls
        });

    } catch (error) {
        console.error('Error retrieving bank details:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving bank details',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getBankDetailById = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bank detail ID'
            });
        }

        const bankDetail = await bankDetailsQueries.getBankDetailById(id);
        if (!bankDetail) {
            return res.status(404).json({
                success: false,
                message: 'Bank detail not found'
            });
        }

        // Generate signed URL for QR code if available
        if ((bankDetail as any).qr_code_s3_key) {
            try {
                (bankDetail as any).qr_code_signed_url = await generateSignedUrl((bankDetail as any).qr_code_s3_key);
            } catch (error) {
                console.error(`Error generating signed URL for QR code: ${(bankDetail as any).qr_code_s3_key}`, error);
                (bankDetail as any).qr_code_signed_url = null;
            }
        }

        res.json({
            success: true,
            message: 'Bank detail retrieved successfully',
            data: bankDetail
        });

    } catch (error) {
        console.error('Error retrieving bank detail:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving bank detail',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const getActiveBankDetail = async (req: Request, res: Response) => {
    try {
        const bankDetail = await bankDetailsQueries.getActiveBankDetail();
        if (!bankDetail) {
            return res.status(404).json({
                success: false,
                message: 'No active bank detail found'
            });
        }

        // Generate signed URL for QR code if available
        if ((bankDetail as any).qr_code_s3_key) {
            try {
                (bankDetail as any).qr_code_signed_url = await generateSignedUrl((bankDetail as any).qr_code_s3_key);
            } catch (error) {
                console.error(`Error generating signed URL for QR code: ${(bankDetail as any).qr_code_s3_key}`, error);
                (bankDetail as any).qr_code_signed_url = null;
            }
        }

        res.json({
            success: true,
            message: 'Active bank detail retrieved successfully',
            data: bankDetail
        });

    } catch (error) {
        console.error('Error retrieving active bank detail:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving active bank detail',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
};

export const updateBankDetail = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bank detail ID'
            });
        }

        // Validate request data
        const { error, value } = bankDetailsSchema.update.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map((d: any) => d.message) 
            });
        }

        // Get user ID from token payload
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Get database connection and start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if bank detail exists
            const existingBankDetail = await bankDetailsQueries.getBankDetailById(id, connection);
            if (!existingBankDetail) {
                throw new Error('Bank detail not found');
            }

            // Check if account number already exists (if being updated)
            if (value.account_number) {
                const existingByAccountNumber = await bankDetailsQueries.getBankDetailByAccountNumber(value.account_number, id, connection);
                if (existingByAccountNumber) {
                    throw new Error('Account number already exists. Please choose a different account number.');
                }
            }

            // Update bank detail
            await bankDetailsQueries.updateBankDetail(id, value, user.id, connection);

            // Handle QR code upload if provided
            if (req.file) {
                // Note: We DON'T delete the old QR code from S3 to maintain history
                // Only the database reference will be updated to point to the new file
                
                // Upload new QR code
                const qrCodeS3Key = generateS3Key(id, req.file.originalname);
                const qrCodeUrl = await uploadToS3(req.file, qrCodeS3Key);
                
                // Update bank detail with new QR code info (old file remains in S3)
                await bankDetailsQueries.updateBankDetailQRCode(id, qrCodeUrl, qrCodeS3Key, user.id, connection);
            }

            // Commit transaction
            await connection.commit();

            // Get updated bank detail
            const updatedBankDetail = await bankDetailsQueries.getBankDetailById(id);
            
            // Generate signed URL for QR code if available
            if ((updatedBankDetail as any)?.qr_code_s3_key) {
                try {
                    (updatedBankDetail as any).qr_code_signed_url = await generateSignedUrl((updatedBankDetail as any).qr_code_s3_key);
                } catch (error) {
                    console.error('Error generating signed URL for QR code:', error);
                    (updatedBankDetail as any).qr_code_signed_url = null;
                }
            }

            res.json({
                success: true,
                message: 'Bank detail updated successfully',
                data: updatedBankDetail
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Error updating bank detail:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Error updating bank detail',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

export const deleteBankDetail = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bank detail ID'
            });
        }

        // Get user ID from token payload
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Get database connection and start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if bank detail exists
            const existingBankDetail = await bankDetailsQueries.getBankDetailById(id, connection);
            if (!existingBankDetail) {
                throw new Error('Bank detail not found');
            }

            // Soft delete bank detail
            await bankDetailsQueries.deleteBankDetail(id, user.id, connection);

            // Commit transaction
            await connection.commit();

            res.json({
                success: true,
                message: 'Bank detail deactivated successfully'
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Error deleting bank detail:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Error deleting bank detail',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

export const deleteQRCode = async (req: Request, res: Response) => {
    let connection: PoolConnection | null = null;
    
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bank detail ID'
            });
        }

        // Get user ID from token payload
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Get database connection and start transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if bank detail exists
            const existingBankDetail = await bankDetailsQueries.getBankDetailById(id, connection);
            if (!existingBankDetail) {
                throw new Error('Bank detail not found');
            }

            // Note: We DON'T delete QR code from S3 to maintain history
            // Only remove the database reference - file remains in S3 for historical purposes
            
            // Remove QR code references from database only
            await bankDetailsQueries.deleteBankDetailQRCode(id, user.id, connection);

            // Commit transaction
            await connection.commit();

            res.json({
                success: true,
                message: 'QR code reference removed successfully (file preserved in S3 for history)'
            });

        } catch (error) {
            await connection.rollback();
            throw error;
        }

    } catch (error) {
        console.error('Error removing QR code reference:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Error removing QR code reference',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

export default {
    createBankDetail,
    getAllBankDetails,
    getBankDetailById,
    getActiveBankDetail,
    updateBankDetail,
    deleteBankDetail,
    deleteQRCode,
    uploadMiddleware
};
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as path from 'path';
import * as fs from 'fs';

// S3 Configuration - using environment variables from .env
const s3Client = new S3Client({
    region: process.env.AWS_BUCKET_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY || '',
        secretAccessKey: process.env.AWS_SECRET_KEY || ''
    }
});

const S3_BUCKET = process.env.AWS_BUCKET_NAME || 'solarhut';
const SIGNED_URL_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

console.log(`🔧 S3 Configuration loaded:`);
console.log(`   Bucket: ${S3_BUCKET}`);
console.log(`   Region: ${process.env.AWS_BUCKET_REGION}`);
console.log(`   Access Key ID: ${process.env.AWS_ACCESS_KEY?.substring(0, 10)}...`);

/**
 * Upload file to S3 bucket
 * @param filePath Local file path (can be relative or absolute)
 * @param s3Key S3 object key (path in bucket)
 * @param contentType MIME type
 * @returns S3 key and bucket
 */
export const uploadToS3 = async (
    filePath: string,
    s3Key: string,
    contentType: string = 'application/octet-stream'
): Promise<{ s3Key: string; s3Bucket: string; fileSize: number }> => {
    try {
        // Construct absolute path if relative path is provided
        let absolutePath = filePath;
        
        // Normalize path - remove leading slashes and construct absolute path
        const normalizedPath = filePath.replace(/^[\/\\]+/, ''); // Remove leading slashes/backslashes
        
        if (!path.isAbsolute(filePath)) {
            // Relative path - join with current working directory
            absolutePath = path.join(process.cwd(), normalizedPath);
        } else {
            // Already absolute on Windows, just use as-is
            absolutePath = filePath;
        }
        
        console.log(`📂 File path handling:`);
        console.log(`   Original: ${filePath}`);
        console.log(`   Absolute: ${absolutePath}`);
        
        // Check if file exists
        if (!fs.existsSync(absolutePath)) {
            console.error(`❌ File not found at: ${absolutePath}`);
            
            // Try alternative paths
            const altPaths = [
                path.join(process.cwd(), filePath),
                path.join(process.cwd(), normalizedPath),
                filePath
            ];
            
            console.log(`   Trying alternative paths...`);
            for (const alt of altPaths) {
                console.log(`   - ${alt} [${fs.existsSync(alt) ? 'EXISTS' : 'not found'}]`);
                if (fs.existsSync(alt)) {
                    absolutePath = alt;
                    break;
                }
            }
            
            if (!fs.existsSync(absolutePath)) {
                throw new Error(`File not found: ${filePath} (checked: ${absolutePath})`);
            }
        }
        
        console.log(`✓ File found at: ${absolutePath}`);
        
        // Read file
        const fileContent = fs.readFileSync(absolutePath);
        const fileSize = fileContent.length;

        // Upload to S3
        const uploadCommand = new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: s3Key,
            Body: fileContent,
            ContentType: contentType,
            ServerSideEncryption: 'AES256',
            Metadata: {
                uploadedAt: new Date().toISOString()
            }
        });

        await s3Client.send(uploadCommand);

        console.log(`✅ File uploaded to S3: s3://${S3_BUCKET}/${s3Key}`);

        return {
            s3Key,
            s3Bucket: S3_BUCKET,
            fileSize
        };
    } catch (error: any) {
        console.error('Error uploading to S3:', error);
        throw new Error(`S3 upload failed: ${error.message}`);
    }
};

/**
 * Generate signed URL for S3 object
 * @param s3Key S3 object key
 * @param expirySeconds URL expiry time in seconds (default 7 days)
 * @returns Signed URL
 */
export const generateSignedUrl = async (
    s3Key: string,
    expirySeconds: number = SIGNED_URL_EXPIRY
): Promise<string> => {
    try {
        const getObjectCommand = new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: s3Key
        });

        const signedUrl = await getSignedUrl(s3Client, getObjectCommand, {
            expiresIn: expirySeconds
        });

        console.log(`Generated signed URL for: ${s3Key}`);
        return signedUrl;
    } catch (error: any) {
        console.error('Error generating signed URL:', error);
        throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
};

/**
 * Delete file from S3
 * @param s3Key S3 object key
 */
export const deleteFromS3 = async (s3Key: string): Promise<void> => {
    try {
        const deleteCommand = new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: s3Key
        });

        await s3Client.send(deleteCommand);
        console.log(`File deleted from S3: ${s3Key}`);
    } catch (error: any) {
        console.error('Error deleting from S3:', error);
        throw new Error(`S3 deletion failed: ${error.message}`);
    }
};

/**
 * Generate S3 key for job attachments
 * @param jobId Job ID
 * @param status Job status
 * @param fileName Original file name
 * @returns S3 key
 */
export const generateS3Key = (jobId: number, status: string, fileName: string): string => {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `jobs/${jobId}/attachments/${status}/${timestamp}-${sanitizedFileName}`;
};

/**
 * Process and upload attachment
 * @param filePath Local file path
 * @param jobId Job ID
 * @param status Job status
 * @param contentType MIME type
 * @returns S3 details and signed URL
 */
export const processAttachmentUpload = async (
    filePath: string,
    jobId: number,
    status: string,
    contentType: string
): Promise<{
    s3Key: string;
    s3Bucket: string;
    signedUrl: string;
    fileSize: number;
    fileName: string;
}> => {
    try {
        const fileName = path.basename(filePath);
        const s3Key = generateS3Key(jobId, status, fileName);

        // Upload to S3
        const { s3Key: finalS3Key, s3Bucket, fileSize } = await uploadToS3(
            filePath,
            s3Key,
            contentType
        );

        // Generate signed URL
        const signedUrl = await generateSignedUrl(finalS3Key);

        return {
            s3Key: finalS3Key,
            s3Bucket,
            signedUrl,
            fileSize,
            fileName
        };
    } catch (error: any) {
        console.error('Error processing attachment:', error);
        throw error;
    }
};

/**
 * Batch process multiple attachments
 * @param attachments Array of file paths and metadata
 * @param jobId Job ID
 * @param status Job status
 * @returns Processed attachments with signed URLs
 */
export const batchProcessAttachments = async (
    attachments: Array<{ filePath: string; contentType: string; fileName: string }>,
    jobId: number,
    status: string
): Promise<Array<{
    s3Key: string;
    s3Bucket: string;
    signedUrl: string;
    fileSize: number;
    fileName: string;
}>> => {
    try {
        const processed = await Promise.all(
            attachments.map(att =>
                processAttachmentUpload(att.filePath, jobId, status, att.contentType)
            )
        );

        return processed;
    } catch (error: any) {
        console.error('Error batch processing attachments:', error);
        throw error;
    }
};

/**
 * Get signed URLs for multiple S3 keys
 * @param s3Keys Array of S3 keys
 * @returns Array of signed URLs
 */
export const getMultipleSignedUrls = async (
    s3Keys: string[]
): Promise<{ [key: string]: string }> => {
    try {
        const urls: { [key: string]: string } = {};

        await Promise.all(
            s3Keys.map(async (key) => {
                urls[key] = await generateSignedUrl(key);
            })
        );

        return urls;
    } catch (error: any) {
        console.error('Error getting multiple signed URLs:', error);
        throw error;
    }
};

export default {
    uploadToS3,
    generateSignedUrl,
    deleteFromS3,
    generateS3Key,
    processAttachmentUpload,
    batchProcessAttachments,
    getMultipleSignedUrls
};

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to convert FormData attachments into proper array structure
 * Handles both nested objects and flattened form fields
 * 
 * Converts:
 *   - attachments: [file1, file2] (multer uploaded files)
 *   - attachment_type_0: "image", file_name_0: "photo.jpg", ...
 * 
 * Into:
 *   - attachments: [
 *       { attachment_type: "image", file_name: "photo.jpg", file: {...} },
 *       ...
 *     ]
 */
export const normalizeFormDataAttachments = (req: Request, res: Response, next: NextFunction) => {
    try {
        // DEBUG: Log what multer received
        console.log('\n📂 normalizeFormDataAttachments middleware:');
        console.log(`  - req.files exists: ${!!req.files}`);
        console.log(`  - req.files is array: ${Array.isArray(req.files)}`);
        if (req.files) {
            console.log(`  - req.files length: ${Array.isArray(req.files) ? req.files.length : Object.keys(req.files || {}).length}`);
            console.log(`  - req.files keys: ${Object.keys(req.files || {})}`);
            if (Array.isArray(req.files) && req.files.length > 0) {
                console.log(`  - First file name: ${req.files[0].originalname}`);
                console.log(`  - First file path: ${req.files[0].path}`);
            }
        }
        console.log(`  - req.body.attachments exists: ${!!req.body?.attachments}`);
        if (req.body?.attachments) {
            console.log(`  - req.body.attachments is array: ${Array.isArray(req.body.attachments)}`);
            if (Array.isArray(req.body.attachments)) {
                console.log(`  - req.body.attachments length: ${req.body.attachments.length}`);
                if (req.body.attachments.length > 0) {
                    console.log(`  - First attachment keys: ${Object.keys(req.body.attachments[0])}`);
                    console.log(`  - First attachment file property: ${!!req.body.attachments[0].file}`);
                }
            } else {
                console.log(`  - req.body.attachments type: ${typeof req.body.attachments}`);
            }
        }
        
        // Only process if body exists
        if (!req.body) {
            return next();
        }

        // If attachments are already a proper array, skip processing
        if (Array.isArray(req.body.attachments) && req.body.attachments.length > 0) {
            // Verify array items are proper objects
            if (req.body.attachments[0].fieldname !== undefined || 
                req.body.attachments[0].attachment_type !== undefined ||
                req.body.attachments[0].file !== undefined) {
                console.log(`✅ Attachments already in proper array format with ${req.body.attachments.length} items`);
                console.log(`   - First item keys: ${Object.keys(req.body.attachments[0])}`);
                console.log(`   - First item has .file: ${!!req.body.attachments[0].file}`);
                return next();
            }
        }

        // Handle case where attachments is an empty object {} instead of array []
        if (req.body.attachments && typeof req.body.attachments === 'object' && !Array.isArray(req.body.attachments)) {
            const attachmentKeys = Object.keys(req.body.attachments);
            
            // If it's an empty object or only contains empty values
            if (attachmentKeys.length === 0) {
                // Check if attachment details are at root level (attachment_type, file_name, mime_type)
                if (req.body.attachment_type || req.body.file_name) {
                    console.log('📋 Restructuring attachment: root level fields → array format');
                    
                    // Move attachment fields from root to array
                    const attachment: any = {};
                    
                    // Copy all attachment-related fields
                    if (req.body.attachment_type) attachment.attachment_type = req.body.attachment_type;
                    if (req.body.file_name) attachment.file_name = req.body.file_name;
                    if (req.body.file_path) attachment.file_path = req.body.file_path;
                    if (req.body.file_size) attachment.file_size = req.body.file_size;
                    if (req.body.mime_type) attachment.mime_type = req.body.mime_type;
                    if (req.body.s3_key) attachment.s3_key = req.body.s3_key;
                    if (req.body.s3_bucket) attachment.s3_bucket = req.body.s3_bucket;
                    
                    if (Object.keys(attachment).length > 0) {
                        req.body.attachments = [attachment];
                        
                        // Remove from root level to avoid validation errors
                        delete req.body.attachment_type;
                        delete req.body.file_name;
                        delete req.body.file_path;
                        delete req.body.file_size;
                        delete req.body.mime_type;
                        delete req.body.s3_key;
                        delete req.body.s3_bucket;
                        
                        console.log('✓ Attachment restructured:', JSON.stringify(req.body.attachments[0]));
                        return next();
                    }
                } else {
                    // Empty object and no root level fields - convert to empty array
                    req.body.attachments = [];
                    return next();
                }
            }
        }

        // Convert FormData flattened structure to nested array
        const attachments: any[] = [];
        let maxIndex = -1;

        // Find all indexed fields
        const indexPattern = /_(\d+)$/;
        
        for (const key in req.body) {
            const match = key.match(indexPattern);
            if (match) {
                const index = parseInt(match[1], 10);
                maxIndex = Math.max(maxIndex, index);
            }
        }

        // Build attachments array from indexed fields
        if (maxIndex >= 0) {
            for (let i = 0; i <= maxIndex; i++) {
                const attachment: any = {};

                // Try to find properties for this index
                for (const key in req.body) {
                    if (key.endsWith(`_${i}`)) {
                        const baseKey = key.substring(0, key.length - (`_${i}`.length));
                        attachment[baseKey] = req.body[key];
                        delete req.body[key]; // Remove the indexed version
                    }
                }

                // Only add if we found some properties
                if (Object.keys(attachment).length > 0) {
                    attachments.push(attachment);
                }
            }
        }

        // If we found indexed attachments, use them
        if (attachments.length > 0) {
            req.body.attachments = attachments;
        }

        // Handle multer files array (from -F "attachments=@file1" -F "attachments=@file2")
        if (req.files && Array.isArray(req.files)) {
            const multerFiles = req.files;
            console.log(`\n✅ multer files detected: ${multerFiles.length} files`);
            
            if (!req.body.attachments) {
                req.body.attachments = [];
            } else if (!Array.isArray(req.body.attachments)) {
                req.body.attachments = [req.body.attachments];
            }

            // Add multer files to attachments with proper path
            for (const file of multerFiles) {
                const attachment: any = {
                    attachment_type: req.body[`attachment_type_${multerFiles.indexOf(file)}`] || 'document',
                    file_name: file.originalname || file.filename,
                    file: file, // Keep full multer object for compatibility
                    file_path: file.path, // Add actual file path from multer
                    file_size: file.size,
                    mime_type: file.mimetype
                };
                
                console.log(`  - Attachment added: ${file.originalname}, path: ${file.path}`);
                req.body.attachments.push(attachment);
            }
            
            console.log(`✓ Converted ${req.body.attachments.length} files to attachments`);
        }

        // Handle single file field with attachments array markers
        if (req.file && req.body.attachments) {
            if (!Array.isArray(req.body.attachments)) {
                req.body.attachments = [req.body.attachments];
            }

            const attachment: any = {
                attachment_type: req.body.attachment_type || 'document',
                file_name: req.file.originalname || req.file.filename,
                file: req.file, // Keep full multer object
                file_path: req.file.path, // Add actual file path from multer
                file_size: req.file.size,
                mime_type: req.file.mimetype
            };

            req.body.attachments.push(attachment);
        }

        // FINAL DEBUG: Show what we're passing to the controller
        console.log(`\n📤 Final attachment status for controller:`);
        if (req.body.attachments && Array.isArray(req.body.attachments)) {
            console.log(`  - Total attachments: ${req.body.attachments.length}`);
            for (let i = 0; i < req.body.attachments.length; i++) {
                const att = req.body.attachments[i];
                console.log(`  [${i}] ${att.file_name} - has file: ${!!att.file}, file path: ${att.file_path || 'N/A'}`);
            }
        } else {
            console.log(`  - No attachments array found in req.body`);
        }

        next();
    } catch (error: any) {
        console.error('Error normalizing FormData attachments:', error);
        // Continue anyway - let validation handle any issues
        next();
    }
};

/**
 * Alternative approach: Parse attachments from FormData for simpler structure
 * Use this if you want to keep attachment metadata separate from files
 */
export const parseAttachmentsFromFormData = (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.body) {
            return next();
        }

        // If we have multer files, they're in req.files
        if (req.files) {
            const files = Array.isArray(req.files) ? req.files : [req.files];
            
            req.body.attachments = files.map((file: any, index: number) => ({
                attachment_type: req.body[`attachment_type[${index}]`] || 
                                req.body[`attachment_type_${index}`] || 
                                'document',
                file_name: file.originalname || file.filename,
                file: file,
                file_size: file.size,
                mime_type: file.mimetype
            }));
        }

        next();
    } catch (error: any) {
        console.error('Error parsing FormData attachments:', error);
        next();
    }
};

// Final logging for all attachment processing - this runs after middleware chain before controller
export const logAttachmentsBeforeController = (req: Request, res: Response, next: NextFunction) => {
    try {
        console.log(`\n🔚 BEFORE CONTROLLER - Attachment Status:`);
        console.log(`  - req.body.attachments exists: ${!!req.body?.attachments}`);
        if (req.body?.attachments) {
            if (Array.isArray(req.body.attachments)) {
                console.log(`  - req.body.attachments length: ${req.body.attachments.length}`);
                if (req.body.attachments.length > 0) {
                    console.log(`  - First attachment: file_name=${req.body.attachments[0].file_name}, has .file=${!!req.body.attachments[0].file}, attachment_type=${req.body.attachments[0].attachment_type}`);
                }
            } else {
                console.log(`  - req.body.attachments is NOT array, type: ${typeof req.body.attachments}`);
            }
        } else {
            console.log(`  - No attachments in req.body`);
        }
        next();
    } catch (error) {
        console.error('Error in logAttachmentsBeforeController:', error);
        next();
    }
};

export default normalizeFormDataAttachments;

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    PutObjectCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    CopyObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { SpacesConfig, SPACES_CONFIG } from '../config/spaces.config';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
    url: string;
    key: string;
    type: string;
}

@Injectable()
export class UploadService {
    private readonly logger = new Logger(UploadService.name);
    private readonly s3Client;
    private readonly bucketName: string;
    private readonly spacesUrl: string;

    constructor(private configService: ConfigService) {
        this.s3Client = SpacesConfig.getClient(configService);
        this.bucketName = this.configService.get<string>(SPACES_CONFIG.BUCKET_NAME);
        this.spacesUrl = this.configService.get<string>('SPACES_CDN_URL') ||
            `https://${this.bucketName}.${this.configService.get<string>('SPACES_REGION')}.digitaloceanspaces.com`;
    }

    /**
     * Validates file based on type and size constraints
     */
    validateFile(file: Express.Multer.File, fileType: 'PROFILE_PICTURE' | 'DOCUMENT' | 'PAYMENT_RECEIPT'): void {
        // Get specific size limit for this file type
        const maxFileSize = SPACES_CONFIG.MAX_FILE_SIZE[fileType];
        const maxSizeMB = (maxFileSize / (1024 * 1024)).toFixed(0);

        // Check file size against specific limit
        if (file.size > maxFileSize) {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            throw new BadRequestException(
                `File size exceeds ${maxSizeMB}MB limit for ${fileType}. Your file size: ${fileSizeMB}MB`
            );
        }

        // Check file extension
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = SPACES_CONFIG.ALLOWED_FILE_TYPES[fileType];

        if (!allowedExtensions.includes(fileExtension)) {
            throw new BadRequestException(
                `Invalid file type. Allowed types for ${fileType}: ${allowedExtensions.join(', ')}`
            );
        }

        this.logger.log(`File validation passed for ${fileType}:`, {
            originalName: file.originalname,
            size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
            maxAllowed: `${maxSizeMB}MB`,
            extension: fileExtension
        });
    }

    /**
     * Generate a unique file key for storage
     * @param applicationNumber - Application number (e.g., APP001) or null for temp storage
     * @param originalName - Original filename
     * @param fileType - Type of file being uploaded
     * @param isTemp - Whether this is temporary storage
     */
    generateFileKey(applicationNumber: string | null, originalName: string, fileType: string, isTemp: boolean = false): string {
        const fileExtension = path.extname(originalName).toLowerCase();
        const timestamp = Date.now();
        const uniqueId = uuidv4().substring(0, 8);

        // Create a clean filename
        const baseFileName = `${fileType}_${timestamp}_${uniqueId}`;

        if (isTemp) {
            // Store in temp folder with temp prefix
            const tempFolderName = applicationNumber ? `temp_${applicationNumber}` : `temp_${timestamp}`;
            return `${SPACES_CONFIG.FILE_PATHS.TEMP}/${tempFolderName}/${baseFileName}${fileExtension}`;
        } else {
            // Store in final applications folder using application number
            return `${SPACES_CONFIG.FILE_PATHS.APPLICATIONS}/${applicationNumber}/${baseFileName}${fileExtension}`;
        }
    }

    private slugifyFilePart(value: string): string {
        return value
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'payment-receipt';
    }

    private formatDateStamp(date: Date = new Date()): string {
        const day = `${date.getDate()}`.padStart(2, '0');
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const year = `${date.getFullYear()}`;
        return `${day}${month}${year}`;
    }

    private async uploadWithKey(
        file: Express.Multer.File,
        key: string,
        metadata: Record<string, string>,
    ): Promise<UploadResult> {
        const upload = new Upload({
            client: this.s3Client,
            params: {
                Bucket: this.bucketName,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
                ACL: 'public-read',
                Metadata: metadata,
            },
        });

        await upload.done();

        return {
            url: `${this.spacesUrl}/${key}`,
            key,
            type: metadata.fileType || 'document',
        };
    }

    /**
     * Upload file to DigitalOcean Spaces
     * @param file - The file to upload
     * @param applicationNumber - Application number for organization
     * @param fileType - Type of file being uploaded
     * @param isTemp - Whether to store in temp folder (default: true for initial uploads)
     */
    async uploadToSpaces(
        file: Express.Multer.File,
        applicationNumber: string,
        fileType: string,
        isTemp: boolean = true
    ): Promise<UploadResult> {
        try {
            // Validate the file
            const validationType = fileType === 'profile_picture' ? 'PROFILE_PICTURE' : 'DOCUMENT';
            this.validateFile(file, validationType);

            // Generate unique file key
            const key = this.generateFileKey(applicationNumber, file.originalname, fileType, isTemp);

            this.logger.log(`Starting upload to Spaces:`, {
                applicationNumber,
                fileType,
                originalName: file.originalname,
                key,
                size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
                isTemp
            });

            const result = await this.uploadWithKey(file, key, {
                applicationNumber,
                fileType,
                originalName: file.originalname,
                uploadedBy: 'application-portal',
                isTemp: isTemp.toString(),
            });

            this.logger.log('File uploaded successfully to Spaces:', {
                applicationNumber,
                fileType,
                url: result.url,
                key,
                isTemp
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to upload file to Spaces:', {
                applicationNumber,
                fileType,
                originalName: file.originalname,
                error: error.message,
                stack: error.stack
            });
            throw new BadRequestException(`Failed to upload file: ${error.message}`);
        }
    }

    async uploadPaymentReceipt(
        file: Express.Multer.File,
        applicationNumber: string,
        paymentName: string,
    ): Promise<UploadResult> {
        try {
            this.validateFile(file, 'PAYMENT_RECEIPT');

            const extension = path.extname(file.originalname).toLowerCase();
            const fileName = `${this.slugifyFilePart(paymentName)}-${this.formatDateStamp()}${extension}`;
            const key = `${SPACES_CONFIG.FILE_PATHS.PAYMENT_RECEIPTS}/${applicationNumber}/${fileName}`;

            this.logger.log('Starting payment receipt upload to Spaces:', {
                applicationNumber,
                paymentName,
                originalName: file.originalname,
                key,
                size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
            });

            return await this.uploadWithKey(file, key, {
                applicationNumber,
                fileType: 'payment_receipt',
                paymentName,
                originalName: file.originalname,
                uploadedBy: 'payments-module',
                isTemp: 'false',
            });
        } catch (error) {
            this.logger.error('Failed to upload payment receipt to Spaces:', {
                applicationNumber,
                paymentName,
                originalName: file.originalname,
                error: error.message,
                stack: error.stack,
            });

            throw new BadRequestException(`Failed to upload payment receipt: ${error.message}`);
        }
    }

    /**
     * Delete file from DigitalOcean Spaces (for rollback scenarios)
     */
    async deleteFromSpaces(key: string): Promise<void> {
        try {
            this.logger.log(`Attempting to delete file from Spaces:`, { key });

            const deleteCommand = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            await this.s3Client.send(deleteCommand);

            this.logger.log('File deleted successfully from Spaces:', { key });
        } catch (error) {
            this.logger.error('Failed to delete file from Spaces:', {
                key,
                error: error.message,
                stack: error.stack
            });
            // Don't throw error here as this is cleanup operation
        }
    }

    /**
     * Get file URL by key
     */
    getFileUrl(key: string): string {
        return `${this.spacesUrl}/${key}`;
    }

    extractKeyFromUrl(url?: string | null): string | null {
        if (!url) {
            return null;
        }

        try {
            const parsedUrl = new URL(url);
            let key = decodeURIComponent(parsedUrl.pathname || '').replace(/^\/+/, '');

            if (!key) {
                return null;
            }

            const bucketPrefix = `${this.bucketName}/`;
            if (key.startsWith(bucketPrefix)) {
                key = key.slice(bucketPrefix.length);
            }

            return key || null;
        } catch (error) {
            this.logger.warn('Failed to extract Spaces key from URL:', {
                url,
                error: error.message,
            });
            return null;
        }
    }

    async deleteByUrl(url?: string | null): Promise<void> {
        const key = this.extractKeyFromUrl(url);

        if (!key) {
            return;
        }

        await this.deleteFromSpaces(key);
    }

    async deleteManyFromSpaces(keys: string[]): Promise<void> {
        const normalizedKeys = [...new Set((keys || []).filter(Boolean))];

        if (!normalizedKeys.length) {
            return;
        }

        try {
            for (let index = 0; index < normalizedKeys.length; index += 1000) {
                const batch = normalizedKeys.slice(index, index + 1000);
                const deleteCommand = new DeleteObjectsCommand({
                    Bucket: this.bucketName,
                    Delete: {
                        Objects: batch.map((key) => ({ Key: key })),
                        Quiet: true,
                    },
                });

                await this.s3Client.send(deleteCommand);
            }

            this.logger.log('Deleted multiple files from Spaces successfully:', {
                count: normalizedKeys.length,
            });
        } catch (error) {
            this.logger.error('Failed to delete multiple files from Spaces:', {
                count: normalizedKeys.length,
                error: error.message,
                stack: error.stack,
            });
        }
    }

    async deleteByPrefix(prefix: string): Promise<void> {
        if (!prefix) {
            return;
        }

        try {
            let continuationToken: string | undefined;
            const keysToDelete: string[] = [];

            do {
                const listCommand = new ListObjectsV2Command({
                    Bucket: this.bucketName,
                    Prefix: prefix,
                    ContinuationToken: continuationToken,
                });

                const response = await this.s3Client.send(listCommand);

                response.Contents?.forEach((entry) => {
                    if (entry.Key) {
                        keysToDelete.push(entry.Key);
                    }
                });

                continuationToken = response.IsTruncated
                    ? response.NextContinuationToken
                    : undefined;
            } while (continuationToken);

            await this.deleteManyFromSpaces(keysToDelete);
        } catch (error) {
            this.logger.error('Failed to delete Spaces objects by prefix:', {
                prefix,
                error: error.message,
                stack: error.stack,
            });
        }
    }

    getApplicationTempPrefix(applicationNumber: string): string {
        return `${SPACES_CONFIG.FILE_PATHS.TEMP}/temp_${applicationNumber}/`;
    }

    /**
     * Move file from temp storage to final applications folder
     * @param tempKey - Current key in temp storage
     * @param applicationNumber - Application number for final storage
     * @param fileType - Type of file
     */
    async moveFromTempToFinal(tempKey: string, applicationNumber: string, fileType: string): Promise<UploadResult> {
        try {
            this.logger.log('Moving file from temp to final storage:', {
                tempKey,
                applicationNumber,
                fileType
            });

            // Extract original filename from temp key
            const tempFileName = path.basename(tempKey);
            const fileExtension = path.extname(tempFileName);

            // Generate final key
            const finalKey = `${SPACES_CONFIG.FILE_PATHS.APPLICATIONS}/${applicationNumber}/${tempFileName}`;

            // Copy from temp to final location
            const copyCommand = new CopyObjectCommand({
                Bucket: this.bucketName,
                Key: finalKey,
                CopySource: `${this.bucketName}/${tempKey}`,
                ACL: 'public-read',
                MetadataDirective: 'REPLACE',
                Metadata: {
                    applicationNumber,
                    fileType,
                    uploadedBy: 'application-portal',
                    movedFromTemp: 'true'
                }
            });

            await this.s3Client.send(copyCommand);

            // Delete from temp location
            await this.deleteFromSpaces(tempKey);

            const finalUrl = `${this.spacesUrl}/${finalKey}`;

            this.logger.log('File moved successfully from temp to final storage:', {
                tempKey,
                finalKey,
                finalUrl
            });

            return {
                url: finalUrl,
                key: finalKey,
                type: fileType
            };
        } catch (error) {
            this.logger.error('Failed to move file from temp to final storage:', {
                tempKey,
                applicationNumber,
                error: error.message
            });
            throw new BadRequestException(`Failed to move file: ${error.message}`);
        }
    }

    /**
     * Clean up temp files older than specified hours
     * @param applicationNumber - Specific application to clean up, or null for all temp files
     * @param maxAgeHours - Maximum age in hours (default from config)
     */
    async cleanupTempFiles(applicationNumber?: string, maxAgeHours: number = SPACES_CONFIG.TEMP_FILE_EXPIRY_HOURS): Promise<void> {
        try {
            const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));

            this.logger.log('Starting temp file cleanup:', {
                applicationNumber: applicationNumber || 'all',
                cutoffTime,
                maxAgeHours
            });

            // Note: For full implementation, you'd need to list objects in temp folder
            // and check their LastModified date, then delete old ones
            // This would require additional S3 list operations

            if (applicationNumber) {
                // Clean up specific application's temp files
                const tempFolderPrefix = `${SPACES_CONFIG.FILE_PATHS.TEMP}/temp_${applicationNumber}/`;

                this.logger.log('Cleaning up temp files for specific application:', {
                    applicationNumber,
                    tempFolderPrefix
                });

                // Implementation would go here to list and delete files in this prefix
            }

        } catch (error) {
            this.logger.error('Failed to cleanup temp files:', {
                applicationNumber,
                error: error.message
            });
        }
    }
}
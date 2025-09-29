import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, DeleteObjectCommand, CopyObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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
    validateFile(file: Express.Multer.File, fileType: 'PROFILE_PICTURE' | 'DOCUMENT'): void {
        // Check file size
        if (file.size > SPACES_CONFIG.MAX_FILE_SIZE) {
            throw new BadRequestException(`File size exceeds 5MB limit. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
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

            // Create upload instance for handling large files
            const upload = new Upload({
                client: this.s3Client,
                params: {
                    Bucket: this.bucketName,
                    Key: key,
                    Body: file.buffer,
                    ContentType: file.mimetype,
                    ACL: 'public-read', // Make files publicly accessible
                    Metadata: {
                        applicationNumber,
                        fileType,
                        originalName: file.originalname,
                        uploadedBy: 'application-portal',
                        isTemp: isTemp.toString()
                    }
                },
            });

            // Execute upload
            const result = await upload.done();

            const fileUrl = `${this.spacesUrl}/${key}`;

            this.logger.log('File uploaded successfully to Spaces:', {
                applicationNumber,
                fileType,
                url: fileUrl,
                key,
                isTemp
            });

            return {
                url: fileUrl,
                key,
                type: fileType
            };
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
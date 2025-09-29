import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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
     */
    generateFileKey(applicationId: string, originalName: string, fileType: string): string {
        const fileExtension = path.extname(originalName).toLowerCase();
        const timestamp = Date.now();
        const uniqueId = uuidv4().substring(0, 8);

        // Create a clean filename
        const baseFileName = `${fileType}_${timestamp}_${uniqueId}`;

        return `${SPACES_CONFIG.FILE_PATHS.APPLICATIONS}/${applicationId}/${baseFileName}${fileExtension}`;
    }

    /**
     * Upload file to DigitalOcean Spaces
     */
    async uploadToSpaces(
        file: Express.Multer.File,
        applicationId: string,
        fileType: string
    ): Promise<UploadResult> {
        try {
            // Validate the file
            const validationType = fileType === 'profile_picture' ? 'PROFILE_PICTURE' : 'DOCUMENT';
            this.validateFile(file, validationType);

            // Generate unique file key
            const key = this.generateFileKey(applicationId, file.originalname, fileType);

            this.logger.log(`Starting upload to Spaces:`, {
                applicationId,
                fileType,
                originalName: file.originalname,
                key,
                size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`
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
                        applicationId,
                        fileType,
                        originalName: file.originalname,
                        uploadedBy: 'application-portal'
                    }
                },
            });

            // Execute upload
            const result = await upload.done();

            const fileUrl = `${this.spacesUrl}/${key}`;

            this.logger.log('File uploaded successfully to Spaces:', {
                applicationId,
                fileType,
                url: fileUrl,
                key
            });

            return {
                url: fileUrl,
                key,
                type: fileType
            };
        } catch (error) {
            this.logger.error('Failed to upload file to Spaces:', {
                applicationId,
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
}
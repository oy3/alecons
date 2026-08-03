import { Injectable, Logger } from '@nestjs/common';
import { UploadService } from './upload.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Application, ApplicationDocument, ApplicationStatus } from '../schemas/application.schema';

@Injectable()
export class TempFileCleanupService {
    private readonly logger = new Logger(TempFileCleanupService.name);

    constructor(
        private readonly uploadService: UploadService,
        @InjectModel(Application.name) private applicationModel: Model<ApplicationDocument>,
    ) { }

    /**
     * Manual cleanup of expired temp files
     * Can be called via API endpoint or manually
     */
    async cleanupExpiredTempFiles(): Promise<{ cleaned: number; failed: number }> {
        this.logger.log('Starting cleanup of expired temp files...');

        try {
            // Find applications that are not yet submitted (status is still pending and currentStage < 4)
            const incompleteApplications = await this.applicationModel.find({
                $or: [
                    { currentStage: { $lt: 4 } },
                    { status: { $ne: ApplicationStatus.PENDING } }
                ],
                updatedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Older than 24 hours
            }).select('applicationNumber updatedAt');

            this.logger.log(`Found ${incompleteApplications.length} incomplete applications for cleanup`);

            let totalCleaned = 0;
            let totalFailed = 0;

            for (const application of incompleteApplications) {
                try {
                    await this.uploadService.cleanupTempFiles(application.applicationNumber);
                    totalCleaned++;

                    this.logger.log(`Cleaned temp files for application: ${application.applicationNumber}`);
                } catch (error) {
                    totalFailed++;
                    this.logger.error(`Failed to cleanup temp files for application ${application.applicationNumber}:`, {
                        error: error.message
                    });
                }
            }

            this.logger.log(`Temp file cleanup completed. Cleaned: ${totalCleaned}, Failed: ${totalFailed}`);

            return { cleaned: totalCleaned, failed: totalFailed };

        } catch (error) {
            this.logger.error('Temp file cleanup failed:', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Manual cleanup of temp files for a specific application
     */
    async cleanupApplicationTempFiles(applicationNumber: string): Promise<void> {
        this.logger.log(`Manual cleanup requested for application: ${applicationNumber}`);

        try {
            await this.uploadService.cleanupTempFiles(applicationNumber);
            this.logger.log(`Manual cleanup completed for application: ${applicationNumber}`);
        } catch (error) {
            this.logger.error(`Manual cleanup failed for application ${applicationNumber}:`, {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Cleanup temp files for applications that have been successfully submitted
     * This ensures no temp files are left behind after successful submission
     */
    async cleanupSubmittedApplicationsTempFiles(): Promise<void> {
        this.logger.log('Starting cleanup of temp files for submitted applications...');

        try {
            // Find applications that have been successfully submitted
            const submittedApplications = await this.applicationModel.find({
                status: ApplicationStatus.PENDING,
                currentStage: { $gte: 4 } // Application completed
            }).select('applicationNumber');

            this.logger.log(`Found ${submittedApplications.length} submitted applications to cleanup temp files`);

            for (const application of submittedApplications) {
                try {
                    await this.uploadService.cleanupTempFiles(application.applicationNumber);
                    this.logger.log(`Cleaned temp files for submitted application: ${application.applicationNumber}`);
                } catch (error) {
                    this.logger.error(`Failed to cleanup temp files for submitted application ${application.applicationNumber}:`, {
                        error: error.message
                    });
                }
            }

            this.logger.log('Cleanup of submitted applications temp files completed.');

        } catch (error) {
            this.logger.error('Cleanup of submitted applications temp files failed:', {
                error: error.message,
                stack: error.stack
            });
        }
    }
}
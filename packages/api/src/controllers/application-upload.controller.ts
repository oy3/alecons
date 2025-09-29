import {
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
    Body,
    UseGuards,
    Request,
    BadRequestException,
    HttpException,
    HttpStatus,
    Logger
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService } from '../services/upload.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Application, ApplicationDocument, ApplicationStatus } from '../schemas/application.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { ProgramType, ProgramTypeDocument } from '../schemas/program-type.schema';
import { ProgramMode, ProgramModeDocument } from '../schemas/program-mode.schema';

interface UploadFileDto {
    fileType: 'profile_picture' | 'olevel_result' | 'reference_letter';
    sittingIndex?: number; // For O'level results
    referenceIndex?: number; // For reference letters
}

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationUploadController {
    private readonly logger = new Logger(ApplicationUploadController.name);

    constructor(
        private readonly uploadService: UploadService,
        @InjectModel(Application.name) private applicationModel: Model<ApplicationDocument>,
        @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
        @InjectModel(ProgramType.name) private programTypeModel: Model<ProgramTypeDocument>,
        @InjectModel(ProgramMode.name) private programModeModel: Model<ProgramModeDocument>,
    ) { }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Body() uploadData: UploadFileDto,
        @Request() req
    ) {
        this.logger.log('Upload request received:', {
            hasFile: !!file,
            uploadData,
            userId: req.user?._id?.toString()
        });

        try {
            // Validate request
            if (!file) {
                this.logger.error('No file provided in upload request');
                throw new BadRequestException('No file provided');
            }

            if (!uploadData.fileType) {
                this.logger.error('No file type provided in upload request');
                throw new BadRequestException('File type is required');
            }

            const userId = req.user._id.toString();
            this.logger.log('File upload request:', {
                userId,
                fileType: uploadData.fileType,
                originalName: file.originalname,
                size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
                sittingIndex: uploadData.sittingIndex,
                referenceIndex: uploadData.referenceIndex,
                mimeType: file.mimetype,
                hasBuffer: !!file.buffer
            });

            // Check if user already has an application to use its ID for file organization
            // If not, use temp structure but organize files properly
            let application = await this.applicationModel.findOne({ userId: new Types.ObjectId(userId) });
            const applicationId = application ? application._id.toString() : `temp_${userId}_${Date.now()}`;

            // Upload to DigitalOcean Spaces (but don't save to MongoDB yet)
            const uploadResult = await this.uploadService.uploadToSpaces(
                file,
                applicationId,
                uploadData.fileType
            );

            // Prepare file metadata for frontend storage
            const fileMetadata = {
                type: uploadData.fileType,
                url: uploadResult.url,
                key: uploadResult.key, // Keep key for potential cleanup
                originalName: file.originalname,
                size: file.size,
                uploadedAt: new Date(),
                // Add additional metadata for specific file types
                ...(uploadData.sittingIndex !== undefined && { sittingIndex: uploadData.sittingIndex }),
                ...(uploadData.referenceIndex !== undefined && { referenceIndex: uploadData.referenceIndex })
            };

            this.logger.log('File uploaded to Spaces successfully (not saved to DB yet):', {
                userId,
                fileType: uploadData.fileType,
                url: uploadResult.url,
                key: uploadResult.key,
                message: 'File ready for form submission'
            });

            return {
                success: true,
                data: {
                    ...fileMetadata,
                    message: 'File uploaded to temporary storage. Submit form to complete application.'
                }
            };

        } catch (error) {
            this.logger.error('File upload failed:', {
                userId: req.user?._id,
                fileType: uploadData.fileType,
                error: error.message,
                stack: error.stack
            });

            if (error instanceof BadRequestException || error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'File upload failed',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('submit-application')
    async submitApplication(
        @Body() applicationData: {
            // Application form data
            programId: string;
            programTypeId: string;
            programModeId: string;
            personalInfo: {
                firstName?: string;
                middleName?: string;
                lastName?: string;
                dob: string;
                gender: string;
                phone: string;
                email?: string;
                religion: string;
                maritalStatus: string;
                address: string;
                lga: string;
                stateOfOrigin: string;
                nationality: string;
            };
            academicInfo: {
                primarySchool: {
                    name: string;
                    startDate: string;
                    endDate: string;
                };
                secondarySchool: {
                    name: string;
                    startDate: string;
                    endDate: string;
                };
                sittings: Array<{
                    examType: string;
                    examYear: string;
                    examNumber: string;
                }>;
                subjects: Array<{
                    subject: string;
                    grade: string;
                    sitting: string;
                }>;
                nextOfKin: {
                    name: string;
                    phone: string;
                    email: string;
                    relationship: string;
                    address: string;
                };
                referees: Array<{
                    name: string;
                    phone: string;
                    email: string;
                }>;
            };
            // Uploaded files data
            uploadedFiles: Array<{
                type: string;
                url: string;
                key: string;
                originalName: string;
                size: number;
                uploadedAt: string;
                sittingIndex?: number;
                referenceIndex?: number;
            }>;
        },
        @Request() req
    ) {
        this.logger.log('Application submission request received:', {
            userId: req.user._id.toString(),
            programId: applicationData.programId,
            uploadedFilesCount: applicationData.uploadedFiles?.length || 0,
            personalInfo: !!applicationData.personalInfo,
            academicInfo: !!applicationData.academicInfo
        });

        try {
            const userId = req.user._id; // Keep as ObjectId

            // Always update existing application (created during registration)
            let application = await this.applicationModel.findOne({ userId });

            if (!application) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Application not found. Please contact support.'
                    },
                    HttpStatus.NOT_FOUND
                );
            }

            this.logger.log('Updating existing application:', application._id.toString());

            // Prepare documents array from uploaded files
            const documents = applicationData.uploadedFiles.map(file => ({
                type: file.type,
                url: file.url,
                uploadedAt: new Date(file.uploadedAt),
                ...(file.sittingIndex !== undefined && { sittingIndex: file.sittingIndex }),
                ...(file.referenceIndex !== undefined && { referenceIndex: file.referenceIndex })
            }));

            // Find profile picture URL for profileImageUrl field
            const profilePicture = applicationData.uploadedFiles.find(f => f.type === 'profile_picture');

            // Prepare examinations data from sittings and subjects
            const examinations = applicationData.academicInfo.sittings
                .filter(sitting => sitting.examType && sitting.examYear && sitting.examNumber)
                .map(sitting => {
                    // Get subjects for this sitting
                    const sittingSubjects = applicationData.academicInfo.subjects
                        .filter(subject => subject.sitting === sitting.examType && subject.subject && subject.grade)
                        .map(subject => ({
                            subject: subject.subject,
                            grade: subject.grade
                        }));

                    return {
                        examType: sitting.examType,
                        examYear: sitting.examYear,
                        examNumber: sitting.examNumber,
                        subjects: sittingSubjects
                    };
                });

            // Filter valid referees (must have name, phone, and email)
            const referees = applicationData.academicInfo.referees
                .filter(referee => referee.name && referee.phone && referee.email)
                .map(referee => ({
                    name: referee.name,
                    phone: referee.phone,
                    email: referee.email
                }));

            try {
                // Update all application fields with form data
                application.programId = new Types.ObjectId(applicationData.programId);
                application.programTypeId = new Types.ObjectId(applicationData.programTypeId);
                application.programModeId = new Types.ObjectId(applicationData.programModeId);

                // Personal information
                application.dob = applicationData.personalInfo.dob ? new Date(applicationData.personalInfo.dob) : undefined;
                application.gender = applicationData.personalInfo.gender;
                application.phone = applicationData.personalInfo.phone;
                application.religion = applicationData.personalInfo.religion;
                application.maritalStatus = applicationData.personalInfo.maritalStatus;
                application.address = applicationData.personalInfo.address;
                application.stateOfOrigin = applicationData.personalInfo.stateOfOrigin;
                application.lga = applicationData.personalInfo.lga;
                application.nationality = applicationData.personalInfo.nationality;

                // Academic background
                application.academicBackground = {
                    primary: {
                        name: applicationData.academicInfo.primarySchool.name,
                        startDate: applicationData.academicInfo.primarySchool.startDate,
                        endDate: applicationData.academicInfo.primarySchool.endDate
                    },
                    secondary: {
                        name: applicationData.academicInfo.secondarySchool.name,
                        startDate: applicationData.academicInfo.secondarySchool.startDate,
                        endDate: applicationData.academicInfo.secondarySchool.endDate
                    }
                };

                // Next of kin
                if (applicationData.academicInfo.nextOfKin.name && applicationData.academicInfo.nextOfKin.phone) {
                    application.nextOfKin = {
                        name: applicationData.academicInfo.nextOfKin.name,
                        phone: applicationData.academicInfo.nextOfKin.phone,
                        email: applicationData.academicInfo.nextOfKin.email,
                        relationship: applicationData.academicInfo.nextOfKin.relationship,
                        address: applicationData.academicInfo.nextOfKin.address
                    };
                }

                // Referees and examinations
                application.referees = referees;
                application.examinations = examinations;

                // Documents and profile image
                application.documents = documents;
                if (profilePicture) {
                    application.profileImageUrl = profilePicture.url;
                }

                // Application status
                application.status = ApplicationStatus.PENDING;
                application.currentStage = 4;

                await application.save();

                this.logger.log('Application saved successfully:', {
                    applicationId: application._id.toString(),
                    userId: req.user._id,
                    documentsCount: documents.length,
                    examinationsCount: examinations.length,
                    refereesCount: referees.length,
                    hasNextOfKin: !!application.nextOfKin,
                    hasAcademicBackground: !!application.academicBackground
                });

                return {
                    success: true,
                    data: {
                        applicationId: application._id.toString(),
                        applicationNumber: application.applicationNumber,
                        status: application.status,
                        documentsUploaded: documents.length,
                        examinationsCount: examinations.length,
                        refereesCount: referees.length,
                        message: 'Application submitted successfully'
                    }
                };

            } catch (dbError) {
                this.logger.error('Database save failed, cleaning up uploaded files:', {
                    userId: req.user._id,
                    error: dbError.message,
                    stack: dbError.stack,
                    validationErrors: dbError.errors,
                    filesToCleanup: applicationData.uploadedFiles.map(f => f.key)
                });

                // Log the full error details for debugging
                this.logger.error('Full database error:', dbError);

                // Cleanup uploaded files from Spaces since DB save failed
                const cleanupPromises = applicationData.uploadedFiles.map(file =>
                    this.uploadService.deleteFromSpaces(file.key).catch(err =>
                        this.logger.error('Failed to cleanup file:', { key: file.key, error: err.message })
                    )
                );

                await Promise.all(cleanupPromises);

                throw new HttpException(
                    {
                        success: false,
                        message: 'Failed to save application. Database error: ' + dbError.message,
                        error: dbError.message,
                        details: dbError.errors || 'No additional details'
                    },
                    HttpStatus.INTERNAL_SERVER_ERROR
                );
            }

        } catch (error) {
            this.logger.error('Application submission failed:', {
                userId: req.user._id.toString(),
                error: error.message,
                stack: error.stack
            });

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Application submission failed',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('cleanup-temp-files')
    async cleanupTempFiles(
        @Body() cleanupData: {
            filesToCleanup: Array<{
                key: string;
                url: string;
            }>
        },
        @Request() req
    ) {
        this.logger.log('Cleanup temp files request:', {
            userId: req.user._id.toString(),
            filesToCleanup: cleanupData.filesToCleanup?.length || 0
        });

        try {
            if (!cleanupData.filesToCleanup || cleanupData.filesToCleanup.length === 0) {
                return {
                    success: true,
                    message: 'No files to cleanup'
                };
            }

            // Clean up files from DigitalOcean Spaces
            const cleanupPromises = cleanupData.filesToCleanup.map(file =>
                this.uploadService.deleteFromSpaces(file.key).catch(err => {
                    this.logger.error('Failed to cleanup file:', {
                        key: file.key,
                        error: err.message
                    });
                    return { key: file.key, error: err.message };
                })
            );

            const results = await Promise.all(cleanupPromises);
            const failures = results.filter(result => result && result.error);

            this.logger.log('Temp files cleanup completed:', {
                userId: req.user._id.toString(),
                totalFiles: cleanupData.filesToCleanup.length,
                failures: failures.length
            });

            return {
                success: true,
                data: {
                    cleaned: cleanupData.filesToCleanup.length - failures.length,
                    failed: failures.length,
                    failures: failures
                },
                message: `Cleaned up ${cleanupData.filesToCleanup.length - failures.length} files`
            };

        } catch (error) {
            this.logger.error('Cleanup temp files failed:', {
                userId: req.user._id.toString(),
                error: error.message
            });

            throw new HttpException(
                {
                    success: false,
                    message: 'Cleanup failed',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('remove-document')
    async removeDocument(
        @Body() removeData: { documentType: string; documentUrl: string },
        @Request() req
    ) {
        try {
            const userId = req.user._id.toString();

            this.logger.log('Document removal request:', {
                userId,
                documentType: removeData.documentType,
                documentUrl: removeData.documentUrl
            });

            // Get user's application
            const application = await this.applicationModel.findOne({ userId });
            if (!application) {
                throw new BadRequestException('No application found for this user');
            }

            // Extract key from URL for Spaces deletion
            const urlParts = removeData.documentUrl.split('/');
            const key = urlParts.slice(-3).join('/'); // Get applications/{id}/{filename}

            // Remove from MongoDB
            await this.applicationModel.updateOne(
                { _id: application._id },
                {
                    $pull: {
                        documents: {
                            url: removeData.documentUrl
                        }
                    },
                    // If it's a profile picture, clear the profileImageUrl field
                    ...(removeData.documentType === 'profile_picture' && {
                        $unset: { profileImageUrl: 1 }
                    })
                }
            );

            // Delete from Spaces
            await this.uploadService.deleteFromSpaces(key);

            this.logger.log('Document removed successfully:', {
                userId,
                documentType: removeData.documentType,
                key
            });

            return {
                success: true,
                message: 'Document removed successfully'
            };

        } catch (error) {
            this.logger.error('Document removal failed:', {
                userId: req.user?._id,
                documentType: removeData.documentType,
                error: error.message
            });

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to remove document',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
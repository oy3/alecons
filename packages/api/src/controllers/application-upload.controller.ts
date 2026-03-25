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
import { SessionControlsService } from '../services/session-controls.service';

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
        private readonly sessionControlsService: SessionControlsService,
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

            // Check if user already has an application to get application number
            let application = await this.applicationModel.findOne({ userId: new Types.ObjectId(userId) });
            const applicationNumber = application ? application.applicationNumber : null;

            if (!applicationNumber) {
                throw new BadRequestException('Application not found. Please complete registration first.');
            }

            // Upload to DigitalOcean Spaces temp storage using application number
            const uploadResult = await this.uploadService.uploadToSpaces(
                file,
                applicationNumber,
                uploadData.fileType,
                true // isTemp = true for initial uploads
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
                examinations: Array<{
                    examType: string;
                    examYear: string;
                    examNumber: string;
                    subjects: Array<{
                        subject: string;
                        grade: string;
                    }>;
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
                jambRegistrationNumber?: string;
                jambScore?: number | string;
                isJambExempt?: boolean;
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

            // Move files from temp to final location and prepare documents array
            const movedFiles = [];
            const documents = [];

            for (const file of applicationData.uploadedFiles) {
                try {
                    // Move file from temp to final location using application number
                    const movedFile = await this.uploadService.moveFromTempToFinal(
                        file.key,
                        application.applicationNumber,
                        file.type
                    );

                    movedFiles.push(movedFile);

                    documents.push({
                        type: file.type,
                        url: movedFile.url, // Use new final URL
                        uploadedAt: new Date(file.uploadedAt),
                        ...(file.sittingIndex !== undefined && { sittingIndex: file.sittingIndex }),
                        ...(file.referenceIndex !== undefined && { referenceIndex: file.referenceIndex })
                    });

                } catch (moveError) {
                    this.logger.error('Failed to move file from temp to final location:', {
                        tempKey: file.key,
                        applicationNumber: application.applicationNumber,
                        error: moveError.message
                    });

                    // If moving fails, still use the temp file (fallback)
                    documents.push({
                        type: file.type,
                        url: file.url,
                        uploadedAt: new Date(file.uploadedAt),
                        ...(file.sittingIndex !== undefined && { sittingIndex: file.sittingIndex }),
                        ...(file.referenceIndex !== undefined && { referenceIndex: file.referenceIndex })
                    });
                }
            }

            // Find profile picture URL for profileImageUrl field (use moved file URL if available)
            const profilePicture = movedFiles.find(f => f.type === 'profile_picture') ||
                applicationData.uploadedFiles.find(f => f.type === 'profile_picture');

            // Prepare examinations data - frontend sends examinations array directly
            const examinations = (applicationData.academicInfo.examinations || [])
                .filter(exam => exam.examType && exam.examYear && exam.examNumber)
                .map(exam => ({
                    examType: exam.examType,
                    examYear: exam.examYear,
                    examNumber: exam.examNumber,
                    subjects: (exam.subjects || [])
                        .filter(subject => subject.subject && subject.grade)
                        .map(subject => ({
                            subject: subject.subject,
                            grade: subject.grade
                        }))
                }));

            // Filter valid referees (must have name, phone, and email)
            const referees = (applicationData.academicInfo.referees || [])
                .filter(referee => referee.name && referee.phone && referee.email)
                .map(referee => ({
                    name: referee.name,
                    phone: referee.phone,
                    email: referee.email
                }));

            try {
                // Debug: Log the personal info data being received
                this.logger.log('Personal info data received:', {
                    religion: applicationData.personalInfo.religion,
                    maritalStatus: applicationData.personalInfo.maritalStatus,
                    address: applicationData.personalInfo.address,
                    phone: applicationData.personalInfo.phone,
                    gender: applicationData.personalInfo.gender
                });

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

                // Debug: Log the application object after assignment
                this.logger.log('Application object after assignment:', {
                    religion: application.religion,
                    maritalStatus: application.maritalStatus,
                    address: application.address,
                    phone: application.phone,
                    gender: application.gender
                });

                // Academic background
                if (applicationData.academicInfo.primarySchool && applicationData.academicInfo.secondarySchool) {
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
                }

                // Next of kin
                if (applicationData.academicInfo.nextOfKin && applicationData.academicInfo.nextOfKin.name && applicationData.academicInfo.nextOfKin.phone) {
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
                application.isJambExempt = applicationData.academicInfo.isJambExempt === true;

                if (application.isJambExempt) {
                    application.jambRegistrationNumber = undefined;
                    application.jambScore = undefined;
                } else {
                    application.jambRegistrationNumber = applicationData.academicInfo.jambRegistrationNumber?.trim() || undefined;

                    if (
                        applicationData.academicInfo.jambScore !== undefined &&
                        applicationData.academicInfo.jambScore !== null &&
                        applicationData.academicInfo.jambScore !== ''
                    ) {
                        application.jambScore = Number(applicationData.academicInfo.jambScore);
                    } else {
                        application.jambScore = undefined;
                    }
                }

                // Documents using new grouped structure
                const groupedDocuments: any = {
                    olevelResults: [],
                    referenceLetters: []
                };

                // Group documents by type
                for (const doc of documents) {
                    if (doc.type === 'profile_picture') {
                        groupedDocuments.profilePicture = {
                            type: doc.type,
                            url: doc.url,
                            uploadedAt: doc.uploadedAt
                        };
                    } else if (doc.type === 'olevel_result') {
                        groupedDocuments.olevelResults.push({
                            type: doc.type,
                            url: doc.url,
                            uploadedAt: doc.uploadedAt
                        });
                    } else if (doc.type === 'reference_letter') {
                        groupedDocuments.referenceLetters.push({
                            type: doc.type,
                            url: doc.url,
                            uploadedAt: doc.uploadedAt
                        });
                    }
                }

                application.documents = groupedDocuments;
                if (profilePicture) {
                    application.profileImageUrl = profilePicture.url;
                }

                // Application status
                application.status = ApplicationStatus.PENDING;
                application.currentStage = await this.sessionControlsService.getNextStageAfterApplicationForm(
                    application.entryAcademicSession,
                );

                // Debug: Log the application object just before saving
                this.logger.log('Application object just before save:', {
                    id: application._id,
                    religion: application.religion,
                    maritalStatus: application.maritalStatus,
                    address: application.address,
                    phone: application.phone,
                    gender: application.gender,
                    stateOfOrigin: application.stateOfOrigin,
                    lga: application.lga,
                    nationality: application.nationality
                });

                await application.save();

                // Debug: Log what was actually saved
                const savedApplication = await this.applicationModel.findById(application._id).lean();
                this.logger.log('Application object after save:', {
                    id: savedApplication._id,
                    religion: savedApplication.religion,
                    maritalStatus: savedApplication.maritalStatus,
                    address: savedApplication.address,
                    phone: savedApplication.phone,
                    gender: savedApplication.gender,
                    stateOfOrigin: savedApplication.stateOfOrigin,
                    lga: savedApplication.lga,
                    nationality: savedApplication.nationality
                });

                this.logger.log('Application saved successfully:', {
                    applicationId: application._id.toString(),
                    userId: req.user._id,
                    documentsCount: documents.length,
                    examinationsCount: examinations.length,
                    refereesCount: referees.length,
                    isJambExempt: application.isJambExempt === true,
                    hasJambDetails: !!application.jambRegistrationNumber || application.jambScore !== undefined,
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
                this.logger.error('Database save failed, cleaning up temp files:', {
                    userId: req.user._id,
                    applicationNumber: application.applicationNumber,
                    error: dbError.message,
                    stack: dbError.stack,
                    validationErrors: dbError.errors,
                    tempFilesToCleanup: applicationData.uploadedFiles.map(f => f.key)
                });

                // Log the full error details for debugging
                this.logger.error('Full database error:', dbError);

                // Cleanup temp files from Spaces since DB save failed
                const cleanupPromises = applicationData.uploadedFiles.map(file =>
                    this.uploadService.deleteFromSpaces(file.key).catch(err =>
                        this.logger.error('Failed to cleanup temp file:', { key: file.key, error: err.message })
                    )
                );

                await Promise.all(cleanupPromises);

                // Also cleanup any moved files if they exist
                if (movedFiles && movedFiles.length > 0) {
                    const movedFileCleanup = movedFiles.map(file =>
                        this.uploadService.deleteFromSpaces(file.key).catch(err =>
                            this.logger.error('Failed to cleanup moved file:', { key: file.key, error: err.message })
                        )
                    );
                    await Promise.all(movedFileCleanup);
                }

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

    @Post('remove-document')
    async removeDocument(
        @Body() removeData: { applicationId?: string; documentType: string; documentUrl: string },
        @Request() req
    ) {
        try {
            const userId = req.user._id.toString();

            this.logger.log('Document removal request:', {
                userId,
                applicationId: removeData.applicationId,
                documentType: removeData.documentType,
                documentUrl: removeData.documentUrl
            });

            // Get user's application - try by applicationId first, then fallback to userId
            let application;
            const userObjectId = new Types.ObjectId(userId);

            if (removeData.applicationId) {
                this.logger.log('Searching for application by ID:', {
                    applicationId: removeData.applicationId,
                    userId: userId
                });

                application = await this.applicationModel.findOne({
                    _id: removeData.applicationId,
                    userId: userObjectId  // Convert to ObjectId for proper comparison
                });
            } else {
                this.logger.log('Searching for application by userId:', { userId });
                // Fallback to old method for backward compatibility
                application = await this.applicationModel.findOne({ userId: userObjectId });
            }

            this.logger.log('Application search result:', {
                found: !!application,
                applicationId: application?._id?.toString(),
                userId: application?.userId?.toString()
            });

            if (!application) {
                this.logger.error('Document removal failed:', {
                    userId: userObjectId,
                    applicationId: removeData.applicationId,
                    documentType: removeData.documentType,
                    error: 'No application found for this user',
                    searchCriteria: removeData.applicationId ?
                        { _id: removeData.applicationId, userId: userObjectId } :
                        { userId: userObjectId }
                });

                // Return more specific error message
                const errorMessage = removeData.applicationId ?
                    'Application not found or you do not have permission to modify it' :
                    'No application found for this user. Please save your application first.';

                throw new BadRequestException(errorMessage);
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

    @Post('cleanup-temp-files')
    async cleanupTempFiles(
        @Body() cleanupData: {
            applicationNumber?: string; // Optional: cleanup specific application's temp files
            maxAgeHours?: number; // Optional: override default expiry time
        },
        @Request() req
    ) {
        this.logger.log('Cleanup temp files request:', {
            userId: req.user._id.toString(),
            applicationNumber: cleanupData.applicationNumber,
            maxAgeHours: cleanupData.maxAgeHours
        });

        try {
            // If specific application number provided, clean only that application's temp files
            if (cleanupData.applicationNumber) {
                await this.uploadService.cleanupTempFiles(
                    cleanupData.applicationNumber,
                    cleanupData.maxAgeHours
                );

                return {
                    success: true,
                    message: `Temp files cleaned up for application ${cleanupData.applicationNumber}`
                };
            }

            // Otherwise, clean all expired temp files
            await this.uploadService.cleanupTempFiles(
                undefined,
                cleanupData.maxAgeHours
            );

            return {
                success: true,
                message: 'Expired temp files cleaned up successfully'
            };

        } catch (error) {
            this.logger.error('Temp file cleanup failed:', {
                userId: req.user._id.toString(),
                error: error.message,
                stack: error.stack
            });

            throw new HttpException(
                {
                    success: false,
                    message: 'Temp file cleanup failed',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('cleanup-user-temp-files')
    async cleanupUserTempFiles(@Request() req) {
        this.logger.log('Cleanup user temp files request:', {
            userId: req.user._id.toString()
        });

        try {
            // Get user's application number
            const application = await this.applicationModel.findOne({
                userId: new Types.ObjectId(req.user._id)
            });

            if (!application) {
                return {
                    success: true,
                    message: 'No application found, nothing to cleanup'
                };
            }

            // Cleanup temp files for this specific application
            await this.uploadService.cleanupTempFiles(application.applicationNumber);

            return {
                success: true,
                message: 'Your temp files have been cleaned up successfully'
            };

        } catch (error) {
            this.logger.error('User temp file cleanup failed:', {
                userId: req.user._id.toString(),
                error: error.message,
                stack: error.stack
            });

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to cleanup your temp files',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
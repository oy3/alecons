import {
    Controller,
    Get,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    HttpStatus,
    HttpException,
    Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Application, ApplicationDocument, ApplicationStatus, AdmissionDecision } from '../schemas/application.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { ProgramType, ProgramTypeDocument } from '../schemas/program-type.schema';
import { AcademicSession, AcademicSessionDocument } from '../schemas/academic-session.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { EmailService } from '../services/email.service';
import { MatriculationService } from '../services/matriculation.service';
import { AdmissionLetterPdfService } from '../services/admission-letter-pdf.service';
import { UploadService } from '../services/upload.service';

@ApiTags('Staff Applications')
@Controller('staff/applications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StaffApplicationsController {
    private readonly logger = new Logger(StaffApplicationsController.name);

    constructor(
        @InjectModel(Application.name) private applicationModel: Model<ApplicationDocument>,
        @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(ProgramType.name) private programTypeModel: Model<ProgramTypeDocument>,
        @InjectModel(AcademicSession.name) private academicSessionModel: Model<AcademicSessionDocument>,
        @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
        @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
        private emailService: EmailService,
        private matriculationService: MatriculationService,
        private admissionLetterPdfService: AdmissionLetterPdfService,
        private uploadService: UploadService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Get all applications with filters and pagination' })
    @ApiResponse({ status: 200, description: 'Applications retrieved successfully' })
    async getApplications(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('status') status?: string,
        @Query('program') program?: string,
        @Query('search') search?: string,
        @Query('sortBy') sortBy: string = 'createdAt',
        @Query('sortOrder') sortOrder: string = 'desc'
    ) {
        try {
            this.logger.log('Getting applications with filters:', {
                page,
                limit,
                status,
                program,
                search,
                sortBy,
                sortOrder
            });

            // Build filter object
            const filter: any = { isActive: true };

            if (status && status !== 'all') {
                filter.status = status;
            }

            if (program && program !== 'all') {
                const programDoc = await this.programModel.findOne({ name: program });
                if (programDoc) {
                    filter.programId = programDoc._id;
                }
            }

            // Calculate pagination
            const skip = (page - 1) * limit;
            const sortObject: any = {};
            sortObject[sortBy] = sortOrder === 'desc' ? -1 : 1;

            // Build aggregation pipeline
            const pipeline = [
                { $match: filter },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                {
                    $lookup: {
                        from: 'programs',
                        localField: 'programId',
                        foreignField: '_id',
                        as: 'program'
                    }
                },
                {
                    $unwind: '$user'
                },
                {
                    $unwind: '$program'
                },
                {
                    $addFields: {
                        applicantName: {
                            $concat: ['$user.firstName', ' ', '$user.lastName']
                        },
                        email: '$user.email',
                        programName: '$program.name'
                    }
                }
            ];

            // Add search filter if provided
            if (search) {
                pipeline.push({
                    $match: {
                        $or: [
                            { applicantName: { $regex: search, $options: 'i' } },
                            { email: { $regex: search, $options: 'i' } },
                            { applicationNumber: { $regex: search, $options: 'i' } }
                        ]
                    }
                } as any);
            }

            // Get total count
            const totalCountPipeline = [...pipeline, { $count: 'total' }];
            const totalResult = await this.applicationModel.aggregate(totalCountPipeline);
            const total = totalResult.length > 0 ? totalResult[0].total : 0;

            // Add sorting and pagination
            pipeline.push(
                { $sort: sortObject } as any,
                { $skip: skip } as any,
                { $limit: parseInt(limit.toString()) } as any
            );

            // Project final fields
            pipeline.push({
                $project: {
                    _id: 1,
                    applicationNumber: 1,
                    applicantName: 1,
                    email: 1,
                    phone: 1,
                    programName: 1,
                    status: 1,
                    admissionDecision: 1,
                    currentStage: 1,
                    entranceExam: 1,
                    screening: 1,
                    entryAcademicSession: 1,
                    matriculationNumber: 1,
                    profileImageUrl: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            } as any);

            const applications = await this.applicationModel.aggregate(pipeline);

            const totalPages = Math.ceil(total / limit);

            this.logger.log('Applications retrieved successfully:', {
                total,
                page,
                totalPages,
                applicationsCount: applications.length
            });

            return {
                success: true,
                data: {
                    applications,
                    pagination: {
                        currentPage: parseInt(page.toString()),
                        totalPages,
                        totalItems: total,
                        itemsPerPage: parseInt(limit.toString())
                    }
                }
            };

        } catch (error) {
            this.logger.error('Error getting applications:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve applications',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get application details by ID' })
    @ApiResponse({ status: 200, description: 'Application details retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Application not found' })
    async getApplicationById(@Param('id') id: string) {
        try {
            this.logger.log('Getting application details for ID:', id);

            if (!Types.ObjectId.isValid(id)) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Invalid application ID format'
                    },
                    HttpStatus.BAD_REQUEST
                );
            }

            const application = await this.applicationModel
                .findById(id)
                .populate('userId', 'firstName lastName email')
                .populate('programId', 'name code')
                .populate('programTypeId', 'name')
                .populate('programModeId', 'name')
                .exec();

            if (!application) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Application not found'
                    },
                    HttpStatus.NOT_FOUND
                );
            }

            this.logger.log('Application details retrieved successfully:', application._id);

            return {
                success: true,
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error getting application details:', error.message);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve application details',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update application status' })
    @ApiResponse({ status: 200, description: 'Application status updated successfully' })
    @ApiResponse({ status: 404, description: 'Application not found' })
    async updateApplicationStatus(
        @Param('id') id: string,
        @Body() updateData: {
            status: ApplicationStatus;
            remarks?: string;
        }
    ) {
        try {
            this.logger.log('Updating application status:', {
                applicationId: id,
                newStatus: updateData.status,
                hasRemarks: !!updateData.remarks
            });

            if (!Types.ObjectId.isValid(id)) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Invalid application ID format'
                    },
                    HttpStatus.BAD_REQUEST
                );
            }

            // Validate status
            if (!Object.values(ApplicationStatus).includes(updateData.status)) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Invalid application status'
                    },
                    HttpStatus.BAD_REQUEST
                );
            }

            const application = await this.applicationModel.findById(id);

            if (!application) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Application not found'
                    },
                    HttpStatus.NOT_FOUND
                );
            }

            // Update application status
            application.status = updateData.status;
            await application.save();

            this.logger.log('Application status updated successfully:', {
                applicationId: id,
                oldStatus: application.status,
                newStatus: updateData.status
            });

            return {
                success: true,
                data: {
                    applicationId: id,
                    status: updateData.status,
                    message: 'Application status updated successfully'
                }
            };

        } catch (error) {
            this.logger.error('Error updating application status:', error.message);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to update application status',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('stats/summary')
    @ApiOperation({ summary: 'Get applications statistics summary' })
    @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
    async getApplicationsStats() {
        try {
            this.logger.log('Getting applications statistics');

            const stats = await this.applicationModel.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const totalApplications = await this.applicationModel.countDocuments({ isActive: true });

            const statsObject = stats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {});

            this.logger.log('Applications statistics retrieved successfully:', statsObject);

            return {
                success: true,
                data: {
                    total: totalApplications,
                    byStatus: statsObject
                }
            };

        } catch (error) {
            this.logger.error('Error getting applications statistics:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve applications statistics',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/schedule-exam')
    @ApiOperation({ summary: 'Schedule entrance exam for an application' })
    @ApiResponse({ status: 200, description: 'Exam scheduled successfully' })
    async scheduleExam(
        @Param('id') id: string,
        @Body() examData: {
            examDate: string;
            examTime: string;
            examLink: string;
        }
    ) {
        try {
            this.logger.log('Scheduling exam for application:', { id, examData });

            const application = await this.applicationModel.findById(id)
                .populate('userId', 'firstName lastName email')
                .exec();

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            // Update application with exam details using grouped structure
            application.entranceExam = {
                date: new Date(examData.examDate),
                time: examData.examTime,
                link: examData.examLink
            };
            application.currentStage = 4; // Move to exam stage

            await application.save();

            // Send exam scheduled email
            await this.emailService.sendEntranceExamScheduledEmail(
                (application.userId as any).email,
                (application.userId as any).firstName,
                application.entranceExam.date,
                application.entranceExam.time,
                application.entranceExam.link
            );

            this.logger.log('Exam scheduled successfully for application:', id);

            return {
                success: true,
                message: 'Entrance exam scheduled successfully',
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error scheduling exam:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to schedule exam',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/schedule-screening')
    @ApiOperation({ summary: 'Schedule screening & interview for an application' })
    @ApiResponse({ status: 200, description: 'Screening scheduled successfully' })
    async scheduleScreening(
        @Param('id') id: string,
        @Body() screeningData: {
            screeningDate: string;
            screeningTime: string;
            venue: string;
        }
    ) {
        try {
            this.logger.log('Scheduling screening for application:', { id, screeningData });

            const application = await this.applicationModel.findById(id)
                .populate('userId', 'firstName lastName email')
                .exec();

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            // Update application with screening details using grouped structure
            application.screening = {
                date: new Date(screeningData.screeningDate),
                time: screeningData.screeningTime,
                venue: screeningData.venue,
                completed: false
            };
            application.currentStage = 5; // Move to screening stage

            await application.save();

            // Send screening scheduled email
            await this.emailService.sendScreeningScheduledEmail(
                (application.userId as any).email,
                (application.userId as any).firstName,
                application.screening.date,
                application.screening.time,
                application.screening.venue
            );

            this.logger.log('Screening scheduled successfully for application:', id);

            return {
                success: true,
                message: 'Screening & interview scheduled successfully',
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error scheduling screening:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to schedule screening',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/admission-decision')
    @ApiOperation({ summary: 'Make admission decision for an application' })
    @ApiResponse({ status: 200, description: 'Admission decision made successfully' })
    async makeAdmissionDecision(
        @Param('id') id: string,
        @Body() decisionData: {
            decision: 'admitted' | 'rejected';
            reason?: string;
        }
    ) {
        try {
            this.logger.log('Making admission decision for application:', { id, decisionData });

            const application = await this.applicationModel.findById(id)
                .populate('userId')
                .populate('programId')
                .populate('programTypeId')
                .populate('entryAcademicSession')
                .exec();

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            // Update application with admission decision using correct enum
            const decisionMapping = {
                'admitted': AdmissionDecision.GRANTED,
                'rejected': AdmissionDecision.DENIED
            };

            application.admissionDecision = decisionMapping[decisionData.decision];
            if (decisionData.reason) {
                application.rejectionReason = decisionData.reason;
            }

            if (decisionData.decision === 'admitted') {
                application.status = ApplicationStatus.ADMITTED;
                application.currentStage = 7; // Move to acceptance fee stage
                application.admissionDate = new Date();

                // Generate admission letter PDF
                const user = application.userId as any;
                const program = application.programId as any;
                const programType = application.programTypeId as any;
                const academicSession = application.entryAcademicSession as any;

                // Validate required data
                if (!user || !program || !programType || !academicSession) {
                    this.logger.error('Missing required data for admission letter:', {
                        hasUser: !!user,
                        hasProgram: !!program,
                        hasProgramType: !!programType,
                        hasAcademicSession: !!academicSession
                    });
                    throw new HttpException(
                        {
                            success: false,
                            message: 'Missing required data for admission letter generation. Please ensure application has all required information.'
                        },
                        HttpStatus.BAD_REQUEST
                    );
                }

                // Extract values safely, handling both populated objects and raw IDs
                // Academic Session uses 'sessionYear' field
                const academicSessionName = academicSession?.sessionYear || academicSession?.name || '';
                // Program Type uses 'type' field (e.g., "ND", "HND")
                const programTypeCode = programType?.type || programType?.code || programType?.name || '';
                const programName = program?.name || '';

                this.logger.log('Generating admission letter PDF for:', {
                    student: user.firstName,
                    program: programName,
                    programType: programTypeCode,
                    session: academicSessionName,
                    rawSessionData: JSON.stringify(academicSession),
                    programTypeObject: JSON.stringify(programType),
                    programObject: JSON.stringify(program)
                });

                // Validate extracted values
                if (!programTypeCode || !academicSessionName || !programName) {
                    this.logger.error('Failed to extract required data from populated objects:', {
                        hasProgramTypeCode: !!programTypeCode,
                        hasAcademicSessionName: !!academicSessionName,
                        hasProgramName: !!programName
                    });
                    throw new HttpException(
                        {
                            success: false,
                            message: 'Failed to extract required data. Please check if application data is properly populated.'
                        },
                        HttpStatus.BAD_REQUEST
                    );
                }

                // Fetch acceptance fee from database
                let acceptanceFeeInWords = '';
                let acceptanceFeeAmount = '';

                try {
                    const acceptanceFeePayment = await this.paymentModel.findOne({
                        paymentCode: 'acceptanceFee',
                        active: true
                    });

                    if (acceptanceFeePayment) {
                        acceptanceFeeAmount = acceptanceFeePayment.amount.toLocaleString('en-NG', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        });
                        // Convert number to words (simplified - you may want a proper library)
                        acceptanceFeeInWords = this.numberToWords(acceptanceFeePayment.amount);

                        this.logger.log('Acceptance fee fetched from database:', {
                            amount: acceptanceFeePayment.amount,
                            formatted: acceptanceFeeAmount,
                            inWords: acceptanceFeeInWords
                        });
                    } else {
                        this.logger.warn('Acceptance fee not found in database, using default values');
                    }
                } catch (feeError) {
                    this.logger.error('Error fetching acceptance fee:', feeError.message);
                    // Continue with default values
                }

                // Always use application number for folder structure (not matric number which has slashes)
                const folderIdentifier = application.applicationNumber || application._id.toString();

                const pdfBuffer = await this.admissionLetterPdfService.generateAdmissionLetter({
                    studentFirstName: user.firstName || '',
                    studentFullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                    programName: programName,
                    programType: programTypeCode,
                    academicSession: academicSessionName,
                    acceptanceFee: acceptanceFeeInWords,
                    acceptanceFeeAmount: acceptanceFeeAmount,
                    admissionDate: new Date()
                });

                this.logger.log('Admission letter PDF generated successfully');

                // Upload PDF to DigitalOcean Spaces
                const timestamp = Date.now();
                const pdfFileName = `admission_letter_${timestamp}.pdf`;

                try {
                    // Create a mock file object for the upload service
                    const mockFile = {
                        buffer: pdfBuffer,
                        originalname: pdfFileName,
                        mimetype: 'application/pdf',
                        size: pdfBuffer.length
                    } as Express.Multer.File;

                    // Upload to Spaces in the student's application folder
                    // Path will be: applications/{applicationNumber}/admission_letter_{timestamp}.pdf
                    const uploadResult = await this.uploadService.uploadToSpaces(
                        mockFile,
                        folderIdentifier,
                        'admission_letter',
                        false // Not temp, save to final location
                    );

                    this.logger.log('Admission letter PDF uploaded to Spaces:', {
                        url: uploadResult.url,
                        key: uploadResult.key,
                        folder: folderIdentifier
                    });

                    // Store the PDF URL in the application
                    application.admissionLetter = uploadResult.url;

                } catch (uploadError) {
                    this.logger.error('Failed to upload PDF to Spaces:', uploadError.message);
                    // Continue anyway - email will still have the PDF attached
                }

                // Send admission email with PDF attachment
                await this.emailService.sendAdmissionLetterEmail(
                    user.email,
                    user.firstName,
                    pdfBuffer,
                    programName,
                    academicSessionName
                );

                this.logger.log('Admission email with PDF sent successfully');
            } else {
                application.status = ApplicationStatus.REJECTED;
                application.currentStage = 6; // Stay at admission decision stage but mark as rejected

                // Send rejection email
                await this.emailService.sendRejectionEmail(
                    (application.userId as any).email,
                    (application.userId as any).firstName,
                    decisionData.reason
                );

                this.logger.log('Rejection email sent successfully');
            }

            await application.save();

            this.logger.log('Admission decision made successfully for application:', id);

            return {
                success: true,
                message: `Application ${decisionData.decision} successfully`,
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error making admission decision:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to make admission decision',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/exam-score')
    @ApiOperation({ summary: 'Update entrance exam score' })
    @ApiResponse({ status: 200, description: 'Exam score updated successfully' })
    async updateExamScore(
        @Param('id') id: string,
        @Body() scoreData: {
            score: number;
            passed: boolean;
        }
    ) {
        try {
            this.logger.log('Updating exam score for application:', { id, scoreData });

            const application = await this.applicationModel.findById(id);

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            // Update exam score using grouped structure
            if (!application.entranceExam) {
                throw new HttpException(
                    { success: false, message: 'Entrance exam not scheduled yet' },
                    HttpStatus.BAD_REQUEST
                );
            }

            application.entranceExam.score = scoreData.score;

            if (scoreData.passed) {
                application.currentStage = 5; // Move to screening stage if passed
            } else {
                application.status = ApplicationStatus.REJECTED;
                application.admissionDecision = AdmissionDecision.DENIED;
                application.rejectionReason = 'Failed entrance examination';
            }

            await application.save();

            this.logger.log('Exam score updated successfully for application:', id);

            return {
                success: true,
                message: 'Exam score updated successfully',
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error updating exam score:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to update exam score',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/complete-screening')
    @ApiOperation({ summary: 'Mark screening as completed' })
    @ApiResponse({ status: 200, description: 'Screening marked as completed' })
    async completeScreening(@Param('id') id: string) {
        try {
            this.logger.log('Marking screening as completed for application:', id);

            const application = await this.applicationModel.findById(id);

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            // Update screening completion status using grouped structure
            if (!application.screening) {
                application.screening = { completed: true };
            } else {
                application.screening.completed = true;
            }
            application.currentStage = 6; // Move to admission decision stage
            await application.save();

            this.logger.log('Screening marked as completed for application:', id);

            return {
                success: true,
                message: 'Screening marked as completed',
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error completing screening:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to complete screening',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/generate-matric')
    @ApiOperation({ summary: 'Generate matriculation number and complete application' })
    @ApiResponse({ status: 200, description: 'Matriculation number generated successfully' })
    async generateMatriculationNumber(@Param('id') id: string) {
        try {
            this.logger.log('Generating matriculation number for application:', id);

            const application = await this.applicationModel.findById(id)
                .populate(['userId', 'programId', 'entryAcademicSession'])
                .exec();

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            // Check if application is in the correct stage (school fees paid - stage 10)
            if (application.currentStage !== 10) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Cannot generate matriculation number. Student must complete school fees payment first (currentStage must be 10).',
                        currentStage: application.currentStage
                    },
                    HttpStatus.BAD_REQUEST
                );
            }

            // Check if matriculation number already exists
            if (application.matriculationNumber) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Matriculation number already generated for this application.',
                        matriculationNumber: application.matriculationNumber
                    },
                    HttpStatus.BAD_REQUEST
                );
            }

            const user = application.userId as any;

            // Generate matriculation number using the proper service
            // Extract the actual ObjectId from the populated program
            const programId = application.programId._id || application.programId;
            const matriculationNumber = await this.matriculationService.generateMatriculationNumber(programId.toString());

            // Update application
            application.matriculationNumber = matriculationNumber;
            application.status = ApplicationStatus.COMPLETED;
            // currentStage should already be 10, no need to set it again
            await application.save();

            // Get academic session for student record
            // Extract the ObjectId from the populated entryAcademicSession
            const academicSessionId = typeof application.entryAcademicSession === 'object' && application.entryAcademicSession !== null
                ? (application.entryAcademicSession as any)._id
                : application.entryAcademicSession;
            const admissionYear = new Date().getFullYear();

            // Create Student record (migrate from applicant to student)
            const existingStudent = await this.studentModel.findOne({
                userId: application.userId
            });

            if (!existingStudent) {
                const newStudent = new this.studentModel({
                    userId: application.userId,
                    applicationId: application._id,
                    matriculationNumber: matriculationNumber,
                    programId: application.programId,
                    programTypeId: application.programTypeId,
                    programModeId: application.programModeId,
                    admissionYear: admissionYear,
                    academicSession: academicSessionId, // Store ObjectId reference
                    status: 'active',
                    currentLevel: 1,
                    currentSemester: 1,
                    cumulativeGPA: 0.0,
                    isActive: true
                });

                await newStudent.save();
                this.logger.log('Student record created successfully:', newStudent._id);
            } else {
                this.logger.log('Student record already exists:', existingStudent._id);
            }

            // Update User role from APPLICANT to STUDENT
            const userRecord = await this.userModel.findById(application.userId);
            if (userRecord && userRecord.role === UserRole.APPLICANT) {
                userRecord.role = UserRole.STUDENT;
                await userRecord.save();
                this.logger.log('User role updated from APPLICANT to STUDENT:', userRecord._id);
            } else if (userRecord) {
                this.logger.log('User role already set to:', userRecord.role);
            }

            // Send matriculation email
            const studentPortalUrl = process.env.STUDENT_PORTAL_URL || 'http://localhost:3000/student-portal';
            await this.emailService.sendMatriculationEmail(
                user.email,
                user.firstName,
                matriculationNumber,
                studentPortalUrl
            );

            this.logger.log('Matriculation number generated successfully:', matriculationNumber);

            return {
                success: true,
                message: 'Matriculation number generated and email sent successfully',
                data: {
                    application,
                    matriculationNumber
                }
            };

        } catch (error) {
            this.logger.error('Error generating matriculation number:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to generate matriculation number',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/send-matric-email')
    @ApiOperation({ summary: 'Send matriculation email to student' })
    @ApiResponse({ status: 200, description: 'Matriculation email sent successfully' })
    async sendMatriculationEmail(@Param('id') id: string) {
        try {
            this.logger.log('Sending matriculation email for application:', id);

            const application = await this.applicationModel.findById(id)
                .populate('userId')
                .exec();

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            if (!application.matriculationNumber) {
                throw new HttpException(
                    { success: false, message: 'Matriculation number not generated yet' },
                    HttpStatus.BAD_REQUEST
                );
            }

            const user = application.userId as any;
            const studentPortalUrl = process.env.STUDENT_PORTAL_URL || 'http://localhost:3000/student-portal';

            await this.emailService.sendMatriculationEmail(
                user.email,
                user.firstName,
                application.matriculationNumber,
                studentPortalUrl
            );

            this.logger.log('Matriculation email sent successfully to:', user.email);

            return {
                success: true,
                message: 'Matriculation email sent successfully',
                data: {
                    email: user.email,
                    matriculationNumber: application.matriculationNumber
                }
            };

        } catch (error) {
            this.logger.error('Error sending matriculation email:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to send matriculation email',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Helper method to convert numbers to words (Nigerian Naira context)
     * Supports numbers up to millions
     */
    private numberToWords(num: number): string {
        if (num === 0) return 'Zero';

        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

        const convertLessThanThousand = (n: number): string => {
            if (n === 0) return '';

            let result = '';

            if (n >= 100) {
                result += ones[Math.floor(n / 100)] + ' Hundred ';
                n %= 100;
            }

            if (n >= 10 && n < 20) {
                result += teens[n - 10] + ' ';
            } else {
                if (n >= 20) {
                    result += tens[Math.floor(n / 10)] + ' ';
                    n %= 10;
                }
                if (n > 0) {
                    result += ones[n] + ' ';
                }
            }

            return result.trim();
        };

        if (num < 1000) {
            return convertLessThanThousand(num);
        } else if (num < 1000000) {
            const thousands = Math.floor(num / 1000);
            const remainder = num % 1000;
            let result = convertLessThanThousand(thousands) + ' Thousand';
            if (remainder > 0) {
                result += ' ' + convertLessThanThousand(remainder);
            }
            return result.trim();
        } else {
            const millions = Math.floor(num / 1000000);
            const remainder = num % 1000000;
            let result = convertLessThanThousand(millions) + ' Million';
            if (remainder > 0) {
                if (remainder >= 1000) {
                    const thousands = Math.floor(remainder / 1000);
                    result += ' ' + convertLessThanThousand(thousands) + ' Thousand';
                    const finalRemainder = remainder % 1000;
                    if (finalRemainder > 0) {
                        result += ' ' + convertLessThanThousand(finalRemainder);
                    }
                } else {
                    result += ' ' + convertLessThanThousand(remainder);
                }
            }
            return result.trim();
        }
    }
}
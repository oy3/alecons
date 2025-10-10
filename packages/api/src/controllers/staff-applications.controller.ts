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
import { User, UserDocument } from '../schemas/user.schema';
import { EmailService } from '../services/email.service';
import { MatriculationService } from '../services/matriculation.service';

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
        private emailService: EmailService,
        private matriculationService: MatriculationService,
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
            admissionLetterUrl?: string;
        }
    ) {
        try {
            this.logger.log('Making admission decision for application:', { id, decisionData });

            const application = await this.applicationModel.findById(id)
                .populate('userId', 'firstName lastName email')
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
            if (decisionData.admissionLetterUrl) {
                application.admissionLetter = decisionData.admissionLetterUrl;
            }

            if (decisionData.decision === 'admitted') {
                application.status = ApplicationStatus.ADMITTED;
                application.currentStage = 7; // Move to acceptance fee stage
                application.admissionDate = new Date();
            } else {
                application.status = ApplicationStatus.REJECTED;
                application.currentStage = 6; // Stay at admission decision stage but mark as rejected
            }

            await application.save();

            // Send appropriate email based on decision
            if (decisionData.decision === 'admitted') {
                await this.emailService.sendAdmissionLetterEmail(
                    (application.userId as any).email,
                    (application.userId as any).firstName,
                    decisionData.admissionLetterUrl
                );
            } else {
                await this.emailService.sendRejectionEmail(
                    (application.userId as any).email,
                    (application.userId as any).firstName,
                    decisionData.reason
                );
            }

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
                .populate(['userId', 'programId'])
                .exec();

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            const user = application.userId as any;

            // Generate matriculation number using the proper service
            const matriculationNumber = await this.matriculationService.generateMatriculationNumber(application.programId.toString());

            // Update application
            application.matriculationNumber = matriculationNumber;
            application.status = ApplicationStatus.COMPLETED;
            application.currentStage = 10; // Final stage
            await application.save();

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
}
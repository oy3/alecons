import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpException,
    HttpStatus,
    Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { ExamService } from '../services/exam.service';
import { GradingService } from '../services/grading.service';
import { QueueService } from '../services/queue.service';

@ApiTags('exams')
@Controller('exams')
@UseGuards(AuthGuard('jwt'), ThrottlerGuard, RolesGuard)
export class ExamController {
    private readonly logger = new Logger(ExamController.name);

    constructor(
        private examService: ExamService,
        private gradingService: GradingService,
        private queueService: QueueService,
    ) { }

    @Get()
    @Roles('staff', 'admin')
    @ApiOperation({ summary: 'Get all exams with pagination (Staff only)' })
    @ApiResponse({ status: 200, description: 'Exams retrieved successfully' })
    async getAllExams(@Request() req, @Query() query): Promise<any> {
        try {
            const { 
                page = 1, 
                limit = 10, 
                search = '', 
                status = '', 
                type = '',
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = query;

            const exams = await this.examService.getAllExams({
                page: parseInt(page),
                limit: parseInt(limit),
                search,
                status,
                type,
                sortBy,
                sortOrder
            });

            return {
                success: true,
                ...exams
            };
        } catch (error) {
            this.logger.error('Error getting all exams:', error.message);
            throw new HttpException(
                error.message || 'Failed to get exams',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('available')
    @Roles('student', 'applicant', 'staff')
    @ApiOperation({ summary: 'Get available exams for current user' })
    @ApiResponse({ status: 200, description: 'Available exams retrieved successfully' })
    async getAvailableExams(@Request() req, @Query() query): Promise<any> {
        try {
            const { userId, role, programId, academicSession } = req.user;

            const exams = await this.examService.getAvailableExamsForUser(
                userId,
                role,
                query.programId || programId,
                query.academicSession || academicSession
            );

            return {
                success: true,
                exams
            };
        } catch (error) {
            this.logger.error('Error getting available exams:', error.message);
            throw new HttpException(
                error.message || 'Failed to get available exams',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(':examId')
    @Roles('student', 'applicant', 'staff')
    @ApiOperation({ summary: 'Get exam details by ID' })
    @ApiResponse({ status: 200, description: 'Exam details retrieved successfully' })
    async getExamDetails(@Param('examId') examId: string, @Request() req): Promise<any> {
        try {
            const { userId } = req.user;

            const exam = await this.examService.getExamDetails(examId, userId);

            return {
                success: true,
                exam
            };
        } catch (error) {
            this.logger.error(`Error getting exam details for ${examId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to get exam details',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(':examId/start')
    @Roles('student', 'applicant', 'staff')
    @ApiOperation({ summary: 'Start an exam with password verification' })
    @ApiResponse({ status: 200, description: 'Exam started successfully' })
    async startExam(
        @Param('examId') examId: string,
        @Body() body: { password: string; clientMeta: any },
        @Request() req
    ): Promise<any> {
        try {
            const { userId } = req.user;
            const { password, clientMeta } = body;

            const result = await this.examService.startExam(
                examId,
                userId,
                password,
                clientMeta
            );

            return {
                success: true,
                ...result
            };
        } catch (error) {
            this.logger.error(`Error starting exam ${examId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to start exam',
                error.status || HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get(':examId/questions')
    @Roles('student', 'applicant', 'staff')
    @ApiOperation({ summary: 'Get exam questions for active attempt' })
    @ApiResponse({ status: 200, description: 'Exam questions retrieved successfully' })
    async getExamQuestions(
        @Param('examId') examId: string,
        @Query('attemptId') attemptId: string,
        @Request() req
    ): Promise<any> {
        try {
            const { userId } = req.user;

            if (!attemptId) {
                throw new HttpException('Attempt ID is required', HttpStatus.BAD_REQUEST);
            }

            const questions = await this.examService.getExamQuestions(
                examId,
                attemptId,
                userId
            );

            return {
                success: true,
                questions
            };
        } catch (error) {
            this.logger.error(`Error getting exam questions for ${examId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to get exam questions',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(':examId/save-answers')
    @Roles('student', 'applicant', 'staff')
    @ApiOperation({ summary: 'Auto-save exam answers' })
    @ApiResponse({ status: 200, description: 'Answers saved successfully' })
    async saveAnswers(
        @Param('examId') examId: string,
        @Body() body: { attemptId: string; answers: any[]; timestamp: Date },
        @Request() req
    ): Promise<any> {
        try {
            const { userId } = req.user;
            const { attemptId, answers, timestamp } = body;

            await this.examService.saveAnswers(
                examId,
                attemptId,
                userId,
                answers,
                timestamp
            );

            return {
                success: true,
                message: 'Answers saved successfully'
            };
        } catch (error) {
            this.logger.error(`Error saving answers for exam ${examId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to save answers',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(':examId/submit')
    @Roles('student', 'applicant', 'staff')
    @ApiOperation({ summary: 'Submit exam for grading' })
    @ApiResponse({ status: 200, description: 'Exam submitted successfully' })
    async submitExam(
        @Param('examId') examId: string,
        @Body() body: {
            attemptId: string;
            answers: any[];
            securityViolations: any[];
            submittedAt: Date;
        },
        @Request() req
    ): Promise<any> {
        try {
            const { userId } = req.user;
            const { attemptId, answers, securityViolations, submittedAt } = body;

            const result = await this.examService.submitExam(
                examId,
                attemptId,
                userId,
                answers,
                securityViolations,
                submittedAt
            );

            // Queue grading job for auto-gradable questions
            await this.queueService.queueGradingJob({
                attemptId,
                examId,
                userId,
                priority: 1
            });

            return {
                success: true,
                message: 'Exam submitted successfully',
                ...result
            };
        } catch (error) {
            this.logger.error(`Error submitting exam ${examId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to submit exam',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(':examId/heartbeat')
    @Roles('student', 'applicant', 'staff')
    @ApiOperation({ summary: 'Record exam session heartbeat' })
    @ApiResponse({ status: 200, description: 'Heartbeat recorded successfully' })
    async recordHeartbeat(
        @Param('examId') examId: string,
        @Body() body: { attemptId: string; timestamp: Date; clientMeta: any },
        @Request() req
    ): Promise<any> {
        try {
            const { userId } = req.user;
            const { attemptId, timestamp, clientMeta } = body;

            await this.examService.recordHeartbeat(
                examId,
                attemptId,
                userId,
                { timestamp, ...clientMeta }
            );

            return {
                success: true
            };
        } catch (error) {
            // Don't throw errors for heartbeat failures to avoid disrupting exam
            this.logger.warn(`Heartbeat recording failed for exam ${examId}:`, error.message);
            return {
                success: false,
                message: 'Heartbeat recording failed'
            };
        }
    }

    @Post(':examId/security-violation')
    @Roles('student', 'applicant', 'staff')
    @ApiOperation({ summary: 'Record security violation during exam' })
    @ApiResponse({ status: 200, description: 'Security violation recorded successfully' })
    async recordSecurityViolation(
        @Param('examId') examId: string,
        @Body() body: {
            attemptId: string;
            violationType: string;
            timestamp: Date;
            details: any;
        },
        @Request() req
    ): Promise<any> {
        try {
            const { userId } = req.user;
            const { attemptId, violationType, timestamp, details } = body;

            await this.examService.recordSecurityViolation(
                examId,
                attemptId,
                userId,
                {
                    type: violationType,
                    timestamp,
                    details
                }
            );

            return {
                success: true
            };
        } catch (error) {
            // Don't throw errors for violation recording to avoid disrupting exam
            this.logger.warn(`Security violation recording failed for exam ${examId}:`, error.message);
            return {
                success: false,
                message: 'Security violation recording failed'
            };
        }
    }

    @Get(':examId/results')
    @Roles('student', 'applicant', 'staff')
    @ApiOperation({ summary: 'Get exam results' })
    @ApiResponse({ status: 200, description: 'Exam results retrieved successfully' })
    async getExamResults(
        @Param('examId') examId: string,
        @Query() query,
        @Request() req
    ): Promise<any> {
        try {
            const { userId, role } = req.user;

            const results = await this.examService.getExamResults(
                examId,
                userId,
                role,
                query
            );

            return {
                success: true,
                ...results
            };
        } catch (error) {
            this.logger.error(`Error getting exam results for ${examId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to get exam results',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('user/history')
    @Roles('student', 'applicant', 'staff')
    @ApiOperation({ summary: 'Get user exam history' })
    @ApiResponse({ status: 200, description: 'User exam history retrieved successfully' })
    async getUserExamHistory(@Request() req, @Query() query): Promise<any> {
        try {
            const { userId } = req.user;

            const history = await this.examService.getUserExamHistory(userId);

            return {
                success: true,
                history
            };
        } catch (error) {
            this.logger.error('Error getting user exam history:', error.message);
            throw new HttpException(
                error.message || 'Failed to get exam history',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    // Admin/Staff endpoints
    @Post()
    @Roles('staff', 'admin')
    @ApiOperation({ summary: 'Create new exam (Admin only)' })
    @ApiResponse({ status: 201, description: 'Exam created successfully' })
    async createExam(@Body() createExamDto: any, @Request() req): Promise<any> {
        try {
            const { userId } = req.user;

            const exam = await this.examService.createExam(createExamDto, userId);

            return {
                success: true,
                examId: exam._id,
                exam
            };
        } catch (error) {
            this.logger.error('Error creating exam:', error.message);
            throw new HttpException(
                error.message || 'Failed to create exam',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Put(':examId')
    @Roles('staff', 'admin')
    @ApiOperation({ summary: 'Update existing exam (Admin only)' })
    @ApiResponse({ status: 200, description: 'Exam updated successfully' })
    async updateExam(
        @Param('examId') examId: string,
        @Body() updateExamDto: any,
        @Request() req
    ): Promise<any> {
        try {
            const { userId } = req.user;

            const exam = await this.examService.updateExam(examId, updateExamDto, userId);

            return {
                success: true,
                message: 'Exam updated successfully',
                exam
            };
        } catch (error) {
            this.logger.error(`Error updating exam ${examId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to update exam',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Delete(':examId')
    @Roles('staff', 'admin')
    @ApiOperation({ summary: 'Delete exam (Admin only)' })
    @ApiResponse({ status: 200, description: 'Exam deleted successfully' })
    async deleteExam(@Param('examId') examId: string, @Request() req): Promise<any> {
        try {
            const { userId } = req.user;

            await this.examService.deleteExam(examId, userId);

            return {
                success: true,
                message: 'Exam deleted successfully'
            };
        } catch (error) {
            this.logger.error(`Error deleting exam ${examId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to delete exam',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(':examId/grade-all')
    @Roles('staff', 'admin')
    @ApiOperation({ summary: 'Queue grading for all exam attempts (Admin only)' })
    @ApiResponse({ status: 200, description: 'Grading job queued successfully' })
    async gradeAllAttempts(@Param('examId') examId: string, @Request() req): Promise<any> {
        try {
            const job = await this.queueService.queueResultProcessingJob({
                examId,
                batchSize: 50
            });

            return {
                success: true,
                message: 'Grading job queued',
                jobId: job.id
            };
        } catch (error) {
            this.logger.error(`Error queuing grading job for exam ${examId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to queue grading job',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(':examId/release-results')
    @Roles('staff', 'admin')
    @ApiOperation({ summary: 'Release exam results to students (Admin only)' })
    @ApiResponse({ status: 200, description: 'Results released successfully' })
    async releaseResults(
        @Param('examId') examId: string,
        @Body() body: { releaseAll?: boolean },
        @Request() req
    ): Promise<any> {
        try {
            const { releaseAll = true } = body;

            await this.gradingService.releaseResults(examId, releaseAll);

            return {
                success: true,
                message: 'Results released successfully'
            };
        } catch (error) {
            this.logger.error(`Error releasing results for exam ${examId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to release results',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(':examId/retract-results')
    @Roles('staff', 'admin')
    @ApiOperation({ summary: 'Retract exam results from students (Admin only)' })
    @ApiResponse({ status: 200, description: 'Results retracted successfully' })
    async retractResults(@Param('examId') examId: string, @Request() req): Promise<any> {
        try {
            await this.gradingService.retractResults(examId);

            return {
                success: true,
                message: 'Results retracted successfully'
            };
        } catch (error) {
            this.logger.error(`Error retracting results for exam ${examId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to retract results',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(':examId/statistics')
    @Roles('staff', 'admin')
    @ApiOperation({ summary: 'Get exam statistics and analytics (Admin only)' })
    @ApiResponse({ status: 200, description: 'Exam statistics retrieved successfully' })
    async getExamStatistics(@Param('examId') examId: string, @Request() req): Promise<any> {
        try {
            const statistics = await this.gradingService.calculateExamStatistics(examId);

            return {
                success: true,
                statistics
            };
        } catch (error) {
            this.logger.error(`Error getting statistics for exam ${examId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to get exam statistics',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('jobs/:queueName/:jobId')
    @Roles('staff', 'admin')
    @ApiOperation({ summary: 'Get background job status (Admin only)' })
    @ApiResponse({ status: 200, description: 'Job status retrieved successfully' })
    async getJobStatus(
        @Param('queueName') queueName: string,
        @Param('jobId') jobId: string,
        @Request() req
    ): Promise<any> {
        try {
            const jobStatus = await this.queueService.getJobStatus(queueName, jobId);

            return {
                success: true,
                job: jobStatus
            };
        } catch (error) {
            this.logger.error(`Error getting job status for ${queueName}:${jobId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to get job status',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
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
    Logger,
    Res,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Roles } from "../decorators/roles.decorator";
import { RolesGuard } from "../guards/roles.guard";
import { ExamService } from "../services/exam.service";
import { GradingService } from "../services/grading.service";
import { QueueService } from "../services/queue.service";
import { EmailService } from "../services/email.service";
import { Response } from 'express';

@ApiTags("exams")
@Controller("exams")
@UseGuards(AuthGuard("jwt"), ThrottlerGuard, RolesGuard)
export class ExamController {
    private readonly logger = new Logger(ExamController.name);

    constructor(
        private examService: ExamService,
        private gradingService: GradingService,
        private queueService: QueueService,
        private emailService: EmailService
    ) { }

    @Get()
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Get all exams with pagination (Staff only)" })
    @ApiResponse({ status: 200, description: "Exams retrieved successfully" })
    async getAllExams(@Request() req, @Query() query): Promise<any> {
        try {
            const {
                page = 1,
                limit = 10,
                search = "",
                status = "",
                type = "",
                sortBy = "createdAt",
                sortOrder = "desc",
            } = query;

            const exams = await this.examService.getAllExams({
                page: parseInt(page),
                limit: parseInt(limit),
                search,
                status,
                type,
                sortBy,
                sortOrder,
            });

            return {
                success: true,
                ...exams,
            };
        } catch (error) {
            this.logger.error("Error getting all exams:", error.message);
            throw new HttpException(
                error.message || "Failed to get exams",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get("available")
    @Roles("student", "applicant", "staff", "admin")
    @ApiOperation({ summary: "Get available exams for current user" })
    @ApiResponse({
        status: 200,
        description: "Available exams retrieved successfully",
    })
    async getAvailableExams(@Request() req) {
        try {
            this.logger.log("Get available exams request received");

            // Extract user context with fallback for different user ID fields
            const userRole = req.user.role;
            const userId = req.user.userId || req.user.id || req.user._id;

            if (!userId) {
                throw new HttpException(
                    "User ID not found in request",
                    HttpStatus.UNAUTHORIZED
                );
            }

            this.logger.log(`User context: role=${userRole}, userId=${userId}`);
            this.logger.log("Full user object keys:", Object.keys(req.user));

            const userExams = await this.examService.getAvailableExamsForUser(
                userId,
                userRole
            );

            this.logger.log(`Found ${userExams.length} available exams for user`);

            return {
                success: true,
                data: userExams,
            };
        } catch (error) {
            this.logger.error("Error fetching available exams:", error);
            throw new HttpException(
                "Internal server error",
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get("history")
    @Roles("student", "applicant", "staff", "admin")
    @ApiOperation({
        summary: "Get exam history (completed, graded, missed) for current user",
    })
    @ApiResponse({
        status: 200,
        description: "Exam history retrieved successfully",
    })
    async getExamHistory(@Request() req) {
        try {
            const userRole = req.user.role;
            const userId = req.user.userId || req.user.id || req.user._id;

            if (!userId) {
                throw new HttpException(
                    "User ID not found in request",
                    HttpStatus.UNAUTHORIZED
                );
            }

            const examHistory = await this.examService.getExamHistoryForUser(
                userId,
                userRole
            );

            return {
                success: true,
                data: examHistory,
            };
        } catch (error) {
            this.logger.error("Error fetching exam history:", error);
            throw new HttpException(
                error.message || "Failed to get exam history",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(":examId")
    @Roles("student", "applicant", "staff", "admin")
    @ApiOperation({ summary: "Get exam details by ID" })
    @ApiResponse({
        status: 200,
        description: "Exam details retrieved successfully",
    })
    async getExamDetails(
        @Param("examId") examId: string,
        @Request() req
    ): Promise<any> {
        try {
            const userId = req.user.userId || req.user.id || req.user._id;

            if (!userId) {
                throw new HttpException(
                    "User ID not found in request",
                    HttpStatus.UNAUTHORIZED
                );
            }

            const exam = await this.examService.getExamDetails(examId, userId);

            return {
                success: true,
                exam,
            };
        } catch (error) {
            this.logger.error(
                `Error getting exam details for ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to get exam details",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/start")
    @Roles("student", "applicant", "staff", "admin")
    @ApiOperation({ summary: "Start an exam with password verification" })
    @ApiResponse({ status: 200, description: "Exam started successfully" })
    async startExam(
        @Param("examId") examId: string,
        @Body() body: { password: string; clientMeta: any },
        @Request() req
    ): Promise<any> {
        try {
            const userId = req.user.userId || req.user.id || req.user._id;
            const { password, clientMeta } = body;

            if (!userId) {
                throw new HttpException(
                    "User ID not found in request",
                    HttpStatus.UNAUTHORIZED
                );
            }

            this.logger.log(`Starting exam ${examId} for user ${userId}`);

            const result = await this.examService.startExam(
                examId,
                userId,
                password,
                clientMeta
            );

            return {
                success: true,
                ...result,
            };
        } catch (error) {
            this.logger.error(`Error starting exam ${examId}:`, error.message);
            throw new HttpException(
                error.message || "Failed to start exam",
                error.status || HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get(":examId/questions/manage")
    @Roles("staff", "admin")
    @ApiOperation({
        summary: "Get all questions for exam management (Staff only)",
    })
    @ApiResponse({
        status: 200,
        description: "Exam questions retrieved successfully",
    })
    async getExamQuestionsForManagement(
        @Param("examId") examId: string,
        @Request() req
    ): Promise<any> {
        try {
            const questions = await this.examService.getExamQuestionsForManagement(
                examId
            );
            return {
                success: true,
                questions,
            };
        } catch (error) {
            this.logger.error(
                "Error getting exam questions for management:",
                error.message
            );
            throw new HttpException(
                error.message || "Failed to get exam questions",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/questions")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Create new question for exam" })
    @ApiResponse({ status: 201, description: "Question created successfully" })
    async createQuestion(
        @Param("examId") examId: string,
        @Body() questionData: any,
        @Request() req
    ): Promise<any> {
        try {
            const { userId } = req.user;
            const question = await this.examService.createQuestion(
                examId,
                questionData,
                userId
            );

            return {
                success: true,
                question,
            };
        } catch (error) {
            this.logger.error(
                `Error creating question for exam ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to create question",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(":examId/questions")
    @Roles("student", "applicant", "staff", "admin")
    @ApiOperation({ summary: "Get exam questions for active attempt" })
    @ApiResponse({
        status: 200,
        description: "Exam questions retrieved successfully",
    })
    async getExamQuestions(
        @Param("examId") examId: string,
        @Query("attemptId") attemptId: string,
        @Request() req
    ): Promise<any> {
        try {
            const userId = req.user.userId || req.user.id || req.user._id;

            if (!userId) {
                throw new HttpException(
                    "User ID not found in request",
                    HttpStatus.UNAUTHORIZED
                );
            }

            if (!attemptId) {
                throw new HttpException(
                    "Attempt ID is required",
                    HttpStatus.BAD_REQUEST
                );
            }

            this.logger.log(
                `Getting exam questions for exam ${examId}, attempt ${attemptId}, user ${userId}`
            );

            const questions = await this.examService.getExamQuestions(
                examId,
                attemptId,
                userId
            );

            return {
                success: true,
                questions,
            };
        } catch (error) {
            this.logger.error(
                `Error getting exam questions for ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to get exam questions",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/save-answers")
    @Roles("student", "applicant", "staff", "admin")
    @ApiOperation({ summary: "Auto-save exam answers" })
    @ApiResponse({ status: 200, description: "Answers saved successfully" })
    async saveAnswers(
        @Param("examId") examId: string,
        @Body() body: { attemptId: string; answers: any[]; timestamp: Date },
        @Request() req
    ): Promise<any> {
        try {
            const userId = req.user.userId || req.user.id || req.user._id;
            const { attemptId, answers, timestamp } = body;

            if (!userId) {
                throw new HttpException(
                    "User ID not found in request",
                    HttpStatus.UNAUTHORIZED
                );
            }

            await this.examService.saveAnswers(
                examId,
                attemptId,
                userId,
                answers,
                timestamp
            );

            return {
                success: true,
                message: "Answers saved successfully",
            };
        } catch (error) {
            this.logger.error(
                `Error saving answers for exam ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to save answers",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/submit")
    @Roles("student", "applicant", "staff", "admin")
    @ApiOperation({ summary: "Submit exam for grading" })
    @ApiResponse({ status: 200, description: "Exam submitted successfully" })
    async submitExam(
        @Param("examId") examId: string,
        @Body()
        body: {
            attemptId: string;
            answers: any[];
            securityViolations: any[];
            submittedAt: Date;
            isAutoSubmit?: boolean;
        },
        @Request() req
    ): Promise<any> {
        try {
            const userId = req.user.userId || req.user.id || req.user._id;
            const { attemptId, answers, securityViolations, submittedAt, isAutoSubmit = false } = body;

            if (!userId) {
                throw new HttpException(
                    "User ID not found in request",
                    HttpStatus.UNAUTHORIZED
                );
            }

            const result = await this.examService.submitExam(
                examId,
                attemptId,
                userId,
                answers,
                securityViolations,
                submittedAt,
                isAutoSubmit
            );

            return {
                success: true,
                message: isAutoSubmit ? "Exam auto-submitted successfully" : "Exam submitted successfully",
                data: {
                    attemptId,
                    submittedAt: new Date(),
                    gradingInProgress: true,
                    gradingMessage: "Your exam is being graded. Results will be available shortly.",
                    ...result,
                }
            };
        } catch (error) {
            this.logger.error(`Error submitting exam ${examId}:`, error.message);
            throw new HttpException(
                error.message || "Failed to submit exam",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/heartbeat")
    @Roles("student", "applicant", "staff", "admin")
    @ApiOperation({ summary: "Record exam session heartbeat" })
    @ApiResponse({ status: 200, description: "Heartbeat recorded successfully" })
    async recordHeartbeat(
        @Param("examId") examId: string,
        @Body() body: { attemptId: string; timestamp: Date; clientMeta: any },
        @Request() req
    ): Promise<any> {
        try {
            const userId = req.user.userId || req.user.id || req.user._id;
            const { attemptId, timestamp, clientMeta } = body;

            if (!userId) {
                throw new HttpException(
                    "User ID not found in request",
                    HttpStatus.UNAUTHORIZED
                );
            }

            await this.examService.recordHeartbeat(examId, attemptId, userId, {
                timestamp,
                ...clientMeta,
            });

            return {
                success: true,
            };
        } catch (error) {
            // Don't throw errors for heartbeat failures to avoid disrupting exam
            this.logger.warn(
                `Heartbeat recording failed for exam ${examId}:`,
                error.message
            );
            return {
                success: false,
                message: "Heartbeat recording failed",
            };
        }
    }

    @Post(":examId/security-violation")
    @Roles("student", "applicant", "staff", "admin")
    @ApiOperation({ summary: "Record security violation during exam" })
    @ApiResponse({
        status: 200,
        description: "Security violation recorded successfully",
    })
    async recordSecurityViolation(
        @Param("examId") examId: string,
        @Body()
        body: {
            attemptId: string;
            violationType: string;
            timestamp: Date;
            details: any;
        },
        @Request() req
    ): Promise<any> {
        try {
            const userId = req.user.userId || req.user.id || req.user._id;
            const { attemptId, violationType, timestamp, details } = body;

            if (!userId) {
                throw new HttpException(
                    "User ID not found in request",
                    HttpStatus.UNAUTHORIZED
                );
            }

            await this.examService.recordSecurityViolation(
                examId,
                attemptId,
                userId,
                {
                    type: violationType,
                    timestamp,
                    details,
                }
            );

            return {
                success: true,
            };
        } catch (error) {
            // Don't throw errors for violation recording to avoid disrupting exam
            this.logger.warn(
                `Security violation recording failed for exam ${examId}:`,
                error.message
            );
            return {
                success: false,
                message: "Security violation recording failed",
            };
        }
    }

    @Get(":examId/attempts/:attemptId")
    @Roles("student", "applicant", "staff", "admin")
    @ApiOperation({ summary: "Get exam attempt details with answers and timing" })
    @ApiResponse({
        status: 200,
        description: "Attempt details retrieved successfully",
    })
    async getAttemptDetails(
        @Param("examId") examId: string,
        @Param("attemptId") attemptId: string,
        @Request() req
    ): Promise<any> {
        try {
            const userId = req.user.userId || req.user.id || req.user._id;

            if (!userId) {
                throw new HttpException(
                    "User not authenticated",
                    HttpStatus.UNAUTHORIZED
                );
            }

            this.logger.log(
                `Getting attempt details for exam ${examId}, attempt ${attemptId}, user ${userId}`
            );

            const attemptDetails = await this.examService.getAttemptDetails(
                examId,
                attemptId,
                userId
            );

            return {
                success: true,
                data: attemptDetails,
            };
        } catch (error) {
            this.logger.error(
                `Error getting attempt details for exam ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to get attempt details",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(":examId/results")
    @Roles("student", "applicant", "staff", "admin")
    @ApiOperation({ summary: "Get exam results" })
    @ApiResponse({
        status: 200,
        description: "Exam results retrieved successfully",
    })
    async getExamResults(
        @Param("examId") examId: string,
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
                ...results,
            };
        } catch (error) {
            this.logger.error(
                `Error getting exam results for ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to get exam results",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(":examId/results/:resultId/review")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Get manual scoring review payload for a result" })
    @ApiResponse({ status: 200, description: "Manual review payload retrieved successfully" })
    async getManualReviewPayload(
        @Param("examId") examId: string,
        @Param("resultId") resultId: string,
        @Request() req
    ): Promise<any> {
        try {
            const review = await this.gradingService.getManualReviewPayload(examId, resultId);

            return {
                success: true,
                data: review,
            };
        } catch (error) {
            this.logger.error(
                `Error getting manual review payload for exam ${examId}, result ${resultId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to get manual review payload",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Put(":examId/results/:resultId/manual-score")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Save manual essay scores for a result" })
    @ApiResponse({ status: 200, description: "Manual scoring saved successfully" })
    async saveManualScores(
        @Param("examId") examId: string,
        @Param("resultId") resultId: string,
        @Body()
        body: {
            questionUpdates?: Array<{
                questionId: string;
                pointsAwarded: number;
                feedback?: string;
            }>;
            overallFeedback?: string;
            finalize?: boolean;
        },
        @Request() req
    ): Promise<any> {
        try {
            const graderId = req.user.userId || req.user.id || req.user._id;
            const result = await this.gradingService.saveManualScores(
                examId,
                resultId,
                body,
                graderId
            );

            return {
                success: true,
                message: body?.finalize
                    ? "Manual scoring finalized successfully"
                    : "Manual scoring saved successfully",
                data: {
                    resultId: result._id,
                    gradingStatus: result.gradingStatus,
                    gradingType: result.gradingType,
                    status: result.status,
                    totalScore: result.totalScore,
                    maxScore: result.maxScore,
                    percentage: result.percentage,
                    released: result.released,
                },
            };
        } catch (error) {
            this.logger.error(
                `Error saving manual scores for exam ${examId}, result ${resultId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to save manual scores",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/results/:resultId/release")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Release a single exam result to a student" })
    @ApiResponse({ status: 200, description: "Result released successfully" })
    async releaseSingleResult(
        @Param("examId") examId: string,
        @Param("resultId") resultId: string,
        @Request() req
    ): Promise<any> {
        try {
            const actorId = req.user.userId || req.user.id || req.user._id;
            const result = await this.gradingService.releaseSingleResult(examId, resultId, actorId);

            return {
                success: true,
                message: "Result released successfully",
                data: {
                    resultId: result._id,
                    released: result.released,
                },
            };
        } catch (error) {
            this.logger.error(
                `Error releasing single result ${resultId} for exam ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to release result",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/results/:resultId/retract")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Retract a single exam result from a student" })
    @ApiResponse({ status: 200, description: "Result retracted successfully" })
    async retractSingleResult(
        @Param("examId") examId: string,
        @Param("resultId") resultId: string,
        @Request() req
    ): Promise<any> {
        try {
            const actorId = req.user.userId || req.user.id || req.user._id;
            const result = await this.gradingService.retractSingleResult(examId, resultId, actorId);

            return {
                success: true,
                message: "Result retracted successfully",
                data: {
                    resultId: result._id,
                    released: result.released,
                },
            };
        } catch (error) {
            this.logger.error(
                `Error retracting single result ${resultId} for exam ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to retract result",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get("user/history")
    @Roles("student", "applicant", "staff", "admin")
    @ApiOperation({ summary: "Get user exam history" })
    @ApiResponse({
        status: 200,
        description: "User exam history retrieved successfully",
    })
    async getUserExamHistory(@Request() req, @Query() query): Promise<any> {
        try {
            const { userId } = req.user;

            const history = await this.examService.getUserExamHistory(userId);

            return {
                success: true,
                history,
            };
        } catch (error) {
            this.logger.error("Error getting user exam history:", error.message);
            throw new HttpException(
                error.message || "Failed to get exam history",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    // Admin/Staff endpoints
    @Post()
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Create new exam (Admin only)" })
    @ApiResponse({ status: 201, description: "Exam created successfully" })
    async createExam(@Body() createExamDto: any, @Request() req): Promise<any> {
        try {
            const { userId } = req.user;

            const exam = await this.examService.createExam(createExamDto, userId);

            return {
                success: true,
                examId: exam._id,
                exam,
            };
        } catch (error) {
            this.logger.error("Error creating exam:", error.message);
            throw new HttpException(
                error.message || "Failed to create exam",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Put(":examId")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Update existing exam (Admin only)" })
    @ApiResponse({ status: 200, description: "Exam updated successfully" })
    async updateExam(
        @Param("examId") examId: string,
        @Body() updateExamDto: any,
        @Request() req
    ): Promise<any> {
        try {
            const { userId } = req.user;

            const exam = await this.examService.updateExam(
                examId,
                updateExamDto,
                userId
            );

            return {
                success: true,
                message: "Exam updated successfully",
                exam,
            };
        } catch (error) {
            this.logger.error(`Error updating exam ${examId}:`, error.message);
            throw new HttpException(
                error.message || "Failed to update exam",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Delete(":examId")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Delete exam (Admin only)" })
    @ApiResponse({ status: 200, description: "Exam deleted successfully" })
    async deleteExam(
        @Param("examId") examId: string,
        @Request() req
    ): Promise<any> {
        try {
            const { userId } = req.user;

            await this.examService.deleteExam(examId, userId);

            return {
                success: true,
                message: "Exam deleted successfully",
            };
        } catch (error) {
            this.logger.error(`Error deleting exam ${examId}:`, error.message);
            throw new HttpException(
                error.message || "Failed to delete exam",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/grade-all")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Queue grading for all exam attempts (Admin only)" })
    @ApiResponse({ status: 200, description: "Grading job queued successfully" })
    async gradeAllAttempts(
        @Param("examId") examId: string,
        @Request() req
    ): Promise<any> {
        try {
            this.logger.log(`Starting grade-all process for exam: ${examId}`);

            // Find all completed attempts for this exam that haven't been graded yet
            const attempts = await this.examService.getCompletedAttemptsForGrading(examId, false);

            if (!attempts || attempts.length === 0) {
                return {
                    success: true,
                    message: "No completed attempts found to grade",
                    attemptsProcessed: 0,
                };
            }

            this.logger.log(`Found ${attempts.length} completed attempts to grade for exam ${examId}`);

            // Queue grading jobs for each attempt
            const gradingJobs = [];
            let successCount = 0;
            let queuedCount = 0;
            let synchronousCount = 0;

            for (const attempt of attempts) {
                try {
                    const job = await this.queueService.queueGradingJob({
                        attemptId: attempt._id.toString(),
                        examId: examId,
                        userId: attempt.userId.toString(),
                        priority: 2, // Higher priority for manual grading requests
                    });

                    if (job) {
                        gradingJobs.push(job.id);
                        successCount++;
                        queuedCount++;
                        this.logger.log(`Queued grading job for attempt: ${attempt._id}`);
                    } else {
                        this.logger.warn(`Failed to queue grading job for attempt: ${attempt._id}, falling back to synchronous grading`);

                        // Fallback to synchronous grading if queue fails
                        try {
                            const result = await this.gradingService.gradeExam(attempt._id.toString(), req.user.id);
                            this.logger.log(`Synchronous grading completed for attempt: ${attempt._id}, result: ${result._id}`);
                            successCount++;
                            synchronousCount++;
                        } catch (syncError) {
                            this.logger.error(`Synchronous grading failed for attempt: ${attempt._id}:`, syncError.message);
                        }
                    }
                } catch (error) {
                    this.logger.error(`Error queuing grading job for attempt ${attempt._id}:`, error.message);

                    // Fallback to synchronous grading if queue fails
                    try {
                        const result = await this.gradingService.gradeExam(attempt._id.toString(), req.user.id);
                        this.logger.log(`Fallback synchronous grading completed for attempt: ${attempt._id}, result: ${result._id}`);
                        successCount++;
                        synchronousCount++;
                    } catch (syncError) {
                        this.logger.error(`Fallback synchronous grading failed for attempt: ${attempt._id}:`, syncError.message);
                    }
                }
            }

            return {
                success: true,
                message: synchronousCount > 0 ?
                    `Grading completed for ${successCount} attempts (${queuedCount} queued, ${synchronousCount} processed immediately)` :
                    `Grading jobs queued for ${successCount} attempts`,
                attemptsProcessed: successCount,
                totalAttempts: attempts.length,
                queuedCount: queuedCount,
                synchronousCount: synchronousCount,
                jobIds: gradingJobs,
            };
        } catch (error) {
            this.logger.error(
                `Error queuing grading jobs for exam ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to queue grading jobs",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/regrade-all")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Queue regrading for all exam attempts (Admin only)" })
    @ApiResponse({ status: 200, description: "Regrading jobs queued successfully" })
    async regradeAllAttempts(
        @Param("examId") examId: string,
        @Request() req
    ): Promise<any> {
        try {
            this.logger.log(`Starting regrade-all process for exam: ${examId}`);

            // Find all completed attempts for this exam (including those with existing results)
            const attempts = await this.examService.getCompletedAttemptsForGrading(examId, true);

            if (!attempts || attempts.length === 0) {
                return {
                    success: true,
                    message: "No completed attempts found to regrade",
                    attemptsProcessed: 0,
                };
            }

            this.logger.log(`Found ${attempts.length} completed attempts to regrade for exam ${examId}`);

            // Queue grading jobs for each attempt
            const gradingJobs = [];
            let successCount = 0;
            let queuedCount = 0;
            let synchronousCount = 0;

            for (const attempt of attempts) {
                try {
                    const job = await this.queueService.queueGradingJob({
                        attemptId: attempt._id.toString(),
                        examId: examId,
                        userId: attempt.userId.toString(),
                        priority: 3, // Higher priority for regrade requests
                    });

                    if (job) {
                        gradingJobs.push(job.id);
                        successCount++;
                        queuedCount++;
                        this.logger.log(`Queued regrading job for attempt: ${attempt._id}`);
                    } else {
                        this.logger.warn(`Failed to queue regrading job for attempt: ${attempt._id}, falling back to synchronous grading`);

                        // Fallback to synchronous grading if queue fails
                        try {
                            const result = await this.gradingService.gradeExam(attempt._id.toString(), req.user.id);
                            this.logger.log(`Synchronous regrading completed for attempt: ${attempt._id}, result: ${result._id}`);
                            successCount++;
                            synchronousCount++;
                        } catch (syncError) {
                            this.logger.error(`Synchronous regrading failed for attempt: ${attempt._id}:`, syncError.message);
                        }
                    }
                } catch (error) {
                    this.logger.error(`Error queuing regrading job for attempt ${attempt._id}:`, error.message);

                    // Fallback to synchronous grading if queue fails
                    try {
                        const result = await this.gradingService.gradeExam(attempt._id.toString(), req.user.id);
                        this.logger.log(`Fallback synchronous regrading completed for attempt: ${attempt._id}, result: ${result._id}`);
                        successCount++;
                        synchronousCount++;
                    } catch (syncError) {
                        this.logger.error(`Fallback synchronous regrading failed for attempt: ${attempt._id}:`, syncError.message);
                    }
                }
            }

            const response = {
                success: true,
                message: synchronousCount > 0 ?
                    `Regrading completed for ${successCount} attempts (${queuedCount} queued, ${synchronousCount} processed immediately)` :
                    `Regrading jobs queued for ${successCount} attempts`,
                attemptsProcessed: successCount,
                totalAttempts: attempts.length,
                queuedCount: queuedCount,
                synchronousCount: synchronousCount,
                jobIds: gradingJobs,
            };

            this.logger.log(`Regrade-all completed for exam ${examId}: ${successCount}/${attempts.length} attempts processed`);
            return response;
        } catch (error) {
            this.logger.error(
                `Error queuing regrading jobs for exam ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to queue regrading jobs",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/regrade-user")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Regrade a specific user's exam attempt (Staff/Admin only)" })
    @ApiResponse({ status: 200, description: "User exam regraded successfully" })
    async regradeUserExam(
        @Param("examId") examId: string,
        @Body() body: { userId: string },
        @Request() req
    ): Promise<any> {
        try {
            const { userId } = body;
            this.logger.log(`Starting regrade for user ${userId} in exam: ${examId}`);

            // Find the user's completed attempt using getCompletedAttemptsForGrading then filter
            const attempts = await this.examService.getCompletedAttemptsForGrading(examId, true);
            const userAttempt = attempts.find(attempt => attempt.userId.toString() === userId);

            if (!userAttempt || userAttempt.status !== 'graded') {
                throw new HttpException(
                    "No graded attempt found for this user",
                    HttpStatus.NOT_FOUND
                );
            }

            let success = false;
            let isSynchronous = false;
            let resultId = null;

            try {
                // Try to queue the regrading job first
                const job = await this.queueService.queueGradingJob({
                    attemptId: userAttempt._id.toString(),
                    examId,
                    userId,
                    priority: 2 // High priority for individual regrade
                });

                if (job) {
                    this.logger.log(`Queued individual regrading job for attempt: ${userAttempt._id}`);
                    success = true;
                } else {
                    this.logger.warn(`Failed to queue regrading job for attempt: ${userAttempt._id}, falling back to synchronous grading`);

                    // Fallback to synchronous grading if queue fails
                    try {
                        const result = await this.gradingService.gradeExam(userAttempt._id.toString(), req.user.id);
                        this.logger.log(`Synchronous regrading completed for attempt: ${userAttempt._id}, result: ${result._id}`);
                        success = true;
                        isSynchronous = true;
                        resultId = result._id;
                    } catch (syncError) {
                        this.logger.error(`Synchronous regrading failed for attempt: ${userAttempt._id}:`, syncError.message);
                        throw new HttpException("Failed to regrade exam synchronously", HttpStatus.INTERNAL_SERVER_ERROR);
                    }
                }
            } catch (error) {
                this.logger.error(`Error queuing regrading job for attempt ${userAttempt._id}:`, error.message);

                // Fallback to synchronous grading if queue fails
                try {
                    const result = await this.gradingService.gradeExam(userAttempt._id.toString(), req.user.id);
                    this.logger.log(`Fallback synchronous regrading completed for attempt: ${userAttempt._id}, result: ${result._id}`);
                    success = true;
                    isSynchronous = true;
                    resultId = result._id;
                } catch (syncError) {
                    this.logger.error(`Fallback synchronous regrading failed for attempt: ${userAttempt._id}:`, syncError.message);
                    throw new HttpException("Failed to regrade exam", HttpStatus.INTERNAL_SERVER_ERROR);
                }
            }

            const response: any = {
                success: true,
                message: isSynchronous ?
                    "User exam regraded successfully (processed immediately)" :
                    "User exam queued for regrading successfully",
                attemptId: userAttempt._id,
                processedSynchronously: isSynchronous
            };

            if (resultId) {
                response.resultId = resultId;
            }

            return response;
        } catch (error) {
            this.logger.error(
                `Error regrading user exam for exam ${examId}, user ${body.userId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to regrade user exam",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(":examId/grading-status")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Get exam grading status and available actions" })
    @ApiResponse({ status: 200, description: "Grading status retrieved successfully" })
    async getExamGradingStatus(
        @Param("examId") examId: string,
        @Request() req
    ): Promise<any> {
        try {
            const status = await this.examService.getExamGradingStatus(examId);
            return {
                success: true,
                data: status
            };
        } catch (error) {
            this.logger.error(
                `Error getting grading status for exam ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to get grading status",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/release-results")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Release exam results to students (Admin only)" })
    @ApiResponse({ status: 200, description: "Results released successfully" })
    async releaseResults(
        @Param("examId") examId: string,
        @Body() body: { releaseAll?: boolean },
        @Request() req
    ): Promise<any> {
        try {
            const { releaseAll = true } = body;

            await this.gradingService.releaseResults(examId, releaseAll);

            return {
                success: true,
                message: "Results released successfully",
            };
        } catch (error) {
            this.logger.error(
                `Error releasing results for exam ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to release results",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/retract-results")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Retract exam results from students (Admin only)" })
    @ApiResponse({ status: 200, description: "Results retracted successfully" })
    async retractResults(
        @Param("examId") examId: string,
        @Request() req
    ): Promise<any> {
        try {
            await this.gradingService.retractResults(examId);

            return {
                success: true,
                message: "Results retracted successfully",
            };
        } catch (error) {
            this.logger.error(
                `Error retracting results for exam ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to retract results",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(":examId/statistics")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Get exam statistics and analytics (Admin only)" })
    @ApiResponse({
        status: 200,
        description: "Exam statistics retrieved successfully",
    })
    async getExamStatistics(
        @Param("examId") examId: string,
        @Request() req
    ): Promise<any> {
        try {
            const statistics = await this.gradingService.calculateExamStatistics(
                examId
            );

            return {
                success: true,
                statistics,
            };
        } catch (error) {
            this.logger.error(
                `Error getting statistics for exam ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to get exam statistics",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get("jobs/:queueName/:jobId")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Get background job status (Admin only)" })
    @ApiResponse({
        status: 200,
        description: "Job status retrieved successfully",
    })
    async getJobStatus(
        @Param("queueName") queueName: string,
        @Param("jobId") jobId: string,
        @Request() req
    ): Promise<any> {
        try {
            const jobStatus = await this.queueService.getJobStatus(queueName, jobId);

            return {
                success: true,
                job: jobStatus,
            };
        } catch (error) {
            this.logger.error(
                `Error getting job status for ${queueName}:${jobId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to get job status",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post("update-statuses")
    @Roles("admin", "staff")
    @ApiOperation({
        summary:
            "Manually update exam statuses based on current time (Admin/Staff only)",
    })
    @ApiResponse({
        status: 200,
        description: "Exam statuses updated successfully",
    })
    async updateExamStatuses(): Promise<any> {
        try {
            await this.examService.updateExamStatusesByTime();
            return {
                success: true,
                message: "Exam statuses updated successfully",
            };
        } catch (error) {
            this.logger.error("Error updating exam statuses:", error.message);
            throw new HttpException(
                error.message || "Failed to update exam statuses",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(":examId/passwords")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Get exam passwords (Staff/Admin only)" })
    @ApiResponse({
        status: 200,
        description: "Exam passwords retrieved successfully",
    })
    async getExamPasswords(@Param("examId") examId: string): Promise<any> {
        try {
            const passwords = await this.examService.getExamPasswords(examId);
            return {
                success: true,
                data: passwords,
            };
        } catch (error) {
            this.logger.error("Error getting exam passwords:", error.message);
            throw new HttpException(
                error.message || "Failed to get exam passwords",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/generate-password")
    @Roles("staff", "admin")
    @ApiOperation({
        summary: "Manually generate exam password (Staff/Admin only)",
    })
    @ApiResponse({
        status: 200,
        description: "Exam password generated successfully",
    })
    async generateExamPassword(
        @Param("examId") examId: string,
        @Request() req
    ): Promise<any> {
        try {
            const createdBy = req.user.id || req.user._id;
            const password = await this.examService.generateExamPassword(
                examId,
                createdBy
            );
            return {
                success: true,
                message: "Exam password generated successfully",
                password: password,
            };
        } catch (error) {
            this.logger.error("Error generating exam password:", error.message);
            throw new HttpException(
                error.message || "Failed to generate exam password",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/regenerate-password")
    @Roles("staff", "admin")
    @ApiOperation({ summary: "Regenerate exam password (Staff/Admin only)" })
    @ApiResponse({
        status: 200,
        description: "Exam password regenerated successfully",
    })
    async regenerateExamPassword(
        @Param("examId") examId: string,
        @Request() req
    ): Promise<any> {
        try {
            const userId = req.user.id || req.user._id;
            const result = await this.examService.regenerateExamPassword(
                examId,
                userId
            );

            if (!result.success) {
                throw new HttpException(result.message, HttpStatus.BAD_REQUEST);
            }

            return {
                success: true,
                message: "Exam password regenerated successfully",
                password: result.password,
            };
        } catch (error) {
            this.logger.error("Error regenerating exam password:", error.message);
            throw new HttpException(
                error.message || "Failed to regenerate exam password",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post("schedule-reminders")
    @Roles("staff", "admin")
    @ApiOperation({
        summary: "Schedule reminders for all upcoming exams (Staff/Admin only)",
    })
    @ApiResponse({ status: 200, description: "Reminders scheduled successfully" })
    async scheduleAllExamReminders(@Request() req): Promise<any> {
        try {
            const result = await this.queueService.scheduleAllUpcomingExamReminders();

            this.logger.log(
                `Reminder scheduling completed by user ${req.user.id}: ${result.scheduled} scheduled, ${result.errors.length} errors`
            );

            return {
                success: true,
                message: "Exam reminders scheduled successfully",
                scheduled: result.scheduled,
                errors: result.errors,
            };
        } catch (error) {
            this.logger.error("Error scheduling exam reminders:", error.message);
            throw new HttpException(
                error.message || "Failed to schedule exam reminders",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":examId/send-scheduled-email")
    @Roles("staff", "admin")
    @ApiOperation({
        summary:
            "Send scheduled exam email with password to all target users (Staff/Admin only)",
    })
    @ApiResponse({
        status: 200,
        description: "Scheduled exam emails sent successfully",
    })
    async sendScheduledExamEmail(
        @Param("examId") examId: string,
        @Request() req
    ): Promise<any> {
        try {
            const userId = req.user.userId || req.user.id || req.user._id;

            if (!userId) {
                throw new HttpException(
                    "User not authenticated",
                    HttpStatus.UNAUTHORIZED
                );
            }

            this.logger.log(
                `Manual scheduled exam email trigger for exam ${examId} by user ${userId}`
            );

            const result = await this.examService.sendScheduledExamNotification(
                examId,
                userId
            );

            return {
                success: true,
                message: "Exam reminder emails sent successfully",
                emailsSent: result.emailsSent,
                recipientCount: result.recipientCount,
                errors: result.errors || [],
            };
        } catch (error) {
            this.logger.error(
                `Error sending scheduled exam emails for ${examId}:`,
                error.message
            );
            throw new HttpException(
                error.message || "Failed to send scheduled exam emails",
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(":examId/export-results-pdf")
    @Roles("staff", "admin")
    @ApiOperation({
        summary: "Export all exam results as PDF (Staff/Admin only)",
    })
    @ApiResponse({ status: 200, description: "PDF generated successfully" })
    async exportExamResultsPDF(
        @Param("examId") examId: string,
        @Request() req: any,
        @Res() res: Response,
        @Query() query: any
    ): Promise<void> {
        try {
            this.logger.log(`Exporting exam results PDF for exam: ${examId}`);

            // Get all exam results for this exam
            const response = await this.examService.getExamResults(examId, req.user.id, req.user.role);

            if (!response || !response.results || response.results.length === 0) {
                throw new HttpException('No exam results found to export', HttpStatus.NOT_FOUND);
            }

            // Get exam details
            const exam = await this.examService.getExamDetails(examId, req.user.id);
            if (!exam) {
                throw new HttpException('Exam not found', HttpStatus.NOT_FOUND);
            }

            // Generate HTML content for the PDF
            const htmlContent = this.generateExamResultsHTML(exam, response.results, response.statistics);

            // Generate PDF using Puppeteer
            let browser;
            try {
                this.logger.log('Launching Puppeteer browser for exam results export...');
                const { launchPuppeteerBrowser } = await import('../utils/puppeteer-launch.util');
                browser = await launchPuppeteerBrowser();

                const page = await browser.newPage();
                await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

                this.logger.log('Generating exam results PDF...');
                const buffer = await page.pdf({
                    format: 'A4',
                    margin: {
                        top: '0.5in',
                        right: '0.5in',
                        bottom: '0.5in',
                        left: '0.5in'
                    },
                    printBackground: true
                });

                this.logger.log(`Exam results PDF generated successfully. Buffer size: ${buffer.length} bytes`);

                // Set response headers
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="exam-results-${examId}.pdf"`);
                res.setHeader('Content-Length', buffer.length);

                // Send the PDF
                res.send(buffer);

            } finally {
                if (browser) {
                    await browser.close();
                }
            }

        } catch (error) {
            this.logger.error(`Error exporting exam results PDF for ${examId}:`, error.message);
            if (!res.headersSent) {
                res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                    message: error.message || 'Failed to export exam results PDF'
                });
            }
        }
    }

    private generateExamResultsHTML(exam: any, results: any[], statistics: any): string {
        const totalStudents = results.length;
        const passCount = results.filter(r => r.status === 'pass').length;
        const failCount = totalStudents - passCount;
        const passRate = totalStudents > 0 ? ((passCount / totalStudents) * 100).toFixed(1) : '0';

        const resultRows = results.map(result => {
            const studentName = result.userId ?
                `${result.userId.firstName || ''} ${result.userId.lastName || ''}`.trim() ||
                result.userId.email || 'Unknown Student' : 'Unknown Student';

            const submittedAt = result.attemptId?.submittedAt ?
                new Date(result.attemptId.submittedAt).toLocaleString() : 'Not submitted';

            const earnedScore = result.totalScore ?? result.correctAnswers ?? 0;
            const maxScore = result.maxScore ?? result.totalQuestions ?? 0;

            return `
                <tr>
                    <td>${studentName}</td>
                    <td>${result.userId?.email || 'N/A'}</td>
                    <td style="text-align: center;">${earnedScore}/${maxScore}</td>
                    <td style="text-align: center;">${result.percentage}%</td>
                    <td style="text-align: center;">
                        <span style="
                            background-color: ${result.status === 'pass' ? '#28a745' : '#dc3545'};
                            color: white;
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-size: 12px;
                            font-weight: bold;
                        ">
                            ${result.status.toUpperCase()}
                        </span>
                    </td>
                    <td style="text-align: center;">${submittedAt}</td>
                </tr>
            `;
        }).join('');

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Exam Results Export - ${exam.title}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #ffffff;
                    line-height: 1.4;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #007bff;
                    padding-bottom: 20px;
                }
                .logo {
                    font-size: 24px;
                    font-weight: bold;
                    color: #007bff;
                    margin-bottom: 5px;
                }
                .subtitle {
                    color: #666;
                    font-size: 14px;
                }
                .exam-info {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 30px;
                    border: 1px solid #dee2e6;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 20px;
                    margin-bottom: 30px;
                }
                .stat-card {
                    background: #ffffff;
                    padding: 15px;
                    border-radius: 6px;
                    text-align: center;
                    border: 1px solid #dee2e6;
                }
                .stat-value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #007bff;
                }
                .stat-label {
                    font-size: 12px;
                    color: #6c757d;
                    margin-top: 5px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th, td {
                    border: 1px solid #dee2e6;
                    padding: 12px;
                    text-align: left;
                }
                th {
                    background-color: #007bff;
                    color: white;
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background-color: #f8f9fa;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #6c757d;
                    border-top: 1px solid #dee2e6;
                    padding-top: 15px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo">ALECONS - Exam Results Export</div>
                <div class="subtitle">Comprehensive Exam Results Report</div>
            </div>

            <div class="exam-info">
                <h3 style="margin-top: 0; color: #333;">${exam.title}</h3>
                <p style="margin: 5px 0;"><strong>Description:</strong> ${exam.description || 'No description available'}</p>
                <p style="margin: 5px 0;"><strong>Duration:</strong> ${exam.duration || 'N/A'} minutes</p>
                <p style="margin: 5px 0;"><strong>Total Questions:</strong> ${exam.totalQuestions || 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${totalStudents}</div>
                    <div class="stat-label">Total Students</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="color: #28a745;">${passCount}</div>
                    <div class="stat-label">Passed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="color: #dc3545;">${failCount}</div>
                    <div class="stat-label">Failed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${passRate}%</div>
                    <div class="stat-label">Pass Rate</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Student Name</th>
                        <th>Email</th>
                        <th>Score</th>
                        <th>Percentage</th>
                        <th>Status</th>
                        <th>Submitted At</th>
                    </tr>
                </thead>
                <tbody>
                    ${resultRows}
                </tbody>
            </table>

            <div class="footer">
                <div>This is an official exam results export generated by ALECONS Examination System</div>
                <div style="margin-top: 5px;">Generated on: ${new Date().toLocaleString()}</div>
            </div>
        </body>
        </html>
        `;
    }
}

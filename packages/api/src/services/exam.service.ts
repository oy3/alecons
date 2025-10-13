import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Exam, ExamDocument } from '../schemas/exam.schema';
import { Question, QuestionDocument } from '../schemas/question.schema';
import { ExamPassword, ExamPasswordDocument } from '../schemas/exam-password.schema';
import { ExamAttempt, ExamAttemptDocument } from '../schemas/exam-attempt.schema';
import { ExamResult, ExamResultDocument } from '../schemas/exam-result.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ExamService {
    private readonly logger = new Logger(ExamService.name);

    constructor(
        @InjectModel(Exam.name) private examModel: Model<ExamDocument>,
        @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
        @InjectModel(ExamPassword.name) private passwordModel: Model<ExamPasswordDocument>,
        @InjectModel(ExamAttempt.name) private attemptModel: Model<ExamAttemptDocument>,
        @InjectModel(ExamResult.name) private resultModel: Model<ExamResultDocument>,
    ) { }

    async getAvailableExamsForUser(
        userId: string,
        userRole: string,
        programId?: string,
        academicSession?: string
    ): Promise<any[]> {
        try {
            this.logger.log(`Getting available exams for user: ${userId}, role: ${userRole}`);

            const now = new Date();
            const filter: any = {
                isActive: true,
                status: { $in: ['scheduled', 'in-progress'] }
            };

            // Apply targeting rules based on user role and context
            if (userRole === 'student' || userRole === 'applicant') {
                filter.$or = [
                    { 'target.type': userRole },
                    { 'target.type': 'custom', 'target.filter.programId': new Types.ObjectId(programId) }
                ];
            } else if (userRole === 'staff') {
                filter['target.type'] = { $in: ['staff', 'custom'] };
            }

            const exams = await this.examModel
                .find(filter)
                .populate('academicSession')
                .populate({
                    path: 'target.filter.programId',
                    model: 'Program'
                })
                .sort({ examTimestamp: 1 })
                .lean();

            // Get user's attempts for these exams
            const examIds = exams.map(exam => exam._id);
            const userAttempts = await this.attemptModel
                .find({
                    examId: { $in: examIds },
                    userId: new Types.ObjectId(userId)
                })
                .lean();

            const attemptsByExam = userAttempts.reduce((acc, attempt) => {
                acc[attempt.examId.toString()] = attempt;
                return acc;
            }, {});

            // Enhance exams with user attempt data
            return exams.map(exam => ({
                ...exam,
                userAttempt: attemptsByExam[exam._id.toString()] || null
            }));

        } catch (error) {
            this.logger.error('Error getting available exams:', error.message);
            throw error;
        }
    }

    async getExamDetails(examId: string, userId: string): Promise<ExamDocument> {
        try {
            const exam = await this.examModel
                .findById(examId)
                .populate('academicSession')
                .populate('createdBy', 'firstName lastName email');

            if (!exam) {
                throw new NotFoundException('Exam not found');
            }

            // Check if user has access to this exam
            // TODO: Implement proper access control based on target rules

            return exam;
        } catch (error) {
            this.logger.error(`Error getting exam details for ${examId}:`, error.message);
            throw error;
        }
    }

    async getExamQuestions(examId: string, attemptId: string, userId: string): Promise<any[]> {
        try {
            // Verify the attempt belongs to the user
            const attempt = await this.attemptModel.findOne({
                _id: attemptId,
                examId: new Types.ObjectId(examId),
                userId: new Types.ObjectId(userId)
            });

            if (!attempt) {
                throw new BadRequestException('Invalid attempt or access denied');
            }

            // Get questions without answers for security
            const questions = await this.questionModel
                .find({
                    examId: new Types.ObjectId(examId),
                    status: 'active'
                })
                .select('-answer') // Exclude answer field
                .sort({ order: 1 })
                .lean();

            // TODO: Implement question randomization if enabled

            return questions;
        } catch (error) {
            this.logger.error('Error getting exam questions:', error.message);
            throw error;
        }
    }

    async startExam(
        examId: string,
        userId: string,
        password: string,
        clientMeta: any
    ): Promise<{ attemptId: string }> {
        try {
            this.logger.log(`Starting exam ${examId} for user ${userId}`);

            // Verify exam exists and is available
            const exam = await this.examModel.findById(examId);
            if (!exam) {
                throw new NotFoundException('Exam not found');
            }

            if (exam.status !== 'scheduled') {
                throw new BadRequestException('Exam is not available for taking');
            }

            // Check exam timing
            const now = new Date();
            if (now < exam.examTimestamp) {
                throw new BadRequestException('Exam has not started yet');
            }

            const examEndTime = new Date(exam.examTimestamp.getTime() + exam.duration * 60 * 1000);
            if (now > examEndTime) {
                throw new BadRequestException('Exam time has expired');
            }

            // Verify password
            const validPassword = await this.passwordModel.findOne({
                examId: new Types.ObjectId(examId),
                isActive: true,
                expiresAt: { $gt: now }
            });

            if (!validPassword) {
                throw new BadRequestException('No valid password found for this exam');
            }

            const isPasswordValid = await bcrypt.compare(password, validPassword.hashedPassword);
            if (!isPasswordValid) {
                throw new BadRequestException('Invalid exam password');
            }

            // Check attempt limit
            const existingAttempts = await this.attemptModel.countDocuments({
                examId: new Types.ObjectId(examId),
                userId: new Types.ObjectId(userId)
            });

            if (existingAttempts >= exam.attemptLimit) {
                throw new BadRequestException('Maximum attempt limit reached');
            }

            // Check for existing in-progress attempt
            const inProgressAttempt = await this.attemptModel.findOne({
                examId: new Types.ObjectId(examId),
                userId: new Types.ObjectId(userId),
                status: 'in-progress'
            });

            if (inProgressAttempt) {
                // Return existing attempt if resume is allowed
                if (exam.allowResume) {
                    return { attemptId: inProgressAttempt._id.toString() };
                } else {
                    throw new BadRequestException('You have an incomplete attempt. Please contact administrator.');
                }
            }

            // Create new attempt
            const attempt = new this.attemptModel({
                examId: new Types.ObjectId(examId),
                userId: new Types.ObjectId(userId),
                passwordUsed: validPassword._id,
                startedAt: now,
                status: 'in-progress',
                clientMeta,
                answers: []
            });

            await attempt.save();

            // Update password usage
            await this.passwordModel.findByIdAndUpdate(validPassword._id, {
                $inc: { usageCount: 1 },
                $push: { usedBy: new Types.ObjectId(userId) }
            });

            this.logger.log(`Exam started successfully. Attempt ID: ${attempt._id}`);
            return { attemptId: attempt._id.toString() };

        } catch (error) {
            this.logger.error(`Error starting exam ${examId}:`, error.message);
            throw error;
        }
    }

    async saveAnswers(
        examId: string,
        attemptId: string,
        userId: string,
        answers: any[],
        timestamp: Date
    ): Promise<void> {
        try {
            // Verify attempt ownership
            const attempt = await this.attemptModel.findOne({
                _id: attemptId,
                examId: new Types.ObjectId(examId),
                userId: new Types.ObjectId(userId),
                status: 'in-progress'
            });

            if (!attempt) {
                throw new BadRequestException('Invalid attempt or attempt not in progress');
            }

            // Update answers
            await this.attemptModel.findByIdAndUpdate(attemptId, {
                answers,
                autoSavedAt: timestamp,
                lastHeartbeat: timestamp
            });

            this.logger.log(`Answers saved for attempt ${attemptId}`);
        } catch (error) {
            this.logger.error(`Error saving answers for attempt ${attemptId}:`, error.message);
            throw error;
        }
    }

    async submitExam(
        examId: string,
        attemptId: string,
        userId: string,
        finalAnswers: any[],
        securityViolations: any[],
        submittedAt: Date
    ): Promise<{ resultId: string }> {
        try {
            this.logger.log(`Submitting exam for attempt ${attemptId}`);

            // Verify attempt ownership
            const attempt = await this.attemptModel.findOne({
                _id: attemptId,
                examId: new Types.ObjectId(examId),
                userId: new Types.ObjectId(userId),
                status: 'in-progress'
            });

            if (!attempt) {
                throw new BadRequestException('Invalid attempt or attempt already submitted');
            }

            // Update attempt with final submission
            await this.attemptModel.findByIdAndUpdate(attemptId, {
                answers: finalAnswers,
                submittedAt,
                status: 'submitted',
                securityViolations,
                tabSwitchCount: securityViolations.filter(v => v.type === 'tab_switch').length,
                blurCount: securityViolations.filter(v => v.type === 'window_blur').length,
                rightClickCount: securityViolations.filter(v => v.type === 'right_click').length
            });

            // TODO: Queue grading job here
            // For now, we'll create a placeholder result
            const result = new this.resultModel({
                examId: new Types.ObjectId(examId),
                userId: new Types.ObjectId(userId),
                attemptId: new Types.ObjectId(attemptId),
                totalQuestions: finalAnswers.length,
                questionsAttempted: finalAnswers.filter(a => a.selected).length,
                correctAnswers: 0, // Will be calculated during grading
                totalScore: 0, // Will be calculated during grading
                maxScore: 0, // Will be calculated from questions
                percentage: 0,
                status: 'fail', // Will be updated after grading
                gradingType: 'auto',
                questionResults: [],
                released: false
            });

            await result.save();

            this.logger.log(`Exam submitted successfully. Result ID: ${result._id}`);
            return { resultId: result._id.toString() };

        } catch (error) {
            this.logger.error(`Error submitting exam for attempt ${attemptId}:`, error.message);
            throw error;
        }
    }

    async recordHeartbeat(
        examId: string,
        attemptId: string,
        userId: string,
        heartbeatData: any
    ): Promise<void> {
        try {
            await this.attemptModel.findOneAndUpdate(
                {
                    _id: attemptId,
                    examId: new Types.ObjectId(examId),
                    userId: new Types.ObjectId(userId),
                    status: 'in-progress'
                },
                {
                    lastHeartbeat: heartbeatData.timestamp,
                    clientMeta: heartbeatData
                }
            );
        } catch (error) {
            this.logger.error('Error recording heartbeat:', error.message);
        }
    }

    async recordSecurityViolation(
        examId: string,
        attemptId: string,
        userId: string,
        violation: any
    ): Promise<void> {
        try {
            await this.attemptModel.findOneAndUpdate(
                {
                    _id: attemptId,
                    examId: new Types.ObjectId(examId),
                    userId: new Types.ObjectId(userId),
                    status: 'in-progress'
                },
                {
                    $push: { securityViolations: violation }
                }
            );
        } catch (error) {
            this.logger.error('Error recording security violation:', error.message);
        }
    }

    async getExamResults(
        examId: string,
        userId: string,
        userRole: string,
        filters?: any
    ): Promise<any> {
        try {
            if (userRole === 'student' || userRole === 'applicant') {
                // Return user's own result
                const result = await this.resultModel
                    .findOne({
                        examId: new Types.ObjectId(examId),
                        userId: new Types.ObjectId(userId)
                    })
                    .populate('examId')
                    .lean();

                return {
                    exam: result?.examId,
                    result
                };
            } else {
                // Admin view - return all results with filters
                // TODO: Implement admin results view with filtering
                return { results: [] };
            }
        } catch (error) {
            this.logger.error('Error getting exam results:', error.message);
            throw error;
        }
    }

    async getUserExamHistory(userId: string): Promise<any[]> {
        try {
            const attempts = await this.attemptModel
                .find({ userId: new Types.ObjectId(userId) })
                .populate({
                    path: 'examId',
                    populate: {
                        path: 'academicSession'
                    }
                })
                .sort({ createdAt: -1 })
                .lean();

            return attempts;
        } catch (error) {
            this.logger.error('Error getting user exam history:', error.message);
            throw error;
        }
    }

    // Admin methods (TODO: Add proper implementation)
    async createExam(createExamDto: any, createdBy: string): Promise<ExamDocument> {
        try {
            const exam = new this.examModel({
                ...createExamDto,
                createdBy: new Types.ObjectId(createdBy)
            });

            return await exam.save();
        } catch (error) {
            this.logger.error('Error creating exam:', error.message);
            throw error;
        }
    }

    async updateExam(examId: string, updateExamDto: any, updatedBy: string): Promise<ExamDocument> {
        try {
            const exam = await this.examModel.findByIdAndUpdate(
                examId,
                { ...updateExamDto, updatedBy: new Types.ObjectId(updatedBy) },
                { new: true }
            );

            if (!exam) {
                throw new NotFoundException('Exam not found');
            }

            return exam;
        } catch (error) {
            this.logger.error(`Error updating exam ${examId}:`, error.message);
            throw error;
        }
    }

    async deleteExam(examId: string, deletedBy: string): Promise<void> {
        try {
            const exam = await this.examModel.findByIdAndUpdate(
                examId,
                { isActive: false, updatedBy: new Types.ObjectId(deletedBy) }
            );

            if (!exam) {
                throw new NotFoundException('Exam not found');
            }
        } catch (error) {
            this.logger.error(`Error deleting exam ${examId}:`, error.message);
            throw error;
        }
    }
}
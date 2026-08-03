import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Question, QuestionDocument } from '../schemas/question.schema';
import { ExamResult, ExamResultDocument } from '../schemas/exam-result.schema';
import { ExamAttempt, ExamAttemptDocument } from '../schemas/exam-attempt.schema';
import { Exam, ExamDocument } from '../schemas/exam.schema';
import { EmailService } from './email.service';

export interface GradingOptions {
    negativeMarking?: boolean;
    negativePercentage?: number;
    passingPercentage?: number;
}

export interface QuestionResult {
    questionId: string;
    userAnswer: any;
    correctAnswer: any;
    isCorrect?: boolean;
    pointsAwarded: number;
    maxPoints: number;
    explanation?: string;
    requiresManualGrading?: boolean;
}

interface ManualScoreUpdate {
    questionId: string;
    pointsAwarded: number;
    feedback?: string;
}

@Injectable()
export class GradingService {
    private readonly logger = new Logger(GradingService.name);

    constructor(
        @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
        @InjectModel(ExamResult.name) private resultModel: Model<ExamResultDocument>,
        @InjectModel(ExamAttempt.name) private attemptModel: Model<ExamAttemptDocument>,
        @InjectModel(Exam.name) private examModel: Model<ExamDocument>,
        private emailService: EmailService,
    ) { }

    async gradeExam(attemptId: string, gradedBy?: string): Promise<ExamResultDocument> {
        try {
            this.logger.log(`Starting grading for attempt: ${attemptId}`);

            const attempt = await this.attemptModel
                .findById(attemptId)
                .lean();

            if (!attempt) {
                throw new Error('Attempt not found');
            }

            if (!['submitted', 'auto-submitted', 'partially-graded', 'graded'].includes(attempt.status)) {
                throw new Error(`Attempt ${attemptId} is not eligible for grading from status: ${attempt.status}`);
            }

            const exam = await this.examModel.findById(attempt.examId).lean();
            if (!exam) {
                throw new Error(`Exam not found for attempt ${attemptId}`);
            }

            this.logger.debug(`Found attempt for user ${attempt.userId}, exam ${attempt.examId}`);

            const questions = await this.questionModel
                .find({ examId: attempt.examId })
                .lean();

            if (!questions.length) {
                this.logger.error(`No questions found for exam ${attempt.examId}`);
                throw new Error(`No questions found for exam ${attempt.examId}`);
            }

            this.logger.log(`Found ${questions.length} questions for exam ${attempt.examId}`);

            const questionResults: QuestionResult[] = [];
            let correctAnswers = 0;
            let totalScore = 0;
            let maxScore = 0;
            let requiresManualGrading = false;

            for (const question of questions) {
                const userAnswer = attempt.answers.find(a =>
                    a.questionId.toString() === question._id.toString()
                );

                const result = this.gradeQuestion(question as unknown as QuestionDocument, userAnswer);
                questionResults.push(result);

                if (result.requiresManualGrading) {
                    requiresManualGrading = true;
                }

                if (result.isCorrect) {
                    correctAnswers++;
                }

                totalScore += result.pointsAwarded;
                maxScore += result.maxPoints;
            }

            const totalQuestions = questions.length;
            const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
            const normalizedPercentage = Math.round(percentage * 100) / 100;
            const gradingStatus = requiresManualGrading ? 'partial' : 'completed';
            const gradingType = requiresManualGrading ? 'partial' : 'auto';
            const status = gradingStatus === 'completed'
                ? (totalScore >= (exam.cutOffMark ?? 0) ? 'pass' : 'fail')
                : undefined;

            this.logger.debug(`Score calculation: ${totalScore}/${maxScore} = ${normalizedPercentage}%. Cut-off mark: ${exam.cutOffMark}. Grading status: ${gradingStatus}. Result status: ${status || 'pending manual grading'}`);

            const resultData = {
                examId: attempt.examId,
                userId: attempt.userId,
                attemptId: attempt._id,
                totalQuestions,
                questionsAttempted: attempt.answers.filter(a => a.selected || a.answeredAt).length,
                correctAnswers,
                totalScore,
                maxScore,
                percentage: normalizedPercentage,
                status,
                gradingType,
                gradingStatus,
                questionResults,
                gradedAt: new Date(),
                gradedBy: gradedBy ? new Types.ObjectId(gradedBy) : undefined,
            };

            const existingResult = await this.resultModel.findOne({
                attemptId: new Types.ObjectId(attemptId)
            });

            let result: ExamResultDocument;
            const gradingHistoryEntry: any = {
                action: existingResult ? 'regraded' : 'graded',
                performedAt: new Date(),
                method: gradedBy ? 'manual' : 'auto',
                previousStatus: existingResult?.status,
                newStatus: status,
                previousScore: existingResult?.totalScore,
                newScore: totalScore,
                notes: requiresManualGrading
                    ? (existingResult ? 'Updated partial grading; essay/manual questions still require staff scoring' : 'Initial partial grading created from objective questions only')
                    : (existingResult ? 'Result regraded and fully completed' : 'Initial grading completed automatically')
            };

            if (gradedBy) {
                gradingHistoryEntry.performedBy = new Types.ObjectId(gradedBy);
            }

            if (existingResult) {
                const updateData = {
                    ...resultData,
                    released: existingResult.released ?? false,
                    $push: { gradingHistory: gradingHistoryEntry }
                };

                result = await this.resultModel.findByIdAndUpdate(
                    existingResult._id,
                    updateData,
                    { new: true }
                );

                this.logger.log(`Regraded existing result for attempt ${attemptId}. Previous: ${existingResult.totalScore}/${existingResult.maxScore} (${existingResult.percentage}%) -> New: ${totalScore}/${maxScore} (${normalizedPercentage}%)`);
            } else {
                const newResultData = {
                    ...resultData,
                    released: false,
                    gradingHistory: [gradingHistoryEntry]
                };

                result = new this.resultModel(newResultData);
                await result.save();

                this.logger.log(`Created new result for attempt ${attemptId}. Score: ${totalScore}/${maxScore} (${normalizedPercentage}%)`);
            }

            const nextAttemptStatus = gradingStatus === 'completed' ? 'graded' : 'partially-graded';
            await this.attemptModel.findByIdAndUpdate(attemptId, {
                status: nextAttemptStatus,
            });

            await this.syncExamGradingStatus(exam._id.toString());

            return result;

        } catch (error) {
            this.logger.error(`Error grading exam for attempt ${attemptId}:`, error.message);
            throw error;
        }
    }

    async getManualReviewPayload(examId: string, resultId: string): Promise<any> {
        const { exam, result, attempt, questions } = await this.getManualReviewContext(examId, resultId);
        const attemptAnswers = ((attempt.answers || []) as any[]);
        const questionResults = ((result.questionResults || []) as any[]);
        const attemptAnswerMap = new Map(
            attemptAnswers.map((answer: any) => [answer.questionId.toString(), answer])
        );
        const questionResultMap = new Map(
            questionResults.map((questionResult: any) => [questionResult.questionId.toString(), questionResult])
        );

        let manualQuestionCount = 0;
        let pendingManualQuestionCount = 0;

        const reviewQuestions = questions.map((question) => {
            const questionId = question._id.toString();
            const questionResult: any = questionResultMap.get(questionId);
            const attemptAnswer: any = attemptAnswerMap.get(questionId);
            const requiresManualScoring = question.type === 'essay';
            const manuallyScored = requiresManualScoring
                ? Boolean(questionResult?.gradedAt || questionResult?.gradedBy)
                : true;

            if (requiresManualScoring) {
                manualQuestionCount++;
                if (!manuallyScored) {
                    pendingManualQuestionCount++;
                }
            }

            return {
                questionId,
                order: question.order,
                type: question.type,
                questionText: question.questionText,
                options: question.options || null,
                metadata: question.metadata || null,
                maxPoints: question.mark,
                userAnswer: questionResult?.userAnswer ?? attemptAnswer?.selected ?? null,
                correctAnswer: requiresManualScoring ? null : (questionResult?.correctAnswer ?? question.answer),
                isCorrect: questionResult?.isCorrect,
                pointsAwarded: questionResult?.pointsAwarded ?? 0,
                feedback: questionResult?.feedback || '',
                gradedAt: questionResult?.gradedAt || null,
                gradedBy: questionResult?.gradedBy || null,
                requiresManualScoring,
                canEditScore: requiresManualScoring,
                isScored: manuallyScored,
            };
        });

        return {
            exam: {
                _id: exam._id,
                title: exam.title,
                description: exam.description,
                status: exam.status,
                cutOffMark: exam.cutOffMark,
                totalMark: exam.totalMark,
                gradingMode: exam.gradingMode,
            },
            student: result.userId,
            attempt: {
                _id: attempt._id,
                status: attempt.status,
                startedAt: attempt.startedAt,
                submittedAt: attempt.submittedAt,
                timeSpent: attempt.timeSpent,
                securityViolations: attempt.securityViolations?.length || 0,
            },
            result: {
                _id: result._id,
                status: result.status,
                gradingStatus: result.gradingStatus,
                gradingType: result.gradingType,
                totalScore: result.totalScore,
                maxScore: result.maxScore,
                percentage: result.percentage,
                released: result.released,
                overallFeedback: result.overallFeedback || '',
                gradedAt: result.gradedAt,
                gradedBy: result.gradedBy || null,
            },
            summary: {
                totalQuestions: questions.length,
                manualQuestionCount,
                pendingManualQuestionCount,
                canFinalize: manualQuestionCount > 0 && pendingManualQuestionCount === 0,
            },
            questions: reviewQuestions,
        };
    }

    async saveManualScores(
        examId: string,
        resultId: string,
        payload: {
            questionUpdates?: ManualScoreUpdate[];
            overallFeedback?: string;
            finalize?: boolean;
        },
        gradedBy: string
    ): Promise<ExamResultDocument> {
        const { exam, result, attempt, questions } = await this.getManualReviewContext(examId, resultId);
        const questionUpdates = payload?.questionUpdates || [];
        const finalize = Boolean(payload?.finalize);
        const graderObjectId = new Types.ObjectId(gradedBy);
        const now = new Date();

        const essayQuestions = questions.filter((question) => question.type === 'essay');
        if (essayQuestions.length === 0) {
            throw new BadRequestException('This result has no essay questions to score manually');
        }

        const essayQuestionIds = new Set(essayQuestions.map((question) => question._id.toString()));
        const updateMap = new Map<string, ManualScoreUpdate>();

        for (const update of questionUpdates) {
            if (!update?.questionId) {
                throw new BadRequestException('Each manual score update must include a questionId');
            }

            if (updateMap.has(update.questionId)) {
                throw new BadRequestException(`Duplicate manual score update for question ${update.questionId}`);
            }

            if (!essayQuestionIds.has(update.questionId)) {
                throw new BadRequestException(`Question ${update.questionId} is not eligible for manual scoring`);
            }

            const matchingQuestion = essayQuestions.find(
                (question) => question._id.toString() === update.questionId
            );
            if (!matchingQuestion) {
                throw new BadRequestException(`Question ${update.questionId} was not found`);
            }

            if (typeof update.pointsAwarded !== 'number' || Number.isNaN(update.pointsAwarded)) {
                throw new BadRequestException(`Question ${update.questionId} must include a numeric pointsAwarded value`);
            }

            if (update.pointsAwarded < 0 || update.pointsAwarded > matchingQuestion.mark) {
                throw new BadRequestException(
                    `Question ${update.questionId} score must be between 0 and ${matchingQuestion.mark}`
                );
            }

            updateMap.set(update.questionId, update);
        }

        const attemptAnswers = ((attempt.answers || []) as any[]);
        const questionResults = ((result.questionResults || []) as any[]);
        const attemptAnswerMap = new Map(
            attemptAnswers.map((answer: any) => [answer.questionId.toString(), answer])
        );
        const questionResultMap = new Map(
            questionResults.map((questionResult: any) => [questionResult.questionId.toString(), questionResult])
        );

        const updatedQuestionResults = questions.map((question) => {
            const questionId = question._id.toString();
            const existingResult: any = questionResultMap.get(questionId);
            const attemptAnswer: any = attemptAnswerMap.get(questionId);
            const nextQuestionResult: any = existingResult
                ? { ...existingResult }
                : {
                    questionId: question._id,
                    userAnswer: attemptAnswer?.selected ?? null,
                    correctAnswer: question.type === 'essay' ? 'Manual grading required' : question.answer,
                    pointsAwarded: 0,
                    maxPoints: question.mark,
                    isCorrect: question.type === 'essay' ? undefined : false,
                };

            nextQuestionResult.questionId = question._id;
            nextQuestionResult.userAnswer = nextQuestionResult.userAnswer ?? attemptAnswer?.selected ?? null;
            nextQuestionResult.maxPoints = question.mark;

            if (question.type !== 'essay') {
                return nextQuestionResult;
            }

            const update = updateMap.get(questionId);
            if (!update) {
                return nextQuestionResult;
            }

            nextQuestionResult.correctAnswer = 'Manual grading required';
            nextQuestionResult.isCorrect = undefined;
            nextQuestionResult.pointsAwarded = update.pointsAwarded;
            nextQuestionResult.feedback = update.feedback?.trim() || '';
            nextQuestionResult.gradedAt = now;
            nextQuestionResult.gradedBy = graderObjectId;

            return nextQuestionResult;
        });

        const allEssayQuestionsScored = essayQuestions.every((question) => {
            const questionResult = updatedQuestionResults.find(
                (candidate) => candidate.questionId.toString() === question._id.toString()
            );

            return Boolean(questionResult?.gradedAt || questionResult?.gradedBy);
        });

        if (finalize && !allEssayQuestionsScored) {
            throw new BadRequestException('All essay questions must be scored before finalizing this result');
        }

        const totalScore = updatedQuestionResults.reduce(
            (sum, questionResult) => sum + (questionResult.pointsAwarded || 0),
            0
        );
        const maxScore = questions.reduce((sum, question) => sum + (question.mark || 0), 0);
        const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
        const normalizedPercentage = Math.round(percentage * 100) / 100;
        const gradingStatus = finalize ? 'completed' : 'partial';
        const hasObjectiveQuestions = questions.some((question) => question.type !== 'essay');
        const gradingType = hasObjectiveQuestions ? 'partial' : 'manual';
        const status = gradingStatus === 'completed'
            ? (totalScore >= (exam.cutOffMark ?? 0) ? 'pass' : 'fail')
            : undefined;
        const correctAnswers = updatedQuestionResults.filter((questionResult) => questionResult.isCorrect).length;
        const questionsAttempted = attemptAnswers.filter((answer: any) => {
            if (Array.isArray(answer.selected)) {
                return answer.selected.length > 0;
            }

            return answer.selected !== undefined && answer.selected !== null && answer.selected !== '';
        }).length;

        const gradingHistoryEntry: any = {
            action: 'regraded',
            performedBy: graderObjectId,
            performedAt: now,
            method: 'manual',
            previousStatus: result.status,
            newStatus: status,
            previousScore: result.totalScore,
            newScore: totalScore,
            notes: finalize
                ? 'Manual essay scoring completed'
                : 'Manual essay scoring progress saved',
        };

        const updatedResult = await this.resultModel.findByIdAndUpdate(
            resultId,
            {
                $set: {
                    totalQuestions: questions.length,
                    questionsAttempted,
                    correctAnswers,
                    totalScore,
                    maxScore,
                    percentage: normalizedPercentage,
                    status,
                    gradingType,
                    gradingStatus,
                    questionResults: updatedQuestionResults,
                    overallFeedback: payload?.overallFeedback?.trim() || '',
                    gradedAt: now,
                    gradedBy: graderObjectId,
                    released: result.released ?? false,
                },
                $push: {
                    gradingHistory: gradingHistoryEntry,
                },
            },
            { new: true }
        );

        const nextAttemptStatus = finalize ? 'graded' : 'partially-graded';
        await this.attemptModel.findByIdAndUpdate(result.attemptId, {
            status: nextAttemptStatus,
        });

        await this.syncExamGradingStatus(examId);

        return updatedResult;
    }

    private gradeQuestion(question: QuestionDocument, userAnswer: any): QuestionResult {
        const maxPoints = question.mark || 1;
        let isCorrect = false;
        let pointsAwarded = 0;

        const hasAnswer = Boolean(userAnswer) && (
            Array.isArray(userAnswer?.selected)
                ? userAnswer.selected.length > 0
                : userAnswer?.selected !== undefined && userAnswer?.selected !== null && userAnswer?.selected !== ''
        );

        if (!hasAnswer) {
            return {
                questionId: question._id.toString(),
                userAnswer: null,
                correctAnswer: question.answer,
                isCorrect: false,
                pointsAwarded: 0,
                maxPoints,
                explanation: question.metadata?.learningObjective || ''
            };
        }

        switch (question.type) {
            case 'mcq':
                isCorrect = this.gradeMCQ(question, userAnswer);
                break;

            case 'multi':
                isCorrect = this.gradeMultipleSelect(question, userAnswer);
                break;

            case 'essay':
                return {
                    questionId: question._id.toString(),
                    userAnswer: userAnswer.text || userAnswer.selected,
                    correctAnswer: 'Manual grading required',
                    pointsAwarded: 0,
                    maxPoints,
                    explanation: 'This question requires manual grading',
                    requiresManualGrading: true
                };

            default:
                this.logger.warn(`Unknown question type: ${question.type}`);
                break;
        }

        pointsAwarded = isCorrect ? maxPoints : 0;

        return {
            questionId: question._id.toString(),
            userAnswer: userAnswer.selected || userAnswer.text,
            correctAnswer: question.answer,
            isCorrect,
            pointsAwarded,
            maxPoints,
            explanation: question.metadata?.learningObjective || ''
        };
    }

    private async syncExamGradingStatus(examId: string): Promise<void> {
        const exam = await this.examModel.findById(examId).lean();

        if (!exam || !['completed', 'graded'].includes(exam.status)) {
            return;
        }

        const completedAttempts = await this.attemptModel
            .find({
                examId: new Types.ObjectId(examId),
                status: { $in: ['submitted', 'auto-submitted', 'partially-graded', 'graded'] },
                isValid: true,
            })
            .lean();

        const nextExamStatus = completedAttempts.length > 0 && completedAttempts.every((attempt) => attempt.status === 'graded')
            ? 'graded'
            : 'completed';

        if (exam.status !== nextExamStatus) {
            await this.examModel.findByIdAndUpdate(examId, { status: nextExamStatus });
            this.logger.log(`Updated exam ${examId} status from ${exam.status} to ${nextExamStatus} based on grading progress`);
        }
    }

    private async getManualReviewContext(examId: string, resultId: string): Promise<any> {
        const exam = await this.examModel.findById(examId).lean();
        if (!exam) {
            throw new NotFoundException('Exam not found');
        }

        const result = await this.resultModel
            .findById(resultId)
            .populate('userId', 'firstName lastName email')
            .lean();

        if (!result) {
            throw new NotFoundException('Exam result not found');
        }

        if (result.examId.toString() !== examId) {
            throw new BadRequestException('Result does not belong to the specified exam');
        }

        const attempt = await this.attemptModel.findById(result.attemptId).lean();
        if (!attempt) {
            throw new NotFoundException('Exam attempt not found for this result');
        }

        const questions = await this.questionModel
            .find({ examId: new Types.ObjectId(examId) })
            .sort({ order: 1, createdAt: 1 })
            .lean();

        if (!questions.length) {
            throw new NotFoundException('No questions found for this exam');
        }

        return {
            exam,
            result,
            attempt,
            questions,
        };
    }

    private gradeMCQ(question: QuestionDocument, userAnswer: any): boolean {
        const correctOption = question.answer;
        const userSelection = userAnswer.selected;
        return correctOption === userSelection;
    }

    private gradeMultipleSelect(question: QuestionDocument, userAnswer: any): boolean {
        const correctAnswers = question.answer as string[];
        const userSelections = userAnswer.selected as string[];

        if (!Array.isArray(correctAnswers) || !Array.isArray(userSelections)) {
            return false;
        }

        // Check if arrays have same length and same elements
        if (correctAnswers.length !== userSelections.length) {
            return false;
        }

        const sortedCorrect = [...correctAnswers].sort();
        const sortedUser = [...userSelections].sort();

        return sortedCorrect.every((answer, index) => answer === sortedUser[index]);
    }

    async batchGradeExams(examId: string): Promise<void> {
        try {
            this.logger.log(`Starting batch grading for exam: ${examId}`);

            const attempts = await this.attemptModel
                .find({
                    examId: new Types.ObjectId(examId),
                    status: { $in: ['submitted', 'auto-submitted'] }
                })
                .lean();

            this.logger.log(`Found ${attempts.length} submitted attempts to grade`);

            // Grade each attempt
            const gradingPromises = attempts.map(attempt =>
                this.gradeExam(attempt._id.toString())
            );

            await Promise.all(gradingPromises);

            this.logger.log(`Batch grading completed for exam ${examId}`);

        } catch (error) {
            this.logger.error(`Error in batch grading for exam ${examId}:`, error.message);
            throw error;
        }
    }

    async calculateExamStatistics(examId: string): Promise<any> {
        try {
            const results = await this.resultModel
                .find({ examId: new Types.ObjectId(examId), gradingStatus: 'completed' })
                .lean();

            if (!results.length) {
                return {
                    totalAttempts: 0,
                    averageScore: 0,
                    passRate: 0,
                    highestScore: 0,
                    lowestScore: 0,
                    scoreDistribution: []
                };
            }

            const scores = results.map(r => r.percentage);
            const passCount = results.filter(r => r.status === 'pass').length;

            const statistics = {
                totalAttempts: results.length,
                averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
                passRate: (passCount / results.length) * 100,
                highestScore: Math.max(...scores),
                lowestScore: Math.min(...scores),
                scoreDistribution: this.calculateScoreDistribution(scores)
            };

            return statistics;

        } catch (error) {
            this.logger.error(`Error calculating statistics for exam ${examId}:`, error.message);
            throw error;
        }
    }

    private calculateScoreDistribution(scores: number[]): any[] {
        const ranges = [
            { label: '90-100%', min: 90, max: 100, count: 0 },
            { label: '80-89%', min: 80, max: 89, count: 0 },
            { label: '70-79%', min: 70, max: 79, count: 0 },
            { label: '60-69%', min: 60, max: 69, count: 0 },
            { label: '50-59%', min: 50, max: 59, count: 0 },
            { label: '0-49%', min: 0, max: 49, count: 0 }
        ];

        scores.forEach(score => {
            const range = ranges.find(r => score >= r.min && score <= r.max);
            if (range) {
                range.count++;
            }
        });

        return ranges;
    }

    async releaseResults(examId: string, releaseAll: boolean = true): Promise<void> {
        try {
            const exam = await this.examModel.findById(examId).lean();
            if (!exam) {
                throw new Error(`Exam not found: ${examId}`);
            }

            if (exam.status !== 'graded') {
                throw new Error('Only graded exams can have results released');
            }

            const filter: any = { examId: new Types.ObjectId(examId), gradingStatus: 'completed' };

            if (!releaseAll) {
                filter.gradingType = 'auto'; // Only release auto-graded results
            }

            // Get all results that will be released with user and exam details
            const results = await this.resultModel
                .find(filter)
                .populate('userId', 'firstName lastName email')
                .populate('examId', 'title')
                .lean();

            if (results.length === 0) {
                this.logger.log(`No results found to release for exam ${examId}`);
                return;
            }

            // Update the released status
            await this.resultModel.updateMany(filter, { released: true });

            this.logger.log(`Results released for exam ${examId}. Sending emails to ${results.length} students.`);

            // Send notification emails to students
            const emailPromises = results.map(async (result) => {
                try {
                    await this.sendResultReleaseEmail(result as any);
                } catch (emailError) {
                    this.logger.error(`Failed to send exam result email for result ${result._id}:`, emailError.message);
                    // Don't throw here - we want to continue sending other emails
                }
            });

            // Execute all email sends
            await Promise.allSettled(emailPromises);

            this.logger.log(`Email notifications completed for exam ${examId}`);

        } catch (error) {
            this.logger.error(`Error releasing results for exam ${examId}:`, error.message);
            throw error;
        }
    }

    async releaseSingleResult(examId: string, resultId: string, releasedBy?: string): Promise<ExamResultDocument> {
        try {
            const result = await this.resultModel
                .findOne({ _id: new Types.ObjectId(resultId), examId: new Types.ObjectId(examId) })
                .populate('userId', 'firstName lastName email')
                .populate('examId', 'title')
                .lean();

            if (!result) {
                throw new NotFoundException(`Result not found for exam ${examId}`);
            }

            if (result.gradingStatus !== 'completed') {
                throw new BadRequestException('Only fully completed results can be released');
            }

            if (result.released) {
                return await this.resultModel.findById(resultId);
            }

            const performerId = releasedBy ? new Types.ObjectId(releasedBy) : undefined;
            const updatedResult = await this.resultModel.findByIdAndUpdate(
                resultId,
                {
                    $set: { released: true },
                    $push: {
                        gradingHistory: {
                            action: 'released',
                            performedBy: performerId,
                            performedAt: new Date(),
                            method: 'manual',
                            previousStatus: result.status,
                            newStatus: result.status,
                            previousScore: result.totalScore,
                            newScore: result.totalScore,
                            notes: 'Result released to student',
                        },
                    },
                },
                { new: true }
            );

            await this.sendResultReleaseEmail(result as any);

            this.logger.log(`Released single result ${resultId} for exam ${examId}`);
            return updatedResult;
        } catch (error) {
            this.logger.error(`Error releasing result ${resultId} for exam ${examId}:`, error.message);
            throw error;
        }
    }

    async retractResults(examId: string): Promise<void> {
        try {
            await this.resultModel.updateMany(
                { examId: new Types.ObjectId(examId) },
                { released: false }
            );

            this.logger.log(`Results retracted for exam ${examId}`);

        } catch (error) {
            this.logger.error(`Error retracting results for exam ${examId}:`, error.message);
            throw error;
        }
    }

    async retractSingleResult(examId: string, resultId: string, retractedBy?: string): Promise<ExamResultDocument> {
        try {
            const result = await this.resultModel
                .findOne({ _id: new Types.ObjectId(resultId), examId: new Types.ObjectId(examId) })
                .lean();

            if (!result) {
                throw new NotFoundException(`Result not found for exam ${examId}`);
            }

            if (!result.released) {
                return await this.resultModel.findById(resultId);
            }

            const performerId = retractedBy ? new Types.ObjectId(retractedBy) : undefined;
            const updatedResult = await this.resultModel.findByIdAndUpdate(
                resultId,
                {
                    $set: { released: false },
                    $push: {
                        gradingHistory: {
                            action: 'retracted',
                            performedBy: performerId,
                            performedAt: new Date(),
                            method: 'manual',
                            previousStatus: result.status,
                            newStatus: result.status,
                            previousScore: result.totalScore,
                            newScore: result.totalScore,
                            notes: 'Result retracted from student',
                        },
                    },
                },
                { new: true }
            );

            this.logger.log(`Retracted single result ${resultId} for exam ${examId}`);
            return updatedResult;
        } catch (error) {
            this.logger.error(`Error retracting result ${resultId} for exam ${examId}:`, error.message);
            throw error;
        }
    }

    private async sendResultReleaseEmail(result: any): Promise<void> {
        const user = result.userId as any;
        const exam = result.examId as any;

        if (!user || !user.email) {
            this.logger.warn(`No email found for user in result ${result._id}`);
            return;
        }

        await this.emailService.sendExamResultEmail(
            user.email,
            user.firstName || 'Student',
            exam?.title || 'Unknown Exam',
            result.totalScore ?? result.correctAnswers ?? 0,
            result.maxScore ?? result.totalQuestions ?? 0,
            result.percentage || 0,
            result.status || 'unknown',
            result.gradedAt || new Date()
        );

        this.logger.log(`Exam result email sent to ${user.email} for exam: ${exam?.title}`);
    }
}
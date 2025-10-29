import { Injectable, Logger } from '@nestjs/common';
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
    isCorrect: boolean;
    marksAwarded: number;
    maxMarks: number;
    explanation?: string;
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

            // Get attempt with exam details
            const attempt = await this.attemptModel
                .findById(attemptId)
                .lean();

            if (!attempt) {
                throw new Error('Attempt not found');
            }

            this.logger.debug(`Found attempt for user ${attempt.userId}, exam ${attempt.examId}`);

            // Get all questions for the exam - examId in attempt is already an ObjectId
            const questions = await this.questionModel
                .find({ examId: attempt.examId })
                .lean();

            if (!questions.length) {
                this.logger.error(`No questions found for exam ${attempt.examId}`);
                throw new Error(`No questions found for exam ${attempt.examId}`);
            }

            this.logger.log(`Found ${questions.length} questions for exam ${attempt.examId}`);

            // Process each question and calculate scores
            const questionResults: QuestionResult[] = [];
            let correctAnswers = 0;
            let totalScore = 0;
            let maxScore = 0;

            for (const question of questions) {
                const userAnswer = attempt.answers.find(a =>
                    a.questionId.toString() === question._id.toString()
                );

                const result = this.gradeQuestion(question as unknown as QuestionDocument, userAnswer);

                questionResults.push(result);

                if (result.isCorrect) {
                    correctAnswers++;
                }

                totalScore += result.marksAwarded;
                maxScore += result.maxMarks;
            }

            // Update the total questions count to match what was actually processed
            const totalQuestions = questions.length;

            // Calculate percentage and determine pass/fail
            const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
            const exam = attempt.examId as any;

            // Use the exam's cutOffMark to determine pass/fail
            // cutOffMark is absolute score, passingPercentage might be percentage
            let passingThreshold = 50; // Default fallback

            if (exam.cutOffMark && exam.totalMark) {
                // If cutOffMark is set, calculate percentage from it
                passingThreshold = (exam.cutOffMark / exam.totalMark) * 100;
            } else if (exam.passingPercentage) {
                // Use passingPercentage if available
                passingThreshold = exam.passingPercentage;
            }

            const status = percentage >= passingThreshold ? 'pass' : 'fail';

            this.logger.debug(`Score calculation: ${totalScore}/${maxScore} = ${percentage}%. Passing threshold: ${passingThreshold}%. Status: ${status}`);

            // Update or create result document
            const resultData = {
                examId: attempt.examId,
                userId: attempt.userId,
                attemptId: attempt._id,
                totalQuestions,
                questionsAttempted: attempt.answers.filter(a => a.selected).length,
                correctAnswers,
                totalScore,
                maxScore,
                percentage: Math.round(percentage * 100) / 100,
                status,
                gradingType: 'auto',
                questionResults,
                gradedAt: new Date(),
                released: true // Auto-release for objective questions
            };

            const existingResult = await this.resultModel.findOne({
                attemptId: new Types.ObjectId(attemptId)
            });

            let result: ExamResultDocument;
            const gradingHistoryEntry = {
                action: existingResult ? 'regraded' : 'graded',
                performedBy: gradedBy ? new Types.ObjectId(gradedBy) : null,
                performedAt: new Date(),
                method: 'auto',
                previousStatus: existingResult?.status,
                newStatus: status,
                previousScore: existingResult?.totalScore,
                newScore: totalScore,
                notes: existingResult ? 'Automatic regrading via regrade-all action' : 'Initial automatic grading'
            };

            if (existingResult) {
                // Update existing result and add to history
                const updateData = {
                    ...resultData,
                    $push: { gradingHistory: gradingHistoryEntry }
                };

                result = await this.resultModel.findByIdAndUpdate(
                    existingResult._id,
                    updateData,
                    { new: true }
                );

                this.logger.log(`Regraded existing result for attempt ${attemptId}. Previous: ${existingResult.totalScore}/${existingResult.maxScore} (${existingResult.percentage}%) -> New: ${totalScore}/${maxScore} (${percentage}%)`);
            } else {
                // Create new result with initial history entry
                const newResultData = {
                    ...resultData,
                    gradingHistory: [gradingHistoryEntry]
                };

                result = new this.resultModel(newResultData);
                await result.save();

                this.logger.log(`Created new result for attempt ${attemptId}. Score: ${totalScore}/${maxScore} (${percentage}%)`);
            }

            return result;

        } catch (error) {
            this.logger.error(`Error grading exam for attempt ${attemptId}:`, error.message);
            throw error;
        }
    }

    private gradeQuestion(question: QuestionDocument, userAnswer: any): QuestionResult {
        const maxMarks = question.mark || 1;
        let isCorrect = false;
        let marksAwarded = 0;

        if (!userAnswer || !userAnswer.selected) {
            // No answer provided
            return {
                questionId: question._id.toString(),
                userAnswer: null,
                correctAnswer: question.answer,
                isCorrect: false,
                marksAwarded: 0,
                maxMarks,
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
                // Essays require manual grading
                marksAwarded = 0;
                return {
                    questionId: question._id.toString(),
                    userAnswer: userAnswer.text || userAnswer.selected,
                    correctAnswer: 'Manual grading required',
                    isCorrect: false,
                    marksAwarded: 0,
                    maxMarks,
                    explanation: 'This question requires manual grading'
                };

            default:
                this.logger.warn(`Unknown question type: ${question.type}`);
                break;
        }

        marksAwarded = isCorrect ? maxMarks : 0;

        return {
            questionId: question._id.toString(),
            userAnswer: userAnswer.selected || userAnswer.text,
            correctAnswer: question.answer,
            isCorrect,
            marksAwarded,
            maxMarks,
            explanation: question.metadata?.learningObjective || ''
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

            // Get all submitted attempts for the exam
            const attempts = await this.attemptModel
                .find({
                    examId: new Types.ObjectId(examId),
                    status: 'submitted'
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
                .find({ examId: new Types.ObjectId(examId) })
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
            const filter: any = { examId: new Types.ObjectId(examId) };

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
                        result.correctAnswers || 0,
                        result.totalQuestions || 0,
                        result.percentage || 0,
                        result.status || 'unknown',
                        result.gradedAt || new Date()
                    );

                    this.logger.log(`Exam result email sent to ${user.email} for exam: ${exam?.title}`);
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
}
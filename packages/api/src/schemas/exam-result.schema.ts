import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type ExamResultDocument = ExamResult & Document;

@Schema({
    timestamps: true,
    collection: 'examResults'
})
export class ExamResult {
    @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
    examId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ExamAttempt', required: true })
    attemptId: Types.ObjectId;

    @Prop({ required: true, min: 0 })
    totalQuestions: number;

    @Prop({ required: true, min: 0 })
    questionsAttempted: number;

    @Prop({ min: 0, default: 0 })
    correctAnswers: number; // For auto-graded questions

    @Prop({ min: 0, default: 0 })
    partialCorrectAnswers: number; // For multi-select questions

    @Prop({ required: true, min: 0 })
    totalScore: number;

    @Prop({ required: true, min: 0 })
    maxScore: number;

    @Prop({ min: 0, max: 100 })
    percentage: number;

    @Prop({ enum: ['pass', 'fail'] })
    status?: 'pass' | 'fail';

    @Prop({ enum: ['auto', 'manual', 'partial'], required: true })
    gradingType: 'auto' | 'manual' | 'partial'; // partial = mix of auto and manual

    @Prop({ enum: ['partial', 'completed'], required: true })
    gradingStatus: 'partial' | 'completed';

    @Prop({
        type: [{
            questionId: { type: Types.ObjectId, ref: 'Question' },
            userAnswer: MongooseSchema.Types.Mixed,
            correctAnswer: MongooseSchema.Types.Mixed,
            isCorrect: Boolean,
            pointsAwarded: { type: Number, min: 0 },
            maxPoints: { type: Number, min: 0 },
            gradedBy: { type: Types.ObjectId, ref: 'User' },
            gradedAt: Date,
            feedback: { type: String, maxlength: 1000 }
        }]
    })
    questionResults: Array<{
        questionId: Types.ObjectId;
        userAnswer?: string;
        correctAnswer?: string;
        isCorrect?: boolean;
        pointsAwarded: number;
        maxPoints: number;
        gradedBy?: Types.ObjectId;
        gradedAt?: Date;
        feedback?: string;
    }>;

    @Prop({ default: false })
    released: boolean; // Whether results are released to student

    @Prop({ default: Date.now })
    gradedAt: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    gradedBy: Types.ObjectId; // For manual grading

    @Prop({ maxlength: 2000 })
    overallFeedback: string;

    @Prop({
        type: MongooseSchema.Types.Mixed
    })
    statistics: {
        rank?: number;
        totalParticipants?: number;
        percentile?: number;
    };

    @Prop({ default: true })
    isValid: boolean;

    @Prop({
        type: [{
            action: { type: String, enum: ['graded', 'regraded', 'released', 'retracted'], required: true },
            performedBy: { type: Types.ObjectId, ref: 'User' },
            performedAt: { type: Date, default: Date.now },
            method: { type: String, enum: ['auto', 'manual'], required: true },
            previousStatus: { type: String, enum: ['pass', 'fail'] },
            newStatus: { type: String, enum: ['pass', 'fail'] },
            previousScore: Number,
            newScore: Number,
            notes: { type: String, maxlength: 500 }
        }],
        default: []
    })
    gradingHistory: Array<{
        action: 'graded' | 'regraded' | 'released' | 'retracted';
        performedBy?: Types.ObjectId;
        performedAt: Date;
        method: 'auto' | 'manual';
        previousStatus?: 'pass' | 'fail';
        newStatus?: 'pass' | 'fail';
        previousScore?: number;
        newScore?: number;
        notes?: string;
    }>;
}

export const ExamResultSchema = SchemaFactory.createForClass(ExamResult);

// Indexes for performance
ExamResultSchema.index({ examId: 1, userId: 1 }, { unique: true });
ExamResultSchema.index({ userId: 1, gradedAt: -1 });
ExamResultSchema.index({ examId: 1, status: 1 });
ExamResultSchema.index({ examId: 1, totalScore: -1 }); // For ranking
ExamResultSchema.index({ attemptId: 1 }); // For finding results by attempt

// Pre-save middleware to calculate percentage and status
ExamResultSchema.pre('save', function (next) {
    // Calculate percentage
    if (this.maxScore > 0) {
        this.percentage = Math.round((this.totalScore / this.maxScore) * 100);
    }

    // Determine pass/fail status based on exam's cut-off mark
    // Note: This should be populated from the exam's cutOffMark
    // For now, we'll use a simple 50% pass mark
    // this.status = this.percentage >= 50 ? 'pass' : 'fail';

    next();
});
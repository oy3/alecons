import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type ExamAttemptDocument = ExamAttempt & Document;

@Schema({
    timestamps: true,
    collection: 'examAttempts'
})
export class ExamAttempt {
    @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
    examId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ExamPassword' })
    passwordUsed: Types.ObjectId;

    @Prop({
        type: [{
            questionId: { type: Types.ObjectId, ref: 'Question' },
            selected: { type: MongooseSchema.Types.Mixed }, // String for MCQ, Array for multi, String for essay
            answeredAt: { type: Date, default: Date.now }
        }],
        default: []
    })
    answers: Array<{
        questionId: Types.ObjectId;
        selected: string | string[];
        answeredAt: Date;
    }>;

    @Prop({ required: true })
    startedAt: Date;

    @Prop()
    submittedAt: Date;

    @Prop({ enum: ['in-progress', 'submitted', 'auto-submitted', 'partially-graded', 'graded'], default: 'in-progress' })
    status: 'in-progress' | 'submitted' | 'auto-submitted' | 'partially-graded' | 'graded';

    @Prop({ default: Date.now })
    autoSavedAt: Date;

    @Prop({ default: Date.now })
    lastHeartbeat: Date;

    @Prop({
        type: MongooseSchema.Types.Mixed
    })
    clientMeta: {
        ip?: string;
        userAgent?: string;
        screenResolution?: string;
        timezone?: string;
    };

    @Prop({
        type: [{
            type: { type: String, enum: ['tab_switch', 'window_blur', 'right_click', 'key_combination', 'fullscreen_exit', 'copy_attempt'] },
            timestamp: Date,
            details: MongooseSchema.Types.Mixed
        }],
        default: []
    })
    securityViolations: Array<{
        type: 'tab_switch' | 'window_blur' | 'right_click' | 'key_combination' | 'fullscreen_exit' | 'copy_attempt';
        timestamp: Date;
        details?: any;
    }>;

    @Prop({ default: 0 })
    tabSwitchCount: number;

    @Prop({ default: 0 })
    blurCount: number;

    @Prop({ default: 0 })
    rightClickCount: number;

    @Prop() // Will be calculated when graded
    timeSpent: number; // in seconds

    @Prop({ default: true })
    isValid: boolean; // Can be set to false if cheating is detected
}

export const ExamAttemptSchema = SchemaFactory.createForClass(ExamAttempt);

// Indexes for performance
ExamAttemptSchema.index({ examId: 1, userId: 1 });
ExamAttemptSchema.index({ userId: 1, status: 1 });
ExamAttemptSchema.index({ examId: 1, status: 1 });
ExamAttemptSchema.index({ examId: 1, userId: 1, createdAt: -1 });

// Pre-save middleware to calculate time spent
ExamAttemptSchema.pre('save', function (next) {
    if (this.submittedAt && this.startedAt) {
        this.timeSpent = Math.floor((this.submittedAt.getTime() - this.startedAt.getTime()) / 1000);
    }
    next();
});
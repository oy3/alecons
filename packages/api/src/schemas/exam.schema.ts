import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type ExamDocument = Exam & Document;

@Schema({
    timestamps: true,
    collection: 'exams'
})
export class Exam {
    @Prop({ required: true, trim: true, maxlength: 200 })
    title: string;

    @Prop({ required: true, trim: true, maxlength: 1000 })
    description: string;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true })
    academicSession: Types.ObjectId;

    @Prop({
        type: MongooseSchema.Types.Mixed,
        required: true
    })
    target: {
        type: 'applicants' | 'students' | 'staff' | 'custom';
        filter: {
            programId?: Types.ObjectId;
            year?: number;
            semester?: string;
            departmentId?: Types.ObjectId;
            roles?: string[];
            tags?: string[];
        };
    };

    @Prop({ required: true })
    examTimestamp: Date;

    @Prop({ required: true, min: 5, max: 480 }) // 5 minutes to 8 hours
    duration: number; // in minutes

    @Prop({ required: true, min: 1, max: 500 })
    totalQuestions: number;

    @Prop({ required: true, min: 1, max: 10 })
    attemptLimit: number;

    @Prop({ required: true, min: 1 })
    totalMark: number;

    @Prop({ required: true, min: 0 })
    cutOffMark: number;

    @Prop({ default: false })
    randomizeQuestions: boolean;

    @Prop({ default: false })
    randomizeOptions: boolean;

    @Prop({ enum: ['auto', 'manual'], default: 'auto' })
    gradingMode: 'auto' | 'manual';

    @Prop({
        enum: ['draft', 'scheduled', 'in-progress', 'completed', 'graded'],
        default: 'draft'
    })
    status: 'draft' | 'scheduled' | 'in-progress' | 'completed' | 'graded';

    @Prop({ default: true })
    allowResume: boolean;

    @Prop({ default: false })
    proctored: boolean;

    @Prop({
        type: MongooseSchema.Types.Mixed,
        default: {
            disableRightClick: true,
            disableCopy: true,
            fullScreenRequired: true,
            tabSwitchLimit: 3,
            blurLimit: 5
        }
    })
    securitySettings: {
        disableRightClick: boolean;
        disableCopy: boolean;
        fullScreenRequired: boolean;
        tabSwitchLimit: number;
        blurLimit: number;
    };

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    createdBy: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    updatedBy: Types.ObjectId;

    @Prop({ default: true })
    isActive: boolean;

    // Virtual field for question count
    questionCount?: number;

    // Virtual field for attempt count
    attemptCount?: number;
}

export const ExamSchema = SchemaFactory.createForClass(Exam);

// Indexes for performance
ExamSchema.index({ status: 1, examTimestamp: 1 });
ExamSchema.index({ 'target.type': 1, 'target.filter.programId': 1 });
ExamSchema.index({ academicSession: 1, status: 1 });
ExamSchema.index({ createdBy: 1, status: 1 });

// Virtual populate for questions count
ExamSchema.virtual('questionCount', {
    ref: 'Question',
    localField: '_id',
    foreignField: 'examId',
    count: true
});

// Virtual populate for attempts count
ExamSchema.virtual('attemptCount', {
    ref: 'ExamAttempt',
    localField: '_id',
    foreignField: 'examId',
    count: true
});

// Ensure virtuals are serialized
ExamSchema.set('toJSON', { virtuals: true });
ExamSchema.set('toObject', { virtuals: true });
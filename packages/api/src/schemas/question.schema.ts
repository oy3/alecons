import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type QuestionDocument = Question & Document;

@Schema({
    timestamps: true,
    collection: 'questions'
})
export class Question {
    @Prop({ type: Types.ObjectId, ref: 'Exam', required: true })
    examId: Types.ObjectId;

    @Prop({ required: true, trim: true, maxlength: 5000 })
    questionText: string;

    @Prop({ enum: ['mcq', 'multi', 'essay'], required: true })
    type: 'mcq' | 'multi' | 'essay';

    @Prop({
        type: MongooseSchema.Types.Mixed
    })
    options: {
        a?: string;
        b?: string;
        c?: string;
        d?: string;
        e?: string;
    };

    @Prop({ type: MongooseSchema.Types.Mixed })
    answer: string | string[]; // For MCQ: 'a', 'b', etc. For multi: ['a', 'c']

    @Prop({ required: true, min: 1, max: 100 })
    mark: number;

    @Prop({ type: [String], default: [] })
    mediaUrls: string[];

    @Prop({ type: [String], default: [] })
    tags: string[];

    @Prop({ min: 1, default: 1 })
    order: number;

    @Prop({ enum: ['active', 'inactive'], default: 'active' })
    status: 'active' | 'inactive';

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    createdBy: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    updatedBy: Types.ObjectId;

    @Prop({
        type: MongooseSchema.Types.Mixed
    })
    metadata: {
        difficulty?: 'easy' | 'medium' | 'hard';
        subject?: string;
        topic?: string;
        learningObjective?: string;
    };
}

export const QuestionSchema = SchemaFactory.createForClass(Question);

// Indexes for performance
QuestionSchema.index({ examId: 1, order: 1 });
QuestionSchema.index({ examId: 1, status: 1 });
QuestionSchema.index({ type: 1, 'metadata.difficulty': 1 });
QuestionSchema.index({ tags: 1 });

// Pre-save validation middleware
QuestionSchema.pre('save', function () {
    // Validate that MCQ and multi-select questions have options
    if ((this.type === 'mcq' || this.type === 'multi') && !this.options) {
        throw new Error('MCQ and multi-select questions must have options');
    }

    // Validate that MCQ and multi-select questions have answers
    if ((this.type === 'mcq' || this.type === 'multi') && !this.answer) {
        throw new Error('MCQ and multi-select questions must have an answer');
    }
});

// Pre-save middleware to ensure answer field is never sent to client
QuestionSchema.methods.toClientJSON = function () {
    const obj = this.toJSON();
    delete obj.answer; // Remove answer for security
    return obj;
};

// Add database indexes for performance
QuestionSchema.index({ examId: 1 }); // Index for finding questions by exam
QuestionSchema.index({ examId: 1, createdAt: 1 }); // Compound index for sorting
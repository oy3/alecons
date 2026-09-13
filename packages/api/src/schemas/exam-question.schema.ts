import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type ExamQuestionDocument = ExamQuestion & Document;

@Schema({ timestamps: true, collection: 'examQuestions' })
export class ExamQuestion {
    @Prop({ type: Types.ObjectId, ref: 'Exam', required: true, index: true })
    examId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'QuestionBankItem', index: true })
    questionBankItemId?: Types.ObjectId;

    @Prop({ min: 1 })
    bankVersion?: number;

    @Prop({ required: true, trim: true, maxlength: 100000 })
    questionText: string;

    @Prop({ enum: ['mcq', 'multi', 'essay'], required: true })
    type: 'mcq' | 'multi' | 'essay';

    @Prop({ type: MongooseSchema.Types.Mixed })
    options?: Record<string, string>;

    @Prop({ type: MongooseSchema.Types.Mixed })
    answer?: string | string[];

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
    updatedBy?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    copiedBy?: Types.ObjectId;

    @Prop()
    copiedAt?: Date;

    @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
    metadata: {
        difficulty?: 'easy' | 'medium' | 'hard';
        subject?: string;
        topic?: string;
        learningObjective?: string;
        contentMetadata?: unknown;
    };
}

export const ExamQuestionSchema = SchemaFactory.createForClass(ExamQuestion);
ExamQuestionSchema.index({ examId: 1, order: 1 });
ExamQuestionSchema.index({ examId: 1, status: 1 });
ExamQuestionSchema.methods.toClientJSON = function () {
    const obj = this.toJSON();
    delete obj.answer;
    return obj;
};
ExamQuestionSchema.pre('save', function () {
    if ((this.type === 'mcq' || this.type === 'multi') && !this.options) {
        throw new Error('MCQ and multi-select questions must have options');
    }
    if ((this.type === 'mcq' || this.type === 'multi') && !this.answer) {
        throw new Error('MCQ and multi-select questions must have an answer');
    }
});

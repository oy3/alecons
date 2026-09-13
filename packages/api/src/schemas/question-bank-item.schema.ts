import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type QuestionBankItemDocument = QuestionBankItem & Document;

@Schema({ timestamps: true, collection: 'questionBankItems' })
export class QuestionBankItem {
    @Prop({ required: true, trim: true, maxlength: 100000 })
    questionText: string;

    @Prop({ enum: ['mcq', 'multi', 'essay'], required: true, index: true })
    type: 'mcq' | 'multi' | 'essay';

    @Prop({ type: MongooseSchema.Types.Mixed })
    options?: Record<string, string>;

    @Prop({ type: MongooseSchema.Types.Mixed })
    answer?: string | string[];

    @Prop({ required: true, min: 1, max: 100, default: 1 })
    defaultMark: number;

    @Prop({ type: [String], default: [] })
    mediaUrls: string[];

    @Prop({ type: [String], default: [] })
    tags: string[];

    @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
    metadata: {
        difficulty?: 'easy' | 'medium' | 'hard';
        subject?: string;
        topic?: string;
        learningObjective?: string;
        contentMetadata?: unknown;
    };

    @Prop({ required: true, unique: true, index: true })
    fingerprint: string;

    @Prop({ min: 1, default: 1 })
    version: number;

    @Prop({ enum: ['active', 'archived'], default: 'active', index: true })
    status: 'active' | 'archived';

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    createdBy: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    updatedBy?: Types.ObjectId;

    @Prop({ type: [Types.ObjectId], default: [] })
    legacyQuestionIds: Types.ObjectId[];

    @Prop({ min: 0, default: 0 })
    usageCount: number;

    @Prop()
    lastUsedAt?: Date;
}

export const QuestionBankItemSchema = SchemaFactory.createForClass(QuestionBankItem);
QuestionBankItemSchema.index({ status: 1, type: 1, 'metadata.subject': 1, 'metadata.topic': 1 });
QuestionBankItemSchema.index({ usageCount: -1, lastUsedAt: -1 });
QuestionBankItemSchema.index({ tags: 1 });
QuestionBankItemSchema.index({ questionText: 'text', tags: 'text', 'metadata.subject': 'text', 'metadata.topic': 'text' });

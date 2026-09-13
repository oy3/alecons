import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type QuestionBankActivityDocument = QuestionBankActivity & Document;

@Schema({ timestamps: true, collection: 'questionBankActivities' })
export class QuestionBankActivity {
    @Prop({ type: Types.ObjectId, ref: 'QuestionBankItem' })
    questionBankItemId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Exam' })
    examId?: Types.ObjectId;

    @Prop({ required: true, enum: ['created', 'updated', 'archived', 'restored', 'imported', 'reused', 'duplicates_merged', 'migrated'] })
    action: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    actorUserId?: Types.ObjectId;

    @Prop({ min: 1, default: 1 })
    affectedCount: number;

    @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
    metadata: Record<string, unknown>;
}

export const QuestionBankActivitySchema = SchemaFactory.createForClass(QuestionBankActivity);
QuestionBankActivitySchema.index({ createdAt: -1 });
QuestionBankActivitySchema.index({ questionBankItemId: 1, createdAt: -1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ReportSnapshotDocument = ReportSnapshot & Document;

@Schema({ timestamps: true })
export class ReportSnapshot {
  @Prop({ required: true, unique: true, index: true })
  cacheKey: string;

  @Prop({ required: true, index: true })
  reportType: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload: Record<string, unknown>;

  @Prop({ required: true, index: true })
  generatedAt: Date;

  @Prop({ required: true, index: { expires: 0 } })
  expiresAt: Date;
}

export const ReportSnapshotSchema = SchemaFactory.createForClass(ReportSnapshot);


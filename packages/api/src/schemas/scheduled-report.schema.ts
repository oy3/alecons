import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ScheduledReportDocument = ScheduledReport & Document;

@Schema({ timestamps: true, optimisticConcurrency: true })
export class ScheduledReport {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ required: true, trim: true, index: true })
  reportType: string;

  @Prop({ required: true, enum: ['csv', 'xlsx', 'pdf'], default: 'csv' })
  format: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  filters: Record<string, unknown>;

  @Prop({ required: true, enum: ['daily', 'weekly', 'monthly'] })
  frequency: string;

  @Prop({ min: 0, max: 6 })
  dayOfWeek?: number;

  @Prop({ min: 1, max: 28 })
  dayOfMonth?: number;

  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  time: string;

  @Prop({ required: true, default: 'Africa/Lagos', enum: ['Africa/Lagos'] })
  timezone: string;

  @Prop({ type: [String], required: true, validate: [(value: string[]) => value.length > 0, 'At least one recipient is required'] })
  recipients: string[];

  @Prop({ default: true, index: true })
  active: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  updatedBy: Types.ObjectId;

  @Prop({ required: true, index: true })
  nextRunAt: Date;

  @Prop()
  lastRunAt?: Date;

  @Prop({ enum: ['idle', 'running', 'success', 'failed'], default: 'idle' })
  lastRunStatus: string;

  @Prop({ maxlength: 1000 })
  lastError?: string;
}

export const ScheduledReportSchema = SchemaFactory.createForClass(ScheduledReport);
ScheduledReportSchema.index({ active: 1, nextRunAt: 1 });

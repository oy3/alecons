import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ReportExportAuditDocument = ReportExportAudit & Document;

@Schema({ timestamps: true })
export class ReportExportAudit {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  actorUserId: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  reportType: string;

  @Prop({ required: true, enum: ['csv', 'xlsx', 'pdf'] })
  format: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  filters: Record<string, unknown>;

  @Prop({ required: true, default: 0, min: 0 })
  rowCount: number;

  @Prop({ trim: true })
  ipAddress?: string;

  @Prop({ trim: true })
  userAgent?: string;
}

export const ReportExportAuditSchema = SchemaFactory.createForClass(ReportExportAudit);
ReportExportAuditSchema.index({ createdAt: -1, reportType: 1 });


import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PortalActivityEventDocument = PortalActivityEvent & Document;

@Schema({ timestamps: true })
export class PortalActivityEvent {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['staff', 'student', 'application'], index: true })
  portal: string;

  @Prop({ required: true, trim: true })
  roleSnapshot: string;

  @Prop({ required: true, enum: ['page_view', 'login'], default: 'page_view', index: true })
  eventType: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  routeName: string;

  @Prop({ trim: true, maxlength: 300 })
  pathTemplate?: string;

  @Prop({ required: true, index: true })
  occurredAt: Date;

  @Prop({ required: true, index: { expires: 0 } })
  expiresAt: Date;
}

export const PortalActivityEventSchema = SchemaFactory.createForClass(PortalActivityEvent);
PortalActivityEventSchema.index({ portal: 1, occurredAt: -1 });
PortalActivityEventSchema.index({ userId: 1, occurredAt: -1 });


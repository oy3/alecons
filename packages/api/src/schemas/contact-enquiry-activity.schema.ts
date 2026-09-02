import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ContactEnquiryActivityDocument = ContactEnquiryActivity & Document;

@Schema({ timestamps: true })
export class ContactEnquiryActivity {
  @Prop({ type: Types.ObjectId, ref: 'ContactEnquiry', required: true, index: true })
  enquiryId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  actorUserId?: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  action: string;

  @Prop({ maxlength: 80 })
  previousState?: string;

  @Prop({ maxlength: 80 })
  newState?: string;

  @Prop({ maxlength: 1000 })
  comment?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: Record<string, unknown>;
}

export const ContactEnquiryActivitySchema = SchemaFactory.createForClass(ContactEnquiryActivity);
ContactEnquiryActivitySchema.index({ enquiryId: 1, createdAt: 1 });


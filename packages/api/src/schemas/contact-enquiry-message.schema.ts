import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ContactEnquiryMessageDocument = ContactEnquiryMessage & Document;

export enum ContactMessageKind {
  ENQUIRER_MESSAGE = 'enquirer_message',
  STAFF_RESPONSE = 'staff_response',
  INTERNAL_NOTE = 'internal_note',
}

export enum ContactMessageDeliveryStatus {
  NOT_APPLICABLE = 'not_applicable',
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class ContactEnquiryMessage {
  @Prop({ type: Types.ObjectId, ref: 'ContactEnquiry', required: true, index: true })
  enquiryId: Types.ObjectId;

  @Prop({ required: true, enum: ContactMessageKind, index: true })
  kind: ContactMessageKind;

  @Prop({ required: true, trim: true, maxlength: 12000 })
  body: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdByUserId?: Types.ObjectId;

  @Prop({ trim: true, lowercase: true, maxlength: 254 })
  senderEmail?: string;

  @Prop({ required: true, enum: ContactMessageDeliveryStatus, default: ContactMessageDeliveryStatus.NOT_APPLICABLE })
  deliveryStatus: ContactMessageDeliveryStatus;

  @Prop({ maxlength: 1000 })
  deliveryError?: string;

  @Prop()
  sentAt?: Date;

  @Prop({ maxlength: 255 })
  providerMessageId?: string;
}

export const ContactEnquiryMessageSchema = SchemaFactory.createForClass(ContactEnquiryMessage);
ContactEnquiryMessageSchema.index({ enquiryId: 1, createdAt: 1 });


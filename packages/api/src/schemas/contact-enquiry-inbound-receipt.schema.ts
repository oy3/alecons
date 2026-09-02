import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ContactEnquiryInboundReceiptDocument = ContactEnquiryInboundReceipt & Document;

export enum ContactInboundReceiptStatus {
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  IGNORED = 'ignored',
  UNMATCHED = 'unmatched',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class ContactEnquiryInboundReceipt {
  @Prop({ required: true, trim: true })
  providerMessageId: string;

  @Prop({ trim: true })
  providerThreadId?: string;

  @Prop({ trim: true, maxlength: 998 })
  internetMessageId?: string;

  @Prop({ trim: true, lowercase: true, maxlength: 254 })
  senderEmail?: string;

  @Prop({ trim: true, maxlength: 2000 })
  recipient?: string;

  @Prop({ trim: true, maxlength: 998 })
  subject?: string;

  @Prop({ type: Types.ObjectId, ref: 'ContactEnquiry', index: true })
  enquiryId?: Types.ObjectId;

  @Prop({ required: true, enum: ContactInboundReceiptStatus, index: true })
  status: ContactInboundReceiptStatus;

  @Prop({ maxlength: 1000 })
  reason?: string;

  @Prop()
  receivedAt?: Date;

  @Prop()
  processedAt?: Date;

  @Prop({ default: 0, min: 0 })
  attempts: number;
}

export const ContactEnquiryInboundReceiptSchema = SchemaFactory.createForClass(ContactEnquiryInboundReceipt);
ContactEnquiryInboundReceiptSchema.index(
  { providerMessageId: 1 },
  { unique: true, name: 'uniq_contact_inbound_provider_id' },
);
ContactEnquiryInboundReceiptSchema.index({ status: 1, createdAt: -1 });

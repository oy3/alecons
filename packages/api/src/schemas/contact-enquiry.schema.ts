import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ContactEnquiryDocument = ContactEnquiry & Document;

export enum ContactEnquiryCategory {
  ADMISSIONS = 'admissions',
  PROGRAMMES = 'programmes',
  STUDENT_SERVICES = 'student_services',
  FINANCE = 'finance',
  GENERAL = 'general',
}

export enum ContactEnquiryStatus {
  NEW = 'new',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  AWAITING_ENQUIRER = 'awaiting_enquirer',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  SPAM = 'spam',
}

export enum ContactEnquiryPriority {
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Schema({ timestamps: true, optimisticConcurrency: true })
export class ContactEnquiry {
  @Prop({ required: true, unique: true, index: true, uppercase: true, trim: true })
  reference: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  firstName: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  lastName: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 254, index: true })
  email: string;

  @Prop({ trim: true, maxlength: 30 })
  phone?: string;

  @Prop({ required: true, enum: ContactEnquiryCategory, index: true })
  category: ContactEnquiryCategory;

  @Prop({ required: true, enum: ContactEnquiryStatus, default: ContactEnquiryStatus.NEW, index: true })
  status: ContactEnquiryStatus;

  @Prop({ required: true, enum: ContactEnquiryPriority, default: ContactEnquiryPriority.NORMAL, index: true })
  priority: ContactEnquiryPriority;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assignedToUserId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedByUserId?: Types.ObjectId;

  @Prop()
  assignedAt?: Date;

  @Prop({ required: true, default: 'public-website', trim: true, maxlength: 60 })
  source: string;

  @Prop({ required: true, default: Date.now, index: true })
  lastMessageAt: Date;

  @Prop({ required: true, default: Date.now, index: true })
  lastActivityAt: Date;

  @Prop()
  firstResponseAt?: Date;

  @Prop()
  lastResponseAt?: Date;

  @Prop()
  resolvedAt?: Date;

  @Prop()
  closedAt?: Date;
}

export const ContactEnquirySchema = SchemaFactory.createForClass(ContactEnquiry);
ContactEnquirySchema.index({ status: 1, assignedToUserId: 1, lastActivityAt: -1 });
ContactEnquirySchema.index({ category: 1, status: 1, createdAt: -1 });
ContactEnquirySchema.index({ firstName: 'text', lastName: 'text', email: 'text', reference: 'text' });

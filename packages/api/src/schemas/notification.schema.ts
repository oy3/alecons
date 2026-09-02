import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;
export const NOTIFICATION_MESSAGE_TEXT_MAX_LENGTH = 12000;
export const NOTIFICATION_MESSAGE_HTML_MAX_LENGTH = 100000;

export enum NotificationStatus {
    DRAFT = 'draft',
    SCHEDULED = 'scheduled',
    PROCESSING = 'processing',
    SENT = 'sent',
    PARTIALLY_FAILED = 'partially_failed',
    CANCELLED = 'cancelled',
    ARCHIVED = 'archived',
}

export enum NotificationAudienceType {
    ALL = 'all',
    STAFF = 'staff',
    STUDENTS = 'students',
    APPLICANTS = 'applicants',
    STUDENT_COHORT = 'student_cohort',
    SPECIFIC_USERS = 'specific_users',
}

const NotificationAudienceSchema = new MongooseSchema(
    {
        type: { type: String, enum: Object.values(NotificationAudienceType), required: true },
        programId: { type: Types.ObjectId, ref: 'Program' },
        level: { type: Number, min: 1 },
        userIds: [{ type: Types.ObjectId, ref: 'User' }],
    },
    { _id: false },
);

@Schema({ timestamps: true, optimisticConcurrency: true })
export class Notification {
    @Prop({ required: true, trim: true, maxlength: 140 })
    title: string;

    @Prop({ required: true, maxlength: NOTIFICATION_MESSAGE_HTML_MAX_LENGTH })
    messageHtml: string;

    @Prop({ required: true, maxlength: NOTIFICATION_MESSAGE_TEXT_MAX_LENGTH })
    messageText: string;

    @Prop({ enum: ['general', 'admissions', 'academic', 'payment', 'system', 'emergency'], default: 'general' })
    category: string;

    @Prop({ enum: ['normal', 'high', 'urgent'], default: 'normal' })
    priority: string;

    @Prop({
        type: {
            label: { type: String, trim: true, maxlength: 50 },
            url: { type: String, trim: true, maxlength: 500 },
        },
        _id: false,
    })
    action?: { label?: string; url?: string };

    @Prop({ type: NotificationAudienceSchema, required: true })
    audience: {
        type: NotificationAudienceType;
        programId?: Types.ObjectId;
        level?: number;
        userIds?: Types.ObjectId[];
    };

    @Prop({ required: true, trim: true, maxlength: 300 })
    audienceSummary: string;

    @Prop({ enum: NotificationStatus, default: NotificationStatus.DRAFT, index: true })
    status: NotificationStatus;

    @Prop({ type: Types.ObjectId, ref: 'User', index: true })
    createdBy?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    updatedBy?: Types.ObjectId;

    @Prop({ default: false, index: true })
    systemGenerated: boolean;

    @Prop()
    scheduledAt?: Date;

    @Prop()
    sentAt?: Date;

    @Prop()
    expiresAt?: Date;

    @Prop({ default: 0, min: 0 })
    recipientCount: number;

    @Prop({ default: 0, min: 0 })
    failedCount: number;

    @Prop({ maxlength: 1000 })
    lastError?: string;

    @Prop({ type: MongooseSchema.Types.Mixed })
    deliveryMetadata?: Record<string, unknown>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ status: 1, createdAt: -1 });
NotificationSchema.index({ createdBy: 1, createdAt: -1 });
NotificationSchema.index({ scheduledAt: 1, status: 1 });

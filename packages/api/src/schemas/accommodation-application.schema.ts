import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AccommodationApplicationDocument = AccommodationApplication & Document;

export enum AccommodationApplicantType {
    INTERNAL = 'internal',
    EXTERNAL = 'external',
}

export enum AccommodationApplicationStatus {
    DRAFT = 'draft',
    AWAITING_EMAIL_VERIFICATION = 'awaiting_email_verification',
    AWAITING_AGREEMENT = 'awaiting_agreement',
    AWAITING_PAYMENT = 'awaiting_payment',
    PAYMENT_PENDING_REVIEW = 'payment_pending_review',
    PAID_AWAITING_ALLOCATION = 'paid_awaiting_allocation',
    ALLOCATED = 'allocated',
    CANCELLED = 'cancelled',
    EXPIRED = 'expired',
}

@Schema({ timestamps: true, optimisticConcurrency: true })
export class AccommodationApplication {
    @Prop({ required: true, unique: true, uppercase: true, trim: true })
    applicationNumber: string;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Student' })
    studentId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ExternalResident' })
    externalResidentId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true, index: true })
    academicSessionId: Types.ObjectId;

    @Prop({ required: true, enum: AccommodationApplicantType, index: true })
    applicantType: AccommodationApplicantType;

    @Prop({ required: true, enum: AccommodationApplicationStatus, default: AccommodationApplicationStatus.DRAFT, index: true })
    status: AccommodationApplicationStatus;

    @Prop({ trim: true })
    category?: string;

    @Prop({ enum: ['male', 'female'] })
    gender?: string;

    @Prop({ select: false })
    resumeTokenHash?: string;

    @Prop()
    resumeTokenExpiresAt?: Date;

    @Prop({ select: false })
    emailVerificationTokenHash?: string;

    @Prop()
    emailVerificationExpiresAt?: Date;

    @Prop()
    emailVerifiedAt?: Date;

    @Prop()
    submittedAt?: Date;

    @Prop()
    paidAt?: Date;

    @Prop()
    allocatedAt?: Date;

    @Prop({ type: Object, select: false })
    agreementDraft?: Record<string, unknown>;

    @Prop()
    agreementDraftSavedAt?: Date;
}

export const AccommodationApplicationSchema = SchemaFactory.createForClass(AccommodationApplication);
AccommodationApplicationSchema.index({ userId: 1, academicSessionId: 1 }, { unique: true, name: 'uniq_accommodation_user_session' });
AccommodationApplicationSchema.index({ academicSessionId: 1, applicantType: 1, status: 1, createdAt: -1 });

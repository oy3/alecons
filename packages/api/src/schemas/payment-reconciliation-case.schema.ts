import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentReconciliationCaseDocument = PaymentReconciliationCase & Document;

export enum ReconciliationCaseType {
    UNMATCHED_SUCCESS = 'unmatched_success',
    DUPLICATE_PAYMENT = 'duplicate_payment',
    PROVIDER_MISMATCH = 'provider_mismatch',
    PROCESSING_FAILURE = 'processing_failure',
    REFUND_RECOMMENDED = 'refund_recommended',
}

export enum ReconciliationCaseStatus {
    OPEN = 'open',
    INVESTIGATING = 'investigating',
    REFUND_PENDING = 'refund_pending',
    RESOLVED = 'resolved',
    DISMISSED = 'dismissed',
}

@Schema({ timestamps: true, collection: 'paymentreconciliationcases' })
export class PaymentReconciliationCase {
    @Prop({ required: true, enum: ReconciliationCaseType })
    type: ReconciliationCaseType;

    @Prop({ required: true, enum: ReconciliationCaseStatus, default: ReconciliationCaseStatus.OPEN })
    status: ReconciliationCaseStatus;

    @Prop({ required: true })
    provider: string;

    @Prop()
    reference?: string;

    @Prop()
    providerTransactionId?: string;

    @Prop({ type: Types.ObjectId, ref: 'PaymentTransaction' })
    paymentTransactionId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'PaymentTransaction' })
    appliedTransactionId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    userId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Payment' })
    paymentId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession' })
    academicSessionId?: Types.ObjectId;

    @Prop()
    amount?: number;

    @Prop()
    currency?: string;

    @Prop()
    reason?: string;

    @Prop({ type: Object })
    providerSnapshot?: Record<string, unknown>;

    @Prop({ type: Object })
    matchCandidates?: Record<string, unknown>[];

    @Prop({ type: Types.ObjectId, ref: 'User' })
    resolvedBy?: Types.ObjectId;

    @Prop()
    resolvedAt?: Date;

    @Prop()
    resolution?: string;
}

export const PaymentReconciliationCaseSchema = SchemaFactory.createForClass(PaymentReconciliationCase);
PaymentReconciliationCaseSchema.index({ status: 1, type: 1, createdAt: -1 });
PaymentReconciliationCaseSchema.index({ reference: 1, status: 1 });

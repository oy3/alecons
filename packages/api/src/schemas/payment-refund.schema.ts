import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentRefundDocument = PaymentRefund & Document;

export enum PaymentRefundMethod {
    PAYSTACK = 'paystack',
    MANUAL = 'manual',
}

export enum PaymentRefundStatus {
    REQUESTED = 'requested',
    PENDING = 'pending',
    PROCESSING = 'processing',
    NEEDS_ATTENTION = 'needs_attention',
    PROCESSED = 'processed',
    FAILED = 'failed',
    CANCELLED = 'cancelled',
}

@Schema({ timestamps: true, collection: 'paymentrefunds' })
export class PaymentRefund {
    @Prop({ type: Types.ObjectId, ref: 'PaymentTransaction', required: true })
    paymentTransactionId: Types.ObjectId;

    @Prop({ required: true })
    amount: number;

    @Prop({ required: true, default: 'NGN' })
    currency: string;

    @Prop({ required: true, enum: PaymentRefundMethod })
    method: PaymentRefundMethod;

    @Prop({ required: true, enum: PaymentRefundStatus, default: PaymentRefundStatus.REQUESTED })
    status: PaymentRefundStatus;

    @Prop({ required: true })
    reason: string;

    @Prop()
    providerRefundId?: string;

    @Prop()
    providerReference?: string;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    requestedBy: Types.ObjectId;

    @Prop()
    requestedAt: Date;

    @Prop()
    processedAt?: Date;

    @Prop()
    failureReason?: string;

    @Prop()
    manualReference?: string;

    @Prop()
    evidenceUrl?: string;

    @Prop({ type: Object })
    providerSnapshot?: Record<string, unknown>;
}

export const PaymentRefundSchema = SchemaFactory.createForClass(PaymentRefund);
PaymentRefundSchema.index({ paymentTransactionId: 1, status: 1, createdAt: -1 });
PaymentRefundSchema.index({ providerRefundId: 1 }, { unique: true, sparse: true });

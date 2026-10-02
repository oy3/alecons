import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentProviderEventDocument = PaymentProviderEvent & Document;

export enum ProviderEventProcessingStatus {
    RECEIVED = 'received',
    PROCESSING = 'processing',
    PROCESSED = 'processed',
    UNMATCHED = 'unmatched',
    QUARANTINED = 'quarantined',
    FAILED = 'failed',
}

@Schema({ timestamps: true, collection: 'paymentproviderevents' })
export class PaymentProviderEvent {
    @Prop({ required: true, default: 'paystack' })
    provider: string;

    @Prop({ required: true })
    eventType: string;

    @Prop({ required: true, unique: true })
    idempotencyKey: string;

    @Prop()
    reference?: string;

    @Prop()
    providerTransactionId?: string;

    @Prop()
    amount?: number;

    @Prop()
    currency?: string;

    @Prop()
    customerEmail?: string;

    @Prop({ type: Object })
    metadata?: Record<string, unknown>;

    @Prop({ type: Object })
    payload?: Record<string, unknown>;

    @Prop({ required: true })
    payloadHash: string;

    @Prop({ default: true })
    signatureVerified: boolean;

    @Prop({ required: true, enum: ProviderEventProcessingStatus, default: ProviderEventProcessingStatus.RECEIVED })
    processingStatus: ProviderEventProcessingStatus;

    @Prop({ default: 0 })
    processingAttempts: number;

    @Prop()
    processingError?: string;

    @Prop({ type: Types.ObjectId, ref: 'PaymentTransaction' })
    paymentTransactionId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'PaymentReconciliationCase' })
    reconciliationCaseId?: Types.ObjectId;

    @Prop()
    processedAt?: Date;
}

export const PaymentProviderEventSchema = SchemaFactory.createForClass(PaymentProviderEvent);
PaymentProviderEventSchema.index({ processingStatus: 1, createdAt: 1 });
PaymentProviderEventSchema.index({ reference: 1, createdAt: -1 });
PaymentProviderEventSchema.index({ providerTransactionId: 1, eventType: 1 });

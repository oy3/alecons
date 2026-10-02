import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentAuditEventDocument = PaymentAuditEvent & Document;

@Schema({ timestamps: true, collection: 'paymentauditevents' })
export class PaymentAuditEvent {
    @Prop({ required: true })
    action: string;

    @Prop({ type: Types.ObjectId, ref: 'PaymentTransaction' })
    paymentTransactionId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'PaymentReconciliationCase' })
    reconciliationCaseId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'PaymentRefund' })
    refundId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    actorId?: Types.ObjectId;

    @Prop({ required: true, default: 'system' })
    actorType: 'system' | 'staff' | 'provider';

    @Prop({ required: true })
    description: string;

    @Prop({ type: Object })
    metadata?: Record<string, unknown>;
}

export const PaymentAuditEventSchema = SchemaFactory.createForClass(PaymentAuditEvent);
PaymentAuditEventSchema.index({ paymentTransactionId: 1, createdAt: -1 });
PaymentAuditEventSchema.index({ reconciliationCaseId: 1, createdAt: -1 });

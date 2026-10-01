import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentRecoveryRunDocument = PaymentRecoveryRun & Document;

@Schema({ timestamps: true, collection: 'paymentrecoveryruns' })
export class PaymentRecoveryRun {
    @Prop({ required: true, unique: true })
    runId: string;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true })
    academicSessionId: Types.ObjectId;

    @Prop({ type: [String], required: true })
    identifiers: string[];

    @Prop({ required: true })
    inputHash: string;

    @Prop({ type: [Object], default: [] })
    results: Record<string, unknown>[];

    @Prop({ required: true, default: 'previewed' })
    status: 'previewed' | 'applying' | 'applied' | 'expired';

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    createdBy: Types.ObjectId;

    @Prop()
    appliedAt?: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    appliedBy?: Types.ObjectId;

    @Prop()
    reason?: string;
}

export const PaymentRecoveryRunSchema = SchemaFactory.createForClass(PaymentRecoveryRun);
PaymentRecoveryRunSchema.index({ createdAt: -1, status: 1 });

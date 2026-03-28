import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SessionControlDocument = SessionControl & Document;

export interface Control {
    name: string;
    active: boolean;
    description?: string;
}

export interface PaymentControl {
    paymentId: Types.ObjectId;
    active: boolean;
}

@Schema({ timestamps: true })
export class SessionControl {
    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true })
    academicSessionId: Types.ObjectId;

    @Prop({
        type: [{
            name: { type: String, required: true },
            active: { type: Boolean, default: false }
        }],
        default: [
            { name: 'application', active: false },
            { name: 'admissionProcessing', active: false },
            { name: 'entranceExam', active: true },
            { name: 'screening', active: true },
            { name: 'courseRegistration', active: false },
            { name: 'resultUpload', active: false },
            { name: 'resultRelease', active: false },
            { name: 'applicantPaystackPayments', active: true },
            { name: 'applicantManualTransferPayments', active: true },
            { name: 'studentPaystackPayments', active: true },
            { name: 'studentManualTransferPayments', active: true }
        ]
    })
    controls: Control[];

    @Prop({
        type: [{
            paymentId: { type: Types.ObjectId, ref: 'Payment', required: true },
            active: { type: Boolean, default: false }
        }]
    })
    payments: PaymentControl[];

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    updatedBy: Types.ObjectId;
}

export const SessionControlSchema = SchemaFactory.createForClass(SessionControl);

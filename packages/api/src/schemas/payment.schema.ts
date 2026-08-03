import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

export enum PaymentAudience {
    APPLICANT = 'applicant',
    STUDENT = 'student',
    ACADEMIC_STAFF = 'academic_staff',
    ADMIN_STAFF = 'admin_staff',
}

@Schema({ timestamps: true })
export class Payment {
    @Prop({ required: true, unique: true })
    paymentCode: string;

    @Prop({ required: true })
    name: string;

    @Prop()
    description?: string;

    @Prop({ required: true })
    amount: number;

    @Prop()
    category?: string;

    @Prop({ default: true })
    active: boolean;

    @Prop({
        type: [String],
        enum: PaymentAudience,
        default: [PaymentAudience.APPLICANT],
        required: true
    })
    targetAudience: PaymentAudience[];

    @Prop({ type: Types.ObjectId, ref: 'PaymentDestinationAccount' })
    paystackDestinationAccountId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'PaymentDestinationAccount' })
    manualTransferDestinationAccountId?: Types.ObjectId;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentDocument = Payment & Document;

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
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

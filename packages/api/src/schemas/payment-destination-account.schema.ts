import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentDestinationAccountDocument = PaymentDestinationAccount & Document;

export enum PaymentDestinationChannelType {
    PAYSTACK = 'paystack',
    MANUAL_TRANSFER = 'manual_transfer',
}

export enum PaymentDestinationProviderType {
    MAIN = 'main',
    SUBACCOUNT = 'subaccount',
    BANK_ACCOUNT = 'bank_account',
}

@Schema({ timestamps: true })
export class PaymentDestinationAccount {
    @Prop({ required: true, trim: true })
    title: string;

    @Prop({ required: true, unique: true, uppercase: true, trim: true })
    code: string;

    @Prop({ required: true, enum: PaymentDestinationChannelType })
    channelType: PaymentDestinationChannelType;

    @Prop({ required: true, enum: PaymentDestinationProviderType })
    providerType: PaymentDestinationProviderType;

    @Prop({ default: false })
    isDefault: boolean;

    @Prop({ default: true })
    active: boolean;

    @Prop({ trim: true })
    accountName?: string;

    @Prop({ trim: true })
    bankName?: string;

    @Prop({ trim: true })
    accountNumber?: string;

    @Prop({ trim: true, uppercase: true, default: 'NGN' })
    currency?: string;

    @Prop({ trim: true })
    paystackSubaccountCode?: string;

    @Prop({ trim: true })
    paystackChargeBearer?: string;

    @Prop()
    transactionCharge?: number;

    @Prop({ trim: true })
    note?: string;
}

export const PaymentDestinationAccountSchema = SchemaFactory.createForClass(PaymentDestinationAccount);

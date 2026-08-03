import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TenancyAgreementDocument = TenancyAgreement & Document;

@Schema({ timestamps: true })
export class TenancyAgreement {
    @Prop({ type: Types.ObjectId, ref: 'Student', required: true })
    studentId: Types.ObjectId;

    @Prop({ required: true })
    agreementReference: string; // ALECONS-TA-YYYY-StudentId-Timestamp

    // Personal Information
    @Prop({ required: true })
    tenantName: string;

    @Prop({ required: true })
    courseOfStudy: string;

    @Prop({ required: true })
    residentialAddress: string;

    @Prop({ required: true })
    phoneNumber: string;

    // Parent/Guardian Information
    @Prop({
        type: {
            name: { type: String, required: true },
            phoneNumber: { type: String, required: true }
        },
        required: true
    })
    parentInfo: {
        name: string;
        phoneNumber: string;
    };

    // Guarantor Information
    @Prop({
        type: {
            name: { type: String, required: true },
            phoneNumber: { type: String, required: true },
            address: { type: String, required: true },
            occupation: { type: String, required: true },
            relationship: { type: String, required: true }
        },
        required: true
    })
    guarantorInfo: {
        name: string;
        phoneNumber: string;
        address: string;
        occupation: string;
        relationship: string;
    };

    // Hostel Information
    @Prop({
        type: {
            address: { type: String, required: true },
            tenancyStartDate: { type: String, required: true },
            tenancyEndDate: { type: String, required: true }
        },
        required: true
    })
    hostelInfo: {
        address: string;
        tenancyStartDate: string;
        tenancyEndDate: string;
    };

    // Agreement Terms
    @Prop({
        type: {
            agreedToTerms: { type: Boolean, required: true },
            signedAt: { type: Date, required: true }
        },
        required: true
    })
    agreementTerms: {
        agreedToTerms: boolean;
        signedAt: Date;
    };

    @Prop({ default: 'pending' })
    status: string; // signed, pending, approved, rejected

    @Prop()
    documentUrl?: string; // URL to generated PDF in Digital Ocean Spaces

    @Prop()
    notes?: string; // Any additional notes
}

export const TenancyAgreementSchema = SchemaFactory.createForClass(TenancyAgreement);

// Create indexes for better performance
TenancyAgreementSchema.index({ studentId: 1 });
TenancyAgreementSchema.index({ agreementReference: 1 }, { unique: true });
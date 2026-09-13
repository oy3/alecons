import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TenancyAgreementDocument = TenancyAgreement & Document;

export enum TenancyAgreementStatus {
    SIGNED_AWAITING_PAYMENT = 'signed_awaiting_payment',
    PAYMENT_CONFIRMED_AWAITING_ALLOCATION = 'payment_confirmed_awaiting_allocation',
    EXECUTED = 'executed',
    CANCELLED = 'cancelled',
}

@Schema({ timestamps: true })
export class TenancyAgreement {
    @Prop({ type: Types.ObjectId, ref: 'Student' })
    studentId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ExternalResident' })
    externalResidentId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', index: true })
    userId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'AccommodationApplication' })
    accommodationApplicationId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true, index: true })
    academicSessionId: Types.ObjectId;

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

    @Prop({ enum: TenancyAgreementStatus, default: TenancyAgreementStatus.SIGNED_AWAITING_PAYMENT })
    status: TenancyAgreementStatus;

    @Prop()
    documentUrl?: string; // URL to generated PDF in Digital Ocean Spaces

    @Prop({ select: false })
    documentKey?: string; // Private object key for allocation-gated downloads

    @Prop({ select: false })
    documentVersion?: number;

    @Prop()
    notes?: string; // Any additional notes
}

export const TenancyAgreementSchema = SchemaFactory.createForClass(TenancyAgreement);

// Create indexes for better performance
TenancyAgreementSchema.pre('validate', function (next) {
    if (!this.studentId && !this.externalResidentId) {
        return next(new Error('A student or external resident is required'));
    }
    next();
});
TenancyAgreementSchema.index({ studentId: 1 });
TenancyAgreementSchema.index(
    { studentId: 1, academicSessionId: 1 },
    { unique: true, partialFilterExpression: { studentId: { $type: 'objectId' } }, name: 'uniq_tenancy_student_session' },
);
TenancyAgreementSchema.index(
    { externalResidentId: 1, academicSessionId: 1 },
    { unique: true, partialFilterExpression: { externalResidentId: { $type: 'objectId' } }, name: 'uniq_tenancy_external_session' },
);
TenancyAgreementSchema.index({ agreementReference: 1 }, { unique: true });

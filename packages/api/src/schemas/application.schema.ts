import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDocument, Types } from 'mongoose';
import { Logger } from '@nestjs/common';

export type ApplicationDocument = Application & MongooseDocument;

export enum ApplicationStatus {
    PENDING = 'pending',
    ADMITTED = 'admitted',
    CLEARED = 'cleared',
    COMPLETED = 'completed',
    REJECTED = 'rejected',
}

export interface Guardian {
    name: string;
    phone: string;
    address: string;
    email?: string;
    relationship: string;
}

export interface NextOfKin {
    name: string;
    phone: string;
    address: string;
    email?: string;
    relationship: string;
}

export interface AcademicBackground {
    primary: {
        name: string;
        startDate: string;
        endDate: string;
    };
    secondary: {
        name: string;
        startDate: string;
        endDate: string;
    };
}

export interface Referee {
    name: string;
    phone: string;
    email: string;
}

export interface ExamSubject {
    subject: string;
    grade: string;
}

export interface Examination {
    examType: string;
    examYear: string;
    examNumber: string;
    subjects: ExamSubject[];
}

export interface ApplicationDoc {
    type: string;
    url: string;
    uploadedAt?: Date;
}

@Schema({ timestamps: true })
export class Application {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ required: true, unique: true })
    applicationNumber: string;

    @Prop({ type: Types.ObjectId, ref: 'Program', required: true })
    programId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ProgramType', required: true })
    programTypeId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ProgramMode', required: true })
    programModeId: Types.ObjectId;

    @Prop({ required: true, enum: ApplicationStatus, default: ApplicationStatus.PENDING })
    status: ApplicationStatus;

    @Prop({ default: 1 })
    currentStage: number;

    @Prop()
    admissionDate?: Date;

    @Prop()
    dob?: Date;

    @Prop()
    gender?: string;

    @Prop()
    phone?: string;

    @Prop()
    stateOfOrigin?: string;

    @Prop()
    lga?: string;

    @Prop()
    nationality?: string;

    @Prop()
    maritalStatus?: string;

    @Prop()
    religion?: string;

    @Prop()
    address?: string;

    @Prop()
    profileImageUrl?: string;

    @Prop({
        type: {
            name: String,
            phone: String,
            address: String,
            email: String,
            relationship: String,
        }
    })
    guardian?: Guardian;

    @Prop({
        type: {
            name: String,
            phone: String,
            address: String,
            email: String,
            relationship: String,
        }
    })
    nextOfKin?: NextOfKin;

    @Prop({
        type: {
            primary: {
                name: String,
                startDate: String,
                endDate: String,
            },
            secondary: {
                name: String,
                startDate: String,
                endDate: String,
            },
        }
    })
    academicBackground?: AcademicBackground;

    @Prop({
        type: [{
            name: String,
            phone: String,
            email: String,
        }]
    })
    referees: Referee[];

    @Prop({
        type: [{
            examType: String,
            examYear: String,
            examNumber: String,
            subjects: [{
                subject: String,
                grade: String,
            }]
        }]
    })
    examinations: Examination[];

    @Prop({
        type: [{
            type: { type: String, required: true }, // Document type (profile_picture, olevel_result, reference_letter)
            url: { type: String, required: true },  // File URL
            uploadedAt: { type: Date, default: Date.now },
            sittingIndex: { type: Number }, // For olevel results
            referenceIndex: { type: Number } // For reference letters
        }]
    })
    documents: ApplicationDoc[];

    @Prop({ default: true })
    isActive: boolean;
}

export const ApplicationSchema = SchemaFactory.createForClass(Application);

// Note: Application number generation is now handled by ApplicationNumberService
// to ensure uniqueness and avoid race conditions.

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

export enum AdmissionDecision {
    PENDING = 'pending',
    ADMITTED = 'admitted',
    REJECTED = 'rejected',
}

export enum AdmissionDecision {
    AWAITING_DECISION = 'pending',
    GRANTED = 'admitted',
    DENIED = 'rejected',
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

export interface JambDetails {
    registrationNumber?: string;
    score?: number;
}

export interface ApplicationDoc {
    type: string;
    url: string;
    uploadedAt?: Date;
}

export interface EntranceExam {
    date?: Date;
    time?: string;
    link?: string;
    score?: number;
}

export interface Screening {
    date?: Date;
    time?: string;
    venue?: string;
    completed?: boolean;
}

export interface ApplicationDocuments {
    profilePicture?: ApplicationDoc;
    olevelResults: ApplicationDoc[];
    referenceLetters: ApplicationDoc[];
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

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true })
    entryAcademicSession: Types.ObjectId;

    @Prop({ required: true, enum: ApplicationStatus, default: ApplicationStatus.PENDING })
    status: ApplicationStatus;

    @Prop({ default: 1 })
    currentStage: number;

    // Personal Information
    @Prop()
    dob?: Date;

    @Prop()
    gender?: string;

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

    // Guardian Information
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

    // Next of Kin Information
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

    // Academic Background
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

    @Prop({ trim: true })
    jambRegistrationNumber?: string;

    @Prop({ min: 0, max: 400 })
    jambScore?: number;

    @Prop({ default: false })
    isJambExempt?: boolean;

    // Enhanced Document Structure
    @Prop({
        type: {
            profilePicture: {
                type: { type: String },
                url: { type: String },
                uploadedAt: { type: Date }
            },
            olevelResults: [{
                type: { type: String, required: true },
                url: { type: String, required: true },
                uploadedAt: { type: Date }
            }],
            referenceLetters: [{
                type: { type: String, required: true },
                url: { type: String, required: true },
                uploadedAt: { type: Date }
            }]
        },
        default: {
            olevelResults: [],
            referenceLetters: []
        }
    })
    documents: ApplicationDocuments;

    // Grouped Entrance Exam Fields
    @Prop({
        type: {
            date: Date,
            time: String,
            link: String,
            score: Number
        }
    })
    entranceExam?: EntranceExam;

    // Grouped Screening Fields
    @Prop({
        type: {
            date: Date,
            time: String,
            venue: String,
            completed: { type: Boolean, default: false }
        }
    })
    screening?: Screening;

    // Admission Information
    @Prop()
    admissionDate?: Date;

    @Prop({ enum: AdmissionDecision, default: AdmissionDecision.AWAITING_DECISION })
    admissionDecision: AdmissionDecision;

    @Prop()
    admissionLetter?: string;

    @Prop()
    rejectionReason?: string;

    @Prop()
    matriculationNumber?: string;

    // Audit Trail
    @Prop({ type: Types.ObjectId, ref: 'User' })
    lastUpdatedBy?: Types.ObjectId;

    @Prop()
    lastUpdatedAt?: Date;

    @Prop({ default: true })
    isActive: boolean;
}

export const ApplicationSchema = SchemaFactory.createForClass(Application);

// Note: Application number generation is now handled by ApplicationNumberService
// to ensure uniqueness and avoid race conditions.

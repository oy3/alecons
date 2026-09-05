import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { Logger } from '@nestjs/common';

export type ApplicationDocument = Application & MongooseDocument;

export enum ApplicationStatus {
    PENDING = 'pending',
    ADMITTED = 'admitted',
    CLEARED = 'cleared',
    COMPLETED = 'completed',
    REJECTED = 'rejected',
    EXPIRED = 'expired',
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

export interface ApplicationAuditEntry {
    action: string;
    description: string;
    performedBy?: Types.ObjectId;
    actorRole?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

@Schema({ timestamps: true })
export class Application {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ required: true, unique: true })
    applicationNumber: string;

    @Prop({ type: Types.ObjectId, ref: 'Program', required: true })
    programId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true })
    entryAcademicSession: Types.ObjectId;

    @Prop({ required: true, enum: ApplicationStatus, default: ApplicationStatus.PENDING })
    status: ApplicationStatus;

    @Prop({ default: 1 })
    currentStage: number;

    @Prop()
    submittedAt?: Date;

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
    // TODO: Include in application form and autofill in tenancy agreement in student portal
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
    admissionRevokedAt?: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    admissionRevokedBy?: Types.ObjectId;

    @Prop({ trim: true, maxlength: 1000 })
    admissionRevocationReason?: string;

    @Prop()
    matriculationNumber?: string;

    @Prop()
    expiredAt?: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    expiredBy?: Types.ObjectId;

    @Prop({ trim: true, maxlength: 1000 })
    expirationReason?: string;

    // Audit Trail
    @Prop({
        type: [{
            action: { type: String, required: true },
            description: { type: String, required: true },
            performedBy: { type: Types.ObjectId, ref: 'User' },
            actorRole: { type: String },
            metadata: { type: MongooseSchema.Types.Mixed },
            createdAt: { type: Date, default: Date.now },
        }],
        default: [],
    })
    auditTrail: ApplicationAuditEntry[];

    @Prop({ default: true })
    isActive: boolean;
}

export const ApplicationSchema = SchemaFactory.createForClass(Application);
ApplicationSchema.index({ entryAcademicSession: 1, programId: 1, status: 1 });
ApplicationSchema.index({ createdAt: -1, isActive: 1 });
ApplicationSchema.index({ admissionDecision: 1, currentStage: 1 });

// Note: Application number generation is now handled by ApplicationNumberService
// to ensure uniqueness and avoid race conditions.

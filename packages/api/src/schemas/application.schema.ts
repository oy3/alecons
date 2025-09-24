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
            type: String,
            url: String,
            uploadedAt: { type: Date, default: Date.now },
        }]
    })
    documents: ApplicationDoc[];

    @Prop({ default: true })
    isActive: boolean;
}

export const ApplicationSchema = SchemaFactory.createForClass(Application);

// Generate application number before saving
ApplicationSchema.pre('save', async function (next) {
    if (this.isNew && !this.applicationNumber && this.programId) {
        try {
            const ApplicationModel = this.constructor as any;
            const currentYear = new Date().getFullYear();
            const yearString = currentYear.toString().slice(-2); // Get last 2 digits

            // Get program details to get the code
            const Program = this.db.model('Program');
            const program = await Program.findById(this.programId);

            if (!program) {
                throw new Error('Program not found for application number generation');
            }

            const programCode = String(program.code).padStart(2, '0'); // Ensure 2 digits

            // Count applications for this program in current year
            const count = await ApplicationModel.countDocuments({
                programId: this.programId,
                createdAt: {
                    $gte: new Date(currentYear, 0, 1),
                    $lt: new Date(currentYear + 1, 0, 1)
                }
            });

            // Generate: ALEC{yy}{program.code}{0001}
            this.applicationNumber = `ALEC${yearString}${programCode}${String(count + 1).padStart(4, '0')}`;
        } catch (error) {
            const logger = new Logger('ApplicationSchema');
            logger.error('Error generating application number:', error);
            // Fallback to basic numbering if program lookup fails
            const ApplicationModel = this.constructor as any;
            const count = await ApplicationModel.countDocuments();
            this.applicationNumber = `ALEC${new Date().getFullYear()}${String(count + 1).padStart(6, '0')}`;
        }
    }
    next();
});

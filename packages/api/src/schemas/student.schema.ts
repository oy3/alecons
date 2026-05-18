import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StudentDocument = Student & Document;

@Schema({ timestamps: true })
export class Student {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Application', required: true })
    applicationId: Types.ObjectId;

    @Prop({ required: true, unique: true })
    matriculationNumber: string; // New format: ALC/ND/25/010001

    @Prop({ type: Types.ObjectId, ref: 'Program', required: true })
    programId: Types.ObjectId;

    @Prop({ required: true })
    admissionYear: number;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true })
    academicSession: Types.ObjectId; // Reference to AcademicSession collection

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true })
    entryAcademicSession: Types.ObjectId;

    @Prop({ default: 'active' })
    status: string; // active, suspended, graduated, withdrawn

    @Prop({ default: 1 })
    currentLevel: number; // 1, 2, 3, etc.

    @Prop({ default: 1 })
    currentSemester: number; // 1 or 2

    @Prop()
    graduationDate?: Date;

    @Prop({ default: 0.0 })
    cumulativeGPA: number;

    @Prop({ default: true })
    isActive: boolean;

    @Prop()
    profileImageUrl?: string; // Profile image stored in Digital Ocean Spaces
}

export const StudentSchema = SchemaFactory.createForClass(Student);

// Note: Matriculation number generation is now handled by MatriculationService
// to ensure proper format (ALC/programType/YY/programCode+sequence) and uniqueness

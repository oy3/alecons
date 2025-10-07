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
    matriculationNumber: string; // New format: ALC/25/01-0001

    @Prop({ type: Types.ObjectId, ref: 'Program', required: true })
    programId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ProgramType', required: true })
    programTypeId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ProgramMode', required: true })
    programModeId: Types.ObjectId;

    @Prop({ required: true })
    admissionYear: number;

    @Prop({ required: true })
    academicSession: string; // e.g., "2025/2026"

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
}

export const StudentSchema = SchemaFactory.createForClass(Student);

// Note: Matriculation number generation is now handled by MatriculationService
// to ensure proper format (ALC/YY/program.code-nnnn) and uniqueness

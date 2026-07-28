import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StudentAcademicSummaryDocument = StudentAcademicSummary & Document;

@Schema({ timestamps: true })
export class StudentAcademicSummary {
    @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
    studentId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true, index: true })
    academicSessionId: Types.ObjectId;

    @Prop({ required: true, enum: [1, 2] })
    semester: number;

    @Prop({ required: true, min: 1 })
    level: number;

    @Prop({ required: true, default: 0 })
    applicableUnits: number;

    @Prop({ required: true, default: 0 })
    earnedUnits: number;

    @Prop({ required: true, default: 0 })
    qualityPoints: number;

    @Prop({ required: true, default: 0 })
    semesterGPA: number;

    @Prop({ required: true, default: 0 })
    cumulativeApplicableUnits: number;

    @Prop({ required: true, default: 0 })
    cumulativeQualityPoints: number;

    @Prop({ required: true, default: 0 })
    cumulativeGPA: number;

    @Prop()
    calculatedAt?: Date;
}

export const StudentAcademicSummarySchema = SchemaFactory.createForClass(StudentAcademicSummary);
StudentAcademicSummarySchema.index({ studentId: 1, academicSessionId: 1, semester: 1 }, { unique: true });

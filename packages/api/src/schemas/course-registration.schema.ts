import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CourseRegistrationDocument = CourseRegistration & Document;

export enum CourseRegistrationStatus {
    DRAFT = 'draft',
    SUBMITTED = 'submitted',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

@Schema({ _id: false })
export class CourseRegistrationItem {
    @Prop({ type: Types.ObjectId, ref: 'ProgramCourse', required: true })
    programCourseId: Types.ObjectId;
}

export const CourseRegistrationItemSchema = SchemaFactory.createForClass(CourseRegistrationItem);

@Schema({ timestamps: true })
export class CourseRegistration {
    @Prop({ type: Types.ObjectId, ref: 'Student', required: true })
    studentId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Program', required: true })
    programId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true })
    academicSessionId: Types.ObjectId;

    @Prop({ required: true, min: 1 })
    level: number;

    @Prop({ required: true, enum: [1, 2] })
    semester: number;

    @Prop({ type: [CourseRegistrationItemSchema], default: [] })
    items: CourseRegistrationItem[];

    @Prop({ required: true, default: 0 })
    totalUnits: number;

    @Prop({ required: true, enum: CourseRegistrationStatus, default: CourseRegistrationStatus.DRAFT })
    status: CourseRegistrationStatus;

    @Prop()
    submittedAt?: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    reviewedBy?: Types.ObjectId;

    @Prop()
    reviewedAt?: Date;

    @Prop()
    reviewComment?: string;
}

export const CourseRegistrationSchema = SchemaFactory.createForClass(CourseRegistration);

CourseRegistrationSchema.index(
    { studentId: 1, academicSessionId: 1, level: 1, semester: 1 },
    { unique: true, name: 'uniq_student_session_semester_registration' }
);

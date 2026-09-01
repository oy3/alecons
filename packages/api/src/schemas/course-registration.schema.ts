import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CourseRegistrationDocument = CourseRegistration & Document;

export enum CourseRegistrationStatus {
    DRAFT = 'draft',
    SUBMITTED = 'submitted',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

export enum CourseRegistrationHistoryAction {
    SUBMITTED = 'submitted',
    RESUBMITTED = 'resubmitted',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

@Schema({ _id: false })
export class CourseRegistrationItem {
    @Prop({ type: Types.ObjectId, ref: 'ProgramCourse', required: true })
    programCourseId: Types.ObjectId;
}

export const CourseRegistrationItemSchema = SchemaFactory.createForClass(CourseRegistrationItem);

@Schema({ _id: false })
export class CourseRegistrationHistorySnapshotItem {
    @Prop({ type: Types.ObjectId, ref: 'ProgramCourse', required: true })
    programCourseId: Types.ObjectId;

    @Prop()
    courseCode?: string;

    @Prop()
    courseTitle?: string;

    @Prop()
    units?: number;

    @Prop()
    category?: string;
}

export const CourseRegistrationHistorySnapshotItemSchema = SchemaFactory.createForClass(CourseRegistrationHistorySnapshotItem);

@Schema({ _id: false })
export class CourseRegistrationHistorySnapshot {
    @Prop({ required: true, default: 0 })
    totalUnits: number;

    @Prop({ required: true, default: 0 })
    courseCount: number;

    @Prop({ type: [CourseRegistrationHistorySnapshotItemSchema], default: [] })
    items: CourseRegistrationHistorySnapshotItem[];

    @Prop({ min: 1 })
    resitLimitSnapshot?: number;
}

export const CourseRegistrationHistorySnapshotSchema = SchemaFactory.createForClass(CourseRegistrationHistorySnapshot);

@Schema({ _id: false })
export class CourseRegistrationHistoryEntry {
    @Prop({ required: true, enum: CourseRegistrationHistoryAction })
    action: CourseRegistrationHistoryAction;

    @Prop({ enum: CourseRegistrationStatus })
    fromStatus?: CourseRegistrationStatus;

    @Prop({ required: true, enum: CourseRegistrationStatus })
    toStatus: CourseRegistrationStatus;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    performedBy?: Types.ObjectId;

    @Prop()
    actorRole?: string;

    @Prop()
    comment?: string;

    @Prop({ required: true, min: 1 })
    submissionVersion: number;

    @Prop({ type: CourseRegistrationHistorySnapshotSchema, required: true })
    snapshot: CourseRegistrationHistorySnapshot;

    @Prop({ type: Date, default: Date.now })
    createdAt: Date;
}

export const CourseRegistrationHistoryEntrySchema = SchemaFactory.createForClass(CourseRegistrationHistoryEntry);

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

    @Prop({ min: 1 })
    resitLimitSnapshot?: number;

    @Prop({ required: true, default: 0 })
    submissionVersion: number;

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

    @Prop({ type: [CourseRegistrationHistoryEntrySchema], default: [] })
    workflowHistory: CourseRegistrationHistoryEntry[];
}

export const CourseRegistrationSchema = SchemaFactory.createForClass(CourseRegistration);

CourseRegistrationSchema.index(
    { studentId: 1, academicSessionId: 1, level: 1, semester: 1 },
    { unique: true, name: 'uniq_student_session_semester_registration' }
);
CourseRegistrationSchema.index({ academicSessionId: 1, programId: 1, level: 1, semester: 1, status: 1 });

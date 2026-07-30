import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AcademicResultDocument = AcademicResult & Document;

export enum AcademicResultAttemptType {
    INITIAL = 'initial',
    RESIT = 'resit',
    REPEAT = 'repeat',
}

export enum AcademicResultWorkflowStatus {
    DRAFT = 'draft',
    SUBMITTED_TO_HOD = 'submitted_to_hod',
    RETURNED_BY_HOD = 'returned_by_hod',
    HOD_APPROVED = 'hod_approved',
    SUBMITTED_TO_PROVOST = 'submitted_to_provost',
    RETURNED_BY_PROVOST = 'returned_by_provost',
    PROVOST_APPROVED = 'provost_approved',
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
}

export enum AcademicResultSpecialStatus {
    NORMAL = 'normal',
    ABSENT = 'absent',
    INCOMPLETE = 'incomplete',
    WITHHELD = 'withheld',
    CANCELLED = 'cancelled',
    MALPRACTICE = 'malpractice',
    DEFERRED = 'deferred',
    ACADEMIC_REVIEW = 'academic_review',
}

@Schema({ _id: false })
export class AcademicResultComponentScore {
    @Prop({ required: true })
    componentOrder: number;

    @Prop({ required: true })
    componentTitle: string;

    @Prop()
    componentType?: string;

    @Prop({ required: true })
    maximumMarkSnapshot: number;

    @Prop({ required: true })
    weightPercentSnapshot: number;

    @Prop()
    rawMark?: number;

    @Prop()
    weightedContribution?: number;

    @Prop({ default: false })
    absent: boolean;

    @Prop({ default: true })
    mandatorySnapshot: boolean;

    @Prop({ default: false })
    absenceAllowedSnapshot: boolean;
}

export const AcademicResultComponentScoreSchema = SchemaFactory.createForClass(AcademicResultComponentScore);

@Schema({ timestamps: true, optimisticConcurrency: true })
export class AcademicResult {
    @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
    studentId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true, index: true })
    academicSessionId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ProgramCourse', required: true, index: true })
    programCourseId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Program', required: true, index: true })
    programId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Department', required: true, index: true })
    departmentId: Types.ObjectId;

    @Prop({ required: true, min: 1 })
    level: number;

    @Prop({ required: true, enum: [1, 2] })
    semester: number;

    @Prop({ type: Types.ObjectId, ref: 'GradeScaleVersion', required: true })
    gradeScaleVersionId: Types.ObjectId;

    @Prop({ required: true, min: 1 })
    attemptNumber: number;

    @Prop({ enum: AcademicResultAttemptType, required: true })
    attemptType: AcademicResultAttemptType;

    @Prop({ type: Types.ObjectId, ref: 'AcademicResult' })
    supersedesResultId?: Types.ObjectId;

    @Prop({ required: true, min: 1 })
    unitsSnapshot: number;

    @Prop({ required: true })
    courseCodeSnapshot: string;

    @Prop({ required: true })
    courseTitleSnapshot: string;

    @Prop({ type: [AcademicResultComponentScoreSchema], default: [] })
    componentScores: AcademicResultComponentScore[];

    @Prop()
    finalScore?: number;

    @Prop()
    gradeLetter?: string;

    @Prop()
    gradePoint?: number;

    @Prop()
    qualityPoints?: number;

    @Prop()
    isPass?: boolean;

    @Prop({ enum: AcademicResultSpecialStatus, default: AcademicResultSpecialStatus.NORMAL })
    specialStatus: AcademicResultSpecialStatus;

    @Prop({ enum: AcademicResultWorkflowStatus, default: AcademicResultWorkflowStatus.DRAFT, index: true })
    workflowStatus: AcademicResultWorkflowStatus;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    createdBy: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    updatedBy?: Types.ObjectId;

    @Prop()
    publishedAt?: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    publishedBy?: Types.ObjectId;

    @Prop()
    lastAmendedAt?: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    lastAmendedBy?: Types.ObjectId;
}

export const AcademicResultSchema = SchemaFactory.createForClass(AcademicResult);
AcademicResultSchema.index({ studentId: 1, programCourseId: 1, academicSessionId: 1, attemptNumber: 1 }, { unique: true, name: 'uniq_student_course_session_attempt' });
AcademicResultSchema.index({ programCourseId: 1, academicSessionId: 1, attemptType: 1, workflowStatus: 1 }, { name: 'result_workflow_context' });
AcademicResultSchema.index({ departmentId: 1, workflowStatus: 1 });
AcademicResultSchema.index({ studentId: 1, academicSessionId: 1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StudentAcademicSessionDocument = StudentAcademicSession & Document;

export enum StudentAcademicSessionStatus {
    CURRENT = 'current',
    COMPLETED = 'completed',
    WITHDRAWN = 'withdrawn',
}

export enum StudentSemesterOutcome {
    IN_PROGRESS = 'in_progress',
    RESULTS_INCOMPLETE = 'results_incomplete',
    PASSED = 'passed',
    RESIT_REQUIRED = 'resit_required',
    RESIT_IN_PROGRESS = 'resit_in_progress',
    REPEAT_CANDIDATE = 'repeat_candidate',
}

export enum StudentAnnualOutcome {
    IN_PROGRESS = 'in_progress',
    RESULTS_INCOMPLETE = 'results_incomplete',
    ELIGIBLE_FOR_PROGRESSION = 'eligible_for_progression',
    REPEAT_YEAR_REQUIRED = 'repeat_year_required',
    REPEATING_YEAR = 'repeating_year',
    ACADEMIC_REVIEW = 'academic_review',
    GRADUATION_REVIEW = 'graduation_review',
}

@Schema({ _id: false })
export class StudentSemesterProgression {
    @Prop({ required: true, enum: [1, 2] })
    semester: number;

    @Prop({ required: true, enum: StudentSemesterOutcome, default: StudentSemesterOutcome.IN_PROGRESS })
    outcome: StudentSemesterOutcome;

    @Prop({ default: 0 })
    registeredCourseCount: number;

    @Prop({ default: 0 })
    failedCourseCount: number;

    @Prop({ min: 1 })
    resitLimitSnapshot?: number;

    @Prop({ type: [Types.ObjectId], ref: 'ProgramCourse', default: [] })
    resitProgramCourseIds: Types.ObjectId[];

    @Prop({ type: [Types.ObjectId], ref: 'ProgramCourse', default: [] })
    unresolvedProgramCourseIds: Types.ObjectId[];

    @Prop()
    decidedAt?: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    decidedBy?: Types.ObjectId;
}

export const StudentSemesterProgressionSchema = SchemaFactory.createForClass(StudentSemesterProgression);

@Schema({ timestamps: true })
export class StudentAcademicSession {
    @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
    studentId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true, index: true })
    academicSessionId: Types.ObjectId;

    @Prop({ required: true, min: 1, default: 1 })
    level: number;

    @Prop({ required: true, min: 1, default: 1 })
    yearAttemptNumber: number;

    @Prop({ default: false })
    isRepeatYear: boolean;

    @Prop({ type: [StudentSemesterProgressionSchema], default: [] })
    semesterProgressions: StudentSemesterProgression[];

    @Prop({ required: true, enum: StudentAnnualOutcome, default: StudentAnnualOutcome.IN_PROGRESS })
    annualOutcome: StudentAnnualOutcome;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession' })
    sourceAcademicSessionId?: Types.ObjectId;

    @Prop()
    annualDecisionAt?: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    annualDecisionBy?: Types.ObjectId;

    @Prop({
        type: String,
        enum: StudentAcademicSessionStatus,
        required: true,
        default: StudentAcademicSessionStatus.CURRENT,
    })
    status: StudentAcademicSessionStatus;

    @Prop({ required: true, default: Date.now })
    startedAt: Date;

    @Prop()
    endedAt?: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    assignedBy?: Types.ObjectId;
}

export const StudentAcademicSessionSchema = SchemaFactory.createForClass(StudentAcademicSession);
StudentAcademicSessionSchema.index({ studentId: 1, academicSessionId: 1 }, { unique: true });

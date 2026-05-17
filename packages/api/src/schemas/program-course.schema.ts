import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProgramCourseDocument = ProgramCourse & Document;

export enum ProgramCourseCategory {
    COMPULSORY = 'compulsory',
    ELECTIVE = 'elective',
}

@Schema({ timestamps: true })
export class ProgramCourse {
    @Prop({ type: Types.ObjectId, ref: 'Course', required: true })
    courseId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Program', required: true })
    programId: Types.ObjectId;

    @Prop({ required: true, min: 1 })
    units: number;

    @Prop({ required: true, min: 1 })
    hours: number;

    @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
    lecturerIds: Types.ObjectId[];

    @Prop({ type: Types.ObjectId, ref: 'User' })
    courseAdvisorId?: Types.ObjectId;

    @Prop({ required: true, min: 1 })
    level: number;

    @Prop({ required: true, enum: [1, 2] })
    semester: number;

    @Prop({ required: true, enum: ProgramCourseCategory })
    category: ProgramCourseCategory;

    @Prop({ default: true })
    active: boolean;
}

export const ProgramCourseSchema = SchemaFactory.createForClass(ProgramCourse);

ProgramCourseSchema.index(
    { courseId: 1, programId: 1, level: 1, semester: 1 },
    { unique: true, name: 'uniq_program_course_assignment' }
);
ProgramCourseSchema.index({ programId: 1, level: 1, semester: 1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StudentAcademicSessionDocument = StudentAcademicSession & Document;

export enum StudentAcademicSessionStatus {
    CURRENT = 'current',
    COMPLETED = 'completed',
    WITHDRAWN = 'withdrawn',
}

@Schema({ timestamps: true })
export class StudentAcademicSession {
    @Prop({ type: Types.ObjectId, ref: 'Student', required: true, index: true })
    studentId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true, index: true })
    academicSessionId: Types.ObjectId;

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

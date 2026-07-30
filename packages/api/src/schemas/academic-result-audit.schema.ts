import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AcademicResultAuditDocument = AcademicResultAudit & Document;

@Schema({ timestamps: true })
export class AcademicResultAudit {
    @Prop({ type: Types.ObjectId, ref: 'AcademicResult', required: true, index: true })
    academicResultId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ProgramCourse', required: true, index: true })
    programCourseId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true, index: true })
    academicSessionId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    actorUserId: Types.ObjectId;

    @Prop({ required: true })
    actorRole: string;

    @Prop({ required: true })
    action: string;

    @Prop()
    previousState?: string;

    @Prop()
    newState?: string;

    @Prop({ maxlength: 2000 })
    comment?: string;

    @Prop({ type: Object })
    before?: Record<string, unknown>;

    @Prop({ type: Object })
    after?: Record<string, unknown>;
}

export const AcademicResultAuditSchema = SchemaFactory.createForClass(AcademicResultAudit);
AcademicResultAuditSchema.index({ academicResultId: 1, createdAt: 1 });

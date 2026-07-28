import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AcademicSessionDocument = AcademicSession & Document;

export enum SessionStatus {
    DRAFT = 'draft',
    OPEN = 'open',
    ONGOING = 'ongoing',
    CLOSED = 'closed',
}

@Schema({ timestamps: true })
export class AcademicSession {
    @Prop({ required: true })
    sessionYear: string;

    @Prop()
    title?: string;

    @Prop({ required: true })
    startDate: Date;

    @Prop({ required: true })
    endDate: Date;

    @Prop({ required: true, enum: SessionStatus, default: SessionStatus.DRAFT })
    status: SessionStatus;

    @Prop()
    description?: string;

    @Prop({ default: false })
    active: boolean;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    provostUserId?: Types.ObjectId;

    @Prop()
    provostAssignedAt?: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    provostAssignedBy?: Types.ObjectId;
}

export const AcademicSessionSchema = SchemaFactory.createForClass(AcademicSession);

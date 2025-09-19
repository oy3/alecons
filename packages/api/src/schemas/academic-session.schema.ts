import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AcademicSessionDocument = AcademicSession & Document;

export enum SessionStatus {
    OPEN = 'open',
    CLOSED = 'closed',
    UPCOMING = 'upcoming',
}

@Schema({ timestamps: true })
export class AcademicSession {
    @Prop({ required: true, unique: true })
    sessionYear: string;

    @Prop({ required: true })
    startDate: Date;

    @Prop({ required: true })
    endDate: Date;

    @Prop({ required: true, enum: SessionStatus, default: SessionStatus.UPCOMING })
    status: SessionStatus;

    @Prop()
    description?: string;

    @Prop({ default: false })
    active: boolean;
}

export const AcademicSessionSchema = SchemaFactory.createForClass(AcademicSession);

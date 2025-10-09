import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProgramDocument = Program & Document;

@Schema({ timestamps: true })
export class Program {
    @Prop({ type: Types.ObjectId, ref: 'Department', required: true })
    departmentId: Types.ObjectId;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true, unique: true })
    code: number;

    @Prop()
    description?: string;

    @Prop({ type: Types.ObjectId, ref: 'ProgramType', required: true })
    programTypeId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'ProgramMode', required: true })
    programModeId: Types.ObjectId;

    @Prop({ required: true })
    durationSemesters: number;

    @Prop({ default: true })
    active: boolean;
}

export const ProgramSchema = SchemaFactory.createForClass(Program);

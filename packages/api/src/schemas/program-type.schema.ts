import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProgramTypeDocument = ProgramType & Document;

@Schema({ timestamps: true })
export class ProgramType {
    @Prop({ required: true, unique: true })
    type: string;

    @Prop()
    description?: string;

    @Prop({ default: true })
    active: boolean;
}

export const ProgramTypeSchema = SchemaFactory.createForClass(ProgramType);

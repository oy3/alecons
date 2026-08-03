import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProgramModeDocument = ProgramMode & Document;

@Schema({ timestamps: true })
export class ProgramMode {
    @Prop({ required: true, unique: true })
    mode: string;

    @Prop()
    description?: string;

    @Prop({ default: true })
    active: boolean;
}

export const ProgramModeSchema = SchemaFactory.createForClass(ProgramMode);

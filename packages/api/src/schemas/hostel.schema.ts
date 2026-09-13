import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type HostelDocument = Hostel & Document;

@Schema({ timestamps: true })
export class Hostel {
    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ required: true, enum: ['male', 'female'], index: true })
    gender: string;

    @Prop({ trim: true, maxlength: 500 })
    description?: string;

    @Prop({ default: true, index: true })
    active: boolean;
}

export const HostelSchema = SchemaFactory.createForClass(Hostel);
HostelSchema.index({ name: 1, gender: 1 }, { unique: true });

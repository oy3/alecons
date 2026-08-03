import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CourseDocument = Course & Document;

@Schema({ timestamps: true })
export class Course {
    @Prop({ required: true, unique: true, trim: true, uppercase: true })
    code: string;

    @Prop({ required: true, trim: true })
    title: string;

    @Prop({ trim: true })
    description?: string;

    @Prop({ default: true })
    active: boolean;
}

export const CourseSchema = SchemaFactory.createForClass(Course);

CourseSchema.index({ code: 1 }, { unique: true });
CourseSchema.index({ title: 1 });

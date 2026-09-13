import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExternalResidentDocument = ExternalResident & Document;

@Schema({ timestamps: true })
export class ExternalResident {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
    userId: Types.ObjectId;

    @Prop({ required: true, unique: true, uppercase: true, trim: true })
    externalResidentNumber: string;

    @Prop({ required: true, enum: ['male', 'female'] })
    gender: string;

    @Prop({ required: true })
    dob: Date;

    @Prop({ required: true, trim: true, maxlength: 500 })
    homeAddress: string;

    @Prop({ required: true, trim: true, maxlength: 80, default: 'pre_degree' })
    category: string;

    @Prop()
    profileImageUrl?: string;

    @Prop()
    profileImageKey?: string;

    @Prop({ default: true })
    active: boolean;
}

export const ExternalResidentSchema = SchemaFactory.createForClass(ExternalResident);
ExternalResidentSchema.index({ category: 1, active: 1, createdAt: -1 });

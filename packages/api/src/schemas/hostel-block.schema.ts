import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HostelBlockDocument = HostelBlock & Document;

@Schema({ timestamps: true })
export class HostelBlock {
    @Prop({ type: Types.ObjectId, ref: 'Hostel', required: true, index: true })
    hostelId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ required: true, enum: ['internal', 'external'], index: true })
    residentType: string;

    @Prop({ required: true, min: 1 })
    allocationOrder: number;

    @Prop({ default: true })
    active: boolean;
}

export const HostelBlockSchema = SchemaFactory.createForClass(HostelBlock);
HostelBlockSchema.index({ hostelId: 1, name: 1 }, { unique: true });
HostelBlockSchema.index({ hostelId: 1, residentType: 1, active: 1, allocationOrder: 1 });

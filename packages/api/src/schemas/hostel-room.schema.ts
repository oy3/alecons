import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HostelRoomDocument = HostelRoom & Document;

@Schema({ timestamps: true })
export class HostelRoom {
    @Prop({ type: Types.ObjectId, ref: 'HostelBlock', required: true, index: true })
    blockId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ required: true, min: 1 })
    capacity: number;

    @Prop({ required: true, min: 1 })
    allocationOrder: number;

    @Prop({ default: true })
    active: boolean;
}

export const HostelRoomSchema = SchemaFactory.createForClass(HostelRoom);
HostelRoomSchema.index({ blockId: 1, name: 1 }, { unique: true });
HostelRoomSchema.index({ blockId: 1, active: 1, allocationOrder: 1 });

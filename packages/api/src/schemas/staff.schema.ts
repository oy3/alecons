import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StaffDocument = Staff & Document;

@Schema({ timestamps: true })
export class Staff {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ required: true, unique: true })
    staffId: string;

    @Prop({ required: true })
    department: string;

    @Prop({ required: true })
    position: string;

    @Prop({ type: Types.ObjectId, ref: 'Role', required: true })
    roleId: Types.ObjectId;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ unique: true, sparse: true, index: true })
    publicVerificationToken?: string;

    @Prop({ default: true })
    publicVerificationEnabled: boolean;
}

export const StaffSchema = SchemaFactory.createForClass(Staff);

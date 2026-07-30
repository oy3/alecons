import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DepartmentDocument = Department & Document;

@Schema({ timestamps: true })
export class Department {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true, unique: true })
    code: string;

    @Prop()
    description?: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    hodUserId?: Types.ObjectId;

    @Prop()
    hodAssignedAt?: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    hodAssignedBy?: Types.ObjectId;

    @Prop({ default: true })
    active: boolean;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);

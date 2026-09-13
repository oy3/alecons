import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AccommodationAssignmentDocument = AccommodationAssignment & Document;

@Schema({ timestamps: true, optimisticConcurrency: true })
export class AccommodationAssignment {
    @Prop({ type: Types.ObjectId, ref: 'AccommodationApplication', required: true })
    accommodationApplicationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'AcademicSession', required: true, index: true })
    academicSessionId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Hostel', required: true })
    hostelId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'HostelBlock', required: true })
    blockId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'HostelRoom', required: true })
    roomId: Types.ObjectId;

    @Prop({ required: true, min: 1 })
    slotNumber: number;

    @Prop({ required: true, enum: ['active', 'transferred', 'cancelled'], default: 'active' })
    status: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    allocatedBy?: Types.ObjectId;

    @Prop({ required: true, enum: ['automatic', 'manual'], default: 'automatic' })
    allocationSource: string;

    @Prop({ required: true })
    allocatedAt: Date;

    @Prop({ maxlength: 500 })
    note?: string;

    @Prop()
    allocationSlipUrl?: string;

    @Prop({ select: false })
    allocationSlipKey?: string;
}

export const AccommodationAssignmentSchema = SchemaFactory.createForClass(AccommodationAssignment);
AccommodationAssignmentSchema.index(
    { accommodationApplicationId: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: 'active' }, name: 'uniq_active_assignment_per_application' },
);
AccommodationAssignmentSchema.index(
    { academicSessionId: 1, roomId: 1, slotNumber: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: 'active' }, name: 'uniq_active_room_slot_per_session' },
);

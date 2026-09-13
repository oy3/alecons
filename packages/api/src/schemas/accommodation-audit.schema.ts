import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AccommodationAuditDocument = AccommodationAudit & Document;

@Schema({ timestamps: true })
export class AccommodationAudit {
    @Prop({ type: Types.ObjectId, ref: 'AccommodationApplication', index: true })
    accommodationApplicationId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    actorId?: Types.ObjectId;

    @Prop({ required: true, trim: true, index: true })
    action: string;

    @Prop({ required: true, enum: ['public', 'external', 'student', 'staff', 'system'] })
    actorType: string;

    @Prop({ type: Object, default: {} })
    metadata: Record<string, unknown>;
}

export const AccommodationAuditSchema = SchemaFactory.createForClass(AccommodationAudit);
AccommodationAuditSchema.index({ accommodationApplicationId: 1, createdAt: -1 });

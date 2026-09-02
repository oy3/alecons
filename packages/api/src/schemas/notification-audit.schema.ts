import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type NotificationAuditDocument = NotificationAudit & Document;

@Schema({ timestamps: true })
export class NotificationAudit {
    @Prop({ type: Types.ObjectId, ref: 'Notification', required: true, index: true })
    notificationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    actorUserId?: Types.ObjectId;

    @Prop({ required: true, trim: true })
    actorRole: string;

    @Prop({ required: true, trim: true })
    action: string;

    @Prop()
    previousState?: string;

    @Prop()
    newState?: string;

    @Prop({ maxlength: 1000 })
    comment?: string;

    @Prop({ type: MongooseSchema.Types.Mixed })
    metadata?: Record<string, unknown>;
}

export const NotificationAuditSchema = SchemaFactory.createForClass(NotificationAudit);
NotificationAuditSchema.index({ notificationId: 1, createdAt: 1 });

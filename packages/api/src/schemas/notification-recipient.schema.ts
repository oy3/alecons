import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationRecipientDocument = NotificationRecipient & Document;

@Schema({ timestamps: true })
export class NotificationRecipient {
    @Prop({ type: Types.ObjectId, ref: 'Notification', required: true, index: true })
    notificationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ required: true, trim: true })
    recipientRoleSnapshot: string;

    @Prop({ required: true, default: Date.now, index: true })
    deliveredAt: Date;

    @Prop({ default: null, index: true })
    readAt: Date | null;
}

export const NotificationRecipientSchema = SchemaFactory.createForClass(NotificationRecipient);
NotificationRecipientSchema.index(
    { notificationId: 1, userId: 1 },
    { unique: true, name: 'uniq_notification_recipient' },
);
NotificationRecipientSchema.index({ userId: 1, deliveredAt: -1 });
NotificationRecipientSchema.index({ userId: 1, readAt: 1, deliveredAt: -1 });


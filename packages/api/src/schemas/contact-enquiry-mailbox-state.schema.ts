import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ContactEnquiryMailboxStateDocument = ContactEnquiryMailboxState & Document;

@Schema({ timestamps: true })
export class ContactEnquiryMailboxState {
  @Prop({ required: true, lowercase: true, trim: true })
  mailbox: string;

  @Prop({ trim: true })
  historyId?: string;

  @Prop()
  watchExpiration?: Date;

  @Prop()
  lastSyncedAt?: Date;

  @Prop()
  lastRecoveryAt?: Date;

  @Prop()
  leaseUntil?: Date;

  @Prop({ trim: true, maxlength: 120 })
  leaseOwner?: string;

  @Prop({ maxlength: 1000 })
  lastError?: string;
}

export const ContactEnquiryMailboxStateSchema = SchemaFactory.createForClass(ContactEnquiryMailboxState);
ContactEnquiryMailboxStateSchema.index({ mailbox: 1 }, { unique: true, name: 'uniq_contact_mailbox_state' });

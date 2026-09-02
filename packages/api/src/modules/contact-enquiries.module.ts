import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MongooseModule } from '@nestjs/mongoose';
import { GmailPubSubWebhookController } from '../controllers/gmail-pubsub-webhook.controller';
import { PublicContactEnquiriesController } from '../controllers/public-contact-enquiries.controller';
import { StaffContactEnquiriesController } from '../controllers/staff-contact-enquiries.controller';
import { ContactEnquiry, ContactEnquirySchema } from '../schemas/contact-enquiry.schema';
import { ContactEnquiryActivity, ContactEnquiryActivitySchema } from '../schemas/contact-enquiry-activity.schema';
import { ContactEnquiryMessage, ContactEnquiryMessageSchema } from '../schemas/contact-enquiry-message.schema';
import {
  ContactEnquiryInboundReceipt,
  ContactEnquiryInboundReceiptSchema,
} from '../schemas/contact-enquiry-inbound-receipt.schema';
import {
  ContactEnquiryMailboxState,
  ContactEnquiryMailboxStateSchema,
} from '../schemas/contact-enquiry-mailbox-state.schema';
import { Role, RoleSchema } from '../schemas/role.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { ContactEnquiryAccessService } from '../services/contact-enquiry-access.service';
import { ContactEnquiriesService } from '../services/contact-enquiries.service';
import { EmailService } from '../services/email.service';
import { ContentSanitizationService } from '../services/content-sanitization.service';
import { ContactEnquiryGmailService } from '../services/contact-enquiry-gmail.service';
import { ContactEnquiryInboundService } from '../services/contact-enquiry-inbound.service';
import {
  ContactEnquiryGmailScheduleService,
  ContactEnquiryInboundProcessor,
  ContactEnquiryInboundQueueService,
} from '../services/contact-enquiry-inbound.processor';
import { GmailPubSubAuthGuard } from '../guards/gmail-pubsub-auth.guard';
import { NotificationsModule } from './notifications.module';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: 'contact-enquiry-inbound' }),
    MongooseModule.forFeature([
      { name: ContactEnquiry.name, schema: ContactEnquirySchema },
      { name: ContactEnquiryMessage.name, schema: ContactEnquiryMessageSchema },
      { name: ContactEnquiryActivity.name, schema: ContactEnquiryActivitySchema },
      { name: ContactEnquiryInboundReceipt.name, schema: ContactEnquiryInboundReceiptSchema },
      { name: ContactEnquiryMailboxState.name, schema: ContactEnquiryMailboxStateSchema },
      { name: User.name, schema: UserSchema },
      { name: Staff.name, schema: StaffSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  controllers: [
    PublicContactEnquiriesController,
    StaffContactEnquiriesController,
    GmailPubSubWebhookController,
  ],
  providers: [
    ContactEnquiriesService,
    ContactEnquiryAccessService,
    ContactEnquiryGmailService,
    ContactEnquiryInboundService,
    ContactEnquiryInboundQueueService,
    ContactEnquiryInboundProcessor,
    ContactEnquiryGmailScheduleService,
    GmailPubSubAuthGuard,
    ContentSanitizationService,
    EmailService,
  ],
})
export class ContactEnquiriesModule {}

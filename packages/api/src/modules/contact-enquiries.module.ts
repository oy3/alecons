import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PublicContactEnquiriesController } from '../controllers/public-contact-enquiries.controller';
import { StaffContactEnquiriesController } from '../controllers/staff-contact-enquiries.controller';
import { ContactEnquiry, ContactEnquirySchema } from '../schemas/contact-enquiry.schema';
import { ContactEnquiryActivity, ContactEnquiryActivitySchema } from '../schemas/contact-enquiry-activity.schema';
import { ContactEnquiryMessage, ContactEnquiryMessageSchema } from '../schemas/contact-enquiry-message.schema';
import { Role, RoleSchema } from '../schemas/role.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { ContactEnquiryAccessService } from '../services/contact-enquiry-access.service';
import { ContactEnquiriesService } from '../services/contact-enquiries.service';
import { EmailService } from '../services/email.service';
import { NotificationsModule } from './notifications.module';

@Module({
  imports: [
    NotificationsModule,
    MongooseModule.forFeature([
      { name: ContactEnquiry.name, schema: ContactEnquirySchema },
      { name: ContactEnquiryMessage.name, schema: ContactEnquiryMessageSchema },
      { name: ContactEnquiryActivity.name, schema: ContactEnquiryActivitySchema },
      { name: User.name, schema: UserSchema },
      { name: Staff.name, schema: StaffSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  controllers: [PublicContactEnquiriesController, StaffContactEnquiriesController],
  providers: [ContactEnquiriesService, ContactEnquiryAccessService, EmailService],
})
export class ContactEnquiriesModule {}

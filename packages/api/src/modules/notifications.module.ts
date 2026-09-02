import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsController } from '../controllers/notifications.controller';
import { StaffNotificationsController } from '../controllers/staff-notifications.controller';
import { Notification, NotificationSchema } from '../schemas/notification.schema';
import { NotificationRecipient, NotificationRecipientSchema } from '../schemas/notification-recipient.schema';
import { NotificationAudit, NotificationAuditSchema } from '../schemas/notification-audit.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import { Role, RoleSchema } from '../schemas/role.schema';
import { Student, StudentSchema } from '../schemas/student.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { NotificationsService } from '../services/notifications.service';
import {
    NotificationDeliveryProcessor,
    NotificationDeliveryService,
    NotificationScheduleService,
} from '../services/notification-delivery.service';
import { ContentSanitizationService } from '../services/content-sanitization.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Notification.name, schema: NotificationSchema },
            { name: NotificationRecipient.name, schema: NotificationRecipientSchema },
            { name: NotificationAudit.name, schema: NotificationAuditSchema },
            { name: User.name, schema: UserSchema },
            { name: Staff.name, schema: StaffSchema },
            { name: Role.name, schema: RoleSchema },
            { name: Student.name, schema: StudentSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: Application.name, schema: ApplicationSchema },
        ]),
        BullModule.registerQueue({ name: 'notification-delivery' }),
    ],
    controllers: [NotificationsController, StaffNotificationsController],
    providers: [
        NotificationsService,
        NotificationDeliveryService,
        NotificationDeliveryProcessor,
        NotificationScheduleService,
        ContentSanitizationService,
    ],
    exports: [NotificationsService, NotificationDeliveryService],
})
export class NotificationsModule {}

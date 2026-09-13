import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { PublicAccommodationController, StaffAccommodationController } from '../controllers/accommodation.controller';
import { AccommodationService } from '../services/accommodation.service';
import { AccommodationApplication, AccommodationApplicationSchema } from '../schemas/accommodation-application.schema';
import { ExternalResident, ExternalResidentSchema } from '../schemas/external-resident.schema';
import { Hostel, HostelSchema } from '../schemas/hostel.schema';
import { HostelBlock, HostelBlockSchema } from '../schemas/hostel-block.schema';
import { HostelRoom, HostelRoomSchema } from '../schemas/hostel-room.schema';
import { AccommodationAssignment, AccommodationAssignmentSchema } from '../schemas/accommodation-assignment.schema';
import { AccommodationAudit, AccommodationAuditSchema } from '../schemas/accommodation-audit.schema';
import { SessionControl, SessionControlSchema } from '../schemas/session-control.schema';
import { AcademicSession, AcademicSessionSchema } from '../schemas/academic-session.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { PaymentTransaction, PaymentTransactionSchema } from '../schemas/payment-transaction.schema';
import { PaymentsModule } from '../payments/payments.module';
import { UploadModule } from './upload.module';
import { UserManagementModule } from './user-management.module';
import { EmailService } from '../services/email.service';
import { StudentModule } from './student.module';

@Module({
    imports: [
        PaymentsModule,
        StudentModule,
        UploadModule,
        UserManagementModule,
        MulterModule.register({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }),
        MongooseModule.forFeature([
            { name: AccommodationApplication.name, schema: AccommodationApplicationSchema },
            { name: ExternalResident.name, schema: ExternalResidentSchema },
            { name: Hostel.name, schema: HostelSchema },
            { name: HostelBlock.name, schema: HostelBlockSchema },
            { name: HostelRoom.name, schema: HostelRoomSchema },
            { name: AccommodationAssignment.name, schema: AccommodationAssignmentSchema },
            { name: AccommodationAudit.name, schema: AccommodationAuditSchema },
            { name: SessionControl.name, schema: SessionControlSchema },
            { name: AcademicSession.name, schema: AcademicSessionSchema },
            { name: User.name, schema: UserSchema },
            { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
        ]),
    ],
    controllers: [PublicAccommodationController, StaffAccommodationController],
    providers: [AccommodationService, EmailService],
    exports: [AccommodationService],
})
export class AccommodationModule {}

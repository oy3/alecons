import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AcademicSessionsController } from '../controllers/academic-sessions.controller';
import { StudentAcademicSessionsController } from '../controllers/student-academic-sessions.controller';
import { AcademicSessionsService } from '../services/academic-sessions.service';
import { SessionControlsService } from '../services/session-controls.service';
import { EmailService } from '../services/email.service';
import { AcademicSession, AcademicSessionSchema } from '../schemas/academic-session.schema';
import { SessionControl, SessionControlSchema } from '../schemas/session-control.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { Student, StudentSchema } from '../schemas/student.schema';
import { StudentAcademicSession, StudentAcademicSessionSchema } from '../schemas/student-academic-session.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import { AcademicResultsModule } from './academic-results.module';

@Module({
    imports: [
        AcademicResultsModule,
        MongooseModule.forFeature([
            { name: AcademicSession.name, schema: AcademicSessionSchema },
            { name: SessionControl.name, schema: SessionControlSchema },
            { name: Payment.name, schema: PaymentSchema },
            { name: Application.name, schema: ApplicationSchema },
            { name: Student.name, schema: StudentSchema },
            { name: StudentAcademicSession.name, schema: StudentAcademicSessionSchema },
            { name: User.name, schema: UserSchema },
            { name: Staff.name, schema: StaffSchema },
        ]),
    ],
    controllers: [AcademicSessionsController, StudentAcademicSessionsController],
    providers: [AcademicSessionsService, SessionControlsService, EmailService],
    exports: [AcademicSessionsService, SessionControlsService],
})
export class AcademicSessionsModule { }

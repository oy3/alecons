import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController, StaffPaymentsController } from './payments.controller';
import { StudentPaymentsController } from './student-payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { StudentPayment, StudentPaymentSchema } from '../schemas/student-payment.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { Student, StudentSchema } from '../schemas/student.schema';
import { AcademicSession, AcademicSessionSchema } from '../schemas/academic-session.schema';
import { MatriculationService } from '../services/matriculation.service';
import { EmailService } from '../services/email.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Payment.name, schema: PaymentSchema },
            { name: StudentPayment.name, schema: StudentPaymentSchema },
            { name: Application.name, schema: ApplicationSchema },
            { name: User.name, schema: UserSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: Student.name, schema: StudentSchema },
            { name: AcademicSession.name, schema: AcademicSessionSchema },
        ]),
    ],
    controllers: [PaymentsController, StaffPaymentsController, StudentPaymentsController],
    providers: [PaymentsService, MatriculationService, EmailService],
    exports: [PaymentsService],
})
export class PaymentsModule { }

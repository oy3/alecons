import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController, StaffPaymentsController, PaystackWebhookController } from './payments.controller';
import { StudentPaymentsController } from './student-payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { StudentPayment, StudentPaymentSchema } from '../schemas/student-payment.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { Student, StudentSchema } from '../schemas/student.schema';
import { TenancyAgreement, TenancyAgreementSchema } from '../schemas/tenancy-agreement.schema';
import { AcademicSession, AcademicSessionSchema } from '../schemas/academic-session.schema';
import { StudentAcademicSession, StudentAcademicSessionSchema } from '../schemas/student-academic-session.schema';
import { PaymentDestinationAccount, PaymentDestinationAccountSchema } from '../schemas/payment-destination-account.schema';
import { MatriculationService } from '../services/matriculation.service';
import { EmailService } from '../services/email.service';
import { UploadModule } from '../modules/upload.module';
import { PaymentRemittanceService } from './payment-remittance.service';
import { PaymentsReconciliationScheduler } from './payments-reconciliation.scheduler';

@Module({
    imports: [
        UploadModule,
        MongooseModule.forFeature([
            { name: Payment.name, schema: PaymentSchema },
            { name: StudentPayment.name, schema: StudentPaymentSchema },
            { name: Application.name, schema: ApplicationSchema },
            { name: User.name, schema: UserSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: Student.name, schema: StudentSchema },
            { name: TenancyAgreement.name, schema: TenancyAgreementSchema },
            { name: AcademicSession.name, schema: AcademicSessionSchema },
            { name: StudentAcademicSession.name, schema: StudentAcademicSessionSchema },
            { name: PaymentDestinationAccount.name, schema: PaymentDestinationAccountSchema },
        ]),
    ],
    controllers: [PaymentsController, StaffPaymentsController, StudentPaymentsController, PaystackWebhookController],
    providers: [
        PaymentsService,
        PaymentRemittanceService,
        PaymentsReconciliationScheduler,
        MatriculationService,
        EmailService,
    ],
    exports: [PaymentsService, PaymentRemittanceService],
})
export class PaymentsModule { }

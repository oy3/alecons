import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { StudentPayment, StudentPaymentSchema } from '../schemas/student-payment.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Payment.name, schema: PaymentSchema },
            { name: StudentPayment.name, schema: StudentPaymentSchema },
            { name: Application.name, schema: ApplicationSchema },
        ]),
    ],
    controllers: [PaymentsController],
    providers: [PaymentsService],
    exports: [PaymentsService],
})
export class PaymentsModule {}

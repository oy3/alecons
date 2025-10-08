import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AcademicSessionsController } from '../controllers/academic-sessions.controller';
import { AcademicSessionsService } from '../services/academic-sessions.service';
import { SessionControlsService } from '../services/session-controls.service';
import { AcademicSession, AcademicSessionSchema } from '../schemas/academic-session.schema';
import { SessionControl, SessionControlSchema } from '../schemas/session-control.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: AcademicSession.name, schema: AcademicSessionSchema },
            { name: SessionControl.name, schema: SessionControlSchema },
            { name: Payment.name, schema: PaymentSchema },
        ]),
    ],
    controllers: [AcademicSessionsController],
    providers: [AcademicSessionsService, SessionControlsService],
    exports: [AcademicSessionsService, SessionControlsService],
})
export class AcademicSessionsModule { }
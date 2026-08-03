import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffDashboardController } from '../controllers/staff-dashboard.controller';
import { StaffDashboardService } from '../services/staff-dashboard.service';
import { AcademicSession, AcademicSessionSchema } from '../schemas/academic-session.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { StudentPayment, StudentPaymentSchema } from '../schemas/student-payment.schema';
import { User, UserSchema } from '../schemas/user.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Application.name, schema: ApplicationSchema },
            { name: User.name, schema: UserSchema },
            { name: AcademicSession.name, schema: AcademicSessionSchema },
            { name: StudentPayment.name, schema: StudentPaymentSchema },
        ]),
    ],
    controllers: [StaffDashboardController],
    providers: [StaffDashboardService],
})
export class StaffDashboardModule { }

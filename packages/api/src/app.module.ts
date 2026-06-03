import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { MulterModule } from '@nestjs/platform-express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProgramsModule } from './programs/programs.module';
import { PaymentsModule } from './payments/payments.module';
import { UploadModule } from './modules/upload.module';
import { AcademicSessionsModule } from './modules/academic-sessions.module';
import { DepartmentsModule } from './modules/departments.module';
import { ExamModule } from './modules/exam.module';
import { StaffDashboardModule } from './modules/staff-dashboard.module';
import { UserManagementModule } from './modules/user-management.module';
import { StudentModule } from './modules/student.module';
import { CourseRegistrationManagementModule } from './modules/course-registration-management.module';
import { CoursesModule } from './courses/courses.module';
import { StaffApplicationsController } from './controllers/staff-applications.controller';
import { ExamResultsController } from './controllers/exam-results.controller';
import { Application, ApplicationSchema } from './schemas/application.schema';
import { Program, ProgramSchema } from './schemas/program.schema';
import { ProgramType, ProgramTypeSchema } from './schemas/program-type.schema';
import { AcademicSession, AcademicSessionSchema } from './schemas/academic-session.schema';
import { User, UserSchema } from './schemas/user.schema';
import { Student, StudentSchema } from './schemas/student.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { StudentPayment, StudentPaymentSchema } from './schemas/student-payment.schema';
import { ExamAttempt, ExamAttemptSchema } from './schemas/exam-attempt.schema';
import { ExamResult, ExamResultSchema } from './schemas/exam-result.schema';
import { ExamPassword, ExamPasswordSchema } from './schemas/exam-password.schema';
import { EmailService } from './services/email.service';
import { MatriculationService } from './services/matriculation.service';
import { ContentSanitizationService } from './services/content-sanitization.service';
import { AdmissionLetterPdfService } from './services/admission-letter-pdf.service';
import * as multer from 'multer';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
        }),
        MongooseModule.forRoot(process.env.DATABASE_URL),
        MongooseModule.forFeature([
            { name: Application.name, schema: ApplicationSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: ProgramType.name, schema: ProgramTypeSchema },
            { name: AcademicSession.name, schema: AcademicSessionSchema },
            { name: User.name, schema: UserSchema },
            { name: Student.name, schema: StudentSchema },
            { name: Payment.name, schema: PaymentSchema },
            { name: StudentPayment.name, schema: StudentPaymentSchema },
            { name: ExamAttempt.name, schema: ExamAttemptSchema },
            { name: ExamResult.name, schema: ExamResultSchema },
            { name: ExamPassword.name, schema: ExamPasswordSchema },
        ]),
        ThrottlerModule.forRoot([
            {
                ttl: 60000,
                limit: 100,
            },
        ]),
        BullModule.forRoot({
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD,
            },
        }),
        ScheduleModule.forRoot(),
        MulterModule.register({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 5 * 1024 * 1024,
            },
        }),
        AuthModule,
        ProgramsModule,
        PaymentsModule,
        UploadModule,
        AcademicSessionsModule,
        DepartmentsModule,
        CoursesModule,
        ExamModule,
        StaffDashboardModule,
        UserManagementModule,
        StudentModule,
        CourseRegistrationManagementModule,
    ],
    controllers: [AppController, StaffApplicationsController, ExamResultsController],
    providers: [AppService, EmailService, MatriculationService, ContentSanitizationService, AdmissionLetterPdfService],
})
export class AppModule { }

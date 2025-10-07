import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ProgramsModule } from './programs/programs.module';
import { PaymentsModule } from './payments/payments.module';
import { UploadModule } from './modules/upload.module';
import { StaffApplicationsController } from './controllers/staff-applications.controller';
import { Application, ApplicationSchema } from './schemas/application.schema';
import { Program, ProgramSchema } from './schemas/program.schema';
import { User, UserSchema } from './schemas/user.schema';
import { EmailService } from './services/email.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        MongooseModule.forRoot(process.env.DATABASE_URL),
        MongooseModule.forFeature([
            { name: Application.name, schema: ApplicationSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: User.name, schema: UserSchema }
        ]),
        ThrottlerModule.forRoot([
            {
                ttl: 60000,
                limit: 100,
            },
        ]),
        AuthModule,
        ProgramsModule,
        PaymentsModule,
        UploadModule,
    ],
    controllers: [AppController, StaffApplicationsController],
    providers: [AppService, EmailService],
})
export class AppModule { }

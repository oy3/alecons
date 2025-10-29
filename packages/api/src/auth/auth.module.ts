import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { AuthController } from './auth.controller';
import { ApplicationNumberController } from '../controllers/application-number.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailService } from '../services/email.service';
import { ApplicationNumberService } from '../services/application-number.service';
import { ApplicationEligibilityService } from '../services/application-eligibility.service';
import { User, UserSchema } from '../schemas/user.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { ProgramType, ProgramTypeSchema } from '../schemas/program-type.schema';
import { ProgramMode, ProgramModeSchema } from '../schemas/program-mode.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import { Role, RoleSchema } from '../schemas/role.schema';
import { AcademicSession, AcademicSessionSchema } from '../schemas/academic-session.schema';
import { SessionControl, SessionControlSchema } from '../schemas/session-control.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Application.name, schema: ApplicationSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: ProgramType.name, schema: ProgramTypeSchema },
            { name: ProgramMode.name, schema: ProgramModeSchema },
            { name: Staff.name, schema: StaffSchema },
            { name: Role.name, schema: RoleSchema },
            { name: AcademicSession.name, schema: AcademicSessionSchema },
            { name: SessionControl.name, schema: SessionControlSchema },
        ]),
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService): Promise<JwtModuleOptions> => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.get<string>('JWT_EXPIRATION') || '7d'
                } as jwt.SignOptions,
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController, ApplicationNumberController],
    providers: [AuthService, JwtStrategy, EmailService, ApplicationNumberService, ApplicationEligibilityService],
    exports: [AuthService, JwtStrategy],
})
export class AuthModule { }
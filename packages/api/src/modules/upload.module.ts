import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { ApplicationUploadController } from '../controllers/application-upload.controller';
import { UploadService } from '../services/upload.service';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { ProgramType, ProgramTypeSchema } from '../schemas/program-type.schema';
import { ProgramMode, ProgramModeSchema } from '../schemas/program-mode.schema';
import { AcademicSessionsModule } from './academic-sessions.module';
import * as multer from 'multer';

@Module({
    imports: [
        ConfigModule,
        AcademicSessionsModule,
        MongooseModule.forFeature([
            { name: Application.name, schema: ApplicationSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: ProgramType.name, schema: ProgramTypeSchema },
            { name: ProgramMode.name, schema: ProgramModeSchema }
        ]),
        MulterModule.register({
            // Configure multer for memory storage (files will be uploaded to Spaces)
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB limit
            },
        }),
    ],
    controllers: [ApplicationUploadController],
    providers: [UploadService],
    exports: [UploadService],
})
export class UploadModule { }
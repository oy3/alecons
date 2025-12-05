import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentController } from '../controllers/student.controller';
import { StudentService } from '../services/student.service';
import { TenancyAgreementService } from '../services/tenancy-agreement.service';
import { UploadService } from '../services/upload.service';
import { Student, StudentSchema } from '../schemas/student.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { TenancyAgreement, TenancyAgreementSchema } from '../schemas/tenancy-agreement.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Student.name, schema: StudentSchema },
            { name: User.name, schema: UserSchema },
            { name: Application.name, schema: ApplicationSchema },
            { name: TenancyAgreement.name, schema: TenancyAgreementSchema },
        ])
    ],
    controllers: [StudentController],
    providers: [StudentService, TenancyAgreementService, UploadService],
    exports: [StudentService, TenancyAgreementService] // Export so other modules can use them
})
export class StudentModule { }
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserManagementController } from '../controllers/user-management.controller';
import { PublicVerificationController } from '../controllers/public-verification.controller';
import { RolesController } from '../controllers/roles.controller';
import { UserManagementService } from '../services/user-management.service';
import { PublicVerificationService } from '../services/public-verification.service';
import { RolesService } from '../services/roles.service';
import { RoleSeederService } from '../services/role-seeder.service';
import { User, UserSchema } from '../schemas/user.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import { Role, RoleSchema } from '../schemas/role.schema';
import { Student, StudentSchema } from '../schemas/student.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { Department, DepartmentSchema } from '../schemas/department.schema';
import { ExternalResident, ExternalResidentSchema } from '../schemas/external-resident.schema';
import { EmailService } from '../services/email.service';
import { UploadModule } from './upload.module';

@Module({
    imports: [
        UploadModule,
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Staff.name, schema: StaffSchema },
            { name: Role.name, schema: RoleSchema },
            { name: Student.name, schema: StudentSchema },
            { name: Application.name, schema: ApplicationSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: Department.name, schema: DepartmentSchema },
            { name: ExternalResident.name, schema: ExternalResidentSchema }
        ])
    ],
    controllers: [UserManagementController, PublicVerificationController, RolesController],
    providers: [UserManagementService, PublicVerificationService, RolesService, RoleSeederService, EmailService],
    exports: [UserManagementService, PublicVerificationService, RolesService]
})
export class UserManagementModule { }

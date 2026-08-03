import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IdCardController } from '../controllers/id-card.controller';
import { IdCardService } from '../services/id-card.service';
import { IdCardLog, IdCardLogSchema } from '../schemas/id-card-log.schema';
import { Student, StudentSchema } from '../schemas/student.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { ProgramType, ProgramTypeSchema } from '../schemas/program-type.schema';
import { ProgramMode, ProgramModeSchema } from '../schemas/program-mode.schema';
import { AcademicSession, AcademicSessionSchema } from '../schemas/academic-session.schema';
import { Department, DepartmentSchema } from '../schemas/department.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: IdCardLog.name, schema: IdCardLogSchema },
            { name: Student.name, schema: StudentSchema },
            { name: Staff.name, schema: StaffSchema },
            { name: User.name, schema: UserSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: ProgramType.name, schema: ProgramTypeSchema },
            { name: ProgramMode.name, schema: ProgramModeSchema },
            { name: AcademicSession.name, schema: AcademicSessionSchema },
            { name: Department.name, schema: DepartmentSchema },
        ]),
    ],
    controllers: [IdCardController],
    providers: [IdCardService],
    exports: [IdCardService],
})
export class IdCardModule { }

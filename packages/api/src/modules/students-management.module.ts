import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StaffStudentsController } from '../controllers/staff-students.controller';
import { StaffStudentsService } from '../services/staff-students.service';
import { Student, StudentSchema } from '../schemas/student.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { ProgramType, ProgramTypeSchema } from '../schemas/program-type.schema';
import { ProgramMode, ProgramModeSchema } from '../schemas/program-mode.schema';
import { AcademicSession, AcademicSessionSchema } from '../schemas/academic-session.schema';
import { StudentAcademicSession, StudentAcademicSessionSchema } from '../schemas/student-academic-session.schema';
import { StudentPayment, StudentPaymentSchema } from '../schemas/student-payment.schema';
import { CourseRegistration, CourseRegistrationSchema } from '../schemas/course-registration.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Student.name, schema: StudentSchema },
            { name: User.name, schema: UserSchema },
            { name: Application.name, schema: ApplicationSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: ProgramType.name, schema: ProgramTypeSchema },
            { name: ProgramMode.name, schema: ProgramModeSchema },
            { name: AcademicSession.name, schema: AcademicSessionSchema },
            { name: StudentAcademicSession.name, schema: StudentAcademicSessionSchema },
            { name: StudentPayment.name, schema: StudentPaymentSchema },
            { name: CourseRegistration.name, schema: CourseRegistrationSchema },
        ]),
    ],
    controllers: [StaffStudentsController],
    providers: [StaffStudentsService],
})
export class StudentsManagementModule {}

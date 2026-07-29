import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentController } from '../controllers/student.controller';
import { StudentCourseRegistrationController } from '../controllers/student-course-registration.controller';
import { StudentService } from '../services/student.service';
import { CourseRegistrationService } from '../services/course-registration.service';
import { TenancyAgreementService } from '../services/tenancy-agreement.service';
import { UploadService } from '../services/upload.service';
import { Student, StudentSchema } from '../schemas/student.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { ProgramCourse, ProgramCourseSchema } from '../schemas/program-course.schema';
import { CourseRegistration, CourseRegistrationSchema } from '../schemas/course-registration.schema';
import { AcademicSession, AcademicSessionSchema } from '../schemas/academic-session.schema';
import { SessionControl, SessionControlSchema } from '../schemas/session-control.schema';
import { TenancyAgreement, TenancyAgreementSchema } from '../schemas/tenancy-agreement.schema';
import { StudentAcademicSession, StudentAcademicSessionSchema } from '../schemas/student-academic-session.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Student.name, schema: StudentSchema },
            { name: User.name, schema: UserSchema },
            { name: Application.name, schema: ApplicationSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: ProgramCourse.name, schema: ProgramCourseSchema },
            { name: CourseRegistration.name, schema: CourseRegistrationSchema },
            { name: AcademicSession.name, schema: AcademicSessionSchema },
            { name: SessionControl.name, schema: SessionControlSchema },
            { name: TenancyAgreement.name, schema: TenancyAgreementSchema },
            { name: StudentAcademicSession.name, schema: StudentAcademicSessionSchema },
        ])
    ],
    controllers: [StudentController, StudentCourseRegistrationController],
    providers: [StudentService, CourseRegistrationService, TenancyAgreementService, UploadService],
    exports: [StudentService, TenancyAgreementService, CourseRegistrationService] // Export so other modules can use them
})
export class StudentModule { }

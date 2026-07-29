import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AcademicResult, AcademicResultSchema } from '../schemas/academic-result.schema';
import { AcademicResultAudit, AcademicResultAuditSchema } from '../schemas/academic-result-audit.schema';
import { GradeScaleVersion, GradeScaleVersionSchema } from '../schemas/grade-scale-version.schema';
import { StudentAcademicSummary, StudentAcademicSummarySchema } from '../schemas/student-academic-summary.schema';
import { AcademicSession, AcademicSessionSchema } from '../schemas/academic-session.schema';
import { Course, CourseSchema } from '../schemas/course.schema';
import { Department, DepartmentSchema } from '../schemas/department.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { ProgramCourse, ProgramCourseSchema } from '../schemas/program-course.schema';
import { CourseRegistration, CourseRegistrationSchema } from '../schemas/course-registration.schema';
import { Student, StudentSchema } from '../schemas/student.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Role, RoleSchema } from '../schemas/role.schema';
import { StudentAcademicSession, StudentAcademicSessionSchema } from '../schemas/student-academic-session.schema';
import { StudentAcademicResultsController } from '../controllers/student-academic-results.controller';
import { StudentAcademicResultsService } from '../services/student-academic-results.service';
import { AcademicResultsService } from '../services/academic-results.service';
import { AcademicResultsController } from '../controllers/academic-results.controller';
import { StudentProgressionService } from '../services/student-progression.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: AcademicResult.name, schema: AcademicResultSchema },
            { name: AcademicResultAudit.name, schema: AcademicResultAuditSchema },
            { name: GradeScaleVersion.name, schema: GradeScaleVersionSchema },
            { name: StudentAcademicSummary.name, schema: StudentAcademicSummarySchema },
            { name: AcademicSession.name, schema: AcademicSessionSchema },
            { name: Course.name, schema: CourseSchema },
            { name: Department.name, schema: DepartmentSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: ProgramCourse.name, schema: ProgramCourseSchema },
            { name: CourseRegistration.name, schema: CourseRegistrationSchema },
            { name: Student.name, schema: StudentSchema },
            { name: Staff.name, schema: StaffSchema },
            { name: User.name, schema: UserSchema },
            { name: Role.name, schema: RoleSchema },
            { name: StudentAcademicSession.name, schema: StudentAcademicSessionSchema },
        ]),
    ],
    controllers: [StudentAcademicResultsController, AcademicResultsController],
    providers: [StudentAcademicResultsService, AcademicResultsService, StudentProgressionService],
    exports: [StudentAcademicResultsService, AcademicResultsService, StudentProgressionService],
})
export class AcademicResultsModule {}

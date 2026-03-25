import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { Course, CourseSchema } from '../schemas/course.schema';
import { ProgramCourse, ProgramCourseSchema } from '../schemas/program-course.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Course.name, schema: CourseSchema },
            { name: ProgramCourse.name, schema: ProgramCourseSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: User.name, schema: UserSchema },
            { name: Staff.name, schema: StaffSchema },
        ]),
    ],
    controllers: [CoursesController],
    providers: [CoursesService],
    exports: [CoursesService],
})
export class CoursesModule { }

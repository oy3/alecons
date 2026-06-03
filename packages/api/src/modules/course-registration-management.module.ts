import { Module } from '@nestjs/common';
import { StudentModule } from './student.module';
import { StaffCourseRegistrationsController } from '../controllers/staff-course-registrations.controller';

@Module({
    imports: [StudentModule],
    controllers: [StaffCourseRegistrationsController],
})
export class CourseRegistrationManagementModule { }

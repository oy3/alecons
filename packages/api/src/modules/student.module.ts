import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentController } from '../controllers/student.controller';
import { StudentService } from '../services/student.service';
import { Student, StudentSchema } from '../schemas/student.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Student.name, schema: StudentSchema },
            { name: User.name, schema: UserSchema },
            { name: Application.name, schema: ApplicationSchema },
        ])
    ],
    controllers: [StudentController],
    providers: [StudentService],
    exports: [StudentService] // Export so other modules can use it
})
export class StudentModule { }
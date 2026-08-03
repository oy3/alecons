import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DepartmentsController } from '../controllers/departments.controller';
import { DepartmentsService } from '../services/departments.service';
import { Department, DepartmentSchema } from '../schemas/department.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Department.name, schema: DepartmentSchema },
            { name: Program.name, schema: ProgramSchema },
            { name: User.name, schema: UserSchema },
            { name: Staff.name, schema: StaffSchema },
        ]),
    ],
    controllers: [DepartmentsController],
    providers: [DepartmentsService],
    exports: [DepartmentsService],
})
export class DepartmentsModule { }

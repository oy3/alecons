import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DepartmentsController } from '../controllers/departments.controller';
import { DepartmentsService } from '../services/departments.service';
import { Department, DepartmentSchema } from '../schemas/department.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Department.name, schema: DepartmentSchema },
            { name: Program.name, schema: ProgramSchema },
        ]),
    ],
    controllers: [DepartmentsController],
    providers: [DepartmentsService],
    exports: [DepartmentsService],
})
export class DepartmentsModule { }
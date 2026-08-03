import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { ProgramType, ProgramTypeSchema } from '../schemas/program-type.schema';
import { ProgramMode, ProgramModeSchema } from '../schemas/program-mode.schema';
import { Department, DepartmentSchema } from '../schemas/department.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Program.name, schema: ProgramSchema },
            { name: ProgramType.name, schema: ProgramTypeSchema },
            { name: ProgramMode.name, schema: ProgramModeSchema },
            { name: Department.name, schema: DepartmentSchema },
            { name: User.name, schema: UserSchema },
            { name: Staff.name, schema: StaffSchema },
        ]),
    ],
    controllers: [ProgramsController],
    providers: [ProgramsService],
    exports: [ProgramsService],
})
export class ProgramsModule { }

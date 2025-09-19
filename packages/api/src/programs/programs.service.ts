import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProgramType, ProgramTypeDocument } from '../schemas/program-type.schema';
import { ProgramMode, ProgramModeDocument } from '../schemas/program-mode.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { Department, DepartmentDocument } from '../schemas/department.schema';

@Injectable()
export class ProgramsService {
    constructor(
        @InjectModel(ProgramType.name) private programTypeModel: Model<ProgramTypeDocument>,
        @InjectModel(ProgramMode.name) private programModeModel: Model<ProgramModeDocument>,
        @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
        @InjectModel(Department.name) private departmentModel: Model<DepartmentDocument>,
    ) { }

    async getProgramTypes() {
        try {
            const programTypes = await this.programTypeModel.find().exec();
            return {
                success: true,
                data: programTypes.map(type => ({
                    id: type._id.toString(),
                    name: type.type,
                    description: type.description,
                })),
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to fetch program types',
                error: error.message,
            };
        }
    }

    async getProgramModes() {
        try {
            const programModes = await this.programModeModel.find().exec();
            return {
                success: true,
                data: programModes.map(mode => ({
                    id: mode._id.toString(),
                    name: mode.mode,
                    description: mode.description,
                })),
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to fetch program modes',
                error: error.message,
            };
        }
    }

    async getPrograms() {
        try {
            const programs = await this.programModel.find().exec();

            return {
                success: true,
                data: programs.map(program => ({
                    id: program._id.toString(),
                    name: program.name,
                    code: program.code,
                    description: program.description,
                    departmentId: program.departmentId,
                })),
            };
        } catch (error) {
            return {
                success: false,
                message: 'Failed to fetch programs',
                error: error.message,
            };
        }
    }
}

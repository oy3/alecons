import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProgramType, ProgramTypeDocument } from '../schemas/program-type.schema';
import { ProgramMode, ProgramModeDocument } from '../schemas/program-mode.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { Department, DepartmentDocument } from '../schemas/department.schema';
import {
    CreateProgramDto,
    UpdateProgramDto,
    QueryProgramsDto,
    CreateProgramTypeDto,
    UpdateProgramTypeDto,
    CreateProgramModeDto,
    UpdateProgramModeDto
} from '../dto/program.dto';

@Injectable()
export class ProgramsService {
    constructor(
        @InjectModel(ProgramType.name) private programTypeModel: Model<ProgramTypeDocument>,
        @InjectModel(ProgramMode.name) private programModeModel: Model<ProgramModeDocument>,
        @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
        @InjectModel(Department.name) private departmentModel: Model<DepartmentDocument>,
    ) { }

    // Program CRUD Operations
    async createProgram(createProgramDto: CreateProgramDto) {
        try {
            // Validate department exists
            const department = await this.departmentModel.findById(createProgramDto.departmentId);
            if (!department) {
                throw new BadRequestException('Department not found');
            }

            // Validate program type exists
            const programType = await this.programTypeModel.findById(createProgramDto.programTypeId);
            if (!programType) {
                throw new BadRequestException('Program type not found');
            }

            // Validate program mode exists
            const programMode = await this.programModeModel.findById(createProgramDto.programModeId);
            if (!programMode) {
                throw new BadRequestException('Program mode not found');
            }

            // Use atomic operation to generate code to avoid race conditions
            let savedProgram;
            let attempts = 0;
            const maxAttempts = 5;

            while (attempts < maxAttempts) {
                try {
                    // Get next code atomically
                    const lastProgram = await this.programModel.findOne().sort({ code: -1 }).exec();
                    const nextCode = lastProgram ? lastProgram.code + 1 : 1;

                    const program = new this.programModel({
                        ...createProgramDto,
                        departmentId: new Types.ObjectId(createProgramDto.departmentId),
                        programTypeId: new Types.ObjectId(createProgramDto.programTypeId),
                        programModeId: new Types.ObjectId(createProgramDto.programModeId),
                        code: nextCode,
                        active: createProgramDto.active ?? true
                    });

                    savedProgram = await program.save();
                    break; // Success, exit loop
                } catch (error) {
                    if (error.code === 11000 && error.keyPattern?.code) {
                        // Duplicate code error, retry with a delay
                        attempts++;
                        if (attempts >= maxAttempts) {
                            throw new BadRequestException('Failed to generate unique program code after multiple attempts');
                        }
                        // Small delay before retry
                        await new Promise(resolve => setTimeout(resolve, 10 * attempts));
                    } else {
                        throw error; // Re-throw if it's not a duplicate code error
                    }
                }
            }

            return {
                success: true,
                data: this.formatProgramResponse(savedProgram),
                message: 'Program created successfully'
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to create program: ' + error.message);
        }
    }

    async findAllPrograms(queryDto: QueryProgramsDto) {
        try {
            const { search, departmentId, programTypeId, programModeId, active, page = 1, limit = 10 } = queryDto;
            const skip = (page - 1) * limit;

            // Build filter object
            const filter: any = {};

            if (search) {
                filter.$or = [
                    { name: { $regex: search, $options: 'i' } }
                ];
            }

            if (departmentId) {
                filter.departmentId = new Types.ObjectId(departmentId);
            }

            if (programTypeId) {
                filter.programTypeId = new Types.ObjectId(programTypeId);
            }

            if (programModeId) {
                filter.programModeId = new Types.ObjectId(programModeId);
            }

            if (active !== undefined) {
                filter.active = active;
            }

            const programs = await this.programModel
                .find(filter)
                .populate('departmentId', 'name code')
                .populate('programTypeId', 'type description')
                .populate('programModeId', 'mode description')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec();

            const total = await this.programModel.countDocuments(filter);

            return {
                success: true,
                data: programs.map(program => this.formatProgramResponse(program)),
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new BadRequestException('Failed to fetch programs: ' + error.message);
        }
    }

    async findProgramById(id: string) {
        try {
            if (!Types.ObjectId.isValid(id)) {
                throw new BadRequestException('Invalid program ID');
            }

            const program = await this.programModel
                .findById(id)
                .populate('departmentId', 'name code')
                .populate('programTypeId', 'type description')
                .populate('programModeId', 'mode description')
                .exec();

            if (!program) {
                throw new NotFoundException('Program not found');
            }

            return {
                success: true,
                data: this.formatProgramResponse(program)
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to fetch program: ' + error.message);
        }
    }

    async updateProgram(id: string, updateProgramDto: UpdateProgramDto) {
        try {
            if (!Types.ObjectId.isValid(id)) {
                throw new BadRequestException('Invalid program ID');
            }

            // Validate references if they are being updated
            if (updateProgramDto.departmentId) {
                const department = await this.departmentModel.findById(updateProgramDto.departmentId);
                if (!department) {
                    throw new BadRequestException('Department not found');
                }
            }

            if (updateProgramDto.programTypeId) {
                const programType = await this.programTypeModel.findById(updateProgramDto.programTypeId);
                if (!programType) {
                    throw new BadRequestException('Program type not found');
                }
            }

            if (updateProgramDto.programModeId) {
                const programMode = await this.programModeModel.findById(updateProgramDto.programModeId);
                if (!programMode) {
                    throw new BadRequestException('Program mode not found');
                }
            }

            const updateData: any = { ...updateProgramDto };

            // Convert string IDs to ObjectIds
            if (updateProgramDto.departmentId) {
                updateData.departmentId = new Types.ObjectId(updateProgramDto.departmentId);
            }
            if (updateProgramDto.programTypeId) {
                updateData.programTypeId = new Types.ObjectId(updateProgramDto.programTypeId);
            }
            if (updateProgramDto.programModeId) {
                updateData.programModeId = new Types.ObjectId(updateProgramDto.programModeId);
            }

            const program = await this.programModel
                .findByIdAndUpdate(id, updateData, { new: true })
                .populate('departmentId', 'name code')
                .populate('programTypeId', 'type description')
                .populate('programModeId', 'mode description')
                .exec();

            if (!program) {
                throw new NotFoundException('Program not found');
            }

            return {
                success: true,
                data: this.formatProgramResponse(program),
                message: 'Program updated successfully'
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to update program: ' + error.message);
        }
    }

    async deleteProgram(id: string) {
        try {
            if (!Types.ObjectId.isValid(id)) {
                throw new BadRequestException('Invalid program ID');
            }

            const program = await this.programModel.findByIdAndDelete(id).exec();
            if (!program) {
                throw new NotFoundException('Program not found');
            }

            return {
                success: true,
                message: 'Program deleted successfully'
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to delete program: ' + error.message);
        }
    }

    async toggleProgramStatus(id: string) {
        try {
            if (!Types.ObjectId.isValid(id)) {
                throw new BadRequestException('Invalid program ID');
            }

            const program = await this.programModel.findById(id).exec();
            if (!program) {
                throw new NotFoundException('Program not found');
            }

            program.active = !program.active;
            await program.save();

            return {
                success: true,
                data: { active: program.active },
                message: `Program ${program.active ? 'activated' : 'deactivated'} successfully`
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to toggle program status: ' + error.message);
        }
    }

    // Program Type CRUD Operations
    async createProgramType(createProgramTypeDto: CreateProgramTypeDto) {
        try {
            // Validate type length and convert to uppercase
            if (createProgramTypeDto.type.length > 2) {
                throw new BadRequestException('Program type must be maximum 2 characters');
            }

            const typeData = {
                ...createProgramTypeDto,
                type: createProgramTypeDto.type.toUpperCase(),
                active: createProgramTypeDto.active ?? true
            };

            // Check for duplicate
            const existingType = await this.programTypeModel.findOne({ type: typeData.type });
            if (existingType) {
                throw new BadRequestException('Program type already exists');
            }

            const programType = new this.programTypeModel(typeData);
            const savedType = await programType.save();

            return {
                success: true,
                data: this.formatProgramTypeResponse(savedType),
                message: 'Program type created successfully'
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to create program type: ' + error.message);
        }
    }

    async findAllProgramTypes() {
        try {
            const programTypes = await this.programTypeModel.find().sort({ createdAt: -1 }).exec();
            return {
                success: true,
                data: programTypes.map(type => this.formatProgramTypeResponse(type))
            };
        } catch (error) {
            throw new BadRequestException('Failed to fetch program types: ' + error.message);
        }
    }

    async updateProgramType(id: string, updateProgramTypeDto: UpdateProgramTypeDto) {
        try {
            if (!Types.ObjectId.isValid(id)) {
                throw new BadRequestException('Invalid program type ID');
            }

            const updateData = { ...updateProgramTypeDto };

            // Validate and convert type to uppercase if provided
            if (updateProgramTypeDto.type) {
                if (updateProgramTypeDto.type.length > 2) {
                    throw new BadRequestException('Program type must be maximum 2 characters');
                }
                updateData.type = updateProgramTypeDto.type.toUpperCase();

                // Check for duplicate (excluding current record)
                const existingType = await this.programTypeModel.findOne({
                    type: updateData.type,
                    _id: { $ne: id }
                });
                if (existingType) {
                    throw new BadRequestException('Program type already exists');
                }
            }

            const programType = await this.programTypeModel
                .findByIdAndUpdate(id, updateData, { new: true })
                .exec();

            if (!programType) {
                throw new NotFoundException('Program type not found');
            }

            return {
                success: true,
                data: this.formatProgramTypeResponse(programType),
                message: 'Program type updated successfully'
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to update program type: ' + error.message);
        }
    }

    async deleteProgramType(id: string) {
        try {
            if (!Types.ObjectId.isValid(id)) {
                throw new BadRequestException('Invalid program type ID');
            }

            // Check if program type is being used by any programs
            const programsUsingType = await this.programModel.countDocuments({ programTypeId: id });
            if (programsUsingType > 0) {
                throw new BadRequestException('Cannot delete program type as it is being used by programs');
            }

            const programType = await this.programTypeModel.findByIdAndDelete(id).exec();
            if (!programType) {
                throw new NotFoundException('Program type not found');
            }

            return {
                success: true,
                message: 'Program type deleted successfully'
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to delete program type: ' + error.message);
        }
    }

    async toggleProgramTypeStatus(id: string) {
        try {
            if (!Types.ObjectId.isValid(id)) {
                throw new BadRequestException('Invalid program type ID');
            }

            const programType = await this.programTypeModel.findById(id).exec();
            if (!programType) {
                throw new NotFoundException('Program type not found');
            }

            programType.active = !programType.active;
            await programType.save();

            return {
                success: true,
                data: { active: programType.active },
                message: `Program type ${programType.active ? 'activated' : 'deactivated'} successfully`
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to toggle program type status: ' + error.message);
        }
    }

    // Program Mode CRUD Operations
    async createProgramMode(createProgramModeDto: CreateProgramModeDto) {
        try {
            // Validate mode length and convert to uppercase
            if (createProgramModeDto.mode.length > 2) {
                throw new BadRequestException('Program mode must be maximum 2 characters');
            }

            const modeData = {
                ...createProgramModeDto,
                mode: createProgramModeDto.mode.toUpperCase(),
                active: createProgramModeDto.active ?? true
            };

            // Check for duplicate
            const existingMode = await this.programModeModel.findOne({ mode: modeData.mode });
            if (existingMode) {
                throw new BadRequestException('Program mode already exists');
            }

            const programMode = new this.programModeModel(modeData);
            const savedMode = await programMode.save();

            return {
                success: true,
                data: this.formatProgramModeResponse(savedMode),
                message: 'Program mode created successfully'
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to create program mode: ' + error.message);
        }
    }

    async findAllProgramModes() {
        try {
            const programModes = await this.programModeModel.find().sort({ createdAt: -1 }).exec();
            return {
                success: true,
                data: programModes.map(mode => this.formatProgramModeResponse(mode))
            };
        } catch (error) {
            throw new BadRequestException('Failed to fetch program modes: ' + error.message);
        }
    }

    async updateProgramMode(id: string, updateProgramModeDto: UpdateProgramModeDto) {
        try {
            if (!Types.ObjectId.isValid(id)) {
                throw new BadRequestException('Invalid program mode ID');
            }

            const updateData = { ...updateProgramModeDto };

            // Validate and convert mode to uppercase if provided
            if (updateProgramModeDto.mode) {
                if (updateProgramModeDto.mode.length > 2) {
                    throw new BadRequestException('Program mode must be maximum 2 characters');
                }
                updateData.mode = updateProgramModeDto.mode.toUpperCase();

                // Check for duplicate (excluding current record)
                const existingMode = await this.programModeModel.findOne({
                    mode: updateData.mode,
                    _id: { $ne: id }
                });
                if (existingMode) {
                    throw new BadRequestException('Program mode already exists');
                }
            }

            const programMode = await this.programModeModel
                .findByIdAndUpdate(id, updateData, { new: true })
                .exec();

            if (!programMode) {
                throw new NotFoundException('Program mode not found');
            }

            return {
                success: true,
                data: this.formatProgramModeResponse(programMode),
                message: 'Program mode updated successfully'
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to update program mode: ' + error.message);
        }
    }

    async deleteProgramMode(id: string) {
        try {
            if (!Types.ObjectId.isValid(id)) {
                throw new BadRequestException('Invalid program mode ID');
            }

            // Check if program mode is being used by any programs
            const programsUsingMode = await this.programModel.countDocuments({ programModeId: id });
            if (programsUsingMode > 0) {
                throw new BadRequestException('Cannot delete program mode as it is being used by programs');
            }

            const programMode = await this.programModeModel.findByIdAndDelete(id).exec();
            if (!programMode) {
                throw new NotFoundException('Program mode not found');
            }

            return {
                success: true,
                message: 'Program mode deleted successfully'
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to delete program mode: ' + error.message);
        }
    }

    async toggleProgramModeStatus(id: string) {
        try {
            if (!Types.ObjectId.isValid(id)) {
                throw new BadRequestException('Invalid program mode ID');
            }

            const programMode = await this.programModeModel.findById(id).exec();
            if (!programMode) {
                throw new NotFoundException('Program mode not found');
            }

            programMode.active = !programMode.active;
            await programMode.save();

            return {
                success: true,
                data: { active: programMode.active },
                message: `Program mode ${programMode.active ? 'activated' : 'deactivated'} successfully`
            };
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Failed to toggle program mode status: ' + error.message);
        }
    }

    // Helper methods for formatting responses
    private formatProgramResponse(program: any) {
        return {
            id: program._id.toString(),
            departmentId: program.departmentId?.toString() || program.departmentId,
            department: program.departmentId?.name || null,
            departmentCode: program.departmentId?.code || null,
            name: program.name,
            code: program.code,
            description: program.description,
            programTypeId: program.programTypeId?.toString() || program.programTypeId,
            programType: program.programTypeId?.type || null,
            programModeId: program.programModeId?.toString() || program.programModeId,
            programMode: program.programModeId?.mode || null,
            durationSemesters: program.durationSemesters,
            active: program.active,
            createdAt: program.createdAt,
            updatedAt: program.updatedAt
        };
    }

    private formatProgramTypeResponse(programType: any) {
        return {
            id: programType._id.toString(),
            type: programType.type,
            description: programType.description,
            active: programType.active,
            createdAt: programType.createdAt,
            updatedAt: programType.updatedAt
        };
    }

    private formatProgramModeResponse(programMode: any) {
        return {
            id: programMode._id.toString(),
            mode: programMode.mode,
            description: programMode.description,
            active: programMode.active,
            createdAt: programMode.createdAt,
            updatedAt: programMode.updatedAt
        };
    }

    // Legacy methods (keep for backward compatibility)
    async getProgramTypes() {
        const result = await this.findAllProgramTypes();
        return {
            success: result.success,
            data: result.data.map(type => ({
                id: type.id,
                name: type.type,
                description: type.description,
            })),
        };
    }

    async getProgramModes() {
        const result = await this.findAllProgramModes();
        return {
            success: result.success,
            data: result.data.map(mode => ({
                id: mode.id,
                name: mode.mode,
                description: mode.description,
            })),
        };
    }

    async getPrograms() {
        const result = await this.findAllPrograms({});
        return {
            success: result.success,
            data: result.data.map(program => ({
                id: program.id,
                name: program.name,
                code: program.code,
                description: program.description,
                departmentId: program.departmentId,
            })),
        };
    }
}

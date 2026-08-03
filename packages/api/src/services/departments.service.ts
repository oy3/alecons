import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Department, DepartmentDocument } from '../schemas/department.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Staff, StaffDocument } from '../schemas/staff.schema';
import { CreateDepartmentDto, UpdateDepartmentDto, QueryDepartmentsDto } from '../dto/department.dto';

@Injectable()
export class DepartmentsService {
    constructor(
        @InjectModel(Department.name)
        private departmentModel: Model<DepartmentDocument>,
        @InjectModel(Program.name)
        private programModel: Model<ProgramDocument>,
        @InjectModel(User.name)
        private userModel: Model<UserDocument>,
        @InjectModel(Staff.name)
        private staffModel: Model<StaffDocument>,
    ) { }

    async create(createDepartmentDto: CreateDepartmentDto, assignedBy?: string): Promise<Department> {
        // Check if department with same code already exists
        const existingDepartment = await this.departmentModel.findOne({
            code: createDepartmentDto.code.toUpperCase(),
        });

        if (existingDepartment) {
            throw new ConflictException(`Department with code ${createDepartmentDto.code} already exists`);
        }

        const hodUserId = await this.resolveHodUserId(createDepartmentDto.hodUserId);
        const department = new this.departmentModel({
            ...createDepartmentDto,
            hodUserId,
            hodAssignedAt: hodUserId ? new Date() : undefined,
            hodAssignedBy: hodUserId && assignedBy && Types.ObjectId.isValid(assignedBy)
                ? new Types.ObjectId(assignedBy)
                : undefined,
            code: createDepartmentDto.code.toUpperCase(),
            active: createDepartmentDto.active !== undefined ? createDepartmentDto.active : true,
        });

        return department.save();
    }

    async findAll(query: QueryDepartmentsDto): Promise<{
        departments: Array<Department & { programsCount: number }>;
        pagination: {
            currentPage: number;
            totalPages: number;
            totalItems: number;
            itemsPerPage: number;
        };
    }> {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filter: any = {};

        if (query.search) {
            filter.$or = [
                { name: { $regex: query.search, $options: 'i' } },
                { code: { $regex: query.search, $options: 'i' } },
                { description: { $regex: query.search, $options: 'i' } },
            ];
        }

        if (query.active !== undefined) {
            filter.active = typeof query.active === 'string' ? query.active === 'true' : query.active;
        }

        // Build sort object
        const sort: any = {};
        const sortBy = query.sortBy || 'createdAt';
        const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
        sort[sortBy] = sortOrder;

        // Execute queries
        const [departments, totalItems] = await Promise.all([
            this.departmentModel
                .find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate('hodUserId', 'firstName otherName lastName email')
                .lean()
                .exec(),
            this.departmentModel.countDocuments(filter),
        ]);

        const departmentIds = departments.map((department) => department._id);
        const programCounts = departmentIds.length > 0
            ? await this.programModel.aggregate([
                {
                    $match: {
                        departmentId: { $in: departmentIds.map((id) => new Types.ObjectId(id.toString())) }
                    }
                },
                {
                    $group: {
                        _id: {
                            departmentId: '$departmentId',
                            normalizedName: {
                                $toLower: {
                                    $trim: { input: '$name' }
                                }
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: '$_id.departmentId',
                        count: { $sum: 1 }
                    }
                }
            ])
            : [];

        const countsMap = new Map(programCounts.map((item) => [item._id.toString(), item.count]));
        const departmentsWithCounts = departments.map((department) => ({
            ...department,
            programsCount: countsMap.get(department._id.toString()) || 0,
        }));

        return {
            departments: departmentsWithCounts,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit),
                totalItems,
                itemsPerPage: limit,
            },
        };
    }

    async findById(id: string): Promise<Department> {
        const department = await this.departmentModel.findById(id).populate('hodUserId', 'firstName otherName lastName email').exec();

        if (!department) {
            throw new NotFoundException('Department not found');
        }

        return department;
    }

    async update(id: string, updateDepartmentDto: UpdateDepartmentDto, assignedBy?: string): Promise<DepartmentDocument> {
        const department = await this.departmentModel.findById(id).exec();

        if (!department) {
            throw new NotFoundException('Department not found');
        }

        // Check if code is being updated and if it conflicts with existing department
        if (updateDepartmentDto.code) {
            const existingDepartment = await this.departmentModel.findOne({
                code: updateDepartmentDto.code.toUpperCase(),
                _id: { $ne: id },
            });

            if (existingDepartment) {
                throw new ConflictException(`Department with code ${updateDepartmentDto.code} already exists`);
            }

            updateDepartmentDto.code = updateDepartmentDto.code.toUpperCase();
        }

        if (updateDepartmentDto.hodUserId !== undefined) {
            const hodUserId = await this.resolveHodUserId(updateDepartmentDto.hodUserId);
            department.hodUserId = hodUserId;
            department.hodAssignedAt = hodUserId ? new Date() : undefined;
            department.hodAssignedBy = hodUserId && assignedBy && Types.ObjectId.isValid(assignedBy)
                ? new Types.ObjectId(assignedBy)
                : undefined;
        }

        Object.assign(department, {
            ...updateDepartmentDto,
            hodUserId: department.hodUserId,
        });
        return department.save();
    }

    async delete(id: string): Promise<void> {
        const department = await this.findById(id);

        // You might want to check if department has programs before deleting
        // const programsCount = await this.programModel.countDocuments({ departmentId: id });
        // if (programsCount > 0) {
        //   throw new ConflictException('Cannot delete department that has programs');
        // }

        await this.departmentModel.findByIdAndDelete(id);
    }

    async findAllActive(): Promise<Array<Department & { programsCount: number }>> {
        const departments = await this.departmentModel
            .find({ active: true })
            .populate('hodUserId', 'firstName otherName lastName email')
            .sort({ name: 1 })
            .lean()
            .exec();
        const departmentIds = departments.map((department) => department._id);

        const programCounts = departmentIds.length > 0
            ? await this.programModel.aggregate([
                {
                    $match: {
                        departmentId: { $in: departmentIds.map((id) => new Types.ObjectId(id.toString())) }
                    }
                },
                {
                    $group: {
                        _id: {
                            departmentId: '$departmentId',
                            normalizedName: {
                                $toLower: {
                                    $trim: { input: '$name' }
                                }
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: '$_id.departmentId',
                        count: { $sum: 1 }
                    }
                }
            ])
            : [];

        const countsMap = new Map(programCounts.map((item) => [item._id.toString(), item.count]));

        return departments.map((department) => ({
            ...department,
            programsCount: countsMap.get(department._id.toString()) || 0,
        }));
    }

    async toggleStatus(id: string): Promise<DepartmentDocument> {
        const department = await this.departmentModel.findById(id).exec();

        if (!department) {
            throw new NotFoundException('Department not found');
        }

        department.active = !department.active;
        return department.save();
    }

    private async resolveHodUserId(hodUserId?: string): Promise<Types.ObjectId | undefined> {
        if (!hodUserId) return undefined;
        if (!Types.ObjectId.isValid(hodUserId)) {
            throw new NotFoundException('Selected HOD is invalid');
        }

        const userId = new Types.ObjectId(hodUserId);
        const [user, staff] = await Promise.all([
            this.userModel.findOne({ _id: userId, isActive: true }).select('_id role').lean(),
            this.staffModel.findOne({ userId, isActive: true }).select('_id').lean(),
        ]);

        if (!user || !staff) {
            throw new NotFoundException('Selected HOD must be an active staff member');
        }

        return userId;
    }
}

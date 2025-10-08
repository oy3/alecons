import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Department, DepartmentDocument } from '../schemas/department.schema';
import { CreateDepartmentDto, UpdateDepartmentDto, QueryDepartmentsDto } from '../dto/department.dto';

@Injectable()
export class DepartmentsService {
    constructor(
        @InjectModel(Department.name)
        private departmentModel: Model<DepartmentDocument>,
    ) { }

    async create(createDepartmentDto: CreateDepartmentDto): Promise<Department> {
        // Check if department with same code already exists
        const existingDepartment = await this.departmentModel.findOne({
            code: createDepartmentDto.code.toUpperCase(),
        });

        if (existingDepartment) {
            throw new ConflictException(`Department with code ${createDepartmentDto.code} already exists`);
        }

        const department = new this.departmentModel({
            ...createDepartmentDto,
            code: createDepartmentDto.code.toUpperCase(),
            active: createDepartmentDto.active !== undefined ? createDepartmentDto.active : true,
        });

        return department.save();
    }

    async findAll(query: QueryDepartmentsDto): Promise<{
        departments: Department[];
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
                .exec(),
            this.departmentModel.countDocuments(filter),
        ]);

        return {
            departments,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit),
                totalItems,
                itemsPerPage: limit,
            },
        };
    }

    async findById(id: string): Promise<Department> {
        const department = await this.departmentModel.findById(id).exec();

        if (!department) {
            throw new NotFoundException('Department not found');
        }

        return department;
    }

    async update(id: string, updateDepartmentDto: UpdateDepartmentDto): Promise<DepartmentDocument> {
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

        Object.assign(department, updateDepartmentDto);
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

    async findAllActive(): Promise<Department[]> {
        return this.departmentModel.find({ active: true }).sort({ name: 1 }).exec();
    }

    async toggleStatus(id: string): Promise<DepartmentDocument> {
        const department = await this.departmentModel.findById(id).exec();

        if (!department) {
            throw new NotFoundException('Department not found');
        }

        department.active = !department.active;
        return department.save();
    }
}
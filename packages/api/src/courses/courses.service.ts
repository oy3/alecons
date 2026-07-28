import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Course, CourseDocument } from '../schemas/course.schema';
import { ProgramCourse, ProgramCourseCategory, ProgramCourseDocument } from '../schemas/program-course.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { Staff, StaffDocument } from '../schemas/staff.schema';
import {
    AcademicResult,
    AcademicResultDocument,
    AcademicResultWorkflowStatus,
} from '../schemas/academic-result.schema';
import {
    CreateCourseDto,
    CreateProgramCourseDto,
    QueryCoursesDto,
    QueryProgramCoursesDto,
    UpdateCourseDto,
    UpdateProgramCourseDto,
} from '../dto/course.dto';

@Injectable()
export class CoursesService {
    constructor(
        @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
        @InjectModel(ProgramCourse.name) private programCourseModel: Model<ProgramCourseDocument>,
        @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Staff.name) private staffModel: Model<StaffDocument>,
        @InjectModel(AcademicResult.name) private academicResultModel: Model<AcademicResultDocument>,
    ) { }

    async createCourse(createCourseDto: CreateCourseDto) {
        const normalizedCode = createCourseDto.code.trim().toUpperCase();
        const existingCourse = await this.courseModel.findOne({ code: normalizedCode }).exec();

        if (existingCourse) {
            throw new BadRequestException(`Course with code ${normalizedCode} already exists`);
        }

        const course = await this.courseModel.create({
            ...createCourseDto,
            code: normalizedCode,
            title: createCourseDto.title.trim(),
            description: createCourseDto.description?.trim(),
            active: createCourseDto.active ?? true,
        });

        return {
            success: true,
            data: this.formatCourseResponse(course),
            message: 'Course created successfully',
        };
    }

    async findAllCourses(queryDto: QueryCoursesDto) {
        const { search, active, page = 1, limit = 10 } = queryDto;
        const filter: any = {};

        if (search) {
            filter.$or = [
                { code: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        if (active !== undefined) {
            filter.active = active;
        }

        const skip = (page - 1) * limit;
        const [courses, total] = await Promise.all([
            this.courseModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
            this.courseModel.countDocuments(filter),
        ]);

        return {
            success: true,
            data: courses.map((course) => this.formatCourseResponse(course)),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async updateCourse(id: string, updateCourseDto: UpdateCourseDto) {
        this.ensureValidObjectId(id, 'Invalid course ID');

        const course = await this.courseModel.findById(id).exec();
        if (!course) {
            throw new NotFoundException('Course not found');
        }

        if (updateCourseDto.code) {
            const normalizedCode = updateCourseDto.code.trim().toUpperCase();
            const duplicate = await this.courseModel.findOne({ code: normalizedCode, _id: { $ne: id } }).exec();
            if (duplicate) {
                throw new BadRequestException(`Course with code ${normalizedCode} already exists`);
            }
            course.code = normalizedCode;
        }

        if (updateCourseDto.title !== undefined) {
            course.title = updateCourseDto.title.trim();
        }

        if (updateCourseDto.description !== undefined) {
            course.description = updateCourseDto.description?.trim();
        }

        if (updateCourseDto.active !== undefined) {
            course.active = updateCourseDto.active;
        }

        await course.save();

        return {
            success: true,
            data: this.formatCourseResponse(course),
            message: 'Course updated successfully',
        };
    }

    async deleteCourse(id: string) {
        this.ensureValidObjectId(id, 'Invalid course ID');

        const mappingsCount = await this.programCourseModel.countDocuments({ courseId: new Types.ObjectId(id) });
        if (mappingsCount > 0) {
            throw new BadRequestException('Cannot delete course because it is already assigned to one or more programs');
        }

        const course = await this.courseModel.findByIdAndDelete(id).exec();
        if (!course) {
            throw new NotFoundException('Course not found');
        }

        return {
            success: true,
            message: 'Course deleted successfully',
        };
    }

    async createProgramCourse(createProgramCourseDto: CreateProgramCourseDto) {
        await this.validateProgramCourseReferences(createProgramCourseDto);

        const programCourse = await this.programCourseModel.create({
            ...createProgramCourseDto,
            courseId: new Types.ObjectId(createProgramCourseDto.courseId),
            programId: new Types.ObjectId(createProgramCourseDto.programId),
            lecturerIds: (createProgramCourseDto.lecturerIds || []).map((id) => new Types.ObjectId(id)),
            active: createProgramCourseDto.active ?? true,
        });

        const populatedProgramCourse = await this.programCourseModel
            .findById(programCourse._id)
            .populate('courseId', 'code title description active')
            .populate({
                path: 'programId',
                populate: [
                    { path: 'departmentId', select: 'name code' },
                    { path: 'programTypeId', select: 'type' },
                    { path: 'programModeId', select: 'mode' },
                ],
            })
            .populate('lecturerIds', 'firstName otherName lastName email role isActive')
            .exec();

        return {
            success: true,
            data: this.formatProgramCourseResponse(populatedProgramCourse),
            message: 'Program course assigned successfully',
        };
    }

    async findAllProgramCourses(queryDto: QueryProgramCoursesDto) {
        const { search, programId, level, semester, category, active, page = 1, limit = 10 } = queryDto;
        const filter: any = {};

        if (programId) {
            filter.programId = new Types.ObjectId(programId);
        }

        if (level) {
            filter.level = level;
        }

        if (semester) {
            filter.semester = semester;
        }

        if (category) {
            filter.category = category;
        }

        if (active !== undefined) {
            filter.active = active;
        }

        if (search) {
            const matchingCourses = await this.courseModel.find({
                $or: [
                    { code: { $regex: search, $options: 'i' } },
                    { title: { $regex: search, $options: 'i' } },
                ],
            }).select('_id').lean();

            const courseIds = matchingCourses.map((course) => course._id);
            filter.$or = [
                { courseId: { $in: courseIds } },
            ];
        }

        const skip = (page - 1) * limit;
        const [programCourses, total] = await Promise.all([
            this.programCourseModel
                .find(filter)
                .populate('courseId', 'code title description active')
                .populate({
                    path: 'programId',
                    populate: [
                        { path: 'departmentId', select: 'name code' },
                        { path: 'programTypeId', select: 'type' },
                        { path: 'programModeId', select: 'mode' },
                    ],
                })
                .populate('lecturerIds', 'firstName otherName lastName email role isActive')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec(),
            this.programCourseModel.countDocuments(filter),
        ]);

        return {
            success: true,
            data: programCourses.map((programCourse) => this.formatProgramCourseResponse(programCourse)),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async updateProgramCourse(id: string, updateProgramCourseDto: UpdateProgramCourseDto) {
        this.ensureValidObjectId(id, 'Invalid program course ID');

        const existingProgramCourse = await this.programCourseModel.findById(id).exec();
        if (!existingProgramCourse) {
            throw new NotFoundException('Program course not found');
        }

        if (
            updateProgramCourseDto.assessmentComponents &&
            JSON.stringify(existingProgramCourse.assessmentComponents || []) !==
                JSON.stringify(updateProgramCourseDto.assessmentComponents)
        ) {
            const openResultExists = await this.academicResultModel.exists({
                programCourseId: existingProgramCourse._id,
                workflowStatus: {
                    $nin: [AcademicResultWorkflowStatus.PUBLISHED, AcademicResultWorkflowStatus.ARCHIVED],
                },
            });
            if (openResultExists) {
                throw new BadRequestException(
                    'Assessment components cannot be changed while this course has draft or pending results',
                );
            }
        }

        await this.validateProgramCourseReferences(updateProgramCourseDto, id);

        const updateData: any = { ...updateProgramCourseDto };
        if (updateProgramCourseDto.courseId) {
            updateData.courseId = new Types.ObjectId(updateProgramCourseDto.courseId);
        }
        if (updateProgramCourseDto.programId) {
            updateData.programId = new Types.ObjectId(updateProgramCourseDto.programId);
        }
        if (updateProgramCourseDto.lecturerIds) {
            updateData.lecturerIds = updateProgramCourseDto.lecturerIds.map((lecturerId) => new Types.ObjectId(lecturerId));
        }

        const programCourse = await this.programCourseModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .populate('courseId', 'code title description active')
            .populate({
                path: 'programId',
                populate: [
                    { path: 'departmentId', select: 'name code' },
                    { path: 'programTypeId', select: 'type' },
                    { path: 'programModeId', select: 'mode' },
                ],
            })
            .populate('lecturerIds', 'firstName otherName lastName email role isActive')
            .exec();

        return {
            success: true,
            data: this.formatProgramCourseResponse(programCourse),
            message: 'Program course updated successfully',
        };
    }

    async deleteProgramCourse(id: string) {
        this.ensureValidObjectId(id, 'Invalid program course ID');

        const resultExists = await this.academicResultModel.exists({
            programCourseId: new Types.ObjectId(id),
        });
        if (resultExists) {
            throw new BadRequestException(
                'Cannot delete this program course because academic results reference it. Deactivate it instead.',
            );
        }

        const programCourse = await this.programCourseModel.findByIdAndDelete(id).exec();
        if (!programCourse) {
            throw new NotFoundException('Program course not found');
        }

        return {
            success: true,
            message: 'Program course deleted successfully',
        };
    }

    async getCourseOptions() {
        const courses = await this.courseModel.find({ active: true }).sort({ code: 1 }).lean().exec();
        return {
            success: true,
            data: courses.map((course) => this.formatCourseResponse(course)),
        };
    }

    private async validateProgramCourseReferences(
        input: Partial<CreateProgramCourseDto | UpdateProgramCourseDto>,
        programCourseId?: string,
    ) {
        if (input.courseId) {
            this.ensureValidObjectId(input.courseId, 'Invalid course ID');
            const course = await this.courseModel.findById(input.courseId).exec();
            if (!course) {
                throw new BadRequestException('Course not found');
            }
        }

        if (input.programId) {
            this.ensureValidObjectId(input.programId, 'Invalid program ID');
            const program = await this.programModel.findById(input.programId).exec();
            if (!program) {
                throw new BadRequestException('Program not found');
            }
        }

        if (input.lecturerIds?.length) {
            await this.validateActiveStaffUsers(input.lecturerIds, 'One or more selected lecturers are invalid or inactive');
        }

        if (input.level && input.level < 1) {
            throw new BadRequestException('Level must be at least 1');
        }

        if (input.semester && ![1, 2].includes(input.semester)) {
            throw new BadRequestException('Semester must be either 1 or 2');
        }

        if (input.category && !Object.values(ProgramCourseCategory).includes(input.category as ProgramCourseCategory)) {
            throw new BadRequestException('Invalid program course category');
        }

        if (input.assessmentComponents) {
            const activeComponents = input.assessmentComponents.filter((component) => component.active !== false);
            if (!activeComponents.length) {
                throw new BadRequestException('Add at least one active assessment component');
            }
            const orders = new Set<number>();
            let scaledWeight = 0;
            for (const component of activeComponents) {
                if (!component.title?.trim() || Number(component.maximumMark) <= 0 || Number(component.weightPercent) <= 0) {
                    throw new BadRequestException('Assessment components require a title, positive maximum mark, and positive weight');
                }
                if (orders.has(Number(component.displayOrder))) {
                    throw new BadRequestException('Assessment component display order must be unique');
                }
                orders.add(Number(component.displayOrder));
                scaledWeight += Math.round(Number(component.weightPercent) * 10000);
            }
            if (scaledWeight !== 100 * 10000) {
                throw new BadRequestException('Active assessment component weights must total exactly 100%');
            }
        }

        const uniqueFilter: any = {
            courseId: input.courseId ? new Types.ObjectId(input.courseId) : undefined,
            programId: input.programId ? new Types.ObjectId(input.programId) : undefined,
            level: input.level,
            semester: input.semester,
        };

        if (uniqueFilter.courseId && uniqueFilter.programId && uniqueFilter.level && uniqueFilter.semester) {
            const duplicate = await this.programCourseModel.findOne({
                ...uniqueFilter,
                ...(programCourseId ? { _id: { $ne: new Types.ObjectId(programCourseId) } } : {}),
            }).exec();

            if (duplicate) {
                throw new BadRequestException('This course is already assigned to the selected program, level, and semester');
            }
        }
    }

    private ensureValidObjectId(value: string, message: string) {
        if (!Types.ObjectId.isValid(value)) {
            throw new BadRequestException(message);
        }
    }

    private async validateActiveStaffUsers(userIds: string[], errorMessage: string) {
        const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

        for (const userId of uniqueUserIds) {
            this.ensureValidObjectId(userId, errorMessage);
        }

        const users = await this.userModel.find({
            _id: { $in: uniqueUserIds.map((id) => new Types.ObjectId(id)) },
            role: { $in: [UserRole.STAFF, UserRole.ADMIN] },
            isActive: true,
        }).lean();

        const staffRecords = await this.staffModel.find({
            userId: { $in: users.map((user) => user._id) },
            isActive: true,
        }).lean();

        if (users.length !== uniqueUserIds.length || staffRecords.length !== uniqueUserIds.length) {
            throw new BadRequestException(errorMessage);
        }
    }

    private formatCourseResponse(course: any) {
        return {
            id: course._id.toString(),
            code: course.code,
            title: course.title,
            description: course.description || '',
            active: course.active,
            createdAt: course.createdAt,
            updatedAt: course.updatedAt,
        };
    }

    private formatProgramCourseResponse(programCourse: any) {
        const program = programCourse.programId;
        const course = programCourse.courseId;

        return {
            id: programCourse._id.toString(),
            courseId: course?._id?.toString() || course?.toString?.() || null,
            course: course ? {
                id: course._id?.toString?.() || null,
                code: course.code,
                title: course.title,
                description: course.description || '',
                active: course.active,
            } : null,
            programId: program?._id?.toString?.() || program?.toString?.() || null,
            program: program ? {
                id: program._id?.toString?.() || null,
                name: program.name,
                code: program.code,
                durationYears: program.durationYears,
                department: program.departmentId ? {
                    id: program.departmentId._id?.toString?.() || null,
                    name: program.departmentId.name,
                    code: program.departmentId.code,
                } : null,
                programType: program.programTypeId ? {
                    id: program.programTypeId._id?.toString?.() || null,
                    type: program.programTypeId.type,
                } : null,
                programMode: program.programModeId ? {
                    id: program.programModeId._id?.toString?.() || null,
                    mode: program.programModeId.mode,
                } : null,
            } : null,
            units: programCourse.units,
            hours: programCourse.hours,
            level: programCourse.level,
            semester: programCourse.semester,
            category: programCourse.category,
            active: programCourse.active,
            assessmentComponents: (programCourse.assessmentComponents || []).map((component: any) => ({
                title: component.title,
                maximumMark: component.maximumMark,
                weightPercent: component.weightPercent,
                componentType: component.componentType || 'assessment',
                displayOrder: component.displayOrder,
                description: component.description || '',
                assessmentDate: component.assessmentDate || null,
                active: component.active !== false,
                mandatory: component.mandatory !== false,
                absenceAllowed: component.absenceAllowed === true,
            })),
            lecturers: Array.isArray(programCourse.lecturerIds)
                ? programCourse.lecturerIds.map((lecturer: any) => ({
                    id: lecturer._id?.toString?.() || lecturer.toString?.() || null,
                    firstName: lecturer.firstName,
                    otherName: lecturer.otherName,
                    lastName: lecturer.lastName,
                    email: lecturer.email,
                    role: lecturer.role,
                    isActive: lecturer.isActive,
                }))
                : [],
            createdAt: programCourse.createdAt,
            updatedAt: programCourse.updatedAt,
        };
    }
}

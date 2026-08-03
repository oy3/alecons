import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Student, StudentDocument } from '../schemas/student.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { StudentAcademicSession, StudentAcademicSessionDocument } from '../schemas/student-academic-session.schema';
import { StudentPayment, StudentPaymentDocument } from '../schemas/student-payment.schema';
import { CourseRegistration, CourseRegistrationDocument } from '../schemas/course-registration.schema';

type StudentFilters = {
    page?: number;
    limit?: number;
    search?: string;
    programId?: string;
    programTypeId?: string;
    programModeId?: string;
    level?: string;
    status?: string;
    portalAccess?: string;
};

const STUDENT_STATUSES = ['active', 'suspended', 'graduated', 'withdrawn'];

@Injectable()
export class StaffStudentsService {
    constructor(
        @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Program.name) private readonly programModel: Model<ProgramDocument>,
        @InjectModel(StudentAcademicSession.name) private readonly studentAcademicSessionModel: Model<StudentAcademicSessionDocument>,
        @InjectModel(StudentPayment.name) private readonly studentPaymentModel: Model<StudentPaymentDocument>,
        @InjectModel(CourseRegistration.name) private readonly courseRegistrationModel: Model<CourseRegistrationDocument>,
    ) {}

    private asObjectId(value?: string, field = 'id') {
        if (!value || !Types.ObjectId.isValid(value)) throw new BadRequestException(`Invalid ${field}`);
        return new Types.ObjectId(value);
    }

    private async buildQuery(filters: StudentFilters): Promise<FilterQuery<StudentDocument>> {
        const query: FilterQuery<StudentDocument> = {};
        const selectedProgramId = filters.programId
            ? this.asObjectId(filters.programId, 'programId')
            : undefined;
        if (selectedProgramId) query.programId = selectedProgramId;
        if (filters.level) query.currentLevel = Number(filters.level);
        if (filters.status) query.status = filters.status;

        if (filters.programTypeId || filters.programModeId) {
            const programQuery: FilterQuery<ProgramDocument> = {};
            if (selectedProgramId) programQuery._id = selectedProgramId;
            if (filters.programTypeId) programQuery.programTypeId = this.asObjectId(filters.programTypeId, 'programTypeId');
            if (filters.programModeId) programQuery.programModeId = this.asObjectId(filters.programModeId, 'programModeId');
            const programs = await this.programModel.find(programQuery).select('_id').lean();
            query.programId = { $in: programs.map((program: any) => program._id) };
        }

        if (filters.portalAccess === 'enabled' || filters.portalAccess === 'disabled') {
            query.isActive = filters.portalAccess === 'enabled';
        }

        return query;
    }

    private studentPopulation() {
        return [
            { path: 'userId', select: 'firstName otherName lastName email phone isActive isEmailVerified profileImageUrl' },
            { path: 'programId', select: 'name code programTypeId programModeId', populate: [{ path: 'programTypeId', select: 'type' }, { path: 'programModeId', select: 'mode' }] },
            { path: 'academicSession', select: 'title sessionYear status' },
            { path: 'entryAcademicSession', select: 'title sessionYear status' },
        ];
    }

    async getStudents(filters: StudentFilters) {
        const page = Math.max(1, Number(filters.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
        const query = await this.buildQuery(filters);

        if (filters.search?.trim()) {
            const expression = new RegExp(filters.search.trim(), 'i');
            const users = await this.userModel.find({
                $or: [{ firstName: expression }, { otherName: expression }, { lastName: expression }, { email: expression }, { phone: expression }],
            }).select('_id').lean();
            query.$or = [
                { matriculationNumber: expression },
                { userId: { $in: users.map((user: any) => user._id) } },
            ];
        }

        const [students, totalItems] = await Promise.all([
            this.studentModel.find(query).populate(this.studentPopulation()).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            this.studentModel.countDocuments(query),
        ]);

        return { students, pagination: { currentPage: page, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / limit)), limit } };
    }

    async getStats(filters: Omit<StudentFilters, 'page' | 'limit' | 'search'>) {
        const query = await this.buildQuery(filters);
        const [totalEnrolled, activeStudents, suspendedStudents, portalAccessDisabled] = await Promise.all([
            this.studentModel.countDocuments(query),
            this.studentModel.countDocuments({ ...query, status: 'active', isActive: true }),
            this.studentModel.countDocuments({ ...query, status: 'suspended' }),
            this.studentModel.countDocuments({ ...query, isActive: false }),
        ]);
        return { totalEnrolled, activeStudents, suspendedStudents, portalAccessDisabled };
    }

    async getFilterOptions() {
        const programs = await this.programModel
            .find({})
            .populate('programTypeId', 'type')
            .populate('programModeId', 'mode')
            .sort({ name: 1 })
            .lean();
        return {
            programs,
            statuses: STUDENT_STATUSES,
        };
    }

    async getStudentById(id: string) {
        const studentId = this.asObjectId(id, 'student id');
        const student = await this.studentModel.findById(studentId).populate(this.studentPopulation()).lean();
        if (!student) throw new NotFoundException('Student record not found');
        const [sessionHistory, payments, courseRegistrations] = await Promise.all([
            this.studentAcademicSessionModel.find({ studentId }).populate('academicSessionId', 'title sessionYear status').sort({ startedAt: -1 }).lean(),
            this.studentPaymentModel.find({ userId: (student as any).userId?._id || (student as any).userId }).populate('paymentId', 'name').populate('academicSessionId', 'title sessionYear').sort({ paidAt: -1, createdAt: -1 }).limit(100).lean(),
            this.courseRegistrationModel.find({ studentId }).populate('academicSessionId', 'title sessionYear').sort({ createdAt: -1 }).lean(),
        ]);
        return { student, sessionHistory, payments, courseRegistrations };
    }

    async updateStudentStatus(id: string, status: string) {
        if (!STUDENT_STATUSES.includes(status)) throw new BadRequestException('Invalid student status');
        const student = await this.studentModel.findByIdAndUpdate(this.asObjectId(id, 'student id'), { status }, { new: true }).populate(this.studentPopulation()).lean();
        if (!student) throw new NotFoundException('Student record not found');
        return student;
    }

    async updatePortalAccess(id: string, isActive: boolean) {
        const student = await this.studentModel.findById(this.asObjectId(id, 'student id')).lean();
        if (!student) throw new NotFoundException('Student record not found');
        await Promise.all([
            this.studentModel.updateOne({ _id: student._id }, { isActive }),
            this.userModel.updateOne({ _id: student.userId }, { isActive }),
        ]);
        return { id: String(student._id), isActive };
    }
}

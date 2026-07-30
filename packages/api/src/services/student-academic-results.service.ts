import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AcademicResult, AcademicResultDocument, AcademicResultWorkflowStatus } from '../schemas/academic-result.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { CourseRegistration, CourseRegistrationDocument, CourseRegistrationStatus } from '../schemas/course-registration.schema';
import { buildAcademicProgress } from './academic-result-calculator';

@Injectable()
export class StudentAcademicResultsService {
    constructor(
        @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
        @InjectModel(AcademicResult.name) private readonly academicResultModel: Model<AcademicResultDocument>,
        @InjectModel(CourseRegistration.name) private readonly courseRegistrationModel: Model<CourseRegistrationDocument>,
    ) {}

    async getPublishedResults(userId: string, filters: { academicSessionId?: string; semester?: number } = {}) {
        const student = await this.studentModel.findOne({ userId: new Types.ObjectId(userId) }).lean();
        if (!student) throw new NotFoundException('Student record not found');
        const [results, registrations] = await Promise.all([
            this.academicResultModel.find({ studentId: student._id, workflowStatus: AcademicResultWorkflowStatus.PUBLISHED })
            .populate('academicSessionId', 'title sessionYear startDate')
            .sort({ publishedAt: -1, createdAt: -1 })
            .lean(),
            this.courseRegistrationModel.find({
                studentId: student._id,
                status: CourseRegistrationStatus.APPROVED,
            })
                .populate('academicSessionId', 'title sessionYear startDate')
                .sort({ createdAt: 1, semester: 1 })
                .lean(),
        ]);
        const progress = buildAcademicProgress(registrations, results);
        const filtered = filters.semester ? results.filter((result: any) => result.semester === filters.semester) : results;
        const sessionFiltered = filters.academicSessionId
            ? filtered.filter((result: any) => String(result.academicSessionId?._id || result.academicSessionId) === filters.academicSessionId)
            : filtered;
        const latestByCourse = new Map<string, any>();
        for (const result of [...sessionFiltered].reverse()) latestByCourse.set(String(result.programCourseId), result);
        const latest = [...latestByCourse.values()];
        const selectedPeriod = [...progress.periods].reverse().find((period) =>
            (!filters.academicSessionId || period.academicSessionId === filters.academicSessionId) &&
            (!filters.semester || period.semester === filters.semester),
        ) || progress.periods[progress.periods.length - 1] || null;
        return {
            results: sessionFiltered,
            preview: latest.slice(0, 6),
            summary: {
                ...(selectedPeriod || {}),
                cumulativeGPA: progress.officialCumulativeGPA,
                hasOfficialCumulativeGPA: progress.completedPeriods > 0,
                periods: progress.periods,
            },
        };
    }
}

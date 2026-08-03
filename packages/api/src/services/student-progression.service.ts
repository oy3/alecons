import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { AcademicResult, AcademicResultDocument, AcademicResultWorkflowStatus } from '../schemas/academic-result.schema';
import { CourseRegistration, CourseRegistrationDocument, CourseRegistrationStatus } from '../schemas/course-registration.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import {
    StudentAcademicSession,
    StudentAcademicSessionDocument,
    StudentAcademicSessionStatus,
    StudentAnnualOutcome,
    StudentSemesterOutcome,
} from '../schemas/student-academic-session.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { calculateAnnualProgression, calculateSemesterProgression } from './academic-progression-calculator';

@Injectable()
export class StudentProgressionService {
    constructor(
        @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
        @InjectModel(Program.name) private readonly programModel: Model<ProgramDocument>,
        @InjectModel(StudentAcademicSession.name) private readonly studentSessionModel: Model<StudentAcademicSessionDocument>,
        @InjectModel(CourseRegistration.name) private readonly registrationModel: Model<CourseRegistrationDocument>,
        @InjectModel(AcademicResult.name) private readonly resultModel: Model<AcademicResultDocument>,
    ) {}

    async recalculate(
        studentId: Types.ObjectId,
        academicSessionId: Types.ObjectId,
        actorUserId?: Types.ObjectId,
        session?: ClientSession,
        persist = true,
    ) {
        const student = await this.studentModel.findById(studentId).session(session || null).lean();
        if (!student) throw new NotFoundException('Student record not found');
        const program = await this.programModel.findById(student.programId).session(session || null).lean();
        if (!program) throw new NotFoundException('Student program not found');

        let enrollment = await this.studentSessionModel.findOne({ studentId, academicSessionId }).session(session || null);
        if (!enrollment) {
            enrollment = new this.studentSessionModel({
                studentId,
                academicSessionId,
                level: student.currentLevel || 1,
                yearAttemptNumber: 1,
                isRepeatYear: false,
                status: StudentAcademicSessionStatus.CURRENT,
                annualOutcome: StudentAnnualOutcome.IN_PROGRESS,
            });
            enrollment.$session(session || null);
        }

        const level = Number(enrollment.level || student.currentLevel || 1);
        const [registrations, results] = await Promise.all([
            this.registrationModel.find({
                studentId,
                academicSessionId,
                level,
                status: CourseRegistrationStatus.APPROVED,
            }).session(session || null).lean(),
            this.resultModel.find({
                studentId,
                academicSessionId,
                workflowStatus: AcademicResultWorkflowStatus.PUBLISHED,
            }).session(session || null).lean(),
        ]);

        const now = new Date();
        const semesterProgressions = [1, 2].map((semester) => {
            const registration = registrations.find((item) => Number(item.semester) === semester) || null;
            const calculated = calculateSemesterProgression(registration, results, Boolean(enrollment?.isRepeatYear));
            return {
                ...calculated,
                semester,
                resitProgramCourseIds: calculated.resitProgramCourseIds.map((id) => new Types.ObjectId(id)),
                unresolvedProgramCourseIds: calculated.unresolvedProgramCourseIds.map((id) => new Types.ObjectId(id)),
                decidedAt: now,
                decidedBy: actorUserId,
            };
        });
        const annualOutcome = calculateAnnualProgression(
            semesterProgressions,
            Boolean(enrollment.isRepeatYear),
            level,
            Number(program.durationYears || 1),
        );

        enrollment.level = level;
        enrollment.semesterProgressions = semesterProgressions as any;
        enrollment.annualOutcome = annualOutcome;
        if (![StudentAnnualOutcome.IN_PROGRESS, StudentAnnualOutcome.RESULTS_INCOMPLETE].includes(annualOutcome)) {
            enrollment.annualDecisionAt = now;
            enrollment.annualDecisionBy = actorUserId;
        }
        if (persist) {
            await enrollment.save({ session });
        }

        const semesterOne = semesterProgressions[0];
        const semesterOneResolved = [StudentSemesterOutcome.PASSED, StudentSemesterOutcome.REPEAT_CANDIDATE]
            .includes(semesterOne.outcome);
        if (
            semesterOneResolved
            && Number(student.currentSemester || 1) === 1
            && String(student.academicSession) === String(academicSessionId)
        ) {
            if (persist) {
                await this.studentModel.findByIdAndUpdate(studentId, { $set: { currentSemester: 2 } }, { session });
            }
        }

        return enrollment;
    }

    async getCurrentEnrollment(studentId: Types.ObjectId, academicSessionId: Types.ObjectId, session?: ClientSession) {
        return this.studentSessionModel.findOne({ studentId, academicSessionId }).session(session || null).lean();
    }

    async rebuildAll(apply = false) {
        const students = await this.studentModel.find({ isActive: true }).select('_id academicSession').lean();
        let rebuilt = 0;
        const failures: Array<{ studentId: string; reason: string }> = [];
        for (const student of students) {
            if (!student.academicSession) continue;
            if (apply) {
                try {
                    await this.recalculate(student._id, student.academicSession);
                    rebuilt++;
                } catch (error) {
                    if (failures.length < 50) {
                        failures.push({
                            studentId: String(student._id),
                            reason: error?.message || 'Progression could not be rebuilt',
                        });
                    }
                }
            }
        }
        return {
            studentsEligible: students.length,
            studentsRebuilt: rebuilt,
            failures,
            applied: Boolean(apply),
        };
    }

    async migratePolicyFoundation(apply = false) {
        const programs = await this.programModel.find({}).select('_id name code maxResitCourses').lean();
        const programLimits = new Map(
            programs
                .filter((program: any) => Number.isInteger(program.maxResitCourses) && program.maxResitCourses > 0)
                .map((program: any) => [String(program._id), Number(program.maxResitCourses)]),
        );
        const programsMissingPolicy = programs
            .filter((program: any) => !programLimits.has(String(program._id)))
            .map((program: any) => ({ id: String(program._id), name: program.name, code: program.code }));

        const registrations = await this.registrationModel.find({
            status: CourseRegistrationStatus.APPROVED,
            $or: [
                { resitLimitSnapshot: { $exists: false } },
                { resitLimitSnapshot: null },
            ],
        }).select('_id programId').lean();
        const registrationOperations = registrations.flatMap((registration: any) => {
            const limit = programLimits.get(String(registration.programId));
            return limit
                ? [{ updateOne: { filter: { _id: registration._id }, update: { $set: { resitLimitSnapshot: limit } } } }]
                : [];
        });

        const legacyEnrollments = await this.studentSessionModel.find({
            $or: [
                { level: { $exists: false } },
                { yearAttemptNumber: { $exists: false } },
                { isRepeatYear: { $exists: false } },
                { annualOutcome: { $exists: false } },
            ],
        }).select('_id studentId academicSessionId status').lean();
        const enrollmentOperations: any[] = [];
        const unresolvedEnrollments: string[] = [];
        for (const enrollment of legacyEnrollments as any[]) {
            const [student, levels] = await Promise.all([
                this.studentModel.findById(enrollment.studentId).select('academicSession currentLevel').lean(),
                this.registrationModel.distinct('level', {
                    studentId: enrollment.studentId,
                    academicSessionId: enrollment.academicSessionId,
                    status: CourseRegistrationStatus.APPROVED,
                }),
            ]);
            const distinctLevels = [...new Set(levels.map(Number).filter((level) => Number.isInteger(level) && level > 0))];
            const currentLevel = student && String(student.academicSession) === String(enrollment.academicSessionId)
                ? Number(student.currentLevel || 1)
                : null;
            const level = distinctLevels.length === 1 ? distinctLevels[0] : currentLevel;
            if (!level) {
                unresolvedEnrollments.push(String(enrollment._id));
                continue;
            }
            enrollmentOperations.push({
                updateOne: {
                    filter: { _id: enrollment._id },
                    update: {
                        $set: {
                            level,
                            yearAttemptNumber: 1,
                            isRepeatYear: false,
                            annualOutcome: StudentAnnualOutcome.IN_PROGRESS,
                        },
                    },
                },
            });
        }

        let progressionRebuild = null;
        if (apply) {
            if (registrationOperations.length) await this.registrationModel.bulkWrite(registrationOperations);
            if (enrollmentOperations.length) await this.studentSessionModel.bulkWrite(enrollmentOperations);
            progressionRebuild = await this.rebuildAll(true);
        }

        return {
            applied: Boolean(apply),
            programsMissingPolicy,
            approvedRegistrationsInspected: registrations.length,
            registrationSnapshotsReady: registrationOperations.length,
            legacyEnrollmentsInspected: legacyEnrollments.length,
            enrollmentRecordsReady: enrollmentOperations.length,
            unresolvedEnrollmentIds: unresolvedEnrollments.slice(0, 50),
            progressionRebuild,
        };
    }
}

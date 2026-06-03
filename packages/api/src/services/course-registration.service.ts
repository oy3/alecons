import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpsertCourseRegistrationDraftDto, SubmitCourseRegistrationDto } from '../dto/course-registration.dto';
import { AcademicSession, AcademicSessionDocument, SessionStatus } from '../schemas/academic-session.schema';
import {
    CourseRegistration,
    CourseRegistrationDocument,
    CourseRegistrationHistoryAction,
    CourseRegistrationStatus,
} from '../schemas/course-registration.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import {
    ProgramCourse,
    ProgramCourseCategory,
    ProgramCourseDocument,
} from '../schemas/program-course.schema';
import { SessionControl, SessionControlDocument } from '../schemas/session-control.schema';
import { Student, StudentDocument } from '../schemas/student.schema';

interface RegistrationEligibilityResult {
    eligible: boolean;
    reason: string | null;
    session: AcademicSessionDocument | null;
}

@Injectable()
export class CourseRegistrationService {
    constructor(
        @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
        @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
        @InjectModel(ProgramCourse.name) private programCourseModel: Model<ProgramCourseDocument>,
        @InjectModel(CourseRegistration.name) private courseRegistrationModel: Model<CourseRegistrationDocument>,
        @InjectModel(AcademicSession.name) private academicSessionModel: Model<AcademicSessionDocument>,
        @InjectModel(SessionControl.name) private sessionControlModel: Model<SessionControlDocument>,
    ) { }

    async getRegistrationContext(userId: string, level?: number, semester?: number) {
        const context = await this.getStudentContext(userId, level, semester);
        const isCurrentPeriod = this.isCurrentRegistrationPeriod(context.student, context.level, context.semester);
        const eligibility = await this.checkEligibility(context.student.academicSession);
        const existingRegistration = await this.findRegistration(
            context.student._id.toString(),
            context.student.academicSession.toString(),
            context.level,
            context.semester,
        );
        const availableCourses = isCurrentPeriod
            ? await this.getAvailableProgramCourses(
                context.student.programId._id?.toString?.() || context.student.programId.toString(),
                context.level,
                context.semester,
            )
            : [];
        const sessionTotals = await this.getSessionUnitSummary(
            context.student._id.toString(),
            context.student.academicSession.toString(),
            context.level,
            existingRegistration?._id?.toString() || null,
        );
        const currentSemesterUnits = existingRegistration?.totalUnits || 0;

        return {
            success: true,
            data: {
                eligibility: {
                    eligible: eligibility.eligible,
                    reason: eligibility.reason,
                },
                session: eligibility.session ? this.formatSession(eligibility.session) : null,
                student: {
                    id: context.student._id.toString(),
                    currentLevel: context.student.currentLevel || 1,
                    selectedLevel: context.level,
                    currentSemester: context.student.currentSemester,
                    selectedSemester: context.semester,
                    academicSessionId: context.student.academicSession.toString(),
                    entryAcademicSessionId: context.student.entryAcademicSession?.toString?.() || null,
                },
                access: {
                    isCurrentPeriod,
                    canRegister: isCurrentPeriod && eligibility.eligible,
                },
                program: this.formatProgram(context.student.programId),
                availableCourses: availableCourses.map((programCourse) => this.formatAvailableProgramCourse(programCourse)),
                registration: existingRegistration ? this.formatRegistration(existingRegistration) : null,
                sessionTotals: {
                    ...sessionTotals,
                    currentSemesterUnits,
                    totalRegisteredUnits: sessionTotals.otherSemesterUnits + currentSemesterUnits,
                },
            },
        };
    }

    async saveDraft(userId: string, payload: UpsertCourseRegistrationDraftDto) {
        const context = await this.getStudentContext(userId, payload.level, payload.semester);
        this.ensureCurrentRegistrationPeriod(context.student, context.level, context.semester);
        await this.ensureRegistrationIsOpen(context.student.academicSession);

        const existingRegistration = await this.findRegistration(
            context.student._id.toString(),
            context.student.academicSession.toString(),
            context.level,
            context.semester,
        );

        if (
            existingRegistration
            && [CourseRegistrationStatus.SUBMITTED, CourseRegistrationStatus.APPROVED].includes(existingRegistration.status)
        ) {
            throw new BadRequestException('This registration is already locked and cannot be edited.');
        }

        const { selectedProgramCourses, totalUnits } = await this.resolveSelectedProgramCourses(
            context.student.programId._id?.toString?.() || context.student.programId.toString(),
            context.level,
            context.semester,
            payload.items || [],
        );

        const registration = existingRegistration || new this.courseRegistrationModel({
            studentId: context.student._id,
            programId: context.student.programId._id || context.student.programId,
            academicSessionId: context.student.academicSession,
            level: context.level,
            semester: context.semester,
        });

        registration.programId = context.student.programId._id || context.student.programId;
        registration.items = selectedProgramCourses.map((programCourse) => ({ programCourseId: programCourse._id }));
        registration.totalUnits = totalUnits;
        registration.submissionVersion = existingRegistration?.submissionVersion || registration.submissionVersion || 0;
        registration.status = CourseRegistrationStatus.DRAFT;
        registration.submittedAt = null;
        registration.reviewedAt = null;
        registration.reviewedBy = null;
        registration.reviewComment = null;

        await registration.save();

        const populatedRegistration = await this.findRegistration(
            context.student._id.toString(),
            context.student.academicSession.toString(),
            context.level,
            context.semester,
        );
        const draftSessionTotals = await this.getSessionUnitSummary(
            context.student._id.toString(),
            context.student.academicSession.toString(),
            context.level,
            populatedRegistration?._id?.toString() || null,
        );

        return {
            success: true,
            message: 'Course registration draft saved successfully.',
            data: {
                registration: this.formatRegistration(populatedRegistration),
                sessionTotals: {
                    ...draftSessionTotals,
                    currentSemesterUnits: totalUnits,
                    totalRegisteredUnits: totalUnits + draftSessionTotals.otherSemesterUnits,
                },
            },
        };
    }

    async submit(userId: string, payload: SubmitCourseRegistrationDto) {
        const context = await this.getStudentContext(userId, payload.level, payload.semester);
        this.ensureCurrentRegistrationPeriod(context.student, context.level, context.semester);
        await this.ensureRegistrationIsOpen(context.student.academicSession);

        const existingRegistration = await this.findRegistration(
            context.student._id.toString(),
            context.student.academicSession.toString(),
            context.level,
            context.semester,
        );

        if (existingRegistration?.status === CourseRegistrationStatus.APPROVED) {
            throw new BadRequestException('This registration has already been approved and cannot be changed.');
        }

        if (existingRegistration?.status === CourseRegistrationStatus.SUBMITTED) {
            throw new BadRequestException('This registration has already been submitted and is awaiting review.');
        }

        const { selectedProgramCourses, totalUnits } = await this.resolveSelectedProgramCourses(
            context.student.programId._id?.toString?.() || context.student.programId.toString(),
            context.level,
            context.semester,
            payload.items,
        );

        if (!selectedProgramCourses.length) {
            throw new BadRequestException('Select at least one course before submitting registration.');
        }

        const compulsoryCourses = await this.programCourseModel
            .find({
                programId: context.student.programId._id || context.student.programId,
                level: context.level,
                semester: context.semester,
                active: true,
                category: ProgramCourseCategory.COMPULSORY,
            })
            .populate('courseId', 'code title')
            .exec();

        const selectedIds = new Set(selectedProgramCourses.map((programCourse) => programCourse._id.toString()));
        const missingCompulsoryCourses = compulsoryCourses.filter(
            (programCourse) => !selectedIds.has(programCourse._id.toString()),
        );

        if (missingCompulsoryCourses.length > 0) {
            const courseList = missingCompulsoryCourses
                .map((programCourse: any) => `${programCourse.courseId?.code || 'Course'} ${programCourse.courseId?.title || ''}`.trim())
                .join(', ');

            throw new BadRequestException(`All compulsory courses must be selected before submission. Missing: ${courseList}`);
        }

        const sessionTotals = await this.getSessionUnitSummary(
            context.student._id.toString(),
            context.student.academicSession.toString(),
            context.level,
            existingRegistration?._id?.toString() || null,
        );

        const nextSessionTotal = sessionTotals.otherSemesterUnits + totalUnits;
        const program = context.student.programId as any;
        const maxUnits = program?.maxUnits;

        if (typeof maxUnits === 'number' && nextSessionTotal > maxUnits) {
            throw new BadRequestException(
                `Selected courses exceed the session maximum of ${maxUnits} units. Current session total would be ${nextSessionTotal} units.`,
            );
        }

        const registration = existingRegistration || new this.courseRegistrationModel({
            studentId: context.student._id,
            programId: context.student.programId._id || context.student.programId,
            academicSessionId: context.student.academicSession,
            level: context.level,
            semester: context.semester,
        });

        const previousStatus = existingRegistration?.status || CourseRegistrationStatus.DRAFT;
        const submissionVersion = Math.max(existingRegistration?.submissionVersion || 0, 0) + 1;
        const submissionAction = submissionVersion === 1
            ? CourseRegistrationHistoryAction.SUBMITTED
            : CourseRegistrationHistoryAction.RESUBMITTED;

        registration.programId = context.student.programId._id || context.student.programId;
        registration.items = selectedProgramCourses.map((programCourse) => ({ programCourseId: programCourse._id }));
        registration.totalUnits = totalUnits;
        registration.submissionVersion = submissionVersion;
        registration.status = CourseRegistrationStatus.SUBMITTED;
        registration.submittedAt = new Date();
        registration.reviewedAt = null;
        registration.reviewedBy = null;
        registration.reviewComment = null;
        registration.workflowHistory = Array.isArray(registration.workflowHistory)
            ? registration.workflowHistory
            : [];
        registration.workflowHistory.push(this.buildWorkflowHistoryEntry({
            action: submissionAction,
            fromStatus: previousStatus,
            toStatus: CourseRegistrationStatus.SUBMITTED,
            performedBy: userId,
            actorRole: 'student',
            comment: null,
            submissionVersion,
            snapshot: this.buildHistorySnapshotFromProgramCourses(selectedProgramCourses, totalUnits),
        }));

        await registration.save();

        const populatedRegistration = await this.findRegistration(
            context.student._id.toString(),
            context.student.academicSession.toString(),
            context.level,
            context.semester,
        );

        return {
            success: true,
            message: 'Course registration submitted successfully.',
            data: {
                registration: this.formatRegistration(populatedRegistration),
                sessionTotals: {
                    ...sessionTotals,
                    currentSemesterUnits: totalUnits,
                    totalRegisteredUnits: nextSessionTotal,
                },
            },
        };
    }

    async getAdvisorPrograms(userId: string) {
        this.ensureValidObjectId(userId, 'Invalid user ID');

        const programs = await this.getOwnedPrograms(userId);

        return {
            success: true,
            data: programs.map((program) => this.formatAdvisorProgram(program)),
        };
    }

    async getAdvisorCourseRegistrations(
        userId: string,
        filters: {
            programId?: string;
            search?: string;
            state?: string;
            level?: number;
            semester?: number;
            page?: number;
            limit?: number;
        } = {},
    ) {
        this.ensureValidObjectId(userId, 'Invalid user ID');

        const ownedPrograms = await this.getOwnedPrograms(userId);
        if (!ownedPrograms.length) {
            return {
                success: true,
                data: {
                    programs: [],
                    program: null,
                    stats: this.createEmptyAdvisorStats(),
                    registrations: [],
                    pagination: {
                        page: 1,
                        limit: filters.limit || 10,
                        totalItems: 0,
                        totalPages: 0,
                    },
                },
            };
        }

        const selectedProgram = this.resolveAdvisorProgram(ownedPrograms, filters.programId);
        const normalizedLevel = filters.level ? Number(filters.level) : undefined;
        const normalizedSemester = filters.semester ? Number(filters.semester) : undefined;

        const students = await this.studentModel
            .find({ programId: selectedProgram._id, isActive: true })
            .populate({
                path: 'userId',
                select: 'firstName otherName lastName email role isActive',
            })
            .populate({
                path: 'academicSession',
                select: 'sessionYear startDate endDate status active',
            })
            .sort({ createdAt: 1 })
            .exec();

        const studentIds = students.map((student) => student._id);
        const registrations = await this.courseRegistrationModel
            .find({
                studentId: { $in: studentIds },
                programId: selectedProgram._id,
            })
            .populate({
                path: 'items.programCourseId',
                populate: [
                    { path: 'courseId', select: 'code title description active' },
                    { path: 'lecturerIds', select: 'firstName otherName lastName email role isActive' },
                ],
            })
            .populate({
                path: 'reviewedBy',
                select: 'firstName otherName lastName email role isActive',
            })
            .sort({ updatedAt: -1 })
            .exec();

        const registrationMap = new Map<string, any>();
        registrations.forEach((registration) => {
            const key = this.buildRegistrationKey(
                this.extractId(registration.studentId),
                this.extractId(registration.academicSessionId),
                registration.level,
                registration.semester,
            );
            registrationMap.set(key, registration);
        });

        const rows = students.map((student) => {
            const level = normalizedLevel || student.currentLevel || 1;
            const semester = normalizedSemester || student.currentSemester || 1;
            const registration = registrationMap.get(
                this.buildRegistrationKey(
                    this.extractId(student._id),
                    this.extractId(student.academicSession),
                    level,
                    semester,
                ),
            ) || null;

            return this.formatAdvisorRegistrationRow(student, selectedProgram, registration, level, semester);
        });

        const filteredRows = this.applyAdvisorRegistrationFilters(rows, filters);
        const stats = this.buildAdvisorRegistrationStats(rows);
        const requestedPage = Math.max(Number(filters.page || 1), 1);
        const limit = Math.min(Math.max(Number(filters.limit || 10), 1), 100);
        const totalItems = filteredRows.length;
        const totalPages = totalItems ? Math.ceil(totalItems / limit) : 0;
        const page = totalPages ? Math.min(requestedPage, totalPages) : 1;
        const pagedRows = filteredRows.slice((page - 1) * limit, (page - 1) * limit + limit);

        return {
            success: true,
            data: {
                programs: ownedPrograms.map((program) => this.formatAdvisorProgram(program)),
                program: this.formatAdvisorProgram(selectedProgram),
                stats,
                registrations: pagedRows,
                pagination: {
                    page,
                    limit,
                    totalItems,
                    totalPages,
                },
            },
        };
    }

    async getAdvisorCourseRegistrationById(userId: string, registrationId: string) {
        this.ensureValidObjectId(userId, 'Invalid user ID');
        this.ensureValidObjectId(registrationId, 'Invalid registration ID');

        const registration = await this.courseRegistrationModel
            .findById(registrationId)
            .populate({
                path: 'studentId',
                populate: [
                    { path: 'userId', select: 'firstName otherName lastName email role isActive' },
                    { path: 'academicSession', select: 'sessionYear startDate endDate status active' },
                ],
            })
            .populate({
                path: 'programId',
                populate: [
                    { path: 'programTypeId', select: 'type description' },
                    { path: 'programModeId', select: 'mode description' },
                    { path: 'departmentId', select: 'name' },
                    { path: 'courseAdvisorId', select: 'firstName otherName lastName email role isActive' },
                ],
            })
            .populate({
                path: 'items.programCourseId',
                populate: [
                    { path: 'courseId', select: 'code title description active' },
                    { path: 'lecturerIds', select: 'firstName otherName lastName email role isActive' },
                ],
            })
            .populate({
                path: 'reviewedBy',
                select: 'firstName otherName lastName email role isActive',
            })
            .populate({
                path: 'workflowHistory.performedBy',
                select: 'firstName otherName lastName email role isActive',
            })
            .exec();

        if (!registration) {
            throw new NotFoundException('Course registration not found');
        }

        this.assertAdvisorOwnership(userId, registration.programId as any);

        return {
            success: true,
            data: {
                registration: this.formatAdvisorRegistrationDetail(registration),
            },
        };
    }

    async approveAdvisorCourseRegistration(userId: string, registrationId: string, reviewComment?: string, actorRole?: string) {
        return this.reviewAdvisorCourseRegistration(userId, registrationId, CourseRegistrationStatus.APPROVED, reviewComment, actorRole);
    }

    async rejectAdvisorCourseRegistration(userId: string, registrationId: string, reviewComment?: string, actorRole?: string) {
        return this.reviewAdvisorCourseRegistration(userId, registrationId, CourseRegistrationStatus.REJECTED, reviewComment, actorRole);
    }

    private async getStudentContext(userId: string, level?: number, semester?: number) {
        if (!Types.ObjectId.isValid(userId)) {
            throw new BadRequestException('Invalid user ID');
        }

        const student = await this.studentModel
            .findOne({ userId: new Types.ObjectId(userId), isActive: true })
            .populate({
                path: 'programId',
                select: 'name code durationYears minUnits maxUnits courseAdvisorId programTypeId programModeId',
                populate: [
                    { path: 'programTypeId', select: 'type description' },
                    { path: 'programModeId', select: 'mode description' },
                    { path: 'courseAdvisorId', select: 'firstName otherName lastName email role isActive' },
                ],
            })
            .exec();

        if (!student) {
            throw new NotFoundException('Student record not found');
        }

        if (!student.academicSession) {
            throw new BadRequestException('Student academic session is not configured.');
        }

        if (!student.programId) {
            throw new BadRequestException('Student program is not configured.');
        }

        const studentCurrentLevel = student.currentLevel || 1;
        const studentCurrentSemester = student.currentSemester || 1;
        const normalizedLevel = level || studentCurrentLevel;
        const maxLevel = Math.max((student.programId as any)?.durationYears || 0, 1);

        if (!Number.isInteger(normalizedLevel) || normalizedLevel < 1) {
            throw new BadRequestException('Level must be a positive whole number.');
        }

        if (normalizedLevel > maxLevel) {
            throw new BadRequestException(`Level must not exceed the program duration of ${maxLevel}.`);
        }

        const normalizedSemester = semester || studentCurrentSemester;
        if (![1, 2].includes(normalizedSemester)) {
            throw new BadRequestException('Semester must be either 1 or 2.');
        }

        return {
            student,
            level: normalizedLevel,
            semester: normalizedSemester,
        };
    }

    private async reviewAdvisorCourseRegistration(
        userId: string,
        registrationId: string,
        status: CourseRegistrationStatus.APPROVED | CourseRegistrationStatus.REJECTED,
        reviewComment?: string,
        actorRole?: string,
    ) {
        const registration = await this.courseRegistrationModel
            .findById(registrationId)
            .populate({
                path: 'programId',
                populate: [
                    { path: 'programTypeId', select: 'type description' },
                    { path: 'programModeId', select: 'mode description' },
                    { path: 'departmentId', select: 'name' },
                    { path: 'courseAdvisorId', select: 'firstName otherName lastName email role isActive' },
                ],
            })
            .populate({
                path: 'studentId',
                populate: [
                    { path: 'userId', select: 'firstName otherName lastName email role isActive' },
                    { path: 'academicSession', select: 'sessionYear startDate endDate status active' },
                ],
            })
            .populate({
                path: 'items.programCourseId',
                populate: [
                    { path: 'courseId', select: 'code title description active' },
                    { path: 'lecturerIds', select: 'firstName otherName lastName email role isActive' },
                ],
            })
            .populate({
                path: 'reviewedBy',
                select: 'firstName otherName lastName email role isActive',
            })
            .populate({
                path: 'workflowHistory.performedBy',
                select: 'firstName otherName lastName email role isActive',
            })
            .exec();

        if (!registration) {
            throw new NotFoundException('Course registration not found');
        }

        this.assertAdvisorOwnership(userId, registration.programId as any);

        if (registration.status !== CourseRegistrationStatus.SUBMITTED) {
            throw new BadRequestException('Only submitted registrations can be reviewed.');
        }

        const submissionVersion = Math.max(registration.submissionVersion || 1, 1);

        registration.workflowHistory = Array.isArray(registration.workflowHistory)
            ? registration.workflowHistory
            : [];
        registration.workflowHistory.push(this.buildWorkflowHistoryEntry({
            action: status === CourseRegistrationStatus.APPROVED
                ? CourseRegistrationHistoryAction.APPROVED
                : CourseRegistrationHistoryAction.REJECTED,
            fromStatus: CourseRegistrationStatus.SUBMITTED,
            toStatus: status,
            performedBy: userId,
            actorRole: actorRole || 'staff',
            comment: reviewComment?.trim() || null,
            submissionVersion,
            snapshot: this.buildHistorySnapshotFromRegistration(registration),
        }));
        registration.submissionVersion = submissionVersion;
        registration.status = status;
        registration.reviewedBy = new Types.ObjectId(userId);
        registration.reviewedAt = new Date();
        registration.reviewComment = reviewComment?.trim() || null;

        await registration.save();
        await registration.populate([
            {
                path: 'reviewedBy',
                select: 'firstName otherName lastName email role isActive',
            },
            {
                path: 'workflowHistory.performedBy',
                select: 'firstName otherName lastName email role isActive',
            },
        ]);

        return {
            success: true,
            message: status === CourseRegistrationStatus.APPROVED
                ? 'Course registration approved successfully.'
                : 'Course registration rejected successfully.',
            data: {
                registration: this.formatAdvisorRegistrationDetail(registration),
            },
        };
    }

    private async getOwnedPrograms(userId: string) {
        return this.programModel
            .find({ courseAdvisorId: new Types.ObjectId(userId) })
            .populate('programTypeId', 'type description')
            .populate('programModeId', 'mode description')
            .populate('departmentId', 'name')
            .sort({ name: 1 })
            .exec();
    }

    private resolveAdvisorProgram(programs: any[], programId?: string) {
        if (!programId) {
            return programs[0];
        }

        const selectedProgram = programs.find((program) => this.extractId(program._id) === programId);

        if (!selectedProgram) {
            throw new NotFoundException('Program not found for this advisor');
        }

        return selectedProgram;
    }

    private assertAdvisorOwnership(userId: string, program: any) {
        const courseAdvisorId = this.extractId(program?.courseAdvisorId);

        if (!courseAdvisorId || courseAdvisorId !== userId) {
            throw new NotFoundException('Course registration not found');
        }
    }

    private ensureValidObjectId(value: string, message: string) {
        if (!Types.ObjectId.isValid(value)) {
            throw new BadRequestException(message);
        }
    }

    private extractId(value: any) {
        return value?._id?.toString?.() || value?.toString?.() || null;
    }

    private buildRegistrationKey(studentId: string | null, academicSessionId: string | null, level: number, semester: number) {
        return [studentId || '', academicSessionId || '', level, semester].join('|');
    }

    private applyAdvisorRegistrationFilters(rows: any[], filters: { search?: string; state?: string; level?: number; semester?: number; }) {
        const search = (filters.search || '').trim().toLowerCase();
        const state = (filters.state || 'all').trim().toLowerCase();

        return rows.filter((row) => {
            if (filters.level && Number(filters.level) !== Number(row.level)) {
                return false;
            }

            if (filters.semester && Number(filters.semester) !== Number(row.semester)) {
                return false;
            }

            if (state !== 'all') {
                if (state === 'registered') {
                    if (row.state === 'not_registered') {
                        return false;
                    }
                } else if (row.state !== state) {
                    return false;
                }
            }

            if (!search) {
                return true;
            }

            const haystack = [
                row.student?.firstName,
                row.student?.otherName,
                row.student?.lastName,
                row.student?.fullName,
                row.student?.matriculationNumber,
                row.program?.name,
                row.program?.code,
                row.status,
                row.reviewComment,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(search);
        });
    }

    private buildAdvisorRegistrationStats(rows: any[]) {
        const stats = this.createEmptyAdvisorStats();

        rows.forEach((row) => {
            stats.totalStudents += 1;

            if (row.state === 'not_registered') {
                stats.notRegisteredStudents += 1;
                return;
            }

            stats.registeredStudents += 1;

            if (row.state === CourseRegistrationStatus.APPROVED) {
                stats.approvedStudents += 1;
            } else if (row.state === CourseRegistrationStatus.SUBMITTED) {
                stats.pendingStudents += 1;
            } else if (row.state === CourseRegistrationStatus.REJECTED) {
                stats.rejectedStudents += 1;
            } else if (row.state === CourseRegistrationStatus.DRAFT) {
                stats.draftStudents += 1;
            }
        });

        return stats;
    }

    private createEmptyAdvisorStats() {
        return {
            totalStudents: 0,
            registeredStudents: 0,
            approvedStudents: 0,
            pendingStudents: 0,
            rejectedStudents: 0,
            draftStudents: 0,
            notRegisteredStudents: 0,
        };
    }

    private formatAdvisorProgram(program: any) {
        return {
            id: this.extractId(program?._id),
            name: program?.name,
            code: program?.code,
            description: program?.description,
            minUnits: program?.minUnits,
            maxUnits: program?.maxUnits,
            durationYears: program?.durationYears,
            courseAdvisorId: this.extractId(program?.courseAdvisorId),
            department: program?.departmentId ? {
                id: this.extractId(program.departmentId),
                name: program.departmentId.name,
            } : null,
            programType: program?.programTypeId ? {
                id: this.extractId(program.programTypeId),
                type: program.programTypeId.type,
                description: program.programTypeId.description,
            } : null,
            programMode: program?.programModeId ? {
                id: this.extractId(program.programModeId),
                mode: program.programModeId.mode,
                description: program.programModeId.description,
            } : null,
        };
    }

    private formatAdvisorRegistrationRow(student: any, program: any, registration: any, level: number, semester: number) {
        const user = student?.userId;
        const status = registration?.status || 'not_registered';

        return {
            id: registration?._id?.toString?.() || null,
            state: status,
            canReview: status === CourseRegistrationStatus.SUBMITTED,
            submissionVersion: registration?.submissionVersion || 0,
            student: {
                id: this.extractId(student?._id),
                userId: this.extractId(user),
                firstName: user?.firstName,
                otherName: user?.otherName,
                lastName: user?.lastName,
                fullName: [user?.firstName, user?.otherName, user?.lastName].filter(Boolean).join(' '),
                matriculationNumber: student?.matriculationNumber,
            },
            program: this.formatAdvisorProgram(program),
            level,
            semester,
            totalUnits: registration?.totalUnits || 0,
            courseCount: Array.isArray(registration?.items) ? registration.items.length : 0,
            submittedAt: registration?.submittedAt || null,
            reviewedAt: registration?.reviewedAt || null,
            reviewedBy: registration?.reviewedBy ? {
                id: this.extractId(registration.reviewedBy),
                firstName: registration.reviewedBy.firstName,
                otherName: registration.reviewedBy.otherName,
                lastName: registration.reviewedBy.lastName,
                email: registration.reviewedBy.email,
            } : null,
            reviewComment: registration?.reviewComment || null,
        };
    }

    private formatAdvisorRegistrationDetail(registration: any) {
        const student = registration?.studentId;
        const user = student?.userId;
        const program = registration?.programId;

        return {
            id: this.extractId(registration?._id),
            state: registration?.status || 'not_registered',
            student: {
                id: this.extractId(student?._id),
                userId: this.extractId(user),
                firstName: user?.firstName,
                otherName: user?.otherName,
                lastName: user?.lastName,
                fullName: [user?.firstName, user?.otherName, user?.lastName].filter(Boolean).join(' '),
                matriculationNumber: student?.matriculationNumber,
            },
            program: this.formatAdvisorProgram(program),
            academicSession: student?.academicSession ? this.formatSession(student.academicSession) : null,
            level: registration?.level,
            semester: registration?.semester,
            totalUnits: registration?.totalUnits || 0,
            submissionVersion: registration?.submissionVersion || 0,
            submittedAt: registration?.submittedAt || null,
            reviewedAt: registration?.reviewedAt || null,
            reviewedBy: registration?.reviewedBy ? {
                id: this.extractId(registration.reviewedBy),
                firstName: registration.reviewedBy.firstName,
                otherName: registration.reviewedBy.otherName,
                lastName: registration.reviewedBy.lastName,
                email: registration.reviewedBy.email,
            } : null,
            reviewComment: registration?.reviewComment || null,
            history: this.formatWorkflowHistory(registration?.workflowHistory),
            items: Array.isArray(registration?.items)
                ? registration.items.map((item: any) => ({
                    programCourseId: item.programCourseId?._id?.toString?.() || item.programCourseId?.toString?.() || null,
                    programCourse: item.programCourseId ? this.formatAvailableProgramCourse(item.programCourseId) : null,
                }))
                : [],
        };
    }

    private isCurrentRegistrationPeriod(student: StudentDocument, level: number, semester: number) {
        const studentCurrentLevel = student.currentLevel || 1;
        const studentCurrentSemester = student.currentSemester || 1;

        return level === studentCurrentLevel && semester === studentCurrentSemester;
    }

    private ensureCurrentRegistrationPeriod(student: StudentDocument, level: number, semester: number) {
        if (this.isCurrentRegistrationPeriod(student, level, semester)) {
            return;
        }

        const studentCurrentLevel = student.currentLevel || 1;
        const studentCurrentSemester = student.currentSemester || 1;

        throw new BadRequestException(
            `Course registration is only available for your current level and semester: level ${studentCurrentLevel}, semester ${studentCurrentSemester}.`,
        );
    }

    private async checkEligibility(
        academicSessionId: Types.ObjectId,
    ): Promise<RegistrationEligibilityResult> {
        const academicSession = await this.academicSessionModel.findById(academicSessionId).exec();

        if (!academicSession) {
            return {
                eligible: false,
                reason: 'Your academic session could not be found.',
                session: null,
            };
        }

        if (![SessionStatus.OPEN, SessionStatus.ONGOING].includes(academicSession.status)) {
            return {
                eligible: false,
                reason: `Course registration is not open for ${academicSession.sessionYear}.`,
                session: academicSession,
            };
        }

        const sessionControl = await this.sessionControlModel.findOne({ academicSessionId: academicSession._id }).exec();
        const courseRegistrationControl = sessionControl?.controls?.find(
            (control) => control.name === 'courseRegistration',
        );

        if (!courseRegistrationControl?.active) {
            return {
                eligible: false,
                reason: `Course registration is currently closed for ${academicSession.sessionYear}.`,
                session: academicSession,
            };
        }

        return {
            eligible: true,
            reason: null,
            session: academicSession,
        };
    }

    private async ensureRegistrationIsOpen(academicSessionId: Types.ObjectId) {
        const eligibility = await this.checkEligibility(academicSessionId);

        if (!eligibility.eligible) {
            throw new BadRequestException(eligibility.reason || 'Course registration is currently unavailable.');
        }

        return eligibility.session;
    }

    private async getAvailableProgramCourses(programId: string, level: number, semester: number) {
        return this.programCourseModel
            .find({
                programId: new Types.ObjectId(programId),
                level,
                semester,
                active: true,
            })
            .populate('courseId', 'code title description active')
            .populate('lecturerIds', 'firstName otherName lastName email role isActive')
            .sort({ category: 1, createdAt: 1 })
            .exec();
    }

    private async resolveSelectedProgramCourses(
        programId: string,
        level: number,
        semester: number,
        selectedIds: string[],
    ) {
        const normalizedIds = [...new Set((selectedIds || []).filter(Boolean))];

        if (!normalizedIds.length) {
            return {
                selectedProgramCourses: [],
                totalUnits: 0,
            };
        }

        const availableProgramCourses = await this.getAvailableProgramCourses(programId, level, semester);
        const availableMap = new Map(
            availableProgramCourses.map((programCourse) => [programCourse._id.toString(), programCourse]),
        );

        const invalidSelections = normalizedIds.filter((id) => !availableMap.has(id));
        if (invalidSelections.length > 0) {
            throw new BadRequestException('One or more selected courses are invalid for your current program, level, or semester.');
        }

        const selectedProgramCourses = normalizedIds.map((id) => availableMap.get(id)!);
        const totalUnits = selectedProgramCourses.reduce((sum, programCourse) => sum + programCourse.units, 0);

        return {
            selectedProgramCourses,
            totalUnits,
        };
    }

    private async findRegistration(studentId: string, academicSessionId: string, level: number, semester: number) {
        return this.courseRegistrationModel
            .findOne({
                studentId: new Types.ObjectId(studentId),
                academicSessionId: new Types.ObjectId(academicSessionId),
                level,
                semester,
            })
            .populate({
                path: 'items.programCourseId',
                populate: [
                    { path: 'courseId', select: 'code title description active' },
                    { path: 'lecturerIds', select: 'firstName otherName lastName email role isActive' },
                ],
            })
            .populate({
                path: 'reviewedBy',
                select: 'firstName otherName lastName email role isActive',
            })
            .exec();

    }

    private async getSessionUnitSummary(
        studentId: string,
        academicSessionId: string,
        level: number,
        excludeRegistrationId: string | null,
    ) {
        const registrations = await this.courseRegistrationModel.find({
            studentId: new Types.ObjectId(studentId),
            academicSessionId: new Types.ObjectId(academicSessionId),
            level,
            ...(excludeRegistrationId
                ? { _id: { $ne: new Types.ObjectId(excludeRegistrationId) } }
                : {}),
            status: { $in: [CourseRegistrationStatus.DRAFT, CourseRegistrationStatus.SUBMITTED, CourseRegistrationStatus.APPROVED] },
        });

        const otherSemesterUnits = registrations.reduce((sum, registration) => sum + (registration.totalUnits || 0), 0);

        return {
            otherSemesterUnits,
            currentSemesterUnits: 0,
            totalRegisteredUnits: otherSemesterUnits,
        };
    }

    private formatProgram(program: any) {
        const advisor = program.courseAdvisorId;

        return {
            id: program._id?.toString?.() || program._id,
            name: program.name,
            code: program.code,
            minUnits: program.minUnits,
            maxUnits: program.maxUnits,
            durationYears: program.durationYears,
            programType: program.programTypeId?.type || null,
            programMode: program.programModeId?.mode || null,
            courseAdvisorId: advisor?._id?.toString?.() || advisor?.toString?.() || null,
            courseAdvisor: advisor ? {
                id: advisor._id?.toString?.() || advisor.toString?.() || null,
                firstName: advisor.firstName,
                otherName: advisor.otherName,
                lastName: advisor.lastName,
                email: advisor.email,
                role: advisor.role,
                isActive: advisor.isActive,
            } : null,
        };
    }

    private formatSession(session: AcademicSessionDocument) {
        return {
            id: session._id.toString(),
            sessionYear: session.sessionYear,
            startDate: session.startDate,
            endDate: session.endDate,
            status: session.status,
            active: session.active,
        };
    }

    private formatAvailableProgramCourse(programCourse: any) {
        return {
            id: programCourse._id.toString(),
            units: programCourse.units,
            hours: programCourse.hours,
            level: programCourse.level,
            semester: programCourse.semester,
            category: programCourse.category,
            course: programCourse.courseId ? {
                id: programCourse.courseId._id?.toString?.() || null,
                code: programCourse.courseId.code,
                title: programCourse.courseId.title,
                description: programCourse.courseId.description,
                active: programCourse.courseId.active,
            } : null,
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
        };
    }

    private formatRegistration(registration: any) {
        return {
            id: registration._id.toString(),
            level: registration.level,
            semester: registration.semester,
            totalUnits: registration.totalUnits,
            submissionVersion: registration.submissionVersion || 0,
            status: registration.status,
            submittedAt: registration.submittedAt,
            reviewedAt: registration.reviewedAt,
            reviewedBy: registration?.reviewedBy ? {
                id: this.extractId(registration.reviewedBy),
                firstName: registration.reviewedBy.firstName,
                otherName: registration.reviewedBy.otherName,
                lastName: registration.reviewedBy.lastName,
                email: registration.reviewedBy.email,
            } : null,
            reviewComment: registration.reviewComment,
            items: Array.isArray(registration.items)
                ? registration.items.map((item: any) => ({
                    programCourseId: item.programCourseId?._id?.toString?.() || item.programCourseId?.toString?.() || null,
                    programCourse: item.programCourseId ? this.formatAvailableProgramCourse(item.programCourseId) : null,
                }))
                : [],
        };
    }

    private buildWorkflowHistoryEntry(payload: {
        action: CourseRegistrationHistoryAction;
        fromStatus?: CourseRegistrationStatus;
        toStatus: CourseRegistrationStatus;
        performedBy?: string | Types.ObjectId | null;
        actorRole?: string | null;
        comment?: string | null;
        submissionVersion: number;
        snapshot: {
            totalUnits: number;
            courseCount: number;
            items: Array<{
                programCourseId: Types.ObjectId | string;
                courseCode?: string | null;
                courseTitle?: string | null;
                units?: number | null;
                category?: string | null;
            }>;
        };
    }) {
        return {
            action: payload.action,
            fromStatus: payload.fromStatus,
            toStatus: payload.toStatus,
            performedBy: payload.performedBy ? new Types.ObjectId(String(payload.performedBy)) : undefined,
            actorRole: payload.actorRole || undefined,
            comment: payload.comment || undefined,
            submissionVersion: payload.submissionVersion,
            snapshot: {
                totalUnits: payload.snapshot.totalUnits,
                courseCount: payload.snapshot.courseCount,
                items: payload.snapshot.items.map((item) => ({
                    programCourseId: new Types.ObjectId(String(item.programCourseId)),
                    courseCode: item.courseCode || undefined,
                    courseTitle: item.courseTitle || undefined,
                    units: item.units ?? undefined,
                    category: item.category || undefined,
                })),
            },
            createdAt: new Date(),
        };
    }

    private buildHistorySnapshotFromProgramCourses(programCourses: any[], totalUnits: number) {
        return {
            totalUnits,
            courseCount: Array.isArray(programCourses) ? programCourses.length : 0,
            items: Array.isArray(programCourses)
                ? programCourses.map((programCourse: any) => ({
                    programCourseId: programCourse._id,
                    courseCode: programCourse.courseId?.code || null,
                    courseTitle: programCourse.courseId?.title || null,
                    units: programCourse.units,
                    category: programCourse.category,
                }))
                : [],
        };
    }

    private buildHistorySnapshotFromRegistration(registration: any) {
        const items = Array.isArray(registration?.items) ? registration.items : [];

        return {
            totalUnits: registration?.totalUnits || 0,
            courseCount: items.length,
            items: items
                .map((item: any) => item?.programCourseId)
                .filter(Boolean)
                .map((programCourse: any) => ({
                    programCourseId: programCourse._id || programCourse,
                    courseCode: programCourse.courseId?.code || null,
                    courseTitle: programCourse.courseId?.title || null,
                    units: programCourse.units,
                    category: programCourse.category,
                })),
        };
    }

    private formatWorkflowHistory(history: any[]) {
        if (!Array.isArray(history) || !history.length) {
            return [];
        }

        return [...history]
            .sort((left, right) => {
                const leftTime = new Date(left?.createdAt || 0).getTime();
                const rightTime = new Date(right?.createdAt || 0).getTime();
                return rightTime - leftTime;
            })
            .map((entry: any) => ({
                action: entry.action,
                fromStatus: entry.fromStatus,
                toStatus: entry.toStatus,
                createdAt: entry.createdAt,
                actorRole: entry.actorRole || null,
                comment: entry.comment || null,
                submissionVersion: entry.submissionVersion || 0,
                performedBy: entry?.performedBy ? {
                    id: this.extractId(entry.performedBy),
                    firstName: entry.performedBy.firstName,
                    otherName: entry.performedBy.otherName,
                    lastName: entry.performedBy.lastName,
                    email: entry.performedBy.email,
                    role: entry.performedBy.role,
                } : null,
                snapshot: {
                    totalUnits: entry?.snapshot?.totalUnits || 0,
                    courseCount: entry?.snapshot?.courseCount || 0,
                    items: Array.isArray(entry?.snapshot?.items)
                        ? entry.snapshot.items.map((item: any) => ({
                            programCourseId: this.extractId(item?.programCourseId),
                            courseCode: item?.courseCode || null,
                            courseTitle: item?.courseTitle || null,
                            units: item?.units || 0,
                            category: item?.category || null,
                        }))
                        : [],
                },
            }));
    }
}

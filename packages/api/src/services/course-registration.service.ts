import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpsertCourseRegistrationDraftDto, SubmitCourseRegistrationDto } from '../dto/course-registration.dto';
import { AcademicSession, AcademicSessionDocument, SessionStatus } from '../schemas/academic-session.schema';
import {
    CourseRegistration,
    CourseRegistrationDocument,
    CourseRegistrationStatus,
} from '../schemas/course-registration.schema';
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

        registration.programId = context.student.programId._id || context.student.programId;
        registration.items = selectedProgramCourses.map((programCourse) => ({ programCourseId: programCourse._id }));
        registration.totalUnits = totalUnits;
        registration.status = CourseRegistrationStatus.SUBMITTED;
        registration.submittedAt = new Date();
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
                reason: `Course registration is currently disabled for ${academicSession.sessionYear}.`,
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
            status: registration.status,
            submittedAt: registration.submittedAt,
            reviewedAt: registration.reviewedAt,
            reviewComment: registration.reviewComment,
            items: Array.isArray(registration.items)
                ? registration.items.map((item: any) => ({
                    programCourseId: item.programCourseId?._id?.toString?.() || item.programCourseId?.toString?.() || null,
                    programCourse: item.programCourseId ? this.formatAvailableProgramCourse(item.programCourseId) : null,
                }))
                : [],
        };
    }
}

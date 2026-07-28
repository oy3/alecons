import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { AcademicResult, AcademicResultAttemptType, AcademicResultDocument, AcademicResultSpecialStatus, AcademicResultWorkflowStatus } from '../schemas/academic-result.schema';
import { AcademicResultAudit, AcademicResultAuditDocument } from '../schemas/academic-result-audit.schema';
import { AcademicSession, AcademicSessionDocument } from '../schemas/academic-session.schema';
import { CourseRegistration, CourseRegistrationDocument, CourseRegistrationStatus } from '../schemas/course-registration.schema';
import { Department, DepartmentDocument } from '../schemas/department.schema';
import { GradeScaleStatus, GradeScaleVersion, GradeScaleVersionDocument } from '../schemas/grade-scale-version.schema';
import { ProgramCourse, ProgramCourseDocument } from '../schemas/program-course.schema';
import { Role, RoleDocument } from '../schemas/role.schema';
import { Staff, StaffDocument } from '../schemas/staff.schema';
import { StudentAcademicSummary, StudentAcademicSummaryDocument } from '../schemas/student-academic-summary.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import {
  calculateAcademicResult,
  assertAcademicWorkflowTransition,
  buildAcademicProgress,
  nextAcademicAttemptType,
  roundAcademicValue,
  validateAssessmentComponents,
  validateGradeBands,
} from './academic-result-calculator';

type WorkflowQueue = 'lecturer' | 'hod' | 'hod-ready' | 'provost' | 'publish' | 'published';

@Injectable()
export class AcademicResultsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(GradeScaleVersion.name) private readonly gradeScaleModel: Model<GradeScaleVersionDocument>,
    @InjectModel(ProgramCourse.name) private readonly programCourseModel: Model<ProgramCourseDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Staff.name) private readonly staffModel: Model<StaffDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(AcademicResult.name) private readonly resultModel: Model<AcademicResultDocument>,
    @InjectModel(AcademicResultAudit.name) private readonly auditModel: Model<AcademicResultAuditDocument>,
    @InjectModel(AcademicSession.name) private readonly academicSessionModel: Model<AcademicSessionDocument>,
    @InjectModel(StudentAcademicSummary.name) private readonly summaryModel: Model<StudentAcademicSummaryDocument>,
    @InjectModel(CourseRegistration.name) private readonly registrationModel: Model<CourseRegistrationDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Department.name) private readonly departmentModel: Model<DepartmentDocument>,
  ) {}

  async listGradeScales(userId: string) {
    await this.assertAnyPermission(userId, ['view', 'configure']);
    return this.gradeScaleModel.find().sort({ version: -1, createdAt: -1 }).lean();
  }

  async createGradeScale(userId: string, payload: any) {
    await this.assertPermission(userId, 'configure');
    this.validateBands(payload.bands, Number(payload.gpaScale || 4));
    const status = payload.status || GradeScaleStatus.DRAFT;
    let created: GradeScaleVersionDocument | null = null;
    await this.withTransaction(async (session) => {
      const latest = await this.gradeScaleModel.findOne().sort({ version: -1 }).select('version').session(session).lean();
      const version = Number(latest?.version || 0) + 1;
      if (status === GradeScaleStatus.ACTIVE) {
        await this.gradeScaleModel.updateMany(
          { status: GradeScaleStatus.ACTIVE },
          { status: GradeScaleStatus.RETIRED, updatedBy: this.objectId(userId, 'user') },
          { session },
        );
      }
      created = new this.gradeScaleModel({ name: payload.name?.trim(), gpaScale: Number(payload.gpaScale || 4), version, bands: payload.bands, status, createdBy: this.objectId(userId, 'user') });
      await created.save({ session });
    });
    return created;
  }

  async updateGradeScaleStatus(userId: string, gradeScaleId: string, status: GradeScaleStatus.ACTIVE | GradeScaleStatus.RETIRED) {
    await this.assertPermission(userId, 'configure');
    const actor = this.objectId(userId, 'user');
    let updated: GradeScaleVersionDocument | null = null;
    await this.withTransaction(async (session) => {
      const scale = await this.gradeScaleModel.findById(this.objectId(gradeScaleId, 'grade scale')).session(session);
      if (!scale) throw new NotFoundException('Grade scale not found');
      if (scale.status === status) { updated = scale; return; }
      if (scale.status === GradeScaleStatus.ACTIVE && status === GradeScaleStatus.RETIRED) {
        throw new BadRequestException('Activate another grade scale to replace the current one');
      }
      if (status === GradeScaleStatus.ACTIVE) {
        await this.gradeScaleModel.updateMany(
          { _id: { $ne: scale._id }, status: GradeScaleStatus.ACTIVE },
          { $set: { status: GradeScaleStatus.RETIRED, updatedBy: actor } },
          { session },
        );
      }
      scale.status = status;
      scale.updatedBy = actor;
      updated = await scale.save({ session });
    });
    return updated;
  }

  async getLecturerCourses(userId: string, query: { programId?: string; level?: number } = {}) {
    await this.assertPermission(userId, 'enter_scores');
    const filter: any = { active: true };
    if (query.programId) filter.programId = this.objectId(query.programId, 'program');
    if (query.level) filter.level = Number(query.level);
    if (!(await this.isAdmin(userId))) filter.lecturerIds = this.objectId(userId, 'user');
    return this.programCourseModel.find(filter)
      .populate('courseId', 'code title active')
      .populate({ path: 'programId', populate: [{ path: 'departmentId', select: 'name code' }, { path: 'programTypeId', select: 'type active' }, { path: 'programModeId', select: 'mode active' }] })
      .sort({ level: 1, semester: 1 })
      .lean();
  }

  async getScoreSheet(userId: string, programCourseId: string, attemptType: AcademicResultAttemptType = AcademicResultAttemptType.INITIAL) {
    await this.assertPermission(userId, 'enter_scores');
    const programCourse = await this.findProgramCourse(programCourseId);
    await this.assertProgramCourseLecturer(userId, programCourse);
    this.validateComponents(programCourse.assessmentComponents || []);
    const program: any = programCourse.programId;
    const students = await this.studentModel.find({ programId: program._id, currentLevel: programCourse.level, isActive: true, status: 'active' })
      .populate('userId', 'firstName otherName lastName email')
      .populate('academicSession', 'title sessionYear')
      .sort({ matriculationNumber: 1 })
      .lean();
    const studentIds = students.map((student: any) => student._id);
    const registrations = await this.registrationModel.find({
      studentId: { $in: studentIds },
      programId: program._id,
      level: programCourse.level,
      semester: programCourse.semester,
      status: CourseRegistrationStatus.APPROVED,
      'items.programCourseId': programCourse._id,
    }).lean();
    const registrationByStudent = new Map(registrations.map((registration: any) => [String(registration.studentId), registration]));
    const eligibleStudents = students.filter((student: any) => {
      const registration: any = registrationByStudent.get(String(student._id));
      return registration && String(registration.academicSessionId) === String(student.academicSession?._id || student.academicSession);
    });
    if (!Object.values(AcademicResultAttemptType).includes(attemptType)) {
      throw new BadRequestException('Invalid result attempt type');
    }
    const results = await this.resultModel.find({ studentId: { $in: eligibleStudents.map((student: any) => student._id) }, programCourseId: programCourse._id }).sort({ attemptNumber: -1, createdAt: -1 }).lean();
    const returnedAudits = results.length
      ? await this.auditModel.find({
          academicResultId: { $in: results.map((result) => result._id) },
          action: { $in: ['returned_by_hod', 'returned_by_provost'] },
        }).sort({ createdAt: -1 }).lean()
      : [];
    const feedbackByResult = new Map<string, any>();
    for (const audit of returnedAudits) {
      const resultId = String(audit.academicResultId);
      if (!feedbackByResult.has(resultId)) feedbackByResult.set(resultId, audit);
    }
    const resultByStudentSession = new Map<string, any>();
    const latestPublishedByStudent = new Map<string, any>();
    for (const result of results) {
      const key = `${result.studentId}:${result.academicSessionId}`;
      if (result.attemptType === attemptType && !resultByStudentSession.has(key)) {
        resultByStudentSession.set(key, result);
      }
      if (result.workflowStatus === AcademicResultWorkflowStatus.PUBLISHED && !latestPublishedByStudent.has(String(result.studentId))) {
        latestPublishedByStudent.set(String(result.studentId), result);
      }
    }
    const sheetStudents = eligibleStudents.map((student: any) => {
      const sessionId = student.academicSession?._id || student.academicSession;
      const storedResult = resultByStudentSession.get(`${student._id}:${sessionId}`) || null;
      const result = storedResult
        ? { ...storedResult, reviewFeedback: feedbackByResult.get(String(storedResult._id)) || null }
        : null;
      const latestPublished = latestPublishedByStudent.get(String(student._id)) || null;
      const nextAttemptType = nextAcademicAttemptType(latestPublished);
      return {
        studentId: student._id,
        academicSessionId: sessionId,
        academicSession: student.academicSession,
        matriculationNumber: student.matriculationNumber,
        name: [student.userId?.firstName, student.userId?.otherName, student.userId?.lastName].filter(Boolean).join(' '),
        result,
        latestPublishedAttempt: latestPublished,
        nextAttemptType,
        canCreateAttempt: !result && nextAttemptType === attemptType,
      };
    }).filter((student) => attemptType === AcademicResultAttemptType.INITIAL || student.result || student.canCreateAttempt);
    return {
      programCourse,
      attemptType,
      assessmentComponents: programCourse.assessmentComponents,
      students: sheetStudents,
    };
  }

  async saveScores(userId: string, programCourseId: string, payload: { attemptType?: AcademicResultAttemptType; scores: any[] }) {
    await this.assertPermission(userId, 'enter_scores');
    const programCourse = await this.findProgramCourse(programCourseId);
    await this.assertProgramCourseLecturer(userId, programCourse);
    const components = programCourse.assessmentComponents || [];
    this.validateComponents(components);
    const attemptType = payload.attemptType || AcademicResultAttemptType.INITIAL;
    const sheet = await this.getScoreSheet(userId, programCourseId, attemptType);
    const eligible = new Map(sheet.students.map((student: any) => [String(student.studentId), student]));
    if (!Array.isArray(payload.scores) || !payload.scores.length) throw new BadRequestException('Add at least one student score');
    const actor = this.objectId(userId, 'user');
    const program: any = programCourse.programId;
    const course: any = programCourse.courseId;
    const saved: AcademicResultDocument[] = [];
    await this.withTransaction(async (session) => {
      for (const row of payload.scores) {
        const studentId = this.objectId(row.studentId, 'student');
        const eligibleStudent: any = eligible.get(String(studentId));
        if (!eligibleStudent) throw new ForbiddenException('Scores may only be entered for approved current course registrations');
        const academicSessionId = this.objectId(String(eligibleStudent.academicSessionId), 'academic session');
        const existing = await this.resultModel.findOne({ studentId, programCourseId: programCourse._id, academicSessionId, attemptType }).sort({ attemptNumber: -1 }).session(session);
        if (attemptType !== AcademicResultAttemptType.INITIAL && !existing) {
          throw new BadRequestException(`Create the ${attemptType} attempt for ${eligibleStudent.matriculationNumber} before entering scores`);
        }
        if (existing && !this.isEditable(existing.workflowStatus)) throw new BadRequestException(`Result for ${eligibleStudent.matriculationNumber} is no longer editable`);
        if (existing && (row.version === undefined || Number(row.version) !== Number((existing as any).__v || 0))) {
          throw new ConflictException(`Result for ${eligibleStudent.matriculationNumber} changed after this score sheet was loaded. Refresh before saving`);
        }
        const gradeScale = existing
          ? await this.gradeScaleModel.findById(existing.gradeScaleVersionId).session(session)
          : await this.getActiveGradeScale(session);
        if (!gradeScale) throw new BadRequestException('The grade scale originally applied to this result no longer exists');
        const appliedComponents = existing?.componentScores?.length ? this.componentsFromSnapshot(existing.componentScores) : components;
        const calculated = this.calculateResult(appliedComponents, row.componentScores || [], gradeScale.bands, row.specialStatus, true);
        if (calculated.gradePoint !== undefined) calculated.qualityPoints = this.round4(Number(calculated.gradePoint) * Number(programCourse.units));
        const result = existing || new this.resultModel({ studentId, academicSessionId, programCourseId: programCourse._id, programId: program._id, departmentId: program.departmentId?._id || program.departmentId, level: programCourse.level, semester: programCourse.semester, gradeScaleVersionId: gradeScale._id, attemptNumber: 1, attemptType: AcademicResultAttemptType.INITIAL, unitsSnapshot: programCourse.units, courseCodeSnapshot: course.code, courseTitleSnapshot: course.title, createdBy: actor });
        const before = existing ? this.auditSnapshot(existing) : undefined;
        Object.assign(result, calculated, { updatedBy: actor, workflowStatus: AcademicResultWorkflowStatus.DRAFT });
        await result.save({ session });
        await this.writeAudit(result, userId, existing ? 'scores_updated' : 'scores_entered', before, this.auditSnapshot(result), undefined, undefined, undefined, session);
        saved.push(result);
      }
    });
    return { saved: saved.length, results: saved };
  }

  async submitToHod(userId: string, programCourseId: string, attemptType: AcademicResultAttemptType = AcademicResultAttemptType.INITIAL) {
    await this.assertPermission(userId, 'submit');
    const programCourse = await this.findProgramCourse(programCourseId);
    await this.assertProgramCourseLecturer(userId, programCourse);
    const results = await this.resultModel.find({ programCourseId: programCourse._id, attemptType, workflowStatus: { $in: [AcademicResultWorkflowStatus.DRAFT, AcademicResultWorkflowStatus.RETURNED_BY_HOD, AcademicResultWorkflowStatus.RETURNED_BY_PROVOST] } });
    if (!results.length) throw new BadRequestException('There are no editable results to submit');
    const grouped = this.groupResultsByContext(results);
    for (const group of grouped.values()) await this.requireCompleteResultSet(programCourse, group);
    await this.transitionResults(results, userId, AcademicResultWorkflowStatus.SUBMITTED_TO_HOD, 'submitted_to_hod');
    return { submitted: results.length, cohorts: grouped.size };
  }

  async getWorkflowQueue(userId: string, queue: WorkflowQueue) {
    const userObjectId = this.objectId(userId, 'user');
    let status: AcademicResultWorkflowStatus;
    const filter: any = {};
    if (queue === 'lecturer') {
      status = AcademicResultWorkflowStatus.DRAFT;
      if (!(await this.isAdmin(userId))) {
        const courseIds = await this.programCourseModel.find({ lecturerIds: userObjectId }).distinct('_id');
        filter.programCourseId = { $in: courseIds };
      }
    } else if (queue === 'hod' || queue === 'hod-ready') {
      await this.assertPermission(userId, 'review_hod');
      status = queue === 'hod' ? AcademicResultWorkflowStatus.SUBMITTED_TO_HOD : AcademicResultWorkflowStatus.HOD_APPROVED;
      if (!(await this.isAdmin(userId))) {
        const departmentIds = await this.departmentModel.find({ hodUserId: userObjectId, active: true }).distinct('_id');
        filter.departmentId = { $in: departmentIds };
      }
    } else if (queue === 'provost') {
      status = AcademicResultWorkflowStatus.SUBMITTED_TO_PROVOST;
      await this.assertPermission(userId, 'review_provost');
      if (!(await this.isAdmin(userId))) {
        const academicSessionIds = await this.academicSessionModel.find({ provostUserId: userObjectId }).distinct('_id');
        filter.academicSessionId = { $in: academicSessionIds };
      }
    } else if (queue === 'publish') {
      status = AcademicResultWorkflowStatus.PROVOST_APPROVED;
      await this.assertPermission(userId, 'publish');
    } else {
      status = AcademicResultWorkflowStatus.PUBLISHED;
      await this.assertAnyPermission(userId, ['view', 'export', 'amend']);
      if (!(await this.isAdmin(userId)) && !(await this.hasAcademicResultPermission(userId, 'manage'))) {
        const [departmentIds, academicSessionIds, programCourseIds] = await Promise.all([
          this.departmentModel.find({ hodUserId: userObjectId, active: true }).distinct('_id'),
          this.academicSessionModel.find({ provostUserId: userObjectId }).distinct('_id'),
          this.programCourseModel.find({ lecturerIds: userObjectId }).distinct('_id'),
        ]);
        filter.$or = [
          { departmentId: { $in: departmentIds } },
          { academicSessionId: { $in: academicSessionIds } },
          { programCourseId: { $in: programCourseIds } },
        ];
      }
    }
    const results = await this.resultModel.find({ ...filter, workflowStatus: status })
      .populate('academicSessionId', 'title sessionYear')
      .populate({ path: 'programCourseId', populate: [{ path: 'courseId', select: 'code title' }, { path: 'programId', select: 'name code' }] })
      .populate('departmentId', 'name code')
      .lean();
    const contexts = new Map<string, any>();
    for (const result of results as any[]) {
      const programCourse: any = result.programCourseId;
      const session: any = result.academicSessionId;
      const key = `${programCourse?._id}:${session?._id}:${result.attemptType}`;
      if (!contexts.has(key)) contexts.set(key, { contextKey: key, programCourseId: programCourse?._id, academicSessionId: session?._id, attemptType: result.attemptType, courseCodeSnapshot: result.courseCodeSnapshot, courseTitleSnapshot: result.courseTitleSnapshot, program: programCourse?.programId, departmentId: result.departmentId, academicSession: session, level: result.level, semester: result.semester, pendingStudents: 0 });
      contexts.get(key).pendingStudents += 1;
    }
    return [...contexts.values()];
  }

  async hodReview(userId: string, context: any, approved: boolean, comment?: string) {
    await this.assertPermission(userId, 'review_hod');
    const query = this.contextQuery(context, AcademicResultWorkflowStatus.SUBMITTED_TO_HOD);
    await this.assertHodForContext(userId, query.departmentId);
    return this.reviewContext(query, userId, approved, AcademicResultWorkflowStatus.HOD_APPROVED, AcademicResultWorkflowStatus.RETURNED_BY_HOD, 'hod', comment);
  }

  async submitToProvost(userId: string, context: any) {
    await this.assertPermission(userId, 'review_hod');
    const query = this.contextQuery(context, AcademicResultWorkflowStatus.HOD_APPROVED);
    await this.assertHodForContext(userId, query.departmentId);
    const academicSession = await this.academicSessionModel.findById(query.academicSessionId).select('provostUserId').lean();
    if (!academicSession?.provostUserId) throw new BadRequestException('Assign a Provost to this academic session before submission');
    const results = await this.resultModel.find(query);
    if (!results.length) throw new BadRequestException('No HOD-approved result group is ready for Provost submission');
    await this.transitionResults(results, userId, AcademicResultWorkflowStatus.SUBMITTED_TO_PROVOST, 'submitted_to_provost');
    return { submitted: results.length };
  }

  async provostReview(userId: string, context: any, approved: boolean, comment?: string) {
    await this.assertPermission(userId, 'review_provost');
    const query = this.contextQuery(context, AcademicResultWorkflowStatus.SUBMITTED_TO_PROVOST);
    await this.assertProvostForContext(userId, query.academicSessionId);
    return this.reviewContext(query, userId, approved, AcademicResultWorkflowStatus.PROVOST_APPROVED, AcademicResultWorkflowStatus.RETURNED_BY_PROVOST, 'provost', comment);
  }

  async publish(userId: string, context: any) {
    await this.assertPermission(userId, 'publish');
    const query = this.contextQuery(context, AcademicResultWorkflowStatus.PROVOST_APPROVED);
    const results = await this.resultModel.find(query);
    if (!results.length) throw new BadRequestException('No Provost-approved result group is ready to publish');
    const now = new Date();
    await this.withTransaction(async (session) => {
      for (const result of results) {
        result.$session(session);
        const before = this.auditSnapshot(result);
        assertAcademicWorkflowTransition(result.workflowStatus, AcademicResultWorkflowStatus.PUBLISHED);
        result.workflowStatus = AcademicResultWorkflowStatus.PUBLISHED;
        result.publishedAt = now;
        result.publishedBy = this.objectId(userId, 'user');
        result.updatedBy = this.objectId(userId, 'user');
        if (result.attemptType === AcademicResultAttemptType.REPEAT && !result.isPass) result.specialStatus = AcademicResultSpecialStatus.ACADEMIC_REVIEW;
        await result.save({ session });
        await this.writeAudit(result, userId, 'published', before, this.auditSnapshot(result), undefined, undefined, undefined, session);
      }
      for (const studentId of new Set(results.map((result) => String(result.studentId)))) {
        await this.rebuildStudentSummaries(new Types.ObjectId(studentId), session);
      }
    });
    return { published: results.length, publishedAt: now };
  }

  async getContextReport(userId: string, context: any) {
    const query = this.contextQuery(context);
    await this.assertContextReadAccess(userId, query.programCourseId, query.academicSessionId, query.departmentId);
    const results = await this.resultModel.find(query).populate({ path: 'studentId', select: 'matriculationNumber', populate: { path: 'userId', select: 'firstName lastName' } }).sort({ createdAt: 1 }).lean();
    const audits = results.length
      ? await this.auditModel.find({ academicResultId: { $in: results.map((result) => result._id) } })
          .populate('actorUserId', 'firstName otherName lastName email')
          .sort({ createdAt: 1 })
          .lean()
      : [];
    const grades = results.reduce((summary: Record<string, number>, result: any) => { const key = result.gradeLetter || result.specialStatus; summary[key] = (summary[key] || 0) + 1; return summary; }, {});
    return { context, total: results.length, grades, results, audits };
  }

  async createAttempt(userId: string, payload: { studentId: string; programCourseId: string; attemptType: AcademicResultAttemptType }) {
    await this.assertPermission(userId, 'enter_scores');
    const programCourse = await this.findProgramCourse(payload.programCourseId);
    await this.assertProgramCourseLecturer(userId, programCourse);
    if (![AcademicResultAttemptType.RESIT, AcademicResultAttemptType.REPEAT].includes(payload.attemptType)) throw new BadRequestException('Only resit or repeat attempts can be created');
    const studentId = this.objectId(payload.studentId, 'student');
    const student = await this.studentModel.findById(studentId).lean();
    if (!student) throw new NotFoundException('Student not found');
    const academicSessionId = student.academicSession;
    const registration = await this.registrationModel.exists({ studentId, academicSessionId, status: CourseRegistrationStatus.APPROVED, 'items.programCourseId': programCourse._id });
    if (!registration) throw new BadRequestException('The student needs an approved current registration for this course');
    const prior = await this.resultModel.find({ studentId, programCourseId: programCourse._id, workflowStatus: AcademicResultWorkflowStatus.PUBLISHED }).sort({ attemptNumber: -1 });
    const latest = prior[0];
    if (!latest || latest.isPass) throw new BadRequestException('A new attempt requires a previously published failed result');
    const expected = latest.attemptType === AcademicResultAttemptType.INITIAL ? AcademicResultAttemptType.RESIT : latest.attemptType === AcademicResultAttemptType.RESIT ? AcademicResultAttemptType.REPEAT : null;
    if (payload.attemptType !== expected) throw new BadRequestException('Attempt sequence must be initial, then resit, then repeat');
    const gradeScale = await this.getActiveGradeScale();
    const program: any = programCourse.programId;
    const course: any = programCourse.courseId;
    let result: AcademicResultDocument | null = null;
    await this.withTransaction(async (session) => {
      result = new this.resultModel({ studentId, academicSessionId, programCourseId: programCourse._id, programId: program._id, departmentId: program.departmentId?._id || program.departmentId, level: programCourse.level, semester: programCourse.semester, gradeScaleVersionId: gradeScale._id, attemptNumber: latest.attemptNumber + 1, attemptType: payload.attemptType, supersedesResultId: latest._id, unitsSnapshot: programCourse.units, courseCodeSnapshot: course.code, courseTitleSnapshot: course.title, createdBy: this.objectId(userId, 'user'), workflowStatus: AcademicResultWorkflowStatus.DRAFT });
      await result.save({ session });
      await this.writeAudit(result, userId, 'attempt_created', undefined, this.auditSnapshot(result), undefined, undefined, undefined, session);
    });
    return result;
  }

  async amendPublishedResult(userId: string, resultId: string, payload: { version: number; reason: string; specialStatus?: AcademicResultSpecialStatus; componentScores: any[] }) {
    await this.assertPermission(userId, 'amend');
    if (!payload.reason?.trim()) throw new BadRequestException('A reason is required for a published-result amendment');
    const result = await this.resultModel.findById(this.objectId(resultId, 'academic result'));
    if (!result) throw new NotFoundException('Academic result not found');
    if (result.workflowStatus !== AcademicResultWorkflowStatus.PUBLISHED) {
      throw new BadRequestException('Only a published result can be amended through this action');
    }
    if (Number((result as any).__v || 0) !== Number(payload.version)) {
      throw new ConflictException('This result changed after it was opened. Refresh the report before amending it');
    }
    const gradeScale = await this.gradeScaleModel.findById(result.gradeScaleVersionId).lean();
    if (!gradeScale) throw new BadRequestException('The historical grade scale for this result no longer exists');
    const components = this.componentsFromSnapshot(result.componentScores || []);
    if (!components.length) throw new BadRequestException('The historical assessment component snapshot is missing');
    const calculated = this.calculateResult(
      components,
      payload.componentScores || [],
      gradeScale.bands,
      payload.specialStatus || AcademicResultSpecialStatus.NORMAL,
      false,
    );
    if (calculated.gradePoint !== undefined) {
      calculated.qualityPoints = this.round4(Number(calculated.gradePoint) * Number(result.unitsSnapshot));
    }
    const actor = this.objectId(userId, 'user');
    await this.withTransaction(async (session) => {
      result.$session(session);
      const before = this.auditSnapshot(result);
      Object.assign(result, calculated, {
        updatedBy: actor,
        lastAmendedBy: actor,
        lastAmendedAt: new Date(),
      });
      await result.save({ session });
      await this.writeAudit(
        result,
        userId,
        'published_result_amended',
        before,
        this.auditSnapshot(result),
        payload.reason.trim(),
        AcademicResultWorkflowStatus.PUBLISHED,
        AcademicResultWorkflowStatus.PUBLISHED,
        session,
      );
      await this.rebuildStudentSummaries(result.studentId, session);
    });
    return result;
  }

  async getReadiness(userId: string) {
    await this.assertPermission(userId, 'view');
    const [configuredCourses, activeScales, departmentsWithoutHod, activeSessionsWithoutProvost] = await Promise.all([
      this.programCourseModel.countDocuments({ active: true, 'assessmentComponents.0': { $exists: true } }),
      this.gradeScaleModel.countDocuments({ status: GradeScaleStatus.ACTIVE }),
      this.departmentModel.countDocuments({ active: true, $or: [{ hodUserId: { $exists: false } }, { hodUserId: null }] }),
      this.academicSessionModel.countDocuments({ active: true, $or: [{ provostUserId: { $exists: false } }, { provostUserId: null }] }),
    ]);
    return { configuredProgramCourses: configuredCourses, activeGradeScales: activeScales, departmentsWithoutHod, activeSessionsWithoutProvost, ready: configuredCourses > 0 && activeScales > 0 && departmentsWithoutHod === 0 && activeSessionsWithoutProvost === 0 };
  }

  async rebuildAllAcademicSummaries(apply = false) {
    const [registeredStudentIds, summarizedStudentIds, studentsWithStoredGpa] = await Promise.all([
      this.registrationModel.distinct('studentId', { status: CourseRegistrationStatus.APPROVED }),
      this.summaryModel.distinct('studentId'),
      this.studentModel.find({ cumulativeGPA: { $exists: true } }).distinct('_id'),
    ]);
    const studentIds = [...new Set(
      [...registeredStudentIds, ...summarizedStudentIds, ...studentsWithStoredGpa].map(String),
    )];
    const existingSummaries = await this.summaryModel.countDocuments({});
    const storedStudents = await this.studentModel.find({
      _id: { $in: studentIds.map((studentId) => new Types.ObjectId(studentId)) },
    }).select('cumulativeGPA').lean();
    const storedGpaByStudent = new Map(
      storedStudents.map((student) => [String(student._id), student.cumulativeGPA]),
    );
    let studentsRebuilt = 0;
    let studentsWithOfficialCumulativeGPA = 0;
    let studentsWithoutOfficialCumulativeGPA = 0;
    let studentCgpaValuesToChange = 0;
    for (const studentId of studentIds) {
      const progress = await this.getStudentAcademicProgress(new Types.ObjectId(studentId));
      const expectedGpa = progress.officialCumulativeGPA;
      const storedGpa = storedGpaByStudent.get(studentId);
      if (expectedGpa === null) studentsWithoutOfficialCumulativeGPA++;
      else studentsWithOfficialCumulativeGPA++;
      if (
        (expectedGpa === null && storedGpa !== null) ||
        (expectedGpa !== null && Number(storedGpa) !== expectedGpa)
      ) {
        studentCgpaValuesToChange++;
      }
      if (apply) {
        await this.withTransaction((session) =>
          this.rebuildStudentSummaries(new Types.ObjectId(studentId), session),
        );
        studentsRebuilt++;
      }
    }
    return {
      studentsEligible: studentIds.length,
      studentsRebuilt,
      existingSummaries,
      studentsWithOfficialCumulativeGPA,
      studentsWithoutOfficialCumulativeGPA,
      studentCgpaValuesToChange,
      applied: Boolean(apply),
    };
  }

  private async findProgramCourse(id: string) {
    const programCourse = await this.programCourseModel.findById(this.objectId(id, 'program course'))
      .populate('courseId', 'code title active')
      .populate({ path: 'programId', populate: [{ path: 'departmentId', select: 'name code hodUserId' }, { path: 'programTypeId', select: 'type active' }, { path: 'programModeId', select: 'mode active' }] });
    if (!programCourse) throw new NotFoundException('Program course not found');
    return programCourse;
  }

  private async getActiveGradeScale(session?: ClientSession) {
    const scale = await this.gradeScaleModel.findOne({ status: GradeScaleStatus.ACTIVE }).sort({ version: -1, createdAt: -1 }).session(session || null);
    if (!scale) throw new BadRequestException('Activate an institutional grade scale before entering scores');
    return scale;
  }

  private componentsFromSnapshot(scores: any[]) {
    return scores.map((score) => ({ title: score.componentTitle, componentType: score.componentType, displayOrder: score.componentOrder, maximumMark: score.maximumMarkSnapshot, weightPercent: score.weightPercentSnapshot, active: true, mandatory: score.mandatorySnapshot, absenceAllowed: score.absenceAllowedSnapshot }));
  }

  private calculateResult(components: any[], submittedScores: any[], bands: any[], requestedStatus?: AcademicResultSpecialStatus, allowIncomplete = false) {
    return calculateAcademicResult(components, submittedScores, bands, requestedStatus, allowIncomplete);
  }

  private async requireCompleteResultSet(programCourse: ProgramCourseDocument, results: AcademicResultDocument[]) {
    const sessionId = results[0].academicSessionId;
    const studentIds = await this.studentModel.find({ programId: (programCourse.programId as any)._id || programCourse.programId, currentLevel: programCourse.level, academicSession: sessionId, isActive: true, status: 'active' }).distinct('_id');
    const registrations = await this.registrationModel.countDocuments({ studentId: { $in: studentIds }, academicSessionId: sessionId, status: CourseRegistrationStatus.APPROVED, 'items.programCourseId': programCourse._id });
    if (results.length !== registrations) throw new BadRequestException('Enter a result for every student with an approved current course registration before submitting');
    if (results.some((result) => result.specialStatus === AcademicResultSpecialStatus.NORMAL && result.finalScore === undefined)) throw new BadRequestException('Complete all mandatory assessment marks before submitting');
    if (results.some((result) => [AcademicResultSpecialStatus.INCOMPLETE, AcademicResultSpecialStatus.DEFERRED].includes(result.specialStatus))) throw new BadRequestException('Incomplete or deferred results cannot be submitted for approval');
  }

  private groupResultsByContext(results: AcademicResultDocument[]) {
    const groups = new Map<string, AcademicResultDocument[]>();
    for (const result of results) { const key = `${result.programCourseId}:${result.academicSessionId}:${result.attemptType}`; groups.set(key, [...(groups.get(key) || []), result]); }
    return groups;
  }

  private contextQuery(context: any, status?: AcademicResultWorkflowStatus) {
    const query: any = { programCourseId: this.objectId(context.programCourseId, 'program course'), academicSessionId: this.objectId(context.academicSessionId, 'academic session'), attemptType: context.attemptType || AcademicResultAttemptType.INITIAL };
    if (context.departmentId) query.departmentId = this.objectId(context.departmentId?._id || context.departmentId, 'department');
    if (status) query.workflowStatus = status;
    return query;
  }

  private async reviewContext(query: any, userId: string, approved: boolean, approvedStatus: AcademicResultWorkflowStatus, returnedStatus: AcademicResultWorkflowStatus, reviewer: string, comment?: string) {
    const results = await this.resultModel.find(query);
    if (!results.length) throw new BadRequestException(`No result group is awaiting ${reviewer} review`);
    if (!approved && !comment?.trim()) throw new BadRequestException('A return comment is required');
    const next = approved ? approvedStatus : returnedStatus;
    await this.transitionResults(results, userId, next, approved ? `${reviewer}_approved` : `returned_by_${reviewer}`, comment);
    return { updated: results.length, workflowStatus: next };
  }

  private async transitionResults(results: AcademicResultDocument[], userId: string, next: AcademicResultWorkflowStatus, action: string, comment?: string) {
    const actor = this.objectId(userId, 'user');
    await this.withTransaction(async (session) => {
      for (const result of results) {
        result.$session(session);
        const before = this.auditSnapshot(result);
        const previous = result.workflowStatus;
        assertAcademicWorkflowTransition(previous, next);
        result.workflowStatus = next;
        result.updatedBy = actor;
        await result.save({ session });
        await this.writeAudit(result, userId, action, before, this.auditSnapshot(result), comment, previous, next, session);
      }
    });
  }

  private async assertHodForContext(userId: string, departmentId?: Types.ObjectId) {
    if (await this.isAdmin(userId)) return;
    if (!departmentId) throw new BadRequestException('Result context is missing its department');
    const department = await this.departmentModel.findById(departmentId).select('hodUserId').lean();
    if (!department?.hodUserId || String(department.hodUserId) !== userId) throw new ForbiddenException('Only the assigned Head of Department can review this result group');
  }

  private async assertProvostForContext(userId: string, academicSessionId?: Types.ObjectId) {
    if (await this.isAdmin(userId)) return;
    if (!academicSessionId) throw new BadRequestException('Result context is missing its academic session');
    const academicSession = await this.academicSessionModel.findById(academicSessionId).select('provostUserId').lean();
    if (!academicSession?.provostUserId || String(academicSession.provostUserId) !== userId) {
      throw new ForbiddenException('Only the Provost assigned to this academic session can review this result group');
    }
  }

  private async assertContextReadAccess(userId: string, programCourseId: Types.ObjectId, academicSessionId: Types.ObjectId, departmentId?: Types.ObjectId) {
    if (await this.isAdmin(userId)) return;
    const department = departmentId ? await this.departmentModel.findById(departmentId).select('hodUserId').lean() : null;
    if (department?.hodUserId && String(department.hodUserId) === userId) {
      await this.assertAnyPermission(userId, ['review_hod', 'view', 'export', 'amend']);
      return;
    }
    const academicSession = await this.academicSessionModel.findById(academicSessionId).select('provostUserId').lean();
    if (academicSession?.provostUserId && String(academicSession.provostUserId) === userId) {
      await this.assertAnyPermission(userId, ['review_provost', 'view', 'export', 'amend']);
      return;
    }
    const programCourse = await this.programCourseModel.findById(programCourseId).select('lecturerIds').lean();
    if (programCourse?.lecturerIds?.some((id: any) => String(id) === userId)) {
      await this.assertAnyPermission(userId, ['enter_scores', 'view', 'export', 'amend']);
      return;
    }
    await this.assertAnyPermission(userId, ['publish', 'amend', 'manage']);
  }

  private async rebuildStudentSummaries(studentId: Types.ObjectId, session?: ClientSession) {
    const progress = await this.getStudentAcademicProgress(studentId, session);
    await this.summaryModel.deleteMany({ studentId }, { session });
    for (const period of progress.periods.filter((item) => item.cumulativeGPA !== null)) {
      const summary = new this.summaryModel({
        studentId,
        academicSessionId: new Types.ObjectId(period.academicSessionId),
        semester: period.semester,
        level: period.level,
        applicableUnits: period.applicableUnits,
        earnedUnits: period.earnedUnits,
        qualityPoints: period.qualityPoints,
        semesterGPA: period.semesterGPA,
        cumulativeApplicableUnits: period.cumulativeApplicableUnits,
        cumulativeQualityPoints: period.cumulativeQualityPoints,
        cumulativeGPA: period.cumulativeGPA,
        calculatedAt: new Date(),
      });
      await summary.save({ session });
    }
    await this.studentModel.findByIdAndUpdate(
      studentId,
      { $set: { cumulativeGPA: progress.officialCumulativeGPA } },
      { session },
    );
  }

  private async getStudentAcademicProgress(studentId: Types.ObjectId, session?: ClientSession) {
    const results = await this.resultModel.find({ studentId, workflowStatus: AcademicResultWorkflowStatus.PUBLISHED }).sort({ publishedAt: -1, attemptNumber: -1 }).session(session || null).lean();
    const registrations = await this.registrationModel.find({ studentId, status: CourseRegistrationStatus.APPROVED }).populate('academicSessionId', 'title sessionYear startDate').sort({ createdAt: 1, semester: 1 }).session(session || null).lean();
    return buildAcademicProgress(registrations, results);
  }

  private validateBands(bands: any[], gpaScale: number) {
    validateGradeBands(bands, gpaScale);
  }

  private validateComponents(components: any[]) {
    validateAssessmentComponents(components);
  }

  private isEditable(status: AcademicResultWorkflowStatus) { return [AcademicResultWorkflowStatus.DRAFT, AcademicResultWorkflowStatus.RETURNED_BY_HOD, AcademicResultWorkflowStatus.RETURNED_BY_PROVOST].includes(status); }
  private auditSnapshot(result: any) {
    return {
      workflowStatus: result.workflowStatus,
      specialStatus: result.specialStatus,
      finalScore: result.finalScore,
      gradeLetter: result.gradeLetter,
      gradePoint: result.gradePoint,
      qualityPoints: result.qualityPoints,
      isPass: result.isPass,
      componentScores: (result.componentScores || []).map((score: any) => ({
        componentOrder: score.componentOrder,
        componentTitle: score.componentTitle,
        componentType: score.componentType,
        maximumMarkSnapshot: score.maximumMarkSnapshot,
        weightPercentSnapshot: score.weightPercentSnapshot,
        rawMark: score.rawMark,
        weightedContribution: score.weightedContribution,
        absent: score.absent,
        mandatorySnapshot: score.mandatorySnapshot,
        absenceAllowedSnapshot: score.absenceAllowedSnapshot,
      })),
    };
  }
  private async writeAudit(result: AcademicResultDocument, userId: string, action: string, before?: any, after?: any, comment?: string, previousState?: string, newState?: string, session?: ClientSession) { const user = await this.userModel.findById(this.objectId(userId, 'user')).select('role').session(session || null).lean(); const audit = new this.auditModel({ academicResultId: result._id, programCourseId: result.programCourseId, academicSessionId: result.academicSessionId, actorUserId: this.objectId(userId, 'user'), actorRole: user?.role || 'staff', action, previousState, newState, comment: comment?.trim(), before, after }); await audit.save({ session }); }
  private async withTransaction(work: (session: ClientSession) => Promise<void>) { const session = await this.connection.startSession(); try { await session.withTransaction(() => work(session)); } finally { await session.endSession(); } }
  private round4(value: number) { return roundAcademicValue(value); }
  private objectId(value: string, label: string) { if (!Types.ObjectId.isValid(value)) throw new BadRequestException(`Invalid ${label}`); return new Types.ObjectId(value); }
  private async isAdmin(userId: string) { return (await this.userModel.findById(this.objectId(userId, 'user')).select('role').lean())?.role === UserRole.ADMIN; }
  private async hasAcademicResultPermission(userId: string, permission: string) { if (await this.isAdmin(userId)) return true; const staff = await this.staffModel.findOne({ userId: this.objectId(userId, 'user'), isActive: true }).lean(); const role = staff ? await this.roleModel.findById(staff.roleId).lean() : null; const module = role?.modules?.find((item: any) => item.module === 'academicResults'); return Boolean(module?.permissions?.includes(permission) || module?.permissions?.includes('manage')); }
  private async assertPermission(userId: string, permission: string) { if (await this.isAdmin(userId)) return; const staff = await this.staffModel.findOne({ userId: this.objectId(userId, 'user'), isActive: true }).lean(); const role = staff ? await this.roleModel.findById(staff.roleId).lean() : null; const module = role?.modules?.find((item: any) => item.module === 'academicResults'); if (!module?.permissions?.includes(permission) && !module?.permissions?.includes('manage')) throw new ForbiddenException('You do not have the required academic results permission'); }
  private async assertAnyPermission(userId: string, permissions: string[]) { if (await this.isAdmin(userId)) return; const staff = await this.staffModel.findOne({ userId: this.objectId(userId, 'user'), isActive: true }).lean(); const role = staff ? await this.roleModel.findById(staff.roleId).lean() : null; const module = role?.modules?.find((item: any) => item.module === 'academicResults'); if (!module?.permissions?.includes('manage') && !permissions.some((permission) => module?.permissions?.includes(permission))) throw new ForbiddenException('You do not have the required academic results permission'); }
  private async assertProgramCourseLecturer(userId: string, programCourse: any) { if (await this.isAdmin(userId)) return; if (!programCourse.lecturerIds?.some((id: any) => String(id?._id || id) === userId)) throw new ForbiddenException('Only an assigned lecturer can enter scores for this course'); }
}

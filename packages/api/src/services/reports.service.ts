import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { FilterQuery, Model, Types } from 'mongoose';
import { ReportQueryDto } from '../dto/report.dto';
import { AcademicResult, AcademicResultDocument, AcademicResultWorkflowStatus } from '../schemas/academic-result.schema';
import { AcademicSession, AcademicSessionDocument } from '../schemas/academic-session.schema';
import { Application, ApplicationDocument, AdmissionDecision } from '../schemas/application.schema';
import { CourseRegistration, CourseRegistrationDocument } from '../schemas/course-registration.schema';
import { Department, DepartmentDocument } from '../schemas/department.schema';
import { Exam, ExamDocument } from '../schemas/exam.schema';
import { ExamAttempt, ExamAttemptDocument } from '../schemas/exam-attempt.schema';
import { ExamResult, ExamResultDocument } from '../schemas/exam-result.schema';
import { Notification, NotificationDocument } from '../schemas/notification.schema';
import { NotificationRecipient, NotificationRecipientDocument } from '../schemas/notification-recipient.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { PortalActivityEvent, PortalActivityEventDocument } from '../schemas/portal-activity-event.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { ProgramMode, ProgramModeDocument } from '../schemas/program-mode.schema';
import { ProgramType, ProgramTypeDocument } from '../schemas/program-type.schema';
import { ReportSnapshot, ReportSnapshotDocument } from '../schemas/report-snapshot.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { StudentAcademicSession, StudentAcademicSessionDocument } from '../schemas/student-academic-session.schema';
import { StudentAcademicSummary, StudentAcademicSummaryDocument } from '../schemas/student-academic-summary.schema';
import { StudentFeeObligation, StudentFeeObligationDocument } from '../schemas/student-fee-obligation.schema';
import { StudentPayment, StudentPaymentDocument, PaymentStatus } from '../schemas/student-payment.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { ReportAccessScope } from './reports-access.service';
import { StudentFeeObligationService } from './student-fee-obligation.service';

type ReportType = 'overview' | 'admissions' | 'students' | 'finance' | 'academics' | 'exams' | 'communications' | 'activity';

@Injectable()
export class ReportsService {
  private readonly cacheMinutes = 10;

  constructor(
    @InjectModel(AcademicSession.name) private readonly sessionModel: Model<AcademicSessionDocument>,
    @InjectModel(Application.name) private readonly applicationModel: Model<ApplicationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(StudentAcademicSession.name) private readonly enrollmentModel: Model<StudentAcademicSessionDocument>,
    @InjectModel(StudentAcademicSummary.name) private readonly academicSummaryModel: Model<StudentAcademicSummaryDocument>,
    @InjectModel(StudentPayment.name) private readonly studentPaymentModel: Model<StudentPaymentDocument>,
    @InjectModel(StudentFeeObligation.name) private readonly obligationModel: Model<StudentFeeObligationDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Program.name) private readonly programModel: Model<ProgramDocument>,
    @InjectModel(ProgramType.name) private readonly programTypeModel: Model<ProgramTypeDocument>,
    @InjectModel(ProgramMode.name) private readonly programModeModel: Model<ProgramModeDocument>,
    @InjectModel(Department.name) private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(CourseRegistration.name) private readonly registrationModel: Model<CourseRegistrationDocument>,
    @InjectModel(AcademicResult.name) private readonly resultModel: Model<AcademicResultDocument>,
    @InjectModel(Exam.name) private readonly examModel: Model<ExamDocument>,
    @InjectModel(ExamAttempt.name) private readonly attemptModel: Model<ExamAttemptDocument>,
    @InjectModel(ExamResult.name) private readonly examResultModel: Model<ExamResultDocument>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(NotificationRecipient.name) private readonly recipientModel: Model<NotificationRecipientDocument>,
    @InjectModel(PortalActivityEvent.name) private readonly activityModel: Model<PortalActivityEventDocument>,
    @InjectModel(ReportSnapshot.name) private readonly snapshotModel: Model<ReportSnapshotDocument>,
    private readonly obligations: StudentFeeObligationService,
    private readonly config: ConfigService,
  ) {}

  async getFilterOptions(scope: ReportAccessScope) {
    const programQuery: FilterQuery<ProgramDocument> = {};
    if (!scope.unrestricted) {
      const conditions: any[] = [];
      if (scope.departmentIds.length) conditions.push({ departmentId: { $in: scope.departmentIds } });
      if (scope.programIds.length) conditions.push({ _id: { $in: scope.programIds } });
      programQuery.$or = conditions.length ? conditions : [{ _id: { $in: [] } }];
    }
    const [academicSessions, programs, programTypes, programModes, departments] = await Promise.all([
      this.sessionModel.find({}).sort({ startDate: -1 }).select('title sessionYear status startDate endDate').lean(),
      this.programModel.find(programQuery).populate('programTypeId', 'type').populate('programModeId', 'mode').populate('departmentId', 'name code').sort({ name: 1 }).lean(),
      this.programTypeModel.find({}).sort({ type: 1 }).lean(),
      this.programModeModel.find({}).sort({ mode: 1 }).lean(),
      this.departmentModel.find({}).sort({ name: 1 }).lean(),
    ]);
    const allowedDepartmentIds = new Set((programs as any[]).map((item) => String(item.departmentId?._id || item.departmentId)));
    return {
      academicSessions,
      programs,
      programTypes,
      programModes,
      departments: scope.unrestricted ? departments : departments.filter((item: any) => allowedDepartmentIds.has(String(item._id))),
      generatedAt: new Date(),
    };
  }

  async getReport(type: ReportType, filters: ReportQueryDto, scope: ReportAccessScope, refresh = false) {
    const normalized = await this.normalizeFilters(filters, scope);
    return this.cached(type, normalized, refresh, async () => {
      const current = await this.loadReport(type, normalized, scope);
      if (!filters.compare) return current;
      const previousFilters = await this.previousPeriodFilters(filters);
      const previousNormalized = await this.normalizeFilters(previousFilters, scope);
      const previous = await this.loadReport(type, previousNormalized, scope);
      return {
        ...current,
        comparison: {
          label: previousFilters.academicSessionId ? 'Previous academic session' : 'Previous period',
          kpis: previous.kpis || {},
          changes: this.kpiChanges(current.kpis || {}, previous.kpis || {}),
        },
      };
    });
  }

  private loadReport(type: ReportType, normalized: any, scope: ReportAccessScope): Promise<any> {
    switch (type) {
      case 'overview': return this.overview(normalized, scope);
      case 'admissions': return this.admissions(normalized);
      case 'students': return this.students(normalized);
      case 'finance': return this.finance(normalized);
      case 'academics': return this.academics(normalized, scope);
      case 'exams': return this.exams(normalized);
      case 'communications': return this.communications(normalized);
      case 'activity': return this.activity(normalized);
      default: throw new BadRequestException('Unsupported report type');
    }
  }

  private async previousPeriodFilters(filters: ReportQueryDto): Promise<ReportQueryDto> {
    const previous: ReportQueryDto = { ...filters, compare: false };
    if (filters.academicSessionId) {
      const selected = await this.sessionModel.findById(filters.academicSessionId).select('startDate').lean();
      const prior: any = selected
        ? await this.sessionModel.findOne({ startDate: { $lt: selected.startDate } }).sort({ startDate: -1 }).select('_id').lean()
        : null;
      previous.academicSessionId = prior?._id ? String(prior._id) : undefined;
      return previous;
    }
    const { from, to } = this.dateRange(filters);
    const duration = to.getTime() - from.getTime() + 1;
    previous.dateTo = new Date(from.getTime() - 1).toISOString();
    previous.dateFrom = new Date(from.getTime() - duration).toISOString();
    return previous;
  }

  private kpiChanges(current: Record<string, unknown>, previous: Record<string, unknown>) {
    return Object.fromEntries(Object.keys(current).map((key) => {
      const currentValue = Number(current[key]);
      const previousValue = Number(previous[key]);
      if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) return [key, null];
      return [key, previousValue === 0 ? (currentValue === 0 ? 0 : null) : Math.round(((currentValue - previousValue) / Math.abs(previousValue)) * 1000) / 10];
    }));
  }

  async websiteAnalytics(filters: ReportQueryDto) {
    const baseUrl = this.config.get<string>('UMAMI_API_URL')?.replace(/\/$/, '');
    const token = this.config.get<string>('UMAMI_API_TOKEN');
    const websiteId = this.config.get<string>('UMAMI_WEBSITE_ID');
    if (!baseUrl || !token || !websiteId) return { configured: false, message: 'Umami analytics is not configured' };
    const { from, to } = this.dateRange(filters);
    const params = new URLSearchParams({ startAt: String(from.getTime()), endAt: String(to.getTime()), timezone: 'Africa/Lagos' });
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const apiRoot = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/api`;
    const [statsResponse, pageviewsResponse, pathsResponse] = await Promise.all([
      fetch(`${apiRoot}/websites/${websiteId}/stats?${params}`, { headers }),
      fetch(`${apiRoot}/websites/${websiteId}/pageviews?${params}&unit=day`, { headers }),
      fetch(`${apiRoot}/websites/${websiteId}/metrics?${params}&type=path&limit=10`, { headers }),
    ]);
    if (![statsResponse, pageviewsResponse, pathsResponse].every((response) => response.ok)) {
      throw new BadRequestException('Umami analytics could not be retrieved');
    }
    return {
      configured: true,
      stats: await statsResponse.json(),
      trend: await pageviewsResponse.json(),
      topPages: await pathsResponse.json(),
      generatedAt: new Date(),
    };
  }

  async rowsForExport(type: ReportType, filters: ReportQueryDto, scope: ReportAccessScope) {
    const report: any = await this.getReport(type, filters, scope, true);
    const rows: Record<string, unknown>[] = [];
    const walk = (value: any, path = '') => {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) rows.push({ section: path, ...this.flatten(item) });
          else rows.push({ section: path, index: index + 1, value: item });
        });
      } else if (value && typeof value === 'object') {
        Object.entries(value).forEach(([key, item]) => {
          const next = path ? `${path}.${key}` : key;
          if (Array.isArray(item)) walk(item, next);
          else if (item && typeof item === 'object' && !(item instanceof Date)) walk(item, next);
          else rows.push({ section: path || 'summary', metric: key, value: item as any });
        });
      }
    };
    walk(report);
    return rows;
  }

  private async overview(filters: any, scope: ReportAccessScope) {
    const [admissions, students, finance, academics, communications, activity] = await Promise.all([
      this.admissions(filters), this.students(filters), this.finance(filters), this.academics(filters, scope), this.communications(filters), this.activity(filters),
    ]);
    return {
      generatedAt: new Date(),
      kpis: {
        applications: admissions.kpis.totalApplications,
        admissionRate: admissions.kpis.admissionRate,
        activeStudents: students.kpis.active,
        collections: finance.kpis.successfulCollections,
        resultPublicationRate: academics.kpis.publicationRate,
        academicInterventions: academics.kpis.academicInterventions,
        unreadNotificationRate: communications.kpis.unreadRate,
        activePortalUsers: activity.kpis.activeUsers,
      },
      trends: { admissions: admissions.monthlyTrend, collections: finance.monthlyTrend, activity: activity.dailyTrend },
      workflow: {
        pendingApplications: admissions.kpis.pending,
        pendingPayments: finance.kpis.pendingTransactions,
        resultReviewBacklog: academics.kpis.reviewBacklog,
        repeatRequired: academics.kpis.repeatRequired,
      },
    };
  }

  private async admissions(filters: any) {
    const match: any = { isActive: true, ...this.dateMatch(filters, 'createdAt') };
    if (filters.academicSessionId) match.entryAcademicSession = filters.academicSessionId;
    if (filters.programIds) match.programId = { $in: filters.programIds };
    const [total, pending, admitted, rejected, completed, byStatus, byStage, byProgram, monthlyTrend] = await Promise.all([
      this.applicationModel.countDocuments(match),
      this.applicationModel.countDocuments({ ...match, admissionDecision: 'pending' }),
      this.applicationModel.countDocuments({ ...match, admissionDecision: AdmissionDecision.GRANTED }),
      this.applicationModel.countDocuments({ ...match, admissionDecision: AdmissionDecision.DENIED }),
      this.applicationModel.countDocuments({ ...match, status: 'completed' }),
      this.groupCount(this.applicationModel, match, '$status'),
      this.groupCount(this.applicationModel, match, '$currentStage'),
      this.applicationModel.aggregate([
        { $match: match }, { $group: { _id: '$programId', count: { $sum: 1 }, admitted: { $sum: { $cond: [{ $eq: ['$admissionDecision', 'admitted'] }, 1, 0] } } } },
        { $lookup: { from: 'programs', localField: '_id', foreignField: '_id', as: 'program' } },
        { $unwind: { path: '$program', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, id: '$_id', label: { $ifNull: ['$program.name', 'Unknown'] }, count: 1, admitted: 1 } }, { $sort: { count: -1 } },
      ]),
      this.timeTrend(this.applicationModel, match, 'createdAt', { admitted: { $sum: { $cond: [{ $eq: ['$admissionDecision', 'admitted'] }, 1, 0] } } }),
    ]);
    return {
      generatedAt: new Date(),
      kpis: { totalApplications: total, pending, admitted, rejected, completed, admissionRate: this.percent(admitted, total), completionRate: this.percent(completed, total) },
      byStatus, byStage, byProgram, monthlyTrend,
      funnel: Array.from({ length: 10 }, (_, index) => ({ stage: index + 1, count: byStage.filter((item: any) => Number(item.key) >= index + 1).reduce((sum: number, item: any) => sum + item.count, 0) })),
    };
  }

  private async students(filters: any) {
    const match: any = {};
    if (filters.programIds) match.programId = { $in: filters.programIds };
    if (filters.level) match.currentLevel = filters.level;
    if (filters.academicSessionId) match.academicSession = filters.academicSessionId;
    const [total, active, suspended, graduated, withdrawn, portalDisabled, byProgram, demographics, enrollmentOutcomes] = await Promise.all([
      this.studentModel.countDocuments(match), this.studentModel.countDocuments({ ...match, status: 'active', isActive: true }),
      this.studentModel.countDocuments({ ...match, status: 'suspended' }), this.studentModel.countDocuments({ ...match, status: 'graduated' }),
      this.studentModel.countDocuments({ ...match, status: 'withdrawn' }), this.studentModel.countDocuments({ ...match, isActive: false }),
      this.studentModel.aggregate([
        { $match: match }, { $group: { _id: '$programId', count: { $sum: 1 } } },
        { $lookup: { from: 'programs', localField: '_id', foreignField: '_id', as: 'program' } }, { $unwind: '$program' },
        { $project: { _id: 0, id: '$_id', label: '$program.name', count: 1 } }, { $sort: { count: -1 } },
      ]),
      this.studentModel.aggregate([
        { $match: match }, { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } }, { $unwind: '$user' },
        { $group: { _id: { $ifNull: ['$user.gender', 'not_specified'] }, count: { $sum: 1 } } },
        { $project: { _id: 0, key: '$_id', count: 1 } }, { $sort: { count: -1 } },
      ]),
      this.enrollmentModel.aggregate([
        { $match: {
          ...(filters.academicSessionId ? { academicSessionId: filters.academicSessionId } : {}),
          ...(filters.studentIds ? { studentId: { $in: filters.studentIds } } : {}),
        } },
        { $group: { _id: '$annualOutcome', count: { $sum: 1 } } }, { $project: { _id: 0, key: '$_id', count: 1 } }, { $sort: { count: -1 } },
      ]),
    ]);
    return { generatedAt: new Date(), kpis: { total, active, suspended, graduated, withdrawn, portalDisabled }, byProgram, demographics, enrollmentOutcomes };
  }

  private async finance(filters: any) {
    if (filters.academicSessionId) await this.obligations.syncSession(String(filters.academicSessionId));
    const match: any = { ...this.dateMatch(filters, 'createdAt') };
    if (filters.academicSessionId) match.academicSessionId = filters.academicSessionId;
    if (filters.userIds) match.userId = { $in: filters.userIds };
    const [totals] = await this.studentPaymentModel.aggregate([
      { $match: match },
      { $group: { _id: null,
        successfulCollections: { $sum: { $cond: [{ $eq: ['$status', PaymentStatus.SUCCESSFUL] }, '$amount', 0] } },
        successfulTransactions: { $sum: { $cond: [{ $eq: ['$status', PaymentStatus.SUCCESSFUL] }, 1, 0] } },
        pendingTransactions: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        failedTransactions: { $sum: { $cond: [{ $in: ['$status', ['failed', 'rejected', 'cancelled']] }, 1, 0] } },
        transactionFees: { $sum: { $cond: [{ $eq: ['$status', PaymentStatus.SUCCESSFUL] }, { $ifNull: ['$fee', 0] }, 0] } },
      } },
    ]);
    const obligationMatch: any = {};
    if (filters.academicSessionId) obligationMatch.academicSessionId = filters.academicSessionId;
    if (filters.studentIds) obligationMatch.studentId = { $in: filters.studentIds };
    const [obligations] = await this.obligationModel.aggregate([
      { $match: obligationMatch }, { $group: { _id: null,
        expected: { $sum: { $cond: [{ $in: ['$status', ['due', 'paid']] }, '$amountSnapshot', 0] } },
        outstanding: { $sum: { $cond: [{ $eq: ['$status', 'due'] }, '$amountSnapshot', 0] } },
        dueCount: { $sum: { $cond: [{ $eq: ['$status', 'due'] }, 1, 0] } },
      } },
    ]);
    const [byStatus, byMethod, byChannel, byFee, monthlyTrend] = await Promise.all([
      this.groupAmount(this.studentPaymentModel, match, '$status'), this.groupAmount(this.studentPaymentModel, match, '$method'), this.groupAmount(this.studentPaymentModel, match, '$channel'),
      this.studentPaymentModel.aggregate([
        { $match: { ...match, status: PaymentStatus.SUCCESSFUL } }, { $group: { _id: '$paymentId', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
        { $lookup: { from: 'payments', localField: '_id', foreignField: '_id', as: 'payment' } }, { $unwind: { path: '$payment', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, id: '$_id', label: { $ifNull: ['$payment.name', 'Unknown'] }, count: 1, amount: 1 } }, { $sort: { amount: -1 } },
      ]),
      this.timeTrend(this.studentPaymentModel, { ...match, status: PaymentStatus.SUCCESSFUL }, 'paidAt', { amount: { $sum: '$amount' } }),
    ]);
    const expected = Number(obligations?.expected || 0);
    const collected = Number(totals?.successfulCollections || 0);
    return {
      generatedAt: new Date(),
      kpis: { ...totals, expectedStudentFees: expected, outstandingStudentFees: Number(obligations?.outstanding || 0), dueObligations: Number(obligations?.dueCount || 0), collectionRate: this.percent(collected, expected) },
      byStatus, byMethod, byChannel, byFee, monthlyTrend,
      obligationCoverage: filters.academicSessionId ? 'synchronized' : 'select_session_for_expected_revenue',
    };
  }

  private async academics(filters: any, scope: ReportAccessScope) {
    const resultMatch: any = {};
    if (filters.academicSessionId) resultMatch.academicSessionId = filters.academicSessionId;
    if (filters.programIds) resultMatch.programId = { $in: filters.programIds };
    if (filters.departmentId) resultMatch.departmentId = filters.departmentId;
    if (filters.level) resultMatch.level = filters.level;
    if (filters.semester) resultMatch.semester = filters.semester;
    if (!scope.unrestricted && scope.programCourseIds.length && !scope.departmentIds.length && !scope.programIds.length) resultMatch.programCourseId = { $in: scope.programCourseIds };
    const registrationMatch: any = {};
    if (filters.academicSessionId) registrationMatch.academicSessionId = filters.academicSessionId;
    if (filters.programIds) registrationMatch.programId = { $in: filters.programIds };
    if (filters.level) registrationMatch.level = filters.level;
    if (filters.semester) registrationMatch.semester = filters.semester;
    const [totalResults, published, failed, reviewBacklog, gradeDistribution, workflow, registrations, repeatRequired, resitRequired, gpa] = await Promise.all([
      this.resultModel.countDocuments(resultMatch), this.resultModel.countDocuments({ ...resultMatch, workflowStatus: AcademicResultWorkflowStatus.PUBLISHED }),
      this.resultModel.countDocuments({ ...resultMatch, workflowStatus: AcademicResultWorkflowStatus.PUBLISHED, isPass: false }),
      this.resultModel.countDocuments({ ...resultMatch, workflowStatus: { $in: ['submitted_to_hod', 'hod_approved', 'submitted_to_provost', 'provost_approved'] } }),
      this.groupCount(this.resultModel, { ...resultMatch, workflowStatus: AcademicResultWorkflowStatus.PUBLISHED }, '$gradeLetter'),
      this.groupCount(this.resultModel, resultMatch, '$workflowStatus'), this.groupCount(this.registrationModel, registrationMatch, '$status'),
      this.enrollmentModel.countDocuments({ ...(filters.academicSessionId ? { academicSessionId: filters.academicSessionId } : {}), ...(filters.studentIds ? { studentId: { $in: filters.studentIds } } : {}), annualOutcome: { $in: ['repeat_year_required', 'repeating_year'] } }),
      this.enrollmentModel.countDocuments({ ...(filters.academicSessionId ? { academicSessionId: filters.academicSessionId } : {}), ...(filters.studentIds ? { studentId: { $in: filters.studentIds } } : {}), 'semesterProgressions.outcome': { $in: ['resit_required', 'resit_in_progress'] } }),
      this.academicSummaryModel.aggregate([
        { $match: {
          ...(filters.academicSessionId ? { academicSessionId: filters.academicSessionId } : {}),
          ...(filters.studentIds ? { studentId: { $in: filters.studentIds } } : {}),
        } },
        { $group: { _id: null, averageSemesterGPA: { $avg: '$semesterGPA' }, averageCGPA: { $avg: '$cumulativeGPA' }, earnedUnits: { $sum: '$earnedUnits' }, applicableUnits: { $sum: '$applicableUnits' } } },
      ]),
    ]);
    return {
      generatedAt: new Date(),
      kpis: { totalResults, published, failed, publicationRate: this.percent(published, totalResults), passRate: this.percent(published - failed, published), reviewBacklog, repeatRequired, resitRequired, academicInterventions: repeatRequired + resitRequired },
      gradeDistribution, workflow, registrations, gpa: gpa[0] || { averageSemesterGPA: null, averageCGPA: null, earnedUnits: 0, applicableUnits: 0 },
    };
  }

  private async exams(filters: any) {
    const examMatch: any = { ...this.dateMatch(filters, 'createdAt') };
    if (filters.academicSessionId) examMatch.academicSession = filters.academicSessionId;
    if (filters.programIds?.length) examMatch['target.filter.programId'] = { $in: filters.programIds };
    const examIds = await this.examModel.find(examMatch).distinct('_id');
    const resultMatch = { examId: { $in: examIds } };
    const attemptMatch = { examId: { $in: examIds } };
    const [totalExams, publishedExams, totalAttempts, completedAttempts, results] = await Promise.all([
      this.examModel.countDocuments(examMatch), this.examModel.countDocuments({ ...examMatch, status: 'published' }),
      this.attemptModel.countDocuments(attemptMatch), this.attemptModel.countDocuments({ ...attemptMatch, status: { $in: ['submitted', 'auto-submitted', 'graded'] } }),
      this.examResultModel.aggregate([{ $match: resultMatch }, { $group: { _id: null, count: { $sum: 1 }, averageScore: { $avg: '$percentage' }, passed: { $sum: { $cond: [{ $eq: ['$passStatus', 'pass'] }, 1, 0] } }, gradingBacklog: { $sum: { $cond: [{ $ne: ['$status', 'completed'] }, 1, 0] } } } }]),
    ]);
    const summary = results[0] || { count: 0, averageScore: 0, passed: 0, gradingBacklog: 0 };
    return { generatedAt: new Date(), kpis: { totalExams, publishedExams, totalAttempts, completedAttempts, completionRate: this.percent(completedAttempts, totalAttempts), averageScore: summary.averageScore || 0, passRate: this.percent(summary.passed, summary.count), gradingBacklog: summary.gradingBacklog }, byStatus: await this.groupCount(this.examModel, examMatch, '$status') };
  }

  private async communications(filters: any) {
    const match: any = { ...this.dateMatch(filters, 'createdAt') };
    const notificationIds = await this.notificationModel.find(match).distinct('_id');
    const [total, sent, failed, recipients] = await Promise.all([
      this.notificationModel.countDocuments(match), this.notificationModel.countDocuments({ ...match, status: 'sent' }), this.notificationModel.countDocuments({ ...match, status: 'partially_failed' }),
      this.recipientModel.aggregate([{ $match: { notificationId: { $in: notificationIds } } }, { $group: { _id: null, delivered: { $sum: 1 }, read: { $sum: { $cond: [{ $ne: ['$readAt', null] }, 1, 0] } } } }]),
    ]);
    const delivery = recipients[0] || { delivered: 0, read: 0 };
    return { generatedAt: new Date(), kpis: { total, sent, failed, recipients: delivery.delivered, read: delivery.read, readRate: this.percent(delivery.read, delivery.delivered), unreadRate: 100 - this.percent(delivery.read, delivery.delivered) }, byStatus: await this.groupCount(this.notificationModel, match, '$status'), byCategory: await this.groupCount(this.notificationModel, match, '$category'), byAudience: await this.groupCount(this.notificationModel, match, '$audience.type') };
  }

  private async activity(filters: any) {
    const match: any = { ...this.dateMatch(filters, 'occurredAt') };
    const [events, activeUsers, byPortal, byRoute, dailyTrend] = await Promise.all([
      this.activityModel.countDocuments(match), this.activityModel.distinct('userId', match), this.groupCount(this.activityModel, match, '$portal'),
      this.activityModel.aggregate([{ $match: match }, { $group: { _id: { portal: '$portal', routeName: '$routeName' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }, { $project: { _id: 0, portal: '$_id.portal', routeName: '$_id.routeName', count: 1 } }]),
      this.timeTrend(this.activityModel, match, 'occurredAt'),
    ]);
    return { generatedAt: new Date(), kpis: { events, activeUsers: activeUsers.length }, byPortal, byRoute, dailyTrend };
  }

  private async normalizeFilters(filters: ReportQueryDto, scope: ReportAccessScope) {
    const normalized: any = { ...filters };
    for (const key of ['academicSessionId', 'programTypeId', 'programModeId', 'programId', 'departmentId']) {
      if (normalized[key]) normalized[key] = new Types.ObjectId(normalized[key]);
    }
    const programQuery: any = {};
    if (normalized.programId) programQuery._id = normalized.programId;
    if (normalized.programTypeId) programQuery.programTypeId = normalized.programTypeId;
    if (normalized.programModeId) programQuery.programModeId = normalized.programModeId;
    if (normalized.departmentId) programQuery.departmentId = normalized.departmentId;
    if (!scope.unrestricted) {
      const accessConditions: any[] = [];
      if (scope.departmentIds.length) accessConditions.push({ departmentId: { $in: scope.departmentIds } });
      if (scope.programIds.length) accessConditions.push({ _id: { $in: scope.programIds } });
      programQuery.$and = [{ $or: accessConditions.length ? accessConditions : [{ _id: { $in: [] } }] }];
    }
    if (Object.keys(programQuery).length) normalized.programIds = await this.programModel.find(programQuery).distinct('_id');
    if (normalized.programIds) {
      const students = await this.studentModel.find({ programId: { $in: normalized.programIds } }).select('_id userId').lean();
      normalized.studentIds = students.map((student: any) => student._id);
      normalized.userIds = students.map((student: any) => student.userId).filter(Boolean);
    }
    return normalized;
  }

  private async cached(type: string, filters: any, refresh: boolean, loader: () => Promise<any>) {
    const serialized = JSON.stringify(filters, (_key, value) => value instanceof Types.ObjectId ? value.toString() : value);
    const cacheKey = createHash('sha256').update(`${type}:${serialized}`).digest('hex');
    if (!refresh) {
      const snapshot: any = await this.snapshotModel.findOne({ cacheKey, expiresAt: { $gt: new Date() } }).lean();
      if (snapshot) return { ...snapshot.payload, cache: { hit: true, generatedAt: snapshot.generatedAt } };
    }
    const payload = await loader();
    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + this.cacheMinutes * 60_000);
    await this.snapshotModel.updateOne({ cacheKey }, { $set: { reportType: type, payload, generatedAt, expiresAt } }, { upsert: true });
    return { ...payload, cache: { hit: false, generatedAt } };
  }

  private dateRange(filters: ReportQueryDto) {
    const to = filters.dateTo ? new Date(filters.dateTo) : new Date();
    if (filters.dateTo) to.setHours(23, 59, 59, 999);
    const from = filters.dateFrom ? new Date(filters.dateFrom) : new Date(to.getTime() - 30 * 86400000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw new BadRequestException('Invalid report date range');
    return { from, to };
  }

  private dateMatch(filters: any, field: string) {
    if (!filters.dateFrom && !filters.dateTo) return {};
    const { from, to } = this.dateRange(filters);
    return { [field]: { $gte: from, $lte: to } };
  }

  private async groupCount(model: Model<any>, match: any, expression: any) {
    return model.aggregate([{ $match: match }, { $group: { _id: expression, count: { $sum: 1 } } }, { $project: { _id: 0, key: { $ifNull: ['$_id', 'not_specified'] }, count: 1 } }, { $sort: { count: -1 } }]);
  }

  private async groupAmount(model: Model<any>, match: any, expression: any) {
    return model.aggregate([{ $match: match }, { $group: { _id: expression, count: { $sum: 1 }, amount: { $sum: '$amount' } } }, { $project: { _id: 0, key: { $ifNull: ['$_id', 'not_specified'] }, count: 1, amount: 1 } }, { $sort: { amount: -1 } }]);
  }

  private async timeTrend(model: Model<any>, match: any, field: string, extra: Record<string, unknown> = {}) {
    return model.aggregate([
      { $match: match }, { $match: { [field]: { $ne: null } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: `$${field}`, timezone: 'Africa/Lagos' } }, count: { $sum: 1 }, ...extra } },
      { $project: { _id: 0, period: '$_id', count: 1, ...Object.fromEntries(Object.keys(extra).map((key) => [key, 1])) } }, { $sort: { period: 1 } },
    ]);
  }

  private percent(numerator: number, denominator: number) {
    return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
  }

  private flatten(value: any, prefix = '', output: Record<string, unknown> = {}) {
    Object.entries(value || {}).forEach(([key, item]) => {
      const name = prefix ? `${prefix}.${key}` : key;
      if (item && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Date)) this.flatten(item, name, output);
      else output[name] = Array.isArray(item) ? JSON.stringify(item) : item as any;
    });
    return output;
  }
}

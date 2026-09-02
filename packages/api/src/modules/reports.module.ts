import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsController } from '../controllers/reports.controller';
import { PortalActivityController } from '../controllers/portal-activity.controller';
import { AcademicResult, AcademicResultSchema } from '../schemas/academic-result.schema';
import { AcademicSession, AcademicSessionSchema } from '../schemas/academic-session.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { CourseRegistration, CourseRegistrationSchema } from '../schemas/course-registration.schema';
import { Department, DepartmentSchema } from '../schemas/department.schema';
import { Exam, ExamSchema } from '../schemas/exam.schema';
import { ExamAttempt, ExamAttemptSchema } from '../schemas/exam-attempt.schema';
import { ExamResult, ExamResultSchema } from '../schemas/exam-result.schema';
import { Notification, NotificationSchema } from '../schemas/notification.schema';
import { NotificationRecipient, NotificationRecipientSchema } from '../schemas/notification-recipient.schema';
import { Payment, PaymentSchema } from '../schemas/payment.schema';
import { PortalActivityEvent, PortalActivityEventSchema } from '../schemas/portal-activity-event.schema';
import { Program, ProgramSchema } from '../schemas/program.schema';
import { ProgramCourse, ProgramCourseSchema } from '../schemas/program-course.schema';
import { ProgramMode, ProgramModeSchema } from '../schemas/program-mode.schema';
import { ProgramType, ProgramTypeSchema } from '../schemas/program-type.schema';
import { ReportExportAudit, ReportExportAuditSchema } from '../schemas/report-export-audit.schema';
import { ReportSnapshot, ReportSnapshotSchema } from '../schemas/report-snapshot.schema';
import { Role, RoleSchema } from '../schemas/role.schema';
import { ScheduledReport, ScheduledReportSchema } from '../schemas/scheduled-report.schema';
import { SessionControl, SessionControlSchema } from '../schemas/session-control.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import { Student, StudentSchema } from '../schemas/student.schema';
import { StudentAcademicSession, StudentAcademicSessionSchema } from '../schemas/student-academic-session.schema';
import { StudentAcademicSummary, StudentAcademicSummarySchema } from '../schemas/student-academic-summary.schema';
import { StudentFeeObligation, StudentFeeObligationSchema } from '../schemas/student-fee-obligation.schema';
import { StudentPayment, StudentPaymentSchema } from '../schemas/student-payment.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { EmailService } from '../services/email.service';
import { PortalActivityService } from '../services/portal-activity.service';
import { ReportExportService } from '../services/report-export.service';
import { ReportsAccessService } from '../services/reports-access.service';
import { ReportsService } from '../services/reports.service';
import { ScheduledReportsService } from '../services/scheduled-reports.service';
import { StudentFeeObligationService } from '../services/student-fee-obligation.service';

@Module({
  imports: [MongooseModule.forFeature([
    { name: AcademicResult.name, schema: AcademicResultSchema }, { name: AcademicSession.name, schema: AcademicSessionSchema },
    { name: Application.name, schema: ApplicationSchema }, { name: CourseRegistration.name, schema: CourseRegistrationSchema },
    { name: Department.name, schema: DepartmentSchema }, { name: Exam.name, schema: ExamSchema },
    { name: ExamAttempt.name, schema: ExamAttemptSchema }, { name: ExamResult.name, schema: ExamResultSchema },
    { name: Notification.name, schema: NotificationSchema }, { name: NotificationRecipient.name, schema: NotificationRecipientSchema },
    { name: Payment.name, schema: PaymentSchema }, { name: PortalActivityEvent.name, schema: PortalActivityEventSchema },
    { name: Program.name, schema: ProgramSchema }, { name: ProgramCourse.name, schema: ProgramCourseSchema },
    { name: ProgramMode.name, schema: ProgramModeSchema }, { name: ProgramType.name, schema: ProgramTypeSchema },
    { name: ReportExportAudit.name, schema: ReportExportAuditSchema }, { name: ReportSnapshot.name, schema: ReportSnapshotSchema },
    { name: Role.name, schema: RoleSchema }, { name: ScheduledReport.name, schema: ScheduledReportSchema },
    { name: SessionControl.name, schema: SessionControlSchema }, { name: Staff.name, schema: StaffSchema },
    { name: Student.name, schema: StudentSchema }, { name: StudentAcademicSession.name, schema: StudentAcademicSessionSchema },
    { name: StudentAcademicSummary.name, schema: StudentAcademicSummarySchema }, { name: StudentFeeObligation.name, schema: StudentFeeObligationSchema },
    { name: StudentPayment.name, schema: StudentPaymentSchema }, { name: User.name, schema: UserSchema },
  ])],
  controllers: [ReportsController, PortalActivityController],
  providers: [ReportsService, ReportsAccessService, ReportExportService, ScheduledReportsService, StudentFeeObligationService, PortalActivityService, EmailService],
})
export class ReportsModule {}


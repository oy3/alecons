import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { AcademicSession, AcademicSessionDocument } from '../schemas/academic-session.schema';
import { Payment, PaymentAudience, PaymentDocument } from '../schemas/payment.schema';
import { SessionControl, SessionControlDocument } from '../schemas/session-control.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { StudentAcademicSession, StudentAcademicSessionDocument } from '../schemas/student-academic-session.schema';
import { StudentPayment, StudentPaymentDocument, PaymentStatus } from '../schemas/student-payment.schema';
import { StudentFeeObligation, StudentFeeObligationDocument } from '../schemas/student-fee-obligation.schema';

@Injectable()
export class StudentFeeObligationService {
  constructor(
    @InjectModel(AcademicSession.name) private readonly academicSessionModel: Model<AcademicSessionDocument>,
    @InjectModel(SessionControl.name) private readonly sessionControlModel: Model<SessionControlDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(StudentAcademicSession.name) private readonly enrollmentModel: Model<StudentAcademicSessionDocument>,
    @InjectModel(StudentPayment.name) private readonly studentPaymentModel: Model<StudentPaymentDocument>,
    @InjectModel(StudentFeeObligation.name) private readonly obligationModel: Model<StudentFeeObligationDocument>,
  ) {}

  @Cron('0 30 1 * * *')
  async syncCurrentSessions() {
    const sessions = await this.academicSessionModel.find({ status: { $in: ['open', 'ongoing'] } }).select('_id').lean();
    for (const session of sessions) await this.syncSession(String(session._id));
  }

  async syncAllSessions() {
    const sessions = await this.academicSessionModel.find({}).sort({ startDate: 1 }).select('_id title').lean();
    const totals = { sessions: sessions.length, created: 0, paid: 0, students: 0, configuredFees: 0 };
    const results = [];
    for (const session of sessions as any[]) {
      const result = await this.syncSession(String(session._id));
      totals.created += result.created;
      totals.paid += result.paid;
      totals.students += result.students;
      totals.configuredFees += result.configuredFees;
      results.push({ academicSessionId: session._id, title: session.title, ...result });
    }
    return { ...totals, results };
  }

  async syncSession(academicSessionId: string) {
    if (!Types.ObjectId.isValid(academicSessionId)) throw new BadRequestException('Invalid academic session');
    const sessionId = new Types.ObjectId(academicSessionId);
    const [academicSession, controls] = await Promise.all([
      this.academicSessionModel.exists({ _id: sessionId }),
      this.sessionControlModel.findOne({ academicSessionId: sessionId }).lean(),
    ]);
    if (!academicSession) throw new BadRequestException('Academic session not found');
    if (!controls) return { created: 0, paid: 0, students: 0, configuredFees: 0 };

    const activeControls = (controls.payments || []).filter((item: any) => item.active);
    const paymentIds = activeControls.map((item: any) => item.paymentId);
    const payments = await this.paymentModel.find({
      _id: { $in: paymentIds },
      active: true,
      targetAudience: PaymentAudience.STUDENT,
    }).lean();
    const paymentMap = new Map(payments.map((payment: any) => [String(payment._id), payment]));
    const enrollments = await this.enrollmentModel.find({ academicSessionId: sessionId }).select('studentId').lean();
    const enrollmentStudentIds = enrollments.map((item: any) => item.studentId);
    const students = await this.studentModel.find({
      $or: [{ academicSession: sessionId }, { _id: { $in: enrollmentStudentIds } }],
    }).select('_id userId entryAcademicSession').lean();

    const operations: any[] = [];
    for (const student of students as any[]) {
      const group = String(student.entryAcademicSession) === academicSessionId ? 'new' : 'returning';
      for (const control of activeControls as any[]) {
        const eligibleGroups = control.eligibleStudentGroups?.length ? control.eligibleStudentGroups : ['new', 'returning'];
        const payment: any = paymentMap.get(String(control.paymentId));
        if (!payment || !eligibleGroups.includes(group)) continue;
        operations.push({
          updateOne: {
            filter: { studentId: student._id, academicSessionId: sessionId, paymentId: payment._id },
            update: {
              $setOnInsert: {
                studentId: student._id,
                userId: student.userId,
                academicSessionId: sessionId,
                paymentId: payment._id,
                amountSnapshot: payment.amount,
                studentGroupSnapshot: group,
                status: 'due',
              },
            },
            upsert: true,
          },
        });
      }
    }
    const writeResult = operations.length ? await this.obligationModel.bulkWrite(operations, { ordered: false }) : null;

    const successfulPayments = await this.studentPaymentModel.find({
      academicSessionId: sessionId,
      status: PaymentStatus.SUCCESSFUL,
    }).select('_id userId paymentId paidAt verifiedAt createdAt').sort({ paidAt: 1, createdAt: 1 }).lean();
    let paid = 0;
    for (const payment of successfulPayments as any[]) {
      const result = await this.obligationModel.updateOne(
        { userId: payment.userId, academicSessionId: sessionId, paymentId: payment.paymentId, status: 'due' },
        { $set: { status: 'paid', settledByPaymentId: payment._id, settledAt: payment.paidAt || payment.verifiedAt || payment.createdAt } },
      );
      paid += result.modifiedCount;
    }
    return {
      created: Number(writeResult?.upsertedCount || 0),
      paid,
      students: students.length,
      configuredFees: payments.length,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
    AcademicSession,
    AcademicSessionDocument,
    SessionStatus,
} from '../schemas/academic-session.schema';
import {
    Application,
    ApplicationDocument,
    ApplicationStatus,
    AdmissionDecision,
} from '../schemas/application.schema';
import { StudentPayment, StudentPaymentDocument, PaymentStatus } from '../schemas/student-payment.schema';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class StaffDashboardService {
    constructor(
        @InjectModel(Application.name)
        private readonly applicationModel: Model<ApplicationDocument>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        @InjectModel(AcademicSession.name)
        private readonly academicSessionModel: Model<AcademicSessionDocument>,
        @InjectModel(StudentPayment.name)
        private readonly studentPaymentModel: Model<StudentPaymentDocument>,
    ) { }

    async getStats() {
        const currentAcademicSession = await this.getCurrentAcademicSession();
        const revenueQuery: Record<string, unknown> = {
            status: PaymentStatus.SUCCESSFUL,
        };

        if (currentAcademicSession?._id) {
            revenueQuery.academicSessionId = currentAcademicSession._id;
        }

        const [
            totalApplications,
            pendingApplications,
            admittedStudents,
            totalUsers,
            totalRevenueResult,
        ] = await Promise.all([
            this.applicationModel.countDocuments({ isActive: true }),
            this.applicationModel.countDocuments({
                isActive: true,
                status: ApplicationStatus.PENDING,
            }),
            this.applicationModel.countDocuments({
                isActive: true,
                $or: [
                    { admissionDecision: AdmissionDecision.GRANTED },
                    { status: ApplicationStatus.ADMITTED },
                    {
                        status: ApplicationStatus.COMPLETED,
                        admissionDecision: AdmissionDecision.GRANTED,
                    },
                ],
            }),
            this.userModel.countDocuments({ isActive: true }),
            this.studentPaymentModel.aggregate([
                { $match: revenueQuery },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]),
        ]);

        return {
            currentAcademicSession: currentAcademicSession
                ? {
                    id: currentAcademicSession._id,
                    sessionYear: currentAcademicSession.sessionYear,
                    title: currentAcademicSession.title,
                    status: currentAcademicSession.status,
                    startDate: currentAcademicSession.startDate,
                    endDate: currentAcademicSession.endDate,
                }
                : null,
            stats: {
                totalApplications,
                pendingApplications,
                admittedStudents,
                totalUsers,
                totalRevenue: totalRevenueResult[0]?.total || 0,
                systemHealth: 'Good',
            },
        };
    }

    private async getCurrentAcademicSession() {
        const preferredSession = await this.academicSessionModel
            .findOne({ status: SessionStatus.OPEN })
            .sort({ startDate: -1 })
            .lean();

        if (preferredSession) {
            return preferredSession;
        }

        const ongoingSession = await this.academicSessionModel
            .findOne({ status: SessionStatus.ONGOING })
            .sort({ startDate: -1 })
            .lean();

        if (ongoingSession) {
            return ongoingSession;
        }

        return this.academicSessionModel
            .findOne({})
            .sort({ startDate: -1 })
            .lean();
    }
}

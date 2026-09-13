import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { Payment, PaymentDocument, PaymentAudience } from '../schemas/payment.schema';
import {
    PaymentTransaction,
    PaymentTransactionDocument,
    PaymentMethod,
    PaymentStatus,
    PaymentChannel,
    RemittanceStatus,
    PaymentPayerType,
    PaymentContext,
} from '../schemas/payment-transaction.schema';
import {
    PaymentDestinationAccount,
    PaymentDestinationAccountDocument,
    PaymentDestinationChannelType,
    PaymentDestinationProviderType,
} from '../schemas/payment-destination-account.schema';
import { AdmissionDecision, Application, ApplicationDocument, ApplicationStatus } from '../schemas/application.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { AcademicSession, AcademicSessionDocument } from '../schemas/academic-session.schema';
import {
    StudentAcademicSession,
    StudentAcademicSessionDocument,
    StudentAcademicSessionStatus,
} from '../schemas/student-academic-session.schema';
import { TenancyAgreement, TenancyAgreementDocument } from '../schemas/tenancy-agreement.schema';
import { AccommodationApplicationStatus } from '../schemas/accommodation-application.schema';
import { MatriculationService } from '../services/matriculation.service';
import { EmailService } from '../services/email.service';
import { UploadService } from '../services/upload.service';
import { TenancyAgreementService } from '../services/tenancy-agreement.service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface PaymentSummary {
    id: string;
    name: string;
    description?: string;
    amount: number;
    isPaid: boolean;
    paymentCode: string; // Added to identify payment type
    paidAt?: Date;
    reference?: string;
    status?: PaymentStatus;
    channel?: string;
    fee?: number;
    method?: PaymentMethod;
    remarks?: string;
    receiptUrl?: string;
    receiptOriginalName?: string;
    receiptUploadedAt?: Date;
    manualTransferDetails?: ManualTransferDetails;
    paystackDestinationAccount?: DestinationAccountSummary | null;
    manualTransferDestinationAccount?: DestinationAccountSummary | null;
    latestRejectedManualTransfer?: RejectedManualTransferSummary;
}

export interface RejectedManualTransferSummary {
    id: string;
    reference: string;
    amount: number;
    status: PaymentStatus;
    paidAt?: Date;
    rejectedAt?: Date;
    receiptUrl?: string;
    receiptOriginalName?: string;
    receiptUploadedAt?: Date;
    remarks?: string;
    verificationRemarks?: string;
    destinationAccountName?: string;
    destinationBankName?: string;
    destinationAccountNumber?: string;
}

export interface ManualTransferDetails {
    accountName: string;
    accountNumber: string;
    bankName: string;
    note: string;
}

export interface DestinationAccountSummary {
    id: string;
    title: string;
    code: string;
    channelType: PaymentDestinationChannelType;
    providerType: PaymentDestinationProviderType;
    isDefault: boolean;
    active: boolean;
    accountName?: string;
    bankName?: string;
    accountNumber?: string;
    currency?: string;
    paystackSubaccountCode?: string;
    note?: string;
}

export interface PaymentTransactionsSummary {
    paidFees: PaymentSummary[];
    pendingFees?: PaymentSummary[];
    unpaidFees: PaymentSummary[];
    totalPaid: number;
    totalPending?: number;
    totalUnpaid: number;
    availableMethods?: PaymentMethodAvailability;
    isPayable?: boolean;
}

export interface PaymentMethodAvailability {
    paystackEnabled: boolean;
    manualTransferEnabled: boolean;
}

export interface StaffLinkedPaymentRecord {
    id: string;
    amount: number;
    reference: string;
    paidAt?: Date;
    channel?: string;
    fee?: number;
    status: PaymentStatus;
    remarks?: string;
    createdAt?: Date;
    updatedAt?: Date;
    method?: PaymentMethod;
    receiptUrl?: string;
    receiptOriginalName?: string;
    receiptUploadedAt?: Date;
    verifiedAt?: Date;
    rejectedAt?: Date;
    verificationRemarks?: string;
    payment: {
        id?: string;
        name: string;
        description?: string;
        amount?: number;
        paymentCode?: string;
    };
    academicSession?: {
        id?: string;
        sessionYear?: string;
    };
}

export interface StaffLinkedPaymentsSummary {
    payments: StaffLinkedPaymentRecord[];
    totalCount: number;
    totalPaid: number;
    successfulCount: number;
    pendingCount: number;
    failedCount: number;
    cancelledCount: number;
}

export interface PaystackInitializeResponse {
    authorization_url: string;
    access_code: string;
    reference: string;
}

interface PendingReconciliationSummary {
    scanned: number;
    reconciled: number;
    markedSuccessful: number;
    markedFailed: number;
    stillPending: number;
    timedOut: number;
    errors: number;
    runAt: string;
}

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    private readonly paystackBaseUrl = 'https://api.paystack.co';

    constructor(
        @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
        @InjectModel(PaymentTransaction.name) private paymentTransactionModel: Model<PaymentTransactionDocument>,
        @InjectModel(PaymentDestinationAccount.name) private paymentDestinationAccountModel: Model<PaymentDestinationAccountDocument>,
        @InjectModel(Application.name) private applicationModel: Model<ApplicationDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
        @InjectModel(AcademicSession.name) private academicSessionModel: Model<AcademicSessionDocument>,
        @InjectModel(StudentAcademicSession.name) private studentAcademicSessionModel: Model<StudentAcademicSessionDocument>,
        @InjectModel(TenancyAgreement.name) private tenancyAgreementModel: Model<TenancyAgreementDocument>,
        private matriculationService: MatriculationService,
        private emailService: EmailService,
        private uploadService: UploadService,
        private tenancyAgreementService: TenancyAgreementService,
    ) { }

    private getUserAudiencesForContext(
        userRole: UserRole,
        context: 'application-portal' | 'student-portal' = 'application-portal',
    ): PaymentAudience[] {
        switch (userRole) {
            case UserRole.APPLICANT:
                return [PaymentAudience.APPLICANT];
            case UserRole.STUDENT:
                return context === 'application-portal'
                    ? [PaymentAudience.APPLICANT]
                    : [PaymentAudience.STUDENT];
            case UserRole.STAFF:
                return [PaymentAudience.ACADEMIC_STAFF];
            case UserRole.ADMIN:
                return [PaymentAudience.ADMIN_STAFF];
            default:
                return [PaymentAudience.APPLICANT];
        }
    }

    private isManualTransferPending(payment: Partial<PaymentTransaction>): boolean {
        return payment.status === PaymentStatus.PENDING
            && payment.method === PaymentMethod.MANUAL_TRANSFER
            && !!(payment.receiptKey || payment.receiptUrl);
    }

    private isManualTransferRejected(payment: Partial<PaymentTransaction>): boolean {
        return payment.status === PaymentStatus.REJECTED
            && payment.method === PaymentMethod.MANUAL_TRANSFER;
    }

    private toRejectedManualTransferSummary(payment: Partial<PaymentTransaction> & { _id?: Types.ObjectId | string }): RejectedManualTransferSummary {
        return {
            id: payment._id?.toString() || '',
            reference: payment.reference || '',
            amount: Number(payment.amount || 0),
            status: payment.status as PaymentStatus,
            paidAt: payment.paidAt,
            rejectedAt: payment.rejectedAt,
            receiptUrl: payment.receiptUrl,
            receiptOriginalName: payment.receiptOriginalName,
            receiptUploadedAt: payment.receiptUploadedAt,
            remarks: payment.remarks,
            verificationRemarks: payment.verificationRemarks,
            destinationAccountName: payment.destinationAccountName,
            destinationBankName: payment.destinationBankName,
            destinationAccountNumber: payment.destinationAccountNumber,
        };
    }

    private buildPaymentReference(): string {
        const smallSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
        return `ALC${Date.now()}${smallSuffix}`;
    }

    private buildManualTransferReference(): string {
        return this.buildPaymentReference();
    }

    private escapeRegex(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private toDestinationAccountSummary(account?: Partial<PaymentDestinationAccount> & { _id?: Types.ObjectId | string } | null): DestinationAccountSummary | null {
        if (!account?._id) {
            return null;
        }

        return {
            id: account._id.toString(),
            title: account.title || '',
            code: account.code || '',
            channelType: account.channelType as PaymentDestinationChannelType,
            providerType: account.providerType as PaymentDestinationProviderType,
            isDefault: Boolean(account.isDefault),
            active: Boolean(account.active),
            accountName: account.accountName,
            bankName: account.bankName,
            accountNumber: account.accountNumber,
            currency: account.currency,
            paystackSubaccountCode: account.paystackSubaccountCode,
            note: account.note,
        };
    }

    private toManualTransferDetails(account?: Partial<PaymentDestinationAccount> | null): ManualTransferDetails {
        if (account?.accountName && account?.accountNumber && account?.bankName) {
            return {
                accountName: account.accountName,
                accountNumber: account.accountNumber,
                bankName: account.bankName,
                note: account.note || 'Upload a clear receipt after making the transfer.',
            };
        }

        return {
            accountName: '',
            accountNumber: '',
            bankName: '',
            note: '',
        };
    }

    private buildDestinationSnapshot(account?: Partial<PaymentDestinationAccount> & { _id?: Types.ObjectId | string } | null) {
        if (!account?._id) {
            return {
                destinationAccountId: undefined,
                destinationChannelType: undefined,
                destinationProviderType: undefined,
                destinationAccountName: undefined,
                destinationBankName: undefined,
                destinationAccountNumber: undefined,
                destinationPaystackSubaccountCode: undefined,
            };
        }

        return {
            destinationAccountId: new Types.ObjectId(account._id.toString()),
            destinationChannelType: account.channelType,
            destinationProviderType: account.providerType,
            destinationAccountName: account.accountName,
            destinationBankName: account.bankName,
            destinationAccountNumber: account.accountNumber,
            destinationPaystackSubaccountCode: account.paystackSubaccountCode,
        };
    }

    private async getDestinationAccountsMap(ids: Array<Types.ObjectId | string | undefined | null>) {
        const validIds = Array.from(
            new Set(
                ids
                    .filter(Boolean)
                    .map((value) => value!.toString())
                    .filter((value) => Types.ObjectId.isValid(value)),
            ),
        );

        if (validIds.length === 0) {
            return new Map<string, any>();
        }

        const accounts = await this.paymentDestinationAccountModel
            .find({ _id: { $in: validIds.map((id) => new Types.ObjectId(id)) } })
            .lean();

        return new Map(accounts.map((account) => [account._id.toString(), account]));
    }

    private async getActiveDefaultDestinationAccount(channelType: PaymentDestinationChannelType) {
        return this.paymentDestinationAccountModel.findOne({ channelType, isDefault: true, active: true }).lean();
    }

    private async validateDestinationAccountId(
        destinationAccountId: string | undefined,
        channelType: PaymentDestinationChannelType,
    ) {
        if (!destinationAccountId) {
            return null;
        }

        if (!Types.ObjectId.isValid(destinationAccountId)) {
            throw new Error(`Invalid ${channelType} destination account ID`);
        }

        const account = await this.paymentDestinationAccountModel.findById(destinationAccountId).lean();
        if (!account) {
            throw new Error(`${channelType} destination account not found`);
        }

        if (account.channelType !== channelType) {
            throw new Error(`${channelType} destination account has an invalid channel type`);
        }

        return account;
    }

    private async resolveDestinationForPayment(
        payment: Partial<Payment> & {
            paymentCode?: string;
            paystackDestinationAccountId?: Types.ObjectId | string;
            manualTransferDestinationAccountId?: Types.ObjectId | string;
        },
        channelType: PaymentDestinationChannelType,
    ) {
        const configuredId = channelType === PaymentDestinationChannelType.PAYSTACK
            ? payment.paystackDestinationAccountId
            : payment.manualTransferDestinationAccountId;

        if (configuredId && Types.ObjectId.isValid(configuredId.toString())) {
            const account = await this.paymentDestinationAccountModel.findById(configuredId).lean();
            if (account?.active) {
                return account;
            }
        }

        return this.getActiveDefaultDestinationAccount(channelType);
    }

    private buildPaystackInitializePayload(params: {
        email: string;
        amount: number;
        reference: string;
        userId: string;
        paymentId: string;
        paymentName: string;
        destinationAccount?: Partial<PaymentDestinationAccount> | null;
        callbackUrl?: string;
    }) {
        const payload: Record<string, unknown> = {
            email: params.email,
            amount: params.amount * 100,
            reference: params.reference,
            metadata: {
                userId: params.userId,
                paymentId: params.paymentId,
                paymentName: params.paymentName,
            },
        };

        if (params.callbackUrl) {
            payload.callback_url = params.callbackUrl;
        }

        if (
            params.destinationAccount?.channelType === PaymentDestinationChannelType.PAYSTACK
            && params.destinationAccount?.providerType === PaymentDestinationProviderType.SUBACCOUNT
            && params.destinationAccount?.paystackSubaccountCode
        ) {
            payload.subaccount = params.destinationAccount.paystackSubaccountCode;

            if (params.destinationAccount.paystackChargeBearer) {
                payload.bearer = params.destinationAccount.paystackChargeBearer;
            }

            if (typeof params.destinationAccount.transactionCharge === 'number' && params.destinationAccount.transactionCharge > 0) {
                payload.transaction_charge = Math.round(params.destinationAccount.transactionCharge * 100);
            }
        }

        return payload;
    }

    private isTestPaystackEnvironment() {
        return this.paystackSecretKey?.startsWith('sk_test_') || process.env.NODE_ENV !== 'production';
    }

    private shouldFallbackFromInvalidSubaccount(
        message: string,
        destinationAccount?: Partial<PaymentDestinationAccount> | null,
    ) {
        return Boolean(
            this.isTestPaystackEnvironment()
            && destinationAccount?.channelType === PaymentDestinationChannelType.PAYSTACK
            && destinationAccount?.providerType === PaymentDestinationProviderType.SUBACCOUNT
            && destinationAccount?.paystackSubaccountCode
            && /invalid subaccount/i.test(message),
        );
    }

    private formatPaystackInitializationError(
        message: string,
        destinationAccount?: Partial<PaymentDestinationAccount> | null,
    ) {
        if (
            destinationAccount?.channelType === PaymentDestinationChannelType.PAYSTACK
            && destinationAccount?.providerType === PaymentDestinationProviderType.SUBACCOUNT
            && destinationAccount?.paystackSubaccountCode
            && /invalid subaccount/i.test(message)
        ) {
            return `Configured Paystack subaccount ${destinationAccount.paystackSubaccountCode} is invalid for the current Paystack environment.`;
        }

        return message;
    }

    private async sendPaystackInitializeRequest(payload: Record<string, unknown>) {
        const response = await fetch(`${this.paystackBaseUrl}/transaction/initialize`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.paystackSecretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const text = await response.text();
        let data: any = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }

        if (!response.ok || !data?.status) {
            const message = data?.message || `Paystack API error: ${response.status} ${response.statusText}`;
            const error = new Error(message) as Error & {
                statusCode?: number;
                responseBody?: unknown;
            };
            error.statusCode = response.status;
            error.responseBody = data ?? text;
            throw error;
        }

        return data;
    }

    private async initializePaystackTransactionWithFallback(
        payload: Record<string, unknown>,
        destinationAccount?: Partial<PaymentDestinationAccount> | null,
        allowDestinationFallback = true,
    ) {
        try {
            return await this.sendPaystackInitializeRequest(payload);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Paystack initialization failed';

            if (allowDestinationFallback && this.shouldFallbackFromInvalidSubaccount(message, destinationAccount)) {
                const fallbackPayload = { ...payload };
                delete fallbackPayload.subaccount;
                delete fallbackPayload.bearer;
                delete fallbackPayload.transaction_charge;

                this.logger.warn(
                    `Paystack subaccount ${destinationAccount?.paystackSubaccountCode} is invalid in the current environment. Retrying without destination split in test/development mode.`,
                );

                return this.sendPaystackInitializeRequest(fallbackPayload);
            }

            throw new Error(this.formatPaystackInitializationError(message, destinationAccount));
        }
    }

    private getPaymentMethodControlNames(context: 'application-portal' | 'student-portal') {
        if (context === 'student-portal') {
            return {
                paystack: 'studentPaystackPayments',
                manualTransfer: 'studentManualTransferPayments',
            };
        }

        return {
            paystack: 'applicantPaystackPayments',
            manualTransfer: 'applicantManualTransferPayments',
        };
    }

    private async getPaymentMethodAvailability(
        context: 'application-portal' | 'student-portal',
        academicSessionId?: string | Types.ObjectId,
    ): Promise<PaymentMethodAvailability> {
        const defaultAvailability: PaymentMethodAvailability = {
            paystackEnabled: true,
            manualTransferEnabled: true,
        };

        if (!academicSessionId) {
            return defaultAvailability;
        }

        const sessionId = typeof academicSessionId === 'string'
            ? academicSessionId
            : academicSessionId.toString();

        if (!Types.ObjectId.isValid(sessionId)) {
            return defaultAvailability;
        }

        const sessionControl = await this.paymentModel.db.collection('sessioncontrols')
            .findOne({ academicSessionId: new Types.ObjectId(sessionId) });

        if (!sessionControl?.controls?.length) {
            return defaultAvailability;
        }

        const controlNames = this.getPaymentMethodControlNames(context);
        const controlMap = new Map(
            (sessionControl.controls || []).map((control: any) => [control.name, Boolean(control.active)]),
        );

        return {
            paystackEnabled: controlMap.has(controlNames.paystack)
                ? Boolean(controlMap.get(controlNames.paystack))
                : defaultAvailability.paystackEnabled,
            manualTransferEnabled: controlMap.has(controlNames.manualTransfer)
                ? Boolean(controlMap.get(controlNames.manualTransfer))
                : defaultAvailability.manualTransferEnabled,
        };
    }

    private async assertPaymentMethodEnabled(
        method: PaymentMethod,
        context: 'application-portal' | 'student-portal',
        academicSessionId?: string | Types.ObjectId,
    ) {
        const availability = await this.getPaymentMethodAvailability(context, academicSessionId);

        if (method === PaymentMethod.PAYSTACK && !availability.paystackEnabled) {
            throw new Error('Paystack payments are currently disabled for this session');
        }

        if (method === PaymentMethod.MANUAL_TRANSFER && !availability.manualTransferEnabled) {
            throw new Error('Manual transfer payments are currently disabled for this session');
        }

        return availability;
    }

    private async resolveLinkedApplication(userId: string | Types.ObjectId, applicationId?: string) {
        const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

        if (applicationId) {
            if (!Types.ObjectId.isValid(applicationId)) {
                throw new Error('Invalid application ID');
            }

            const selectedApplication = await this.applicationModel
                .findOne({ _id: new Types.ObjectId(applicationId), userId: userObjectId })
                .select('_id applicationNumber entryAcademicSession currentStage status admissionDecision')
                .lean();

            if (!selectedApplication) {
                throw new Error('Application not found or access denied');
            }

            return {
                applicationId: selectedApplication._id as Types.ObjectId,
                applicationNumber: selectedApplication.applicationNumber,
                academicSessionId: selectedApplication.entryAcademicSession as Types.ObjectId,
                status: selectedApplication.status,
                admissionDecision: selectedApplication.admissionDecision,
            };
        }

        const directApplication = await this.applicationModel
            .findOne({ userId: userObjectId })
            .select('_id applicationNumber entryAcademicSession currentStage status admissionDecision')
            .lean();

        if (directApplication) {
            return {
                applicationId: directApplication._id as Types.ObjectId,
                applicationNumber: directApplication.applicationNumber,
                academicSessionId: directApplication.entryAcademicSession as Types.ObjectId,
                status: directApplication.status,
                admissionDecision: directApplication.admissionDecision,
            };
        }

        const student = await this.studentModel
            .findOne({ userId: userObjectId })
            .populate('applicationId', '_id applicationNumber entryAcademicSession currentStage')
            .lean();

        const application = student?.applicationId as any;
        if (application?._id) {
            return {
                applicationId: application._id as Types.ObjectId,
                applicationNumber: application.applicationNumber as string,
                academicSessionId: application.entryAcademicSession as Types.ObjectId | undefined,
            };
        }

        return {
            applicationId: undefined,
            applicationNumber: undefined,
            academicSessionId: undefined,
        };
    }

    private async assertApplicationPortalPaymentAllowed(linkedApplication: {
        academicSessionId?: Types.ObjectId;
        status?: ApplicationStatus;
        admissionDecision?: AdmissionDecision;
    }): Promise<void> {
        if (
            linkedApplication.status === ApplicationStatus.EXPIRED ||
            linkedApplication.status === ApplicationStatus.REJECTED
        ) {
            throw new Error('This application can no longer receive payments');
        }

        if (linkedApplication.admissionDecision !== AdmissionDecision.AWAITING_DECISION) {
            return;
        }

        const sessionControl = await this.paymentModel.db.collection('sessioncontrols').findOne({
            academicSessionId: linkedApplication.academicSessionId,
            controls: { $elemMatch: { name: 'application', active: true } },
        });
        if (!sessionControl) {
            throw new Error('Applications for this academic session are currently closed');
        }
    }

    private async assertAccommodationPaymentEligibility(
        userId: string,
        payment: PaymentDocument | Payment,
        academicSessionId: string,
    ): Promise<any | null> {
        const control = await this.paymentModel.db.collection('sessioncontrols').findOne({
            academicSessionId: new Types.ObjectId(academicSessionId),
            'accommodation.internalPaymentId': (payment as any)._id,
        });
        if (!control) return null;

        const student = await this.studentModel.findOne({
            userId: new Types.ObjectId(userId),
        });

        if (!student) {
            throw new Error('Student record not found');
        }

        const tenancyAgreement = await this.tenancyAgreementModel.findOne({
            studentId: student._id,
            academicSessionId: new Types.ObjectId(academicSessionId),
        });

        if (!tenancyAgreement) {
            throw new Error('You must sign the accommodation agreement before making this payment. Please go to Accommodation first.');
        }

        const application = await this.paymentModel.db.collection('accommodationapplications').findOne({
            userId: new Types.ObjectId(userId),
            academicSessionId: new Types.ObjectId(academicSessionId),
            applicantType: 'internal',
            status: { $in: ['awaiting_payment', 'payment_pending_review', 'paid_awaiting_allocation', 'allocated'] },
        });
        if (!application) throw new Error('Internal accommodation application is not ready for payment');
        this.logger.log(`Accommodation payment authorized for user ${userId} - tenancy agreement signed`);
        return application;
    }

    private async resolveStudentBillableSession(
        userId: string,
        requestedAcademicSessionId?: string,
    ): Promise<{ academicSessionId: string; studentGroup: 'new' | 'returning' }> {
        const student = await this.studentModel
            .findOne({ userId: new Types.ObjectId(userId) })
            .select('academicSession entryAcademicSession')
            .lean();

        if (!student?.academicSession || !student.entryAcademicSession) {
            throw new Error('No billable academic session is assigned to this student');
        }

        const academicSessionId = student.academicSession.toString();
        if (
            requestedAcademicSessionId
            && (!Types.ObjectId.isValid(requestedAcademicSessionId)
                || requestedAcademicSessionId !== academicSessionId)
        ) {
            throw new Error('Selected academic session is not available for this student');
        }

        return {
            academicSessionId,
            studentGroup: student.entryAcademicSession.toString() === academicSessionId
                ? 'new'
                : 'returning',
        };
    }

    private async canStudentViewPaymentHistorySession(
        userId: string,
        academicSessionId: string,
    ): Promise<boolean> {
        if (!Types.ObjectId.isValid(academicSessionId)) {
            return false;
        }

        const sessionId = new Types.ObjectId(academicSessionId);
        const student = await this.studentModel
            .findOne({ userId: new Types.ObjectId(userId) })
            .select('_id entryAcademicSession academicSession')
            .lean();
        if (!student) {
            return false;
        }

        if (
            student.entryAcademicSession?.toString() === academicSessionId
            || student.academicSession?.toString() === academicSessionId
        ) {
            return true;
        }

        const [history, payment] = await Promise.all([
            this.studentAcademicSessionModel.exists({ studentId: student._id, academicSessionId: sessionId }),
            this.paymentTransactionModel.exists({ userId: new Types.ObjectId(userId), academicSessionId: sessionId }),
        ]);

        return Boolean(history || payment);
    }

    async getPaymentTransactionsSummary(userId: string, context: 'application-portal' | 'student-portal' = 'application-portal', applicationId?: string): Promise<PaymentTransactionsSummary> {
        const userObjectId = new Types.ObjectId(userId);

        // Get user to determine their role
        const user = await this.userModel.findById(userObjectId).lean();
        if (!user) {
            throw new Error('User not found');
        }

        const userAudiences = this.getUserAudiencesForContext(user.role, context);
        const linkedApplication = await this.resolveLinkedApplication(userId, applicationId);
        const availableMethods = await this.getPaymentMethodAvailability(
            context,
            linkedApplication.academicSessionId,
        );

        this.logger.log('Payment audience logic:', {
            userId,
            userRole: user.role,
            context,
            selectedAudiences: userAudiences
        });

        // Get all active payments that target this user's audiences
        const allPayments = await this.paymentModel.find({
            active: true,
            targetAudience: { $in: userAudiences }
        }).lean();

        const destinationAccountsMap = await this.getDestinationAccountsMap(
            allPayments.flatMap((payment: any) => [
                payment.paystackDestinationAccountId,
                payment.manualTransferDestinationAccountId,
            ]),
        );

        // Get student's successful payments and pending manual transfers
        const paymentTransactionsQuery: any = {
            userId: userObjectId,
            status: { $in: [PaymentStatus.SUCCESSFUL, PaymentStatus.PENDING, PaymentStatus.REJECTED] }
        };
        if (applicationId && context === 'application-portal') {
            paymentTransactionsQuery.applicationId = linkedApplication.applicationId;
        }
        const paymentTransactions = await this.paymentTransactionModel
            .find(paymentTransactionsQuery)
            .populate('paymentId')
            .lean();

        if (context === 'application-portal' && applicationId) {
            for (const paymentTransaction of paymentTransactions as any[]) {
                if (paymentTransaction.status !== PaymentStatus.SUCCESSFUL) continue;

                const successfulPaymentId = paymentTransaction.paymentId?._id || paymentTransaction.paymentId;
                if (!successfulPaymentId) continue;

                await this.updateApplicationStageAfterPayment(
                    userObjectId,
                    successfulPaymentId as Types.ObjectId,
                    linkedApplication.applicationId,
                );
            }
        }

        // Separate paid and unpaid fees
        const paidFees: PaymentSummary[] = [];
        const pendingFees: PaymentSummary[] = [];
        const unpaidFees: PaymentSummary[] = [];

        const successfulPaymentsById = new Map<string, any>();
        const pendingManualPaymentsById = new Map<string, any>();
        const rejectedManualPaymentsById = new Map<string, any>();

        paymentTransactions.forEach((paymentTransaction: any) => {
            const linkedPaymentId = paymentTransaction.paymentId?._id?.toString();
            if (!linkedPaymentId) {
                return;
            }

            if (paymentTransaction.status === PaymentStatus.SUCCESSFUL) {
                successfulPaymentsById.set(linkedPaymentId, paymentTransaction);
                return;
            }

            if (this.isManualTransferPending(paymentTransaction)) {
                const existingPending = pendingManualPaymentsById.get(linkedPaymentId);
                if (!existingPending || new Date(paymentTransaction.createdAt || 0).getTime() > new Date(existingPending.createdAt || 0).getTime()) {
                    pendingManualPaymentsById.set(linkedPaymentId, paymentTransaction);
                }
                return;
            }

            if (this.isManualTransferRejected(paymentTransaction)) {
                const existingRejected = rejectedManualPaymentsById.get(linkedPaymentId);
                if (!existingRejected || new Date(paymentTransaction.rejectedAt || paymentTransaction.updatedAt || paymentTransaction.createdAt || 0).getTime() > new Date(existingRejected.rejectedAt || existingRejected.updatedAt || existingRejected.createdAt || 0).getTime()) {
                    rejectedManualPaymentsById.set(linkedPaymentId, paymentTransaction);
                }
            }
        });

        allPayments.forEach(payment => {
            const paymentId = payment._id.toString();
            const successfulPayment = successfulPaymentsById.get(paymentId);
            const pendingManualPayment = pendingManualPaymentsById.get(paymentId);
            const paystackDestinationAccount = this.toDestinationAccountSummary(
                destinationAccountsMap.get(payment.paystackDestinationAccountId?.toString?.() || ''),
            );
            const manualTransferDestinationAccount = this.toDestinationAccountSummary(
                destinationAccountsMap.get(payment.manualTransferDestinationAccountId?.toString?.() || ''),
            );
            const manualTransferDetails = this.toManualTransferDetails(
                destinationAccountsMap.get(payment.manualTransferDestinationAccountId?.toString?.() || ''),
            );

            if (successfulPayment) {
                paidFees.push({
                    id: paymentId,
                    name: payment.name,
                    description: payment.description,
                    amount: payment.amount,
                    isPaid: true,
                    paymentCode: payment.paymentCode,
                    paidAt: successfulPayment.paidAt,
                    reference: successfulPayment.reference,
                    status: successfulPayment.status,
                    channel: successfulPayment.channel,
                    fee: successfulPayment.fee,
                    method: successfulPayment.method,
                    remarks: successfulPayment.remarks,
                    receiptUrl: successfulPayment.receiptUrl,
                    receiptOriginalName: successfulPayment.receiptOriginalName,
                    receiptUploadedAt: successfulPayment.receiptUploadedAt,
                    manualTransferDetails,
                    paystackDestinationAccount,
                    manualTransferDestinationAccount,
                });
            } else if (pendingManualPayment) {
                pendingFees.push({
                    id: paymentId,
                    name: payment.name,
                    description: payment.description,
                    amount: pendingManualPayment.amount,
                    isPaid: false,
                    paymentCode: payment.paymentCode,
                    paidAt: pendingManualPayment.paidAt,
                    reference: pendingManualPayment.reference,
                    status: pendingManualPayment.status,
                    channel: pendingManualPayment.channel,
                    method: pendingManualPayment.method,
                    remarks: pendingManualPayment.remarks,
                    receiptUrl: pendingManualPayment.receiptUrl,
                    receiptOriginalName: pendingManualPayment.receiptOriginalName,
                    receiptUploadedAt: pendingManualPayment.receiptUploadedAt,
                    manualTransferDetails,
                    paystackDestinationAccount,
                    manualTransferDestinationAccount,
                });
            } else {
                const rejectedManualPayment = rejectedManualPaymentsById.get(paymentId);
                unpaidFees.push({
                    id: paymentId,
                    name: payment.name,
                    description: payment.description,
                    amount: payment.amount,
                    isPaid: false,
                    paymentCode: payment.paymentCode,
                    manualTransferDetails,
                    paystackDestinationAccount,
                    manualTransferDestinationAccount,
                    latestRejectedManualTransfer: rejectedManualPayment
                        ? this.toRejectedManualTransferSummary(rejectedManualPayment)
                        : undefined,
                });
            }
        });

        const totalPaid = paidFees.reduce((sum, fee) => sum + fee.amount, 0);
        const totalPending = pendingFees.reduce((sum, fee) => sum + fee.amount, 0);
        const totalUnpaid = unpaidFees.reduce((sum, fee) => sum + fee.amount, 0);

        return {
            paidFees,
            pendingFees,
            unpaidFees,
            totalPaid,
            totalPending,
            totalUnpaid,
            availableMethods,
        };
    }

    async initializePayment(userId: string, paymentId: string, email: string, applicationId?: string): Promise<PaystackInitializeResponse> {
        try {
            this.logger.log('initializePayment called with:', { userId, paymentId, email });

            // Ensure paymentId is a valid ObjectId
            if (!Types.ObjectId.isValid(paymentId)) {
                this.logger.log('Invalid ObjectId format:', paymentId);
                throw new Error('Invalid payment ID format');
            }

            // Get payment details
            const payment = await this.paymentModel.findById(new Types.ObjectId(paymentId));
            this.logger.log('Payment found:', payment);

            if (!payment) {
                this.logger.log('Payment not found for ID:', paymentId);
                throw new Error('Payment not found');
            }

            // Check if student has already made a successful payment for this charge
            const linkedApplication = await this.resolveLinkedApplication(userId, applicationId);
            await this.assertApplicationPortalPaymentAllowed(linkedApplication);
            const existingSuccessfulPayment = await this.paymentTransactionModel.findOne({
                userId: new Types.ObjectId(userId),
                paymentId: new Types.ObjectId(paymentId),
                applicationId: linkedApplication.applicationId,
                status: PaymentStatus.SUCCESSFUL
            });

            if (existingSuccessfulPayment) {
                throw new Error('Payment has already been completed successfully for this charge');
            }

            const paystackDestinationAccount = await this.resolveDestinationForPayment(
                payment,
                PaymentDestinationChannelType.PAYSTACK,
            );
            await this.assertPaymentMethodEnabled(
                PaymentMethod.PAYSTACK,
                'application-portal',
                linkedApplication.academicSessionId,
            );

            // Look for any existing payment attempt (pending or failed) - reuse it
            let existingAttempt = await this.paymentTransactionModel.findOne({
                userId: new Types.ObjectId(userId),
                paymentId: new Types.ObjectId(paymentId),
                applicationId: linkedApplication.applicationId,
                status: { $in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
                $or: [
                    { method: PaymentMethod.PAYSTACK },
                    { method: { $exists: false } },
                ],
            }).sort({ createdAt: -1 }); // Get the most recent attempt

            let reference: string;
            let paystackData: any;

            if (existingAttempt) {
                this.logger.log('Found existing payment attempt:', {
                    status: existingAttempt.status,
                    reference: existingAttempt.reference,
                    createdAt: existingAttempt.createdAt
                });

                reference = existingAttempt.reference;

                // Check the actual status with Paystack first
                try {
                    const verifyResponse = await fetch(`${this.paystackBaseUrl}/transaction/verify/${reference}`, {
                        headers: {
                            'Authorization': `Bearer ${this.paystackSecretKey}`,
                        }
                    });
                    const verifyData = await verifyResponse.json();

                    if (verifyData.status) {
                        if (verifyData.data.status === 'success') {
                            // Payment was successful, update our record
                            existingAttempt.status = PaymentStatus.SUCCESSFUL;
                            existingAttempt.remarks = 'Payment successful and verified';
                            existingAttempt.paidAt = new Date();
                            existingAttempt.method = PaymentMethod.PAYSTACK;
                            existingAttempt.channel = verifyData.data.channel;
                            existingAttempt.gatewayId = verifyData.data.id;
                            existingAttempt.authorizationCode = verifyData.data.authorization?.authorization_code;
                            this.markSuccessfulPaystackPaymentAwaitingRemittance(existingAttempt, existingAttempt.amount);
                            await existingAttempt.save();

                            throw new Error('Payment has already been completed successfully');
                        } else if (verifyData.data.status === 'abandoned' || verifyData.data.status === 'failed') {
                            // Payment was abandoned/failed, mark as failed
                            existingAttempt.status = PaymentStatus.FAILED;
                            existingAttempt.remarks = `Payment ${verifyData.data.status}: ${verifyData.data.gateway_response || 'User abandoned payment'}`;
                            await existingAttempt.save();
                            this.logger.log('Payment was marked as failed based on Paystack status');
                        }
                        // For pending status, we'll continue to reuse
                    }
                } catch (verifyError) {
                    this.logger.error('Error verifying existing payment:', verifyError.message);
                    // Continue with the existing reference anyway
                }

                // If it's a failed attempt, update status to pending for retry
                if (existingAttempt.status === PaymentStatus.FAILED) {
                    existingAttempt.status = PaymentStatus.PENDING;
                    existingAttempt.retryCount = (existingAttempt.retryCount || 0) + 1;
                    existingAttempt.remarks = `Payment retry attempt x${existingAttempt.retryCount} - awaiting user action`;
                    await existingAttempt.save();
                    this.logger.log(`Updated failed payment attempt to pending for retry #${existingAttempt.retryCount}`);
                } else if (existingAttempt.status === PaymentStatus.PENDING) {
                    // Update remarks to show it's being retried
                    existingAttempt.retryCount = (existingAttempt.retryCount || 0) + 1;
                    existingAttempt.remarks = `Payment re-initialized with new reference x${existingAttempt.retryCount} - awaiting user action`;
                    await existingAttempt.save();
                    this.logger.log(`Updated pending payment attempt remarks for retry #${existingAttempt.retryCount}`);
                }

                // For existing attempts, we need to create a NEW Paystack transaction with a NEW reference
                // because Paystack references are unique and cannot be reused
                const newReference = this.buildPaymentReference();
                this.logger.log('Creating new Paystack transaction with new reference:', newReference);

                paystackData = await this.createPaystackTransaction(
                    payment,
                    email,
                    newReference,
                    userId,
                    paymentId,
                    paystackDestinationAccount,
                );

                // Update the existing record with the new reference
                existingAttempt.reference = newReference;
                existingAttempt.status = PaymentStatus.PENDING;
                existingAttempt.remarks = `Payment re-initialized with new reference x${existingAttempt.retryCount || 1} - awaiting user action`;
                Object.assign(existingAttempt, this.buildDestinationSnapshot(paystackDestinationAccount));
                await existingAttempt.save();

                return {
                    authorization_url: paystackData.data.authorization_url,
                    access_code: paystackData.data.access_code,
                    reference: newReference
                };
            } else {
                // No existing attempt found, create new payment attempt
                reference = this.buildPaymentReference();
                paystackData = await this.createPaystackTransaction(
                    payment,
                    email,
                    reference,
                    userId,
                    paymentId,
                    paystackDestinationAccount,
                );

                // Create new payment attempt record
                await this.paymentTransactionModel.create({
                    userId: new Types.ObjectId(userId),
                    applicationId: linkedApplication.applicationId,
                    payerType: PaymentPayerType.APPLICANT,
                    paymentContext: PaymentContext.ADMISSION_APPLICATION,
                    academicSessionId: linkedApplication.academicSessionId,
                    paymentId: new Types.ObjectId(paymentId),
                    amount: payment.amount,
                    reference,
                    status: PaymentStatus.PENDING,
                    method: PaymentMethod.PAYSTACK,
                    remarks: 'Payment initialized - awaiting user action',
                    retryCount: 0,
                    ...this.buildDestinationSnapshot(paystackDestinationAccount),
                });

                return {
                    authorization_url: paystackData.data.authorization_url,
                    access_code: paystackData.data.access_code,
                    reference
                };
            }
        } catch (error) {
            this.logger.error('Error in initializePayment:', error);
            throw error;
        }
    }

    private async createPaystackTransaction(
        payment: any,
        email: string,
        reference: string,
        userId: string,
        paymentId: string,
        destinationAccount?: Partial<PaymentDestinationAccount> | null,
        callbackUrl?: string,
    ) {
        this.logger.log('Creating new Paystack transaction:', {
            paymentId,
            amount: payment.amount,
            amountInKobo: payment.amount * 100,
            email,
            reference
        });

        const data = await this.initializePaystackTransactionWithFallback(
            this.buildPaystackInitializePayload({
                email,
                amount: payment.amount,
                reference,
                userId,
                paymentId,
                paymentName: payment.name,
                destinationAccount,
                callbackUrl,
            }),
            destinationAccount,
        );

        this.logger.log('Paystack response:', data);

        return data;
    }

    private async updatePaymentStatus(paymentTransaction: any, transactionData: any) {
        paymentTransaction.status = PaymentStatus.SUCCESSFUL;
        paymentTransaction.remarks = 'Payment successful and verified';
        paymentTransaction.paidAt = new Date();
        paymentTransaction.method = paymentTransaction.method || PaymentMethod.PAYSTACK;
        paymentTransaction.channel = transactionData.channel;
        paymentTransaction.gatewayId = transactionData.id;
        paymentTransaction.authorizationCode = transactionData.authorization?.authorization_code;
        this.markSuccessfulPaystackPaymentAwaitingRemittance(paymentTransaction, paymentTransaction.amount);
        await paymentTransaction.save();
    }

    private getPaystackStatus(transaction: any): string {
        return String(transaction?.status || '').toLowerCase().trim();
    }

    private isPaystackSuccessStatus(status: string): boolean {
        return status === 'success';
    }

    private isPaystackFailureStatus(status: string): boolean {
        return ['failed', 'abandoned', 'reversed'].includes(status);
    }

    private async verifyPaystackTransaction(reference: string): Promise<any> {
        if (!this.paystackSecretKey) {
            throw new Error('PAYSTACK_SECRET_KEY is not configured');
        }

        const response = await fetch(`${this.paystackBaseUrl}/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${this.paystackSecretKey}`,
            },
        });

        const data = await response.json();

        if (!data.status) {
            throw new Error(data.message || 'Failed to verify payment');
        }

        return data.data;
    }

    private async applyPaystackTransactionState(paymentTransaction: any, transaction: any): Promise<any> {
        const paystackStatus = this.getPaystackStatus(transaction);
        const now = new Date();

        paymentTransaction.lastVerifiedAt = now;
        paymentTransaction.verificationAttempts = (paymentTransaction.verificationAttempts || 0) + 1;
        paymentTransaction.gatewayStatus = paystackStatus || transaction?.status;
        paymentTransaction.gatewayResponse = transaction?.gateway_response || paymentTransaction.gatewayResponse;

        if (this.isPaystackSuccessStatus(paystackStatus)) {
            paymentTransaction.status = PaymentStatus.SUCCESSFUL;
            paymentTransaction.remarks = 'Payment successful and verified';
            paymentTransaction.paidAt = transaction?.paid_at ? new Date(transaction.paid_at) : (paymentTransaction.paidAt || now);
            paymentTransaction.method = paymentTransaction.method || PaymentMethod.PAYSTACK;
            paymentTransaction.channel = transaction.channel;
            paymentTransaction.fee = transaction.fees ? (transaction.fees / 100) : (paymentTransaction.fee || 0);
            paymentTransaction.gatewayId = transaction.id;
            paymentTransaction.authorizationCode = transaction.authorization?.authorization_code;
            this.markSuccessfulPaystackPaymentAwaitingRemittance(
                paymentTransaction,
                transaction.amount ? (transaction.amount / 100) : paymentTransaction.amount,
            );
        } else if (this.isPaystackFailureStatus(paystackStatus)) {
            if (paymentTransaction.status !== PaymentStatus.SUCCESSFUL) {
                paymentTransaction.status = PaymentStatus.FAILED;
            }
            paymentTransaction.remarks = `Payment ${paystackStatus || 'failed'}: ${transaction.gateway_response || 'Payment was not completed'}`;
        } else {
            if (paymentTransaction.status !== PaymentStatus.SUCCESSFUL) {
                paymentTransaction.status = PaymentStatus.PENDING;
                paymentTransaction.remarks = `Payment ${paystackStatus || 'pending'}: awaiting completion`;
            }
        }

        await paymentTransaction.save();

        if (paymentTransaction.status === PaymentStatus.SUCCESSFUL) {
            if (paymentTransaction.paymentContext === PaymentContext.ACCOMMODATION_APPLICATION) {
                await this.finalizeAccommodationPayment(paymentTransaction);
            } else {
                await this.updateApplicationStageAfterPayment(
                    paymentTransaction.userId,
                    paymentTransaction.paymentId,
                    paymentTransaction.applicationId,
                );
            }
        }

        return {
            status: paystackStatus,
            reference: transaction.reference,
            amount: transaction.amount,
            channel: transaction.channel,
            paid_at: transaction.paid_at,
            gateway_response: transaction.gateway_response,
        };
    }

    private async finalizeAccommodationPayment(paymentTransaction: any) {
        const db = this.paymentTransactionModel.db;
        const applicationId = paymentTransaction.accommodationApplicationId;
        if (!applicationId) return;
        const applications = db.collection('accommodationapplications');
        const assignments = db.collection('accommodationassignments');
        await applications.updateOne(
            { _id: applicationId },
            { $set: { status: 'paid_awaiting_allocation', paidAt: paymentTransaction.paidAt || new Date(), updatedAt: new Date() } },
        );
        await db.collection('tenancyagreements').updateOne(
            { accommodationApplicationId: applicationId, status: 'signed_awaiting_payment' },
            {
                $set: {
                    status: paymentTransaction.externalResidentId
                        ? 'payment_confirmed_awaiting_allocation'
                        : 'executed',
                    updatedAt: new Date(),
                },
            },
        );
        await db.collection('accommodationaudits').updateOne(
            { accommodationApplicationId: applicationId, action: 'payment_verified', 'metadata.reference': paymentTransaction.reference },
            {
                $setOnInsert: {
                    accommodationApplicationId: applicationId,
                    action: 'payment_verified',
                    actorType: paymentTransaction.verifiedBy ? 'staff' : 'system',
                    actorId: paymentTransaction.verifiedBy,
                    metadata: { reference: paymentTransaction.reference, method: paymentTransaction.method },
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            },
            { upsert: true },
        );
        if (await assignments.findOne({ accommodationApplicationId: applicationId, status: 'active' })) return;
        const application = await applications.findOne({ _id: applicationId });
        if (!application) return;

        const hostels = await db.collection('hostels').find({ gender: application.gender, active: true }).sort({ name: 1 }).toArray();
        for (const hostel of hostels) {
            const blocks = await db.collection('hostelblocks').find({ hostelId: hostel._id, residentType: application.applicantType, active: true }).sort({ allocationOrder: 1, name: 1 }).toArray();
            for (const block of blocks) {
                const rooms = await db.collection('hostelrooms').find({ blockId: block._id, active: true }).sort({ allocationOrder: 1, name: 1 }).toArray();
                for (const room of rooms) {
                    const occupied = new Set((await assignments.distinct('slotNumber', { academicSessionId: application.academicSessionId, roomId: room._id, status: 'active' })).map(Number));
                    for (let slotNumber = 1; slotNumber <= Number(room.capacity); slotNumber += 1) {
                        if (occupied.has(slotNumber)) continue;
                        try {
                            const now = new Date();
                            await assignments.insertOne({
                                accommodationApplicationId: application._id,
                                userId: application.userId,
                                academicSessionId: application.academicSessionId,
                                hostelId: hostel._id,
                                blockId: block._id,
                                roomId: room._id,
                                slotNumber,
                                status: 'active',
                                allocationSource: 'automatic',
                                allocatedAt: now,
                                createdAt: now,
                                updatedAt: now,
                            });
                            await applications.updateOne({ _id: application._id }, { $set: { status: 'allocated', allocatedAt: now, updatedAt: now } });
                            await db.collection('accommodationaudits').insertOne({
                                accommodationApplicationId: application._id,
                                action: 'bed_allocated', actorType: 'system',
                                metadata: { hostelId: hostel._id, blockId: block._id, roomId: room._id, slotNumber },
                                createdAt: now, updatedAt: now,
                            });
                            if (paymentTransaction.externalResidentId) {
                                try {
                                    const resident = await db.collection('externalresidents').findOne({
                                        _id: paymentTransaction.externalResidentId,
                                    });
                                    if (!resident?.externalResidentNumber) {
                                        throw new Error('External resident record not found');
                                    }
                                    await this.tenancyAgreementService.finalizeExternalAccommodationDocuments(
                                        application._id,
                                        application.applicationNumber,
                                        resident.externalResidentNumber,
                                    );
                                } catch (error) {
                                    this.logger.error(
                                        `Could not prepare or email external accommodation documents for ${application.applicationNumber}: ${error instanceof Error ? error.message : error}`,
                                    );
                                }
                            }
                            return;
                        } catch (error: any) {
                            if (error?.code !== 11000) throw error;
                        }
                    }
                }
            }
        }
        await db.collection('accommodationaudits').updateOne(
            { accommodationApplicationId: applicationId, action: 'allocation_waitlisted' },
            {
                $setOnInsert: {
                    accommodationApplicationId: applicationId,
                    action: 'allocation_waitlisted',
                    actorType: 'system',
                    metadata: { reason: 'No matching active bed space is available' },
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            },
            { upsert: true },
        );
    }

    async reconcilePaymentTransactionById(paymentTransactionId: string): Promise<any> {
        if (!Types.ObjectId.isValid(paymentTransactionId)) {
            throw new Error('Invalid payment record ID');
        }

        const paymentTransaction = await this.paymentTransactionModel.findById(paymentTransactionId);
        if (!paymentTransaction) {
            throw new Error('Payment record not found');
        }

        if ((paymentTransaction.method || PaymentMethod.PAYSTACK) !== PaymentMethod.PAYSTACK) {
            throw new Error('Only Paystack payments can be reconciled');
        }

        const transaction = await this.verifyPaystackTransaction(paymentTransaction.reference);
        const result = await this.applyPaystackTransactionState(paymentTransaction, transaction);

        return {
            ...result,
            internalStatus: paymentTransaction.status,
            paymentId: paymentTransaction._id.toString(),
            lastVerifiedAt: paymentTransaction.lastVerifiedAt,
        };
    }

    async reconcilePendingPaystackPayments(options: {
        olderThanMinutes?: number;
        batchSize?: number;
        hardTimeoutHours?: number;
    } = {}): Promise<PendingReconciliationSummary> {
        const olderThanMinutes = Math.max(1, Number(options.olderThanMinutes || 10));
        const batchSize = Math.max(1, Number(options.batchSize || 100));
        const hardTimeoutHours = Math.max(1, Number(options.hardTimeoutHours || 24));

        const olderThanDate = new Date(Date.now() - olderThanMinutes * 60 * 1000);
        const hardTimeoutDate = new Date(Date.now() - hardTimeoutHours * 60 * 60 * 1000);

        const candidates = await this.paymentTransactionModel.find({
            status: PaymentStatus.PENDING,
            $or: [
                { method: PaymentMethod.PAYSTACK },
                { method: { $exists: false } },
            ],
            createdAt: { $lt: olderThanDate },
        })
            .sort({ createdAt: 1 })
            .limit(batchSize);

        const summary: PendingReconciliationSummary = {
            scanned: candidates.length,
            reconciled: 0,
            markedSuccessful: 0,
            markedFailed: 0,
            stillPending: 0,
            timedOut: 0,
            errors: 0,
            runAt: new Date().toISOString(),
        };

        for (const candidate of candidates) {
            try {
                const transaction = await this.verifyPaystackTransaction(candidate.reference);
                await this.applyPaystackTransactionState(candidate, transaction);

                summary.reconciled += 1;
                if (candidate.status === PaymentStatus.SUCCESSFUL) {
                    summary.markedSuccessful += 1;
                } else if (candidate.status === PaymentStatus.FAILED) {
                    summary.markedFailed += 1;
                } else {
                    summary.stillPending += 1;
                }

                if (
                    candidate.status === PaymentStatus.PENDING
                    && candidate.createdAt
                    && new Date(candidate.createdAt).getTime() < hardTimeoutDate.getTime()
                ) {
                    candidate.status = PaymentStatus.FAILED;
                    candidate.remarks = `Payment timed out after ${hardTimeoutHours} hour(s) without completion`;
                    await candidate.save();
                    summary.markedFailed += 1;
                    summary.stillPending = Math.max(0, summary.stillPending - 1);
                    summary.timedOut += 1;
                }
            } catch (error) {
                summary.errors += 1;
                this.logger.error(
                    `Failed to reconcile pending Paystack payment ${candidate.reference}: ${error instanceof Error ? error.message : error}`,
                );

                if (
                    candidate.createdAt
                    && new Date(candidate.createdAt).getTime() < hardTimeoutDate.getTime()
                ) {
                    candidate.status = PaymentStatus.FAILED;
                    candidate.remarks = `Payment timed out after ${hardTimeoutHours} hour(s) without completion`;
                    candidate.lastVerifiedAt = new Date();
                    await candidate.save();
                    summary.markedFailed += 1;
                    summary.timedOut += 1;
                }
            }
        }

        return summary;
    }

    async processPaystackWebhook(
        signature: string | undefined,
        rawBody: Buffer | undefined,
        payload: any,
    ): Promise<{ event: string; reference?: string; reconciled: boolean }> {
        if (!this.paystackSecretKey) {
            throw new Error('PAYSTACK_SECRET_KEY is not configured');
        }

        if (!signature || !rawBody) {
            throw new Error('Missing Paystack webhook signature or raw body');
        }

        const hash = crypto
            .createHmac('sha512', this.paystackSecretKey)
            .update(rawBody)
            .digest('hex');

        if (hash !== signature) {
            throw new Error('Invalid Paystack webhook signature');
        }

        const event = String(payload?.event || '').toLowerCase();
        const reference = payload?.data?.reference;

        if (!reference) {
            return { event, reconciled: false };
        }

        const paymentTransaction = await this.paymentTransactionModel.findOne({ reference });
        if (!paymentTransaction) {
            this.logger.warn(`Paystack webhook received unknown reference: ${reference}`);
            return { event, reference, reconciled: false };
        }

        if ((paymentTransaction.method || PaymentMethod.PAYSTACK) !== PaymentMethod.PAYSTACK) {
            return { event, reference, reconciled: false };
        }

        const transaction = await this.verifyPaystackTransaction(reference);
        await this.applyPaystackTransactionState(paymentTransaction, transaction);

        return { event, reference, reconciled: true };
    }

    private markSuccessfulPaystackPaymentAwaitingRemittance(paymentTransaction: any, amount?: number) {
        if ((paymentTransaction.method || PaymentMethod.PAYSTACK) !== PaymentMethod.PAYSTACK) {
            return;
        }

        paymentTransaction.remittanceStatus = RemittanceStatus.PENDING;
        paymentTransaction.remittanceAmount = Number(amount ?? paymentTransaction.amount ?? 0);
        paymentTransaction.remittanceSettlementId = undefined;
        paymentTransaction.remittanceSettledAt = undefined;
        paymentTransaction.remittanceLastSyncedAt = undefined;
    }

    async verifyPayment(reference: string): Promise<any> {
        const transaction = await this.verifyPaystackTransaction(reference);

        // Find the student payment record
        const paymentTransaction = await this.paymentTransactionModel.findOne({ reference });
        if (!paymentTransaction) {
            throw new Error('Payment record not found');
        }

        return this.applyPaystackTransactionState(paymentTransaction, transaction);
    }

    async initializeExternalAccommodationPayment(input: {
        userId: string;
        externalResidentId: string;
        accommodationApplicationId: string;
        academicSessionId: string;
        paymentId: string;
        email: string;
    }): Promise<PaystackInitializeResponse> {
        const payment = await this.paymentModel.findById(input.paymentId);
        if (!payment || !payment.active) throw new Error('Accommodation payment is unavailable');
        if (!payment.targetAudience.includes(PaymentAudience.EXTERNAL_RESIDENT)) {
            throw new Error('Payment is not configured for external residents');
        }

        const destination = await this.resolveDestinationForPayment(payment, PaymentDestinationChannelType.PAYSTACK);
        if (
            !destination
            || destination.providerType !== PaymentDestinationProviderType.SUBACCOUNT
            || !destination.paystackSubaccountCode
        ) {
            throw new Error('External accommodation payment destination is not fully configured');
        }

        const existing = await this.paymentTransactionModel.findOne({
            accommodationApplicationId: new Types.ObjectId(input.accommodationApplicationId),
            paymentId: payment._id,
            status: PaymentStatus.SUCCESSFUL,
        });
        if (existing) throw new Error('Accommodation payment has already been completed');

        const reference = this.buildPaymentReference();
        const payload = this.buildPaystackInitializePayload({
            email: input.email,
            amount: payment.amount,
            reference,
            userId: input.userId,
            paymentId: input.paymentId,
            paymentName: payment.name,
            destinationAccount: destination,
            callbackUrl: `${process.env.WEBSITE_URL || 'https://alecons.edu.ng'}/accommodation/external?paymentReference=${encodeURIComponent(reference)}`,
        });
        const response = await this.initializePaystackTransactionWithFallback(payload, destination, false);

        await this.paymentTransactionModel.create({
            userId: new Types.ObjectId(input.userId),
            externalResidentId: new Types.ObjectId(input.externalResidentId),
            accommodationApplicationId: new Types.ObjectId(input.accommodationApplicationId),
            academicSessionId: new Types.ObjectId(input.academicSessionId),
            paymentId: payment._id,
            payerType: PaymentPayerType.EXTERNAL_RESIDENT,
            paymentContext: PaymentContext.ACCOMMODATION_APPLICATION,
            amount: payment.amount,
            reference,
            status: PaymentStatus.PENDING,
            method: PaymentMethod.PAYSTACK,
            remarks: 'External accommodation payment initialized - awaiting user action',
            ...this.buildDestinationSnapshot(destination),
        });

        return {
            authorization_url: response.data.authorization_url,
            access_code: response.data.access_code,
            reference,
        };
    }

    async getExternalAccommodationPaymentOptions(paymentId: string) {
        const payment = await this.paymentModel.findById(paymentId).lean();
        if (!payment || !payment.active || !payment.targetAudience.includes(PaymentAudience.EXTERNAL_RESIDENT)) {
            throw new Error('External accommodation payment is unavailable');
        }
        const [paystack, manual] = await Promise.all([
            this.resolveDestinationForPayment(payment, PaymentDestinationChannelType.PAYSTACK),
            this.resolveDestinationForPayment(payment, PaymentDestinationChannelType.MANUAL_TRANSFER),
        ]);
        return {
            payment: { id: payment._id, name: payment.name, amount: payment.amount, description: payment.description },
            paystackEnabled: Boolean(paystack?.active && paystack.providerType === PaymentDestinationProviderType.SUBACCOUNT && paystack.paystackSubaccountCode),
            manualTransfer: manual?.active ? {
                enabled: true,
                accountName: manual.accountName,
                accountNumber: manual.accountNumber,
                bankName: manual.bankName,
                note: manual.note,
            } : { enabled: false },
        };
    }

    async submitExternalAccommodationManualTransfer(input: {
        userId: string; externalResidentId: string; accommodationApplicationId: string;
        academicSessionId: string; applicationNumber: string; paymentId: string;
    }, file: Express.Multer.File) {
        if (!file) throw new Error('Payment receipt is required');
        const payment = await this.paymentModel.findById(input.paymentId);
        if (!payment || !payment.active || !payment.targetAudience.includes(PaymentAudience.EXTERNAL_RESIDENT)) {
            throw new Error('External accommodation payment is unavailable');
        }
        const destination = await this.resolveDestinationForPayment(payment, PaymentDestinationChannelType.MANUAL_TRANSFER);
        if (!destination?.active || !destination.accountName || !destination.accountNumber || !destination.bankName) {
            throw new Error('External accommodation manual transfer destination is not fully configured');
        }
        const duplicate = await this.paymentTransactionModel.findOne({
            accommodationApplicationId: new Types.ObjectId(input.accommodationApplicationId),
            paymentId: payment._id,
            status: { $in: [PaymentStatus.PENDING, PaymentStatus.SUCCESSFUL] },
            method: PaymentMethod.MANUAL_TRANSFER,
        });
        if (duplicate) throw new Error('A manual transfer receipt is already awaiting review or has been approved');
        const receipt = await this.uploadService.uploadPrivateAccommodationReceipt(file, input.applicationNumber);
        return this.paymentTransactionModel.create({
            userId: new Types.ObjectId(input.userId),
            externalResidentId: new Types.ObjectId(input.externalResidentId),
            accommodationApplicationId: new Types.ObjectId(input.accommodationApplicationId),
            academicSessionId: new Types.ObjectId(input.academicSessionId),
            paymentId: payment._id,
            payerType: PaymentPayerType.EXTERNAL_RESIDENT,
            paymentContext: PaymentContext.ACCOMMODATION_APPLICATION,
            amount: payment.amount,
            reference: this.buildManualTransferReference(),
            paidAt: new Date(),
            method: PaymentMethod.MANUAL_TRANSFER,
            channel: PaymentChannel.MANUAL_TRANSFER,
            status: PaymentStatus.PENDING,
            remarks: 'External accommodation transfer submitted; awaiting staff verification',
            receiptKey: receipt.key,
            receiptOriginalName: file.originalname,
            receiptUploadedAt: new Date(),
            ...this.buildDestinationSnapshot(destination),
        });
    }

    /**
     * Update application stage after successful payment
     */
    private async updateApplicationStageAfterPayment(
        userId: Types.ObjectId,
        paymentId: Types.ObjectId,
        applicationId?: Types.ObjectId,
    ): Promise<void> {
        try {
            // Get payment details to determine what stage to advance to
            const payment = await this.paymentModel.findById(paymentId);
            if (!payment) {
                this.logger.log('Payment not found for stage progression');
                return;
            }

            const application = applicationId
                ? await this.applicationModel.findOne({ _id: applicationId, userId })
                : await this.applicationModel.findOne({ userId });
            if (!application) {
                this.logger.log('Application not found for payment stage progression:', {
                    userId: userId.toString(),
                    applicationId: applicationId?.toString(),
                });
                return;
            }

            if (
                application.status === ApplicationStatus.EXPIRED ||
                application.status === ApplicationStatus.REJECTED
            ) {
                this.logger.warn('Skipping payment stage progression for a closed application', {
                    applicationId: application._id.toString(),
                    status: application.status,
                    paymentCode: payment.paymentCode,
                });
                return;
            }

            // Map payment codes to next stages
            // Based on the payment code, determine what stage to advance to
            const stageProgressions: { [key: string]: number } = {
                'formFee': 3,          // Form fee payment (stage 2) -> Application form (stage 3)
                'acceptanceFee': 8,      // Acceptance fee payment (stage 7) -> Sundry fees (stage 8)
                'sundryFee': 9,          // Sundry fee payment (stage 8) -> School fees (stage 9)
                'schoolFee': 10          // School fee payment (stage 9) -> Completed (stage 10)
            };

            const nextStage = stageProgressions[payment.paymentCode];

            if (payment.paymentCode === 'schoolFee') {
                const user = await this.userModel.findById(userId).select('role').lean();
                if (application.currentStage < 10 || user?.role !== UserRole.STUDENT) {
                    await this.completeApplicationProcess(userId, application);
                }
                return;
            }

            if (nextStage && nextStage > application.currentStage) {
                application.currentStage = nextStage;
                await application.save();

                this.logger.log(`Advanced application ${application._id} to stage ${nextStage} after ${payment.paymentCode} payment`);

            } else {
                this.logger.log(`No stage progression needed for payment ${payment.paymentCode}, current stage: ${application.currentStage}`);
            }

        } catch (error) {
            this.logger.error('Error updating application stage after payment:', error);
            // Don't throw error here to avoid affecting payment verification
        }
    }

    /**
     * Mark old pending payments as failed (can be called periodically)
     */
    async markAbandonedPaymentsAsFailed(): Promise<void> {
        const summary = await this.reconcilePendingPaystackPayments({
            olderThanMinutes: 10,
            batchSize: 200,
            hardTimeoutHours: 24,
        });

        this.logger.log(`Reconciled pending payments run summary: ${JSON.stringify(summary)}`);
    }

    /**
     * Manually advance application stage (for admin use or application form completion)
     */
    async advanceApplicationStage(userId: string, targetStage: number): Promise<void> {
        try {
            const application = await this.applicationModel.findOne({
                userId: new Types.ObjectId(userId)
            });

            if (!application) {
                throw new Error('Application not found');
            }

            if (targetStage > application.currentStage) {
                application.currentStage = targetStage;
                await application.save();
                this.logger.log(`Manually advanced application stage to ${targetStage} for user ${userId}`);
            }
        } catch (error) {
            this.logger.error('Error advancing application stage:', error);
            throw error;
        }
    }

    /**
     * Complete application process by generating matriculation number and creating student record
     */
    private async completeApplicationProcess(userId: Types.ObjectId, application: any): Promise<void> {
        try {
            this.logger.log('Starting application completion process for user:', userId);

            // Get user details for email
            const user = await this.userModel.findById(userId);
            if (!user) {
                throw new Error('User not found for application completion');
            }

            // Fetch full application with populated fields
            const fullApplication = await this.applicationModel
                .findById(application._id)
                .populate(['userId', 'programId', 'entryAcademicSession'])
                .exec();

            if (!fullApplication) {
                throw new Error('Application not found');
            }

            // Generate proper matriculation number using the matriculation service
            // Extract just the ObjectId from the populated program document
            this.logger.log('fullApplication.programId type:', typeof fullApplication.programId);
            this.logger.log('fullApplication.programId value:', fullApplication.programId);
            this.logger.log('fullApplication.programId._id:', fullApplication.programId._id);

            const programId = fullApplication.programId._id || fullApplication.programId;
            this.logger.log('Extracted programId:', programId);
            this.logger.log('programId.toString():', programId.toString());
            const normalizedUserId = typeof fullApplication.userId === 'object' && fullApplication.userId !== null
                ? (fullApplication.userId as any)._id
                : fullApplication.userId;
            const normalizedApplicationId = fullApplication._id;

            const academicSessionId = typeof fullApplication.entryAcademicSession === 'object'
                && fullApplication.entryAcademicSession !== null
                ? (fullApplication.entryAcademicSession as any)._id
                : fullApplication.entryAcademicSession;

            if (!academicSessionId) {
                throw new Error('Academic session not found for matriculation generation');
            }

            const matriculationNumber = fullApplication.matriculationNumber || await this.matriculationService.generateMatriculationNumber(
                programId.toString(),
                academicSessionId.toString(),
            );

            let studentProfileImageUrl: string | undefined;
            if (fullApplication.profileImageUrl) {
                try {
                    const copiedProfileImage = await this.uploadService.copyProfileImageToStudentFolder(
                        fullApplication.profileImageUrl,
                        matriculationNumber,
                    );
                    studentProfileImageUrl = copiedProfileImage?.url;
                } catch (error) {
                    this.logger.error('Student profile image migration failed; enrollment will remain retryable:', {
                        userId: normalizedUserId.toString(),
                        applicationId: normalizedApplicationId.toString(),
                        matriculationNumber,
                        error: error.message,
                    });
                }
            }

            // Extract the ObjectId from the populated entryAcademicSession
            const admissionYear = new Date().getFullYear();

            this.logger.log('About to check for existing student record...');
            this.logger.log('User ID for student check:', fullApplication.userId);

            // Create Student record (migrate from applicant to student)
            try {
                const existingStudent = await this.studentModel.findOne({
                    $or: [
                        { userId: normalizedUserId },
                        { applicationId: normalizedApplicationId },
                    ],
                });

                this.logger.log('Existing student check result:', existingStudent ? 'Found' : 'Not found');

                if (!existingStudent) {
                    this.logger.log('Creating new student record...');
                    this.logger.log('Student data:', {
                        userId: normalizedUserId,
                        applicationId: normalizedApplicationId,
                        matriculationNumber: matriculationNumber,
                        programId: fullApplication.programId,
                        admissionYear: admissionYear,
                        academicSession: academicSessionId,
                        entryAcademicSession: academicSessionId
                    });

                    const newStudent = new this.studentModel({
                        userId: normalizedUserId,
                        applicationId: normalizedApplicationId,
                        matriculationNumber: matriculationNumber,
                        programId: fullApplication.programId,
                        admissionYear: admissionYear,
                        academicSession: academicSessionId, // Store ObjectId reference
                        entryAcademicSession: academicSessionId,
                        status: 'active',
                        currentLevel: 1,
                        currentSemester: 1,
                        cumulativeGPA: null,
                        isActive: true,
                        profileImageUrl: studentProfileImageUrl,
                    });

                    await newStudent.save();
                    await this.studentAcademicSessionModel.updateOne(
                        { studentId: newStudent._id, academicSessionId },
                        {
                            $setOnInsert: {
                                status: StudentAcademicSessionStatus.CURRENT,
                                startedAt: new Date(),
                            },
                        },
                        { upsert: true },
                    );
                    this.logger.log('✅ Student record created successfully:', newStudent._id);
                } else {
                    existingStudent.userId = normalizedUserId;
                    existingStudent.applicationId = normalizedApplicationId;
                    existingStudent.matriculationNumber = matriculationNumber;
                    existingStudent.programId = fullApplication.programId;
                    existingStudent.admissionYear = admissionYear;
                    // A repeat completion must not move an existing student into a
                    // different cohort or overwrite their staff-assigned billable session.
                    if (!existingStudent.academicSession) {
                        existingStudent.academicSession = academicSessionId;
                    }
                    if (!existingStudent.entryAcademicSession) {
                        existingStudent.entryAcademicSession = academicSessionId;
                    }
                    if (studentProfileImageUrl) {
                        existingStudent.profileImageUrl = studentProfileImageUrl;
                    }
                    existingStudent.status = existingStudent.status || 'active';
                    existingStudent.currentLevel = existingStudent.currentLevel || 1;
                    existingStudent.currentSemester = existingStudent.currentSemester || 1;
                    existingStudent.isActive = existingStudent.isActive !== false;
                    await existingStudent.save();
                    this.logger.log('Student record already exists:', existingStudent._id);
                }
            } catch (studentError) {
                this.logger.error('❌ Error creating student record:', studentError);
                throw studentError;
            }

            this.logger.log('About to update user role...');
            this.logger.log('Current user role:', user.role);

            // Update User role from APPLICANT to STUDENT
            try {
                if (studentProfileImageUrl) {
                    user.profileImageUrl = studentProfileImageUrl;
                }
                if (user.role === UserRole.APPLICANT) {
                    this.logger.log('Updating user role from APPLICANT to STUDENT...');
                    user.role = UserRole.STUDENT;
                    await user.save();
                    this.logger.log('✅ User role updated from APPLICANT to STUDENT:', user._id);
                } else if (studentProfileImageUrl) {
                    await user.save();
                } else {
                    this.logger.log('User role already set to:', user.role);
                }
            } catch (userError) {
                this.logger.error('❌ Error updating user role:', userError);
                throw userError;
            }

            // Only mark the application complete after its student record and role are ready.
            fullApplication.matriculationNumber = matriculationNumber;
            fullApplication.status = ApplicationStatus.COMPLETED;
            fullApplication.currentStage = 10;
            await fullApplication.save();

            // Send matriculation email
            const studentPortalUrl = process.env.STUDENT_PORTAL_URL || 'http://localhost:3000/student-portal';
            await this.emailService.sendMatriculationEmail(
                user.email,
                user.firstName,
                matriculationNumber,
                studentPortalUrl
            );

            this.logger.log('Application completion process finished successfully for user:', userId);
            this.logger.log('Generated matriculation number:', matriculationNumber);
            this.logger.log('Student record created and user role updated');
            this.logger.log('Matriculation email sent to:', user.email);

        } catch (error) {
            this.logger.error('Error completing application process:', error);
            throw error;
        }
    }

    // Payment Management Methods for Staff Portal

    async getPaymentsForManagement(filters: {
        page?: number;
        limit?: number;
        search?: string;
        active?: boolean;
        sortBy?: string;
        sortOrder?: string;
    }) {
        const {
            page = 1,
            limit = 10,
            search,
            active,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = filters;

        // Build query
        const query: any = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { paymentCode: { $regex: search, $options: 'i' } }
            ];
        }

        if (active !== undefined) {
            query.active = active;
        }

        // Build sort object
        const sort: any = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Execute queries
        const [payments, totalCount] = await Promise.all([
            this.paymentModel
                .find(query)
                .populate('paystackDestinationAccountId', 'title code channelType providerType isDefault active accountName bankName accountNumber currency paystackSubaccountCode note')
                .populate('manualTransferDestinationAccountId', 'title code channelType providerType isDefault active accountName bankName accountNumber currency paystackSubaccountCode note')
                .select('_id name description amount category active paymentCode targetAudience paystackDestinationAccountId manualTransferDestinationAccountId createdAt updatedAt')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            this.paymentModel.countDocuments(query)
        ]);

        // Transform payments for frontend
        const transformedPayments = payments.map(payment => ({
            id: payment._id.toString(),
            name: payment.name,
            description: payment.description,
            amount: payment.amount,
            category: payment.category,
            isActive: payment.active,
            paymentCode: payment.paymentCode,
            targetAudience: payment.targetAudience,
            paystackDestinationAccount: this.toDestinationAccountSummary(payment.paystackDestinationAccountId as any),
            manualTransferDestinationAccount: this.toDestinationAccountSummary(payment.manualTransferDestinationAccountId as any),
            paystackDestinationAccountId: (payment.paystackDestinationAccountId as any)?._id?.toString?.() || null,
            manualTransferDestinationAccountId: (payment.manualTransferDestinationAccountId as any)?._id?.toString?.() || null,
            createdAt: (payment as any).createdAt,
            updatedAt: (payment as any).updatedAt
        }));

        return {
            payments: transformedPayments,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasNextPage: page < Math.ceil(totalCount / limit),
                hasPrevPage: page > 1
            }
        };
    }

    async getPaymentById(id: string) {
        try {
            const payment = await this.paymentModel
                .findById(id)
                .populate('paystackDestinationAccountId', 'title code channelType providerType isDefault active accountName bankName accountNumber currency paystackSubaccountCode note')
                .populate('manualTransferDestinationAccountId', 'title code channelType providerType isDefault active accountName bankName accountNumber currency paystackSubaccountCode note')
                .lean();

            if (!payment) {
                return null;
            }

            return {
                id: payment._id.toString(),
                name: payment.name,
                description: payment.description,
                amount: payment.amount,
                category: payment.category,
                isActive: payment.active,
                paymentCode: payment.paymentCode,
                targetAudience: payment.targetAudience,
                paystackDestinationAccount: this.toDestinationAccountSummary(payment.paystackDestinationAccountId as any),
                manualTransferDestinationAccount: this.toDestinationAccountSummary(payment.manualTransferDestinationAccountId as any),
                paystackDestinationAccountId: (payment.paystackDestinationAccountId as any)?._id?.toString?.() || null,
                manualTransferDestinationAccountId: (payment.manualTransferDestinationAccountId as any)?._id?.toString?.() || null,
                createdAt: (payment as any).createdAt,
                updatedAt: (payment as any).updatedAt
            };
        } catch (error) {
            this.logger.error('Error getting payment by ID:', error);
            throw error;
        }
    }

    async createPayment(createPaymentDto: {
        name: string;
        description?: string;
        amount: number;
        category?: string;
        isActive?: boolean;
        paymentCode?: string;
        targetAudience?: PaymentAudience[];
        paystackDestinationAccountId?: string;
        manualTransferDestinationAccountId?: string;
    }) {
        try {
            await this.validateDestinationAccountId(
                createPaymentDto.paystackDestinationAccountId,
                PaymentDestinationChannelType.PAYSTACK,
            );
            await this.validateDestinationAccountId(
                createPaymentDto.manualTransferDestinationAccountId,
                PaymentDestinationChannelType.MANUAL_TRANSFER,
            );

            const paymentData = {
                name: createPaymentDto.name,
                description: createPaymentDto.description,
                amount: createPaymentDto.amount,
                category: createPaymentDto.category,
                active: createPaymentDto.isActive !== undefined ? createPaymentDto.isActive : true,
                paymentCode: createPaymentDto.paymentCode,
                targetAudience: createPaymentDto.targetAudience || [PaymentAudience.APPLICANT],
                paystackDestinationAccountId: createPaymentDto.paystackDestinationAccountId
                    ? new Types.ObjectId(createPaymentDto.paystackDestinationAccountId)
                    : undefined,
                manualTransferDestinationAccountId: createPaymentDto.manualTransferDestinationAccountId
                    ? new Types.ObjectId(createPaymentDto.manualTransferDestinationAccountId)
                    : undefined,
            };

            const payment = new this.paymentModel(paymentData);
            const savedPayment = await payment.save();

            const hydratedPayment = await this.paymentModel
                .findById(savedPayment._id)
                .populate('paystackDestinationAccountId', 'title code channelType providerType isDefault active accountName bankName accountNumber currency paystackSubaccountCode note')
                .populate('manualTransferDestinationAccountId', 'title code channelType providerType isDefault active accountName bankName accountNumber currency paystackSubaccountCode note')
                .lean();

            this.logger.log('Payment created successfully:', savedPayment._id);

            return {
                id: hydratedPayment!._id.toString(),
                name: hydratedPayment!.name,
                description: hydratedPayment!.description,
                amount: hydratedPayment!.amount,
                category: hydratedPayment!.category,
                isActive: hydratedPayment!.active,
                paymentCode: hydratedPayment!.paymentCode,
                targetAudience: hydratedPayment!.targetAudience,
                paystackDestinationAccount: this.toDestinationAccountSummary(hydratedPayment!.paystackDestinationAccountId as any),
                manualTransferDestinationAccount: this.toDestinationAccountSummary(hydratedPayment!.manualTransferDestinationAccountId as any),
                paystackDestinationAccountId: (hydratedPayment!.paystackDestinationAccountId as any)?._id?.toString?.() || null,
                manualTransferDestinationAccountId: (hydratedPayment!.manualTransferDestinationAccountId as any)?._id?.toString?.() || null,
                createdAt: (hydratedPayment! as any).createdAt,
                updatedAt: (hydratedPayment! as any).updatedAt
            };
        } catch (error) {
            this.logger.error('Error creating payment:', error);
            throw error;
        }
    }

    async updatePayment(id: string, updatePaymentDto: {
        name?: string;
        description?: string;
        amount?: number;
        category?: string;
        isActive?: boolean;
        paymentCode?: string;
        targetAudience?: PaymentAudience[];
        paystackDestinationAccountId?: string | null;
        manualTransferDestinationAccountId?: string | null;
    }) {
        try {
            const updateData: any = {};

            if (updatePaymentDto.name !== undefined) {
                updateData.name = updatePaymentDto.name;
            }
            if (updatePaymentDto.paymentCode !== undefined) {
                updateData.paymentCode = updatePaymentDto.paymentCode;
            }
            if (updatePaymentDto.description !== undefined) {
                updateData.description = updatePaymentDto.description;
            }
            if (updatePaymentDto.amount !== undefined) {
                updateData.amount = updatePaymentDto.amount;
            }
            if (updatePaymentDto.category !== undefined) {
                updateData.category = updatePaymentDto.category;
            }
            if (updatePaymentDto.isActive !== undefined) {
                updateData.active = updatePaymentDto.isActive;
            }
            if (updatePaymentDto.targetAudience !== undefined) {
                updateData.targetAudience = updatePaymentDto.targetAudience;
            }
            if (updatePaymentDto.paystackDestinationAccountId !== undefined) {
                if (updatePaymentDto.paystackDestinationAccountId) {
                    await this.validateDestinationAccountId(
                        updatePaymentDto.paystackDestinationAccountId,
                        PaymentDestinationChannelType.PAYSTACK,
                    );
                    updateData.paystackDestinationAccountId = new Types.ObjectId(updatePaymentDto.paystackDestinationAccountId);
                } else {
                    updateData.paystackDestinationAccountId = null;
                }
            }
            if (updatePaymentDto.manualTransferDestinationAccountId !== undefined) {
                if (updatePaymentDto.manualTransferDestinationAccountId) {
                    await this.validateDestinationAccountId(
                        updatePaymentDto.manualTransferDestinationAccountId,
                        PaymentDestinationChannelType.MANUAL_TRANSFER,
                    );
                    updateData.manualTransferDestinationAccountId = new Types.ObjectId(updatePaymentDto.manualTransferDestinationAccountId);
                } else {
                    updateData.manualTransferDestinationAccountId = null;
                }
            }

            const payment = await this.paymentModel
                .findByIdAndUpdate(id, updateData, { new: true })
                .populate('paystackDestinationAccountId', 'title code channelType providerType isDefault active accountName bankName accountNumber currency paystackSubaccountCode note')
                .populate('manualTransferDestinationAccountId', 'title code channelType providerType isDefault active accountName bankName accountNumber currency paystackSubaccountCode note')
                .lean();

            if (!payment) {
                return null;
            }

            this.logger.log('Payment updated successfully:', payment._id);

            return {
                id: payment._id.toString(),
                name: payment.name,
                description: payment.description,
                amount: payment.amount,
                category: payment.category,
                isActive: payment.active,
                paymentCode: payment.paymentCode,
                targetAudience: payment.targetAudience,
                paystackDestinationAccount: this.toDestinationAccountSummary(payment.paystackDestinationAccountId as any),
                manualTransferDestinationAccount: this.toDestinationAccountSummary(payment.manualTransferDestinationAccountId as any),
                paystackDestinationAccountId: (payment.paystackDestinationAccountId as any)?._id?.toString?.() || null,
                manualTransferDestinationAccountId: (payment.manualTransferDestinationAccountId as any)?._id?.toString?.() || null,
                createdAt: (payment as any).createdAt,
                updatedAt: (payment as any).updatedAt
            };
        } catch (error) {
            this.logger.error('Error updating payment:', error);
            throw error;
        }
    }

    async togglePaymentStatus(id: string) {
        try {
            const payment = await this.paymentModel.findById(id);

            if (!payment) {
                return null;
            }

            payment.active = !payment.active;
            const updatedPayment = await payment.save();

            this.logger.log('Payment status toggled successfully:', {
                id: updatedPayment._id,
                active: updatedPayment.active
            });

            return {
                id: updatedPayment._id.toString(),
                name: updatedPayment.name,
                description: updatedPayment.description,
                amount: updatedPayment.amount,
                category: updatedPayment.category,
                isActive: updatedPayment.active,
                paymentCode: updatedPayment.paymentCode,
                createdAt: (updatedPayment as any).createdAt,
                updatedAt: (updatedPayment as any).updatedAt
            };
        } catch (error) {
            this.logger.error('Error toggling payment status:', error);
            throw error;
        }
    }

    async deletePayment(id: string) {
        try {
            // Check if payment is being used by any payment transactions
            const paymentTransactionCount = await this.paymentTransactionModel.countDocuments({
                paymentId: id
            });

            if (paymentTransactionCount > 0) {
                throw new Error('Cannot delete payment that has been used by students');
            }

            const result = await this.paymentModel.findByIdAndDelete(id);

            if (!result) {
                return null;
            }

            this.logger.log('Payment deleted successfully:', id);
            return true;
        } catch (error) {
            this.logger.error('Error deleting payment:', error);
            throw error;
        }
    }

    async getDestinationAccounts() {
        const accounts = await this.paymentDestinationAccountModel
            .find()
            .sort({ channelType: 1, isDefault: -1, title: 1 })
            .lean();

        return accounts.map((account) => this.toDestinationAccountSummary(account));
    }

    async createDestinationAccount(createDto: {
        title: string;
        code: string;
        channelType: PaymentDestinationChannelType;
        providerType: PaymentDestinationProviderType;
        isDefault?: boolean;
        active?: boolean;
        accountName?: string;
        bankName?: string;
        accountNumber?: string;
        currency?: string;
        paystackSubaccountCode?: string;
        paystackChargeBearer?: string;
        transactionCharge?: number;
        note?: string;
    }) {
        if (createDto.isDefault) {
            await this.paymentDestinationAccountModel.updateMany(
                { channelType: createDto.channelType, isDefault: true },
                { $set: { isDefault: false } },
            );
        }

        const created = await this.paymentDestinationAccountModel.create({
            ...createDto,
            code: createDto.code.trim().toUpperCase(),
            active: createDto.active !== undefined ? createDto.active : true,
            currency: createDto.currency || 'NGN',
        });

        const account = await this.paymentDestinationAccountModel.findById(created._id).lean();
        return this.toDestinationAccountSummary(account);
    }

    async updateDestinationAccount(id: string, updateDto: {
        title?: string;
        code?: string;
        channelType?: PaymentDestinationChannelType;
        providerType?: PaymentDestinationProviderType;
        isDefault?: boolean;
        active?: boolean;
        accountName?: string;
        bankName?: string;
        accountNumber?: string;
        currency?: string;
        paystackSubaccountCode?: string;
        paystackChargeBearer?: string;
        transactionCharge?: number | null;
        note?: string;
    }) {
        if (updateDto.isDefault && updateDto.channelType) {
            await this.paymentDestinationAccountModel.updateMany(
                { channelType: updateDto.channelType, isDefault: true, _id: { $ne: new Types.ObjectId(id) } },
                { $set: { isDefault: false } },
            );
        }

        const updateData: any = { ...updateDto };
        if (updateDto.code !== undefined) {
            updateData.code = updateDto.code.trim().toUpperCase();
        }
        if (updateDto.transactionCharge === null) {
            updateData.transactionCharge = undefined;
        }

        const updated = await this.paymentDestinationAccountModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .lean();

        return this.toDestinationAccountSummary(updated);
    }

    async deleteDestinationAccount(id: string) {
        const usageCount = await this.paymentModel.countDocuments({
            $or: [
                { paystackDestinationAccountId: new Types.ObjectId(id) },
                { manualTransferDestinationAccountId: new Types.ObjectId(id) },
            ],
        });

        if (usageCount > 0) {
            throw new Error('Cannot delete a destination account that is assigned to existing payments');
        }

        const deleted = await this.paymentDestinationAccountModel.findByIdAndDelete(id);
        return Boolean(deleted);
    }

    /**
     * Get payment transactions statistics for staff dashboard
     */
    async getPaymentTransactionsStats(filters: {
        academicSessionId?: string;
    } = {}) {
        try {
            const match: any = {};

            if (filters.academicSessionId) {
                if (!Types.ObjectId.isValid(filters.academicSessionId)) {
                    throw new Error('Invalid academic session filter');
                }

                match.academicSessionId = new Types.ObjectId(filters.academicSessionId);
            }

            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const endOfToday = new Date(startOfToday);
            endOfToday.setDate(endOfToday.getDate() + 1);

            const [summary] = await this.paymentTransactionModel.aggregate([
                { $match: match },
                {
                    $addFields: {
                        successfulAt: {
                            $ifNull: [
                                '$paidAt',
                                {
                                    $ifNull: ['$verifiedAt', '$createdAt'],
                                },
                            ],
                        },
                        isPendingRemittance: {
                            $and: [
                                { $eq: ['$status', PaymentStatus.SUCCESSFUL] },
                                { $eq: ['$method', PaymentMethod.PAYSTACK] },
                                {
                                    $ne: [
                                        { $ifNull: ['$remittanceStatus', null] },
                                        RemittanceStatus.SUCCESS,
                                    ],
                                },
                            ],
                        },
                    },
                },
                {
                    $facet: {
                        totals: [
                            {
                                $group: {
                                    _id: null,
                                    totalRevenue: {
                                        $sum: {
                                            $cond: [
                                                { $eq: ['$status', PaymentStatus.SUCCESSFUL] },
                                                '$amount',
                                                0,
                                            ],
                                        },
                                    },
                                    awaitingVerification: {
                                        $sum: {
                                            $cond: [
                                                { $eq: ['$status', PaymentStatus.PENDING] },
                                                '$amount',
                                                0,
                                            ],
                                        },
                                    },
                                    pendingRemittance: {
                                        $sum: {
                                            $cond: [
                                                '$isPendingRemittance',
                                                '$amount',
                                                0,
                                            ],
                                        },
                                    },
                                    successfulCount: {
                                        $sum: {
                                            $cond: [
                                                { $eq: ['$status', PaymentStatus.SUCCESSFUL] },
                                                1,
                                                0,
                                            ],
                                        },
                                    },
                                    pendingCount: {
                                        $sum: {
                                            $cond: [
                                                { $eq: ['$status', PaymentStatus.PENDING] },
                                                1,
                                                0,
                                            ],
                                        },
                                    },
                                },
                            },
                        ],
                        todaysRevenue: [
                            {
                                $match: {
                                    status: PaymentStatus.SUCCESSFUL,
                                    successfulAt: {
                                        $gte: startOfToday,
                                        $lt: endOfToday,
                                    },
                                },
                            },
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: '$amount' },
                                    count: { $sum: 1 },
                                },
                            },
                        ],
                    },
                },
            ]);

            const totals = summary?.totals?.[0] || {};
            const todaysRevenue = summary?.todaysRevenue?.[0] || {};

            return {
                totalRevenue: Number(totals.totalRevenue || 0),
                awaitingVerification: Number(totals.awaitingVerification || 0),
                todaysRevenue: Number(todaysRevenue.total || 0),
                pendingRemittance: Number(totals.pendingRemittance || 0),
                successfulCount: Number(totals.successfulCount || 0),
                pendingCount: Number(totals.pendingCount || 0),
                todaysSuccessfulCount: Number(todaysRevenue.count || 0),
            };
        } catch (error) {
            this.logger.error('Error getting payment transactions stats:', error);
            throw error;
        }
    }

    async getPaymentTransactionsForManagement(filters: {
        page?: number;
        limit?: number;
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        status?: PaymentStatus;
        paymentId?: string;
        method?: PaymentMethod;
        programId?: string;
        academicSessionId?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    } = {}) {
        const page = Math.max(1, Number(filters.page) || 1);
        const limit = Math.max(1, Number(filters.limit) || 10);
        const skip = (page - 1) * limit;

        const baseMatch: any = {};

        if (filters.status) {
            baseMatch.status = filters.status;
        }

        if (filters.method) {
            baseMatch.method = filters.method;
        }

        if (filters.paymentId) {
            if (!Types.ObjectId.isValid(filters.paymentId)) {
                throw new Error('Invalid payment filter');
            }
            baseMatch.paymentId = new Types.ObjectId(filters.paymentId);
        }

        const pipeline: any[] = [
            { $match: baseMatch },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            {
                $unwind: {
                    path: '$user',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'rejectedBy',
                    foreignField: '_id',
                    as: 'rejectedByUser',
                },
            },
            {
                $unwind: {
                    path: '$rejectedByUser',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: 'applications',
                    localField: 'applicationId',
                    foreignField: '_id',
                    as: 'application',
                },
            },
            {
                $unwind: {
                    path: '$application',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: 'accommodationapplications',
                    localField: 'accommodationApplicationId',
                    foreignField: '_id',
                    as: 'accommodationApplication',
                },
            },
            {
                $unwind: {
                    path: '$accommodationApplication',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: 'externalresidents',
                    localField: 'externalResidentId',
                    foreignField: '_id',
                    as: 'externalResident',
                },
            },
            {
                $unwind: {
                    path: '$externalResident',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: 'students',
                    localField: 'userId',
                    foreignField: 'userId',
                    as: 'student',
                },
            },
            {
                $unwind: {
                    path: '$student',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: 'applications',
                    localField: 'student.applicationId',
                    foreignField: '_id',
                    as: 'studentApplication',
                },
            },
            {
                $unwind: {
                    path: '$studentApplication',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $addFields: {
                    resolvedApplication: {
                        $ifNull: ['$application', '$studentApplication'],
                    },
                    resolvedProgramId: {
                        $ifNull: [
                            '$student.programId',
                            {
                                $ifNull: ['$application.programId', '$studentApplication.programId'],
                            },
                        ],
                    },
                    resolvedAcademicSessionId: {
                        $ifNull: [
                            '$academicSessionId',
                            {
                                $ifNull: ['$student.academicSession', '$application.entryAcademicSession'],
                            },
                        ],
                    },
                    applicationNumber: {
                        $ifNull: ['$application.applicationNumber', { $ifNull: ['$studentApplication.applicationNumber', '$accommodationApplication.applicationNumber'] }],
                    },
                    matriculationNumber: {
                        $ifNull: [
                            '$student.matriculationNumber',
                            {
                                $ifNull: ['$application.matriculationNumber', '$studentApplication.matriculationNumber'],
                            },
                        ],
                    },
                    externalResidentNumber: '$externalResident.externalResidentNumber',
                    userName: {
                        $trim: {
                            input: {
                                $concat: [
                                    { $ifNull: ['$user.firstName', ''] },
                                    ' ',
                                    { $ifNull: ['$user.lastName', ''] },
                                ],
                            },
                        },
                    },
                    effectivePaidAt: {
                        $ifNull: ['$paidAt', '$createdAt'],
                    },
                },
            },
            {
                $lookup: {
                    from: 'programs',
                    localField: 'resolvedProgramId',
                    foreignField: '_id',
                    as: 'program',
                },
            },
            {
                $lookup: {
                    from: 'payments',
                    localField: 'paymentId',
                    foreignField: '_id',
                    as: 'payment',
                },
            },
            {
                $lookup: {
                    from: 'academicsessions',
                    localField: 'resolvedAcademicSessionId',
                    foreignField: '_id',
                    as: 'academicSession',
                },
            },
            {
                $unwind: {
                    path: '$program',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: 'programtypes',
                    localField: 'program.programTypeId',
                    foreignField: '_id',
                    as: 'programType',
                },
            },
            {
                $lookup: {
                    from: 'programmodes',
                    localField: 'program.programModeId',
                    foreignField: '_id',
                    as: 'programMode',
                },
            },
            {
                $unwind: {
                    path: '$programType',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $unwind: {
                    path: '$programMode',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $unwind: {
                    path: '$payment',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $unwind: {
                    path: '$academicSession',
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $addFields: {
                    paymentName: '$payment.name',
                    programName: '$program.name',
                    programTypeLabel: {
                        $ifNull: ['$programType.type', { $ifNull: ['$programType.name', '$programType.description'] }],
                    },
                    programModeLabel: {
                        $ifNull: ['$programMode.mode', { $ifNull: ['$programMode.name', '$programMode.description'] }],
                    },
                    academicSessionLabel: '$academicSession.sessionYear',
                },
            },
        ];

        if (filters.programId) {
            if (!Types.ObjectId.isValid(filters.programId)) {
                throw new Error('Invalid program filter');
            }

            pipeline.push({
                $match: {
                    resolvedProgramId: new Types.ObjectId(filters.programId),
                },
            });
        }

        if (filters.academicSessionId) {
            if (!Types.ObjectId.isValid(filters.academicSessionId)) {
                throw new Error('Invalid academic session filter');
            }

            pipeline.push({
                $match: {
                    resolvedAcademicSessionId: new Types.ObjectId(filters.academicSessionId),
                },
            });
        }

        if (filters.dateFrom || filters.dateTo) {
            const dateRangeMatch: Record<string, Date> = {};

            if (filters.dateFrom) {
                const start = new Date(filters.dateFrom);
                if (Number.isNaN(start.getTime())) {
                    throw new Error('Invalid from date filter');
                }

                start.setHours(0, 0, 0, 0);
                dateRangeMatch.$gte = start;
            }

            if (filters.dateTo) {
                const end = new Date(filters.dateTo);
                if (Number.isNaN(end.getTime())) {
                    throw new Error('Invalid to date filter');
                }

                end.setHours(23, 59, 59, 999);
                dateRangeMatch.$lte = end;
            }

            if (dateRangeMatch.$gte && dateRangeMatch.$lte && dateRangeMatch.$gte > dateRangeMatch.$lte) {
                throw new Error('From date cannot be later than to date');
            }

            pipeline.push({
                $match: {
                    effectivePaidAt: dateRangeMatch,
                },
            });
        }

        if (filters.search?.trim()) {
            const searchRegex = new RegExp(this.escapeRegex(filters.search.trim()), 'i');

            pipeline.push({
                $match: {
                    $or: [
                        { userName: searchRegex },
                        { paymentName: searchRegex },
                        { applicationNumber: searchRegex },
                        { matriculationNumber: searchRegex },
                        { externalResidentNumber: searchRegex },
                        { reference: searchRegex },
                    ],
                },
            });
        }

        const sortFieldMap: Record<string, string> = {
            createdAt: 'createdAt',
            paidAt: 'effectivePaidAt',
            amount: 'amount',
            status: 'status',
            userName: 'userName',
            paymentName: 'paymentName',
        };

        const sortField = sortFieldMap[filters.sortBy || 'paidAt'] || 'effectivePaidAt';
        const sortDirection = filters.sortOrder === 'asc' ? 1 : -1;

        pipeline.push({
            $facet: {
                payments: [
                    {
                        $sort: {
                            [sortField]: sortDirection,
                            _id: sortDirection,
                        },
                    },
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 1,
                            userId: '$user._id',
                            userName: 1,
                            email: '$user.email',
                            applicationNumber: 1,
                            matriculationNumber: 1,
                            externalResidentNumber: 1,
                            programName: 1,
                            programTypeLabel: 1,
                            programModeLabel: 1,
                            academicSessionLabel: 1,
                            paymentName: 1,
                            paymentCode: '$payment.paymentCode',
                            amount: 1,
                            reference: 1,
                            method: 1,
                            status: 1,
                            paidAt: 1,
                            effectivePaidAt: 1,
                            createdAt: 1,
                            receiptUrl: 1,
                            receiptKey: 1,
                            receiptOriginalName: 1,
                            payerType: 1,
                            paymentContext: 1,
                            receiptUploadedAt: 1,
                            verificationRemarks: 1,
                            remarks: 1,
                            gatewayStatus: 1,
                            gatewayResponse: 1,
                            lastVerifiedAt: 1,
                            verificationAttempts: 1,
                            rejectedBy: {
                                firstName: '$rejectedByUser.firstName',
                                lastName: '$rejectedByUser.lastName',
                            },
                            channel: 1,
                        },
                    },
                ],
                totalCount: [
                    { $count: 'count' },
                ],
            },
        });

        const [result] = await this.paymentTransactionModel.aggregate(pipeline);

        const payments = result?.payments || [];
        const totalItems = result?.totalCount?.[0]?.count || 0;
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));

        return {
            payments,
            pagination: {
                totalItems,
                currentPage: page,
                totalPages,
                limit,
            },
        };
    }

    async getPaymentReceipt(paymentTransactionId: string, requesterId: string, requesterRole: UserRole) {
        if (!Types.ObjectId.isValid(paymentTransactionId)) throw new NotFoundException('Payment receipt not found');
        const transaction = await this.paymentTransactionModel.findById(paymentTransactionId).select('userId receiptKey receiptUrl receiptOriginalName').lean();
        if (!transaction || (!transaction.receiptKey && !transaction.receiptUrl)) throw new NotFoundException('Payment receipt not found');
        const isOwner = transaction.userId?.toString() === requesterId;
        if (!isOwner && ![UserRole.STAFF, UserRole.ADMIN].includes(requesterRole)) {
            throw new ForbiddenException('You cannot access this payment receipt');
        }
        const buffer = transaction.receiptKey
            ? await this.uploadService.getFileBufferByKey(transaction.receiptKey)
            : await this.uploadService.getFileBufferByUrl(transaction.receiptUrl);
        if (!buffer) throw new NotFoundException('Payment receipt not found');
        const filename = transaction.receiptOriginalName || 'payment-receipt';
        const extension = filename.split('.').pop()?.toLowerCase();
        const contentType = extension === 'pdf'
            ? 'application/pdf'
            : extension === 'png'
                ? 'image/png'
                : extension === 'webp'
                    ? 'image/webp'
                    : 'image/jpeg';
        return { buffer, filename, contentType };
    }

    async generatePaymentTransactionReceipt(paymentTransactionId: string, userId: string) {
        if (!Types.ObjectId.isValid(paymentTransactionId)) {
            throw new NotFoundException('Payment transaction not found');
        }

        const transaction: any = await this.paymentTransactionModel
            .findOne({
                _id: new Types.ObjectId(paymentTransactionId),
                userId: new Types.ObjectId(userId),
                status: PaymentStatus.SUCCESSFUL,
            })
            .populate('userId', 'firstName otherName lastName email')
            .populate('paymentId', 'name description paymentCode')
            .populate('academicSessionId', 'sessionYear title')
            .lean();

        if (!transaction) {
            throw new NotFoundException('A completed payment transaction was not found');
        }

        const pdf = await PDFDocument.create();
        const page = pdf.addPage([595.28, 841.89]);
        const regular = await pdf.embedFont(StandardFonts.Helvetica);
        const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
        const primary = rgb(0.1, 0.37, 0.37);
        const muted = rgb(0.38, 0.42, 0.46);
        const user = transaction.userId || {};
        const payment = transaction.paymentId || {};
        const session = transaction.academicSessionId || {};
        const payerName = [user.firstName, user.otherName, user.lastName]
            .filter(Boolean)
            .join(' ') || 'Student';
        const paidAt = transaction.paidAt || transaction.updatedAt || transaction.createdAt;
        const formatLabel = (value: unknown) => String(value || 'Not available')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, character => character.toUpperCase());
        const rows = [
            ['Payer', payerName],
            ['Email', user.email || 'Not available'],
            ['Payment', payment.name || 'Payment'],
            ['Academic session', session.title || session.sessionYear || 'Not available'],
            ['Reference', transaction.reference],
            ['Method', formatLabel(transaction.method)],
            ['Channel', formatLabel(transaction.channel || transaction.method)],
            ['Status', 'Paid'],
            ['Payment date', paidAt ? new Intl.DateTimeFormat('en-NG', {
                dateStyle: 'long',
                timeStyle: 'short',
                timeZone: 'Africa/Lagos',
            }).format(new Date(paidAt)) : 'Not available'],
        ];

        page.drawText('ALEBIOSU COLLEGE OF NURSING SCIENCES', {
            x: 48, y: 785, size: 14, font: bold, color: primary,
        });
        page.drawText('PAYMENT RECEIPT', {
            x: 48, y: 742, size: 24, font: bold, color: rgb(0.08, 0.1, 0.13),
        });
        page.drawText('Official record of a completed payment transaction', {
            x: 48, y: 720, size: 10, font: regular, color: muted,
        });
        page.drawLine({
            start: { x: 48, y: 700 }, end: { x: 547, y: 700 }, thickness: 1, color: rgb(0.86, 0.88, 0.9),
        });

        page.drawText(`NGN ${Number(transaction.amount || 0).toLocaleString('en-NG', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`, {
            x: 48, y: 652, size: 25, font: bold, color: primary,
        });

        let y = 604;
        for (const [label, value] of rows) {
            page.drawText(label, { x: 48, y, size: 9, font: regular, color: muted });
            page.drawText(String(value), {
                x: 190, y, size: String(value).length > 48 ? 8 : 10, font: bold, color: rgb(0.08, 0.1, 0.13),
            });
            page.drawLine({
                start: { x: 48, y: y - 12 }, end: { x: 547, y: y - 12 }, thickness: 0.5, color: rgb(0.9, 0.91, 0.92),
            });
            y -= 42;
        }

        page.drawText('This receipt was generated electronically and does not require a signature.', {
            x: 48, y: 92, size: 9, font: regular, color: muted,
        });
        page.drawText(`Generated ${new Intl.DateTimeFormat('en-NG', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Africa/Lagos',
        }).format(new Date())}`, {
            x: 48, y: 72, size: 8, font: regular, color: muted,
        });

        const buffer = Buffer.from(await pdf.save());
        const safeReference = String(transaction.reference || transaction._id).replace(/[^a-zA-Z0-9_-]/g, '-');
        return {
            buffer,
            filename: `payment-receipt-${safeReference}.pdf`,
            contentType: 'application/pdf',
        };
    }

    // Student Portal Specific Methods

    async getPaymentTransactionsSummaryWithSession(userId: string, academicSessionId?: string): Promise<PaymentTransactionsSummary> {
        const userObjectId = new Types.ObjectId(userId);

        // Get user to verify they exist
        const user = await this.userModel.findById(userObjectId).lean();
        if (!user) {
            throw new Error('User not found');
        }

        const billableSession = await this.resolveStudentBillableSession(userId);
        const selectedSessionId = academicSessionId || billableSession.academicSessionId;
        const isPayable = selectedSessionId === billableSession.academicSessionId;

        if (!isPayable && !(await this.canStudentViewPaymentHistorySession(userId, selectedSessionId))) {
            throw new Error('Selected academic session is not available in this payment history');
        }

        const student = await this.studentModel
            .findOne({ userId: userObjectId })
            .select('entryAcademicSession')
            .lean();
        const studentGroup: 'new' | 'returning' =
            student?.entryAcademicSession?.toString() === selectedSessionId
                ? 'new'
                : 'returning';

        const availableMethods = isPayable
            ? await this.getPaymentMethodAvailability('student-portal', selectedSessionId)
            : { paystackEnabled: false, manualTransferEnabled: false };

        // Get student's successful payments for this session
        let paymentTransactionQuery: any = {
            userId: userObjectId,
            status: { $in: [PaymentStatus.SUCCESSFUL, PaymentStatus.PENDING, PaymentStatus.REJECTED] }
        };

        paymentTransactionQuery.academicSessionId = new Types.ObjectId(selectedSessionId);

        const paymentTransactions = await this.paymentTransactionModel
            .find(paymentTransactionQuery)
            .populate('paymentId')
            .lean();

        // Get currently active payments for unpaid calculation (filtered by session controls)
        let unpaidPaymentsQuery: any = {
            active: true,
            targetAudience: { $in: [PaymentAudience.STUDENT] }
        };

        const sessionControls = await this.getActivePaymentsForSession(selectedSessionId, studentGroup);
        if (sessionControls.payments.length > 0) {
            unpaidPaymentsQuery._id = { $in: sessionControls.payments.map(p => new Types.ObjectId(p)) };
        } else {
            unpaidPaymentsQuery = null;
        }

        const activePaymentsForUnpaid = unpaidPaymentsQuery ? await this.paymentModel.find(unpaidPaymentsQuery).lean() : [];

        const destinationAccountsMap = await this.getDestinationAccountsMap(
            [
                ...paymentTransactions.flatMap((paymentTransaction: any) => {
                    const payment = paymentTransaction.paymentId as any;
                    return payment && typeof payment === 'object'
                        ? [payment.paystackDestinationAccountId, payment.manualTransferDestinationAccountId]
                        : [];
                }),
                ...activePaymentsForUnpaid.flatMap((payment: any) => [
                    payment.paystackDestinationAccountId,
                    payment.manualTransferDestinationAccountId,
                ]),
            ],
        );

        // Separate paid and unpaid fees
        const paidFees: PaymentSummary[] = [];
        const pendingFees: PaymentSummary[] = [];
        const unpaidFees: PaymentSummary[] = [];

        const successfulPaymentsById = new Map<string, any>();
        const pendingManualPaymentsById = new Map<string, any>();
        const rejectedManualPaymentsById = new Map<string, any>();

        paymentTransactions.forEach((paymentTransaction: any) => {
            const linkedPaymentId = paymentTransaction.paymentId?._id?.toString();
            if (!linkedPaymentId) {
                return;
            }

            if (paymentTransaction.status === PaymentStatus.SUCCESSFUL) {
                successfulPaymentsById.set(linkedPaymentId, paymentTransaction);
                return;
            }

            if (this.isManualTransferPending(paymentTransaction)) {
                const existingPending = pendingManualPaymentsById.get(linkedPaymentId);
                if (!existingPending || new Date(paymentTransaction.createdAt || 0).getTime() > new Date(existingPending.createdAt || 0).getTime()) {
                    pendingManualPaymentsById.set(linkedPaymentId, paymentTransaction);
                }
                return;
            }

            if (this.isManualTransferRejected(paymentTransaction)) {
                const existingRejected = rejectedManualPaymentsById.get(linkedPaymentId);
                if (!existingRejected || new Date(paymentTransaction.rejectedAt || paymentTransaction.updatedAt || paymentTransaction.createdAt || 0).getTime() > new Date(existingRejected.rejectedAt || existingRejected.updatedAt || existingRejected.createdAt || 0).getTime()) {
                    rejectedManualPaymentsById.set(linkedPaymentId, paymentTransaction);
                }
            }
        });

        // First, add all paid fees from payment transactions (even if payment is no longer active)
        paymentTransactions.forEach(paymentTransaction => {
            if (paymentTransaction.status === PaymentStatus.SUCCESSFUL && paymentTransaction.paymentId && typeof paymentTransaction.paymentId === 'object') {
                const payment = paymentTransaction.paymentId as any; // Type assertion since it's populated
                const paystackDestinationAccount = this.toDestinationAccountSummary(
                    destinationAccountsMap.get(payment.paystackDestinationAccountId?.toString?.() || ''),
                );
                const manualTransferDestinationAccount = this.toDestinationAccountSummary(
                    destinationAccountsMap.get(payment.manualTransferDestinationAccountId?.toString?.() || ''),
                );
                const manualTransferDetails = this.toManualTransferDetails(
                    destinationAccountsMap.get(payment.manualTransferDestinationAccountId?.toString?.() || ''),
                );
                paidFees.push({
                    id: payment._id.toString(),
                    name: payment.name,
                    description: payment.description,
                    amount: paymentTransaction.amount, // Use actual paid amount
                    isPaid: true,
                    paymentCode: payment.paymentCode,
                    paidAt: paymentTransaction.paidAt,
                    reference: paymentTransaction.reference,
                    status: paymentTransaction.status,
                    channel: paymentTransaction.channel,
                    fee: paymentTransaction.fee,
                    method: paymentTransaction.method,
                    remarks: paymentTransaction.remarks,
                    receiptUrl: paymentTransaction.receiptUrl,
                    receiptOriginalName: paymentTransaction.receiptOriginalName,
                    receiptUploadedAt: paymentTransaction.receiptUploadedAt,
                    manualTransferDetails,
                    paystackDestinationAccount,
                    manualTransferDestinationAccount,
                });
            }
        });

        Array.from(pendingManualPaymentsById.values()).forEach((paymentTransaction: any) => {
            if (paymentTransaction.paymentId && typeof paymentTransaction.paymentId === 'object') {
                const payment = paymentTransaction.paymentId as any;
                const paystackDestinationAccount = this.toDestinationAccountSummary(
                    destinationAccountsMap.get(payment.paystackDestinationAccountId?.toString?.() || ''),
                );
                const manualTransferDestinationAccount = this.toDestinationAccountSummary(
                    destinationAccountsMap.get(payment.manualTransferDestinationAccountId?.toString?.() || ''),
                );
                const manualTransferDetails = this.toManualTransferDetails(
                    destinationAccountsMap.get(payment.manualTransferDestinationAccountId?.toString?.() || ''),
                );
                pendingFees.push({
                    id: payment._id.toString(),
                    name: payment.name,
                    description: payment.description,
                    amount: paymentTransaction.amount,
                    isPaid: false,
                    paymentCode: payment.paymentCode,
                    paidAt: paymentTransaction.paidAt,
                    reference: paymentTransaction.reference,
                    status: paymentTransaction.status,
                    channel: paymentTransaction.channel,
                    method: paymentTransaction.method,
                    remarks: paymentTransaction.remarks,
                    receiptUrl: paymentTransaction.receiptUrl,
                    receiptOriginalName: paymentTransaction.receiptOriginalName,
                    receiptUploadedAt: paymentTransaction.receiptUploadedAt,
                    manualTransferDetails,
                    paystackDestinationAccount,
                    manualTransferDestinationAccount,
                });
            }
        });

        // Then, add unpaid fees from currently active payments
        activePaymentsForUnpaid.forEach(payment => {
            const paymentId = payment._id.toString();
            const rejectedManualPayment = rejectedManualPaymentsById.get(paymentId);
            const paystackDestinationAccount = this.toDestinationAccountSummary(
                destinationAccountsMap.get(payment.paystackDestinationAccountId?.toString?.() || ''),
            );
            const manualTransferDestinationAccount = this.toDestinationAccountSummary(
                destinationAccountsMap.get(payment.manualTransferDestinationAccountId?.toString?.() || ''),
            );
            const manualTransferDetails = this.toManualTransferDetails(
                destinationAccountsMap.get(payment.manualTransferDestinationAccountId?.toString?.() || ''),
            );

            // Only add to unpaid if not already paid or awaiting manual verification
            if (!successfulPaymentsById.has(paymentId) && !pendingManualPaymentsById.has(paymentId)) {
                unpaidFees.push({
                    id: paymentId,
                    name: payment.name,
                    description: payment.description,
                    amount: payment.amount,
                    isPaid: false,
                    paymentCode: payment.paymentCode,
                    manualTransferDetails,
                    paystackDestinationAccount,
                    manualTransferDestinationAccount,
                    latestRejectedManualTransfer: rejectedManualPayment
                        ? this.toRejectedManualTransferSummary(rejectedManualPayment)
                        : undefined,
                });
            }
        });

        const totalPaid = paidFees.reduce((sum, fee) => sum + fee.amount, 0);
        const totalPending = pendingFees.reduce((sum, fee) => sum + fee.amount, 0);
        const totalUnpaid = unpaidFees.reduce((sum, fee) => sum + fee.amount, 0);

        return {
            paidFees,
            pendingFees,
            unpaidFees,
            totalPaid,
            totalPending,
            totalUnpaid,
            availableMethods,
            isPayable,
        };
    }

    async getPaymentTransactionHistory(
        userId: string,
        academicSessionId?: string,
        options: { page?: number; limit?: number } = {}
    ) {
        const { page = 1, limit = 10 } = options;
        const userObjectId = new Types.ObjectId(userId);

        if (academicSessionId && !(await this.canStudentViewPaymentHistorySession(userId, academicSessionId))) {
            throw new Error('Selected academic session is not available in this payment history');
        }

        // Build query
        let query: any = {
            userId: userObjectId,
            $or: [
                { status: PaymentStatus.SUCCESSFUL },
                { status: PaymentStatus.PENDING, method: PaymentMethod.MANUAL_TRANSFER },
            ],
        };

        if (academicSessionId) {
            query.academicSessionId = new Types.ObjectId(academicSessionId);
        }

        // Get payments with pagination
        const payments = await this.paymentTransactionModel
            .find(query)
            .populate('paymentId', 'name description amount paymentCode')
            .populate('academicSessionId', 'sessionYear')
            .sort({ paidAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .lean();

        // Get total count for pagination
        const totalCount = await this.paymentTransactionModel.countDocuments(query);

        // Calculate summary
        const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

        return {
            payments: payments.map(payment => ({
                id: payment._id,
                paymentId: payment.paymentId,
                amount: payment.amount,
                reference: payment.reference,
                paidAt: payment.paidAt,
                channel: payment.channel,
                fee: payment.fee,
                status: payment.status,
                method: payment.method,
                remarks: payment.remarks,
                receiptUrl: payment.receiptUrl,
                receiptOriginalName: payment.receiptOriginalName,
                receiptUploadedAt: payment.receiptUploadedAt,
                academicSession: payment.academicSessionId
            })),
            totalPaid: payments
                .filter(payment => payment.status === PaymentStatus.SUCCESSFUL)
                .reduce((sum, payment) => sum + payment.amount, 0),
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        };
    }

    async getPaymentTransactionHistorySessions(userId: string) {
        const student = await this.studentModel
            .findOne({ userId: new Types.ObjectId(userId) })
            .select('_id entryAcademicSession academicSession')
            .lean();

        if (!student) {
            throw new Error('Student record not found');
        }

        const [history, paymentSessionIds] = await Promise.all([
            this.studentAcademicSessionModel
                .find({ studentId: student._id })
                .populate('academicSessionId', 'sessionYear title startDate endDate')
                .sort({ startedAt: -1 })
                .lean(),
            this.paymentTransactionModel.distinct('academicSessionId', {
                userId: new Types.ObjectId(userId),
                academicSessionId: { $exists: true, $ne: null },
            }),
        ]);

        const sessionIds = new Set<string>([
            student.entryAcademicSession?.toString(),
            student.academicSession?.toString(),
            ...paymentSessionIds.map((id) => id.toString()),
        ].filter(Boolean));

        const knownSessionIds = new Set(
            history.map((record: any) => record.academicSessionId?._id?.toString() || record.academicSessionId?.toString()),
        );
        const missingSessionIds = [...sessionIds].filter((id) => !knownSessionIds.has(id));
        const missingSessions = missingSessionIds.length
            ? await this.academicSessionModel
                .find({ _id: { $in: missingSessionIds.map((id) => new Types.ObjectId(id)) } })
                .select('sessionYear title startDate endDate')
                .lean()
            : [];

        const sessions = [
            ...history.map((record: any) => ({
                id: record.academicSessionId?._id?.toString() || record.academicSessionId?.toString(),
                sessionYear: record.academicSessionId?.sessionYear,
                title: record.academicSessionId?.title,
                status: record.status,
                startedAt: record.startedAt,
            })),
            ...missingSessions.map((session: any) => ({
                id: session._id.toString(),
                sessionYear: session.sessionYear,
                title: session.title,
                status: session._id.toString() === student.academicSession.toString() ? 'current' : 'historical',
                startedAt: session.startDate,
            })),
        ];

        return sessions.sort((a, b) =>
            new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime(),
        );
    }

    async getLinkedPaymentsForStaffReview(
        userId: string,
        options: { applicationId?: string; academicSessionId?: string } = {}
    ): Promise<StaffLinkedPaymentsSummary> {
        const userObjectId = new Types.ObjectId(userId);
        const applicationObjectId = options.applicationId && Types.ObjectId.isValid(options.applicationId)
            ? new Types.ObjectId(options.applicationId)
            : null;
        const academicSessionObjectId = options.academicSessionId && Types.ObjectId.isValid(options.academicSessionId)
            ? new Types.ObjectId(options.academicSessionId)
            : null;

        const payments = await this.paymentTransactionModel
            .find({ userId: userObjectId })
            .populate('paymentId', 'name description amount paymentCode')
            .populate('academicSessionId', 'sessionYear')
            .populate('verifiedBy', 'firstName lastName')
            .populate('rejectedBy', 'firstName lastName')
            .sort({ createdAt: -1, paidAt: -1 })
            .lean();

        const mappedPayments = payments.map(payment => {
            const linkedApplicationId = payment.applicationId?.toString();
            const linkedAcademicSessionId = payment.academicSessionId && typeof payment.academicSessionId === 'object' && '_id' in payment.academicSessionId
                ? payment.academicSessionId._id?.toString()
                : payment.academicSessionId?.toString();
            const linkedPayment = payment.paymentId && typeof payment.paymentId === 'object' && '_id' in payment.paymentId
                ? payment.paymentId as any
                : null;

            return {
                id: payment._id.toString(),
                amount: payment.amount,
                reference: payment.reference,
                paidAt: payment.paidAt,
                channel: payment.channel,
                fee: payment.fee,
                status: payment.status,
                remarks: payment.remarks,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt,
                method: payment.method,
                receiptUrl: payment.receiptUrl,
                receiptOriginalName: payment.receiptOriginalName,
                receiptUploadedAt: payment.receiptUploadedAt,
                verifiedAt: payment.verifiedAt,
                rejectedAt: payment.rejectedAt,
                verificationRemarks: payment.verificationRemarks,
                payment: {
                    id: linkedPayment?._id?.toString(),
                    name: linkedPayment?.name || 'Unknown Payment',
                    description: linkedPayment?.description,
                    amount: linkedPayment?.amount,
                    paymentCode: linkedPayment?.paymentCode,
                },
                academicSession: payment.academicSessionId && typeof payment.academicSessionId === 'object'
                    ? {
                        id: (payment.academicSessionId as any)._id?.toString(),
                        sessionYear: (payment.academicSessionId as any).sessionYear,
                    }
                    : undefined,
            };
        });

        return {
            payments: mappedPayments,
            totalCount: mappedPayments.length,
            totalPaid: mappedPayments
                .filter(payment => payment.status === PaymentStatus.SUCCESSFUL)
                .reduce((sum, payment) => sum + payment.amount, 0),
            successfulCount: mappedPayments.filter(payment => payment.status === PaymentStatus.SUCCESSFUL).length,
            pendingCount: mappedPayments.filter(payment => payment.status === PaymentStatus.PENDING).length,
            failedCount: mappedPayments.filter(payment => [PaymentStatus.FAILED, PaymentStatus.REJECTED].includes(payment.status)).length,
            cancelledCount: mappedPayments.filter(payment => payment.status === PaymentStatus.CANCELLED).length,
        };
    }

    async initializePaymentTransaction(
        userId: string,
        paymentId: string,
        email: string,
        academicSessionId?: string
    ): Promise<PaystackInitializeResponse> {
        const { academicSessionId: billableSessionId, studentGroup } =
            await this.resolveStudentBillableSession(userId, academicSessionId);

        const isAvailable = await this.isPaymentAvailableForSession(
            paymentId,
            billableSessionId,
            studentGroup,
        );
        if (!isAvailable) {
            throw new Error('Payment is not available for the selected academic session');
        }

        // Get payment details
        const payment = await this.paymentModel.findById(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }

        const paystackDestinationAccount = await this.resolveDestinationForPayment(
            payment,
            PaymentDestinationChannelType.PAYSTACK,
        );

        // Check if user is authorized for this payment
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        if (!payment.targetAudience.includes(PaymentAudience.STUDENT)) {
            throw new Error('Payment not available for students');
        }

        await this.assertPaymentMethodEnabled(
            PaymentMethod.PAYSTACK,
            'student-portal',
            billableSessionId,
        );

        const accommodationApplication = await this.assertAccommodationPaymentEligibility(userId, payment, billableSessionId);

        const linkedApplication = await this.resolveLinkedApplication(userId);
        const student = await this.studentModel.findOne({ userId: new Types.ObjectId(userId) }).select('_id').lean();
        if (!student) {
            throw new Error('Student record not found');
        }

        // Generate unique reference
        const reference = this.buildPaymentReference();

        // Create student payment record
        const paymentTransaction = new this.paymentTransactionModel({
            userId: new Types.ObjectId(userId),
            applicationId: linkedApplication.applicationId,
            studentId: student._id,
            accommodationApplicationId: accommodationApplication?._id,
            payerType: PaymentPayerType.STUDENT,
            paymentContext: accommodationApplication
                ? PaymentContext.ACCOMMODATION_APPLICATION
                : PaymentContext.STUDENT_ACCOUNT,
            paymentId: new Types.ObjectId(paymentId),
            academicSessionId: new Types.ObjectId(billableSessionId),
            amount: payment.amount,
            reference: reference,
            status: PaymentStatus.PENDING,
            method: PaymentMethod.PAYSTACK,
            remarks: 'Payment initialized - awaiting user action',
            ...this.buildDestinationSnapshot(paystackDestinationAccount),
        });

        await paymentTransaction.save();

        // Initialize with Paystack
        const paystackResponse = await this.initializePaystackPayment(
            reference,
            email,
            payment.amount,
            userId,
            paymentId,
            payment.name,
            paystackDestinationAccount,
        );

        return {
            authorization_url: paystackResponse.authorization_url,
            access_code: paystackResponse.access_code,
            reference: reference
        };
    }

    async submitManualTransferPayment(
        userId: string,
        paymentId: string,
        file: Express.Multer.File,
        options: {
            context: 'application-portal' | 'student-portal';
            academicSessionId?: string;
            applicationId?: string;
        },
    ) {
        if (!file) {
            throw new Error('Payment receipt file is required');
        }

        if (!Types.ObjectId.isValid(paymentId)) {
            throw new Error('Invalid payment ID format');
        }

        const payment = await this.paymentModel.findById(new Types.ObjectId(paymentId));
        if (!payment) {
            throw new Error('Payment not found');
        }

        const user = await this.userModel.findById(new Types.ObjectId(userId)).lean();
        if (!user) {
            throw new Error('User not found');
        }

        const allowedAudiences = this.getUserAudiencesForContext(user.role, options.context);
        const canAccessPayment = payment.targetAudience.some((audience) => allowedAudiences.includes(audience));

        if (!canAccessPayment) {
            throw new Error('Payment not available for this user');
        }

        let billableSessionId: string | undefined;
        let accommodationApplication: any = null;
        if (options.context === 'student-portal') {
            const billableSession = await this.resolveStudentBillableSession(
                userId,
                options.academicSessionId,
            );
            billableSessionId = billableSession.academicSessionId;

            const isAvailable = await this.isPaymentAvailableForSession(
                paymentId,
                billableSessionId,
                billableSession.studentGroup,
            );
            if (!isAvailable) {
                throw new Error('Payment is not available for the selected academic session');
            }

            accommodationApplication = await this.assertAccommodationPaymentEligibility(
                userId,
                payment,
                billableSessionId,
            );
        }

        const linkedApplication = await this.resolveLinkedApplication(userId, options.applicationId);
        if (!linkedApplication.applicationNumber) {
            throw new Error('Application record not found for receipt storage');
        }
        if (options.context === 'application-portal') {
            await this.assertApplicationPortalPaymentAllowed(linkedApplication);
        }

        const manualTransferDestinationAccount = await this.resolveDestinationForPayment(
            payment,
            PaymentDestinationChannelType.MANUAL_TRANSFER,
        );

        await this.assertPaymentMethodEnabled(
            PaymentMethod.MANUAL_TRANSFER,
            options.context,
            options.context === 'student-portal'
                ? billableSessionId
                : linkedApplication.academicSessionId,
        );

        const successQuery: any = {
            userId: new Types.ObjectId(userId),
            paymentId: new Types.ObjectId(paymentId),
            status: PaymentStatus.SUCCESSFUL,
        };
        if (options.applicationId && options.context === 'application-portal') {
            successQuery.applicationId = linkedApplication.applicationId;
        }

        if (billableSessionId) {
            successQuery.academicSessionId = new Types.ObjectId(billableSessionId);
        }

        const existingSuccessfulPayment = await this.paymentTransactionModel.findOne(successQuery);
        if (existingSuccessfulPayment) {
            throw new Error('Payment has already been completed successfully for this charge');
        }

        const pendingManualPaymentQuery: any = {
            userId: new Types.ObjectId(userId),
            paymentId: new Types.ObjectId(paymentId),
            method: PaymentMethod.MANUAL_TRANSFER,
            status: PaymentStatus.PENDING,
        };
        if (options.applicationId && options.context === 'application-portal') {
            pendingManualPaymentQuery.applicationId = linkedApplication.applicationId;
        }

        if (billableSessionId) {
            pendingManualPaymentQuery.academicSessionId = new Types.ObjectId(billableSessionId);
        }

        const pendingManualPayment = await this.paymentTransactionModel.findOne(pendingManualPaymentQuery);

        if (pendingManualPayment) {
            throw new Error('A manual transfer receipt has already been submitted for this payment and is awaiting staff verification');
        }

        const receiptUpload = await this.uploadService.uploadPaymentReceipt(
            file,
            linkedApplication.applicationNumber,
            payment.name,
        );

        const paymentTransaction = await this.paymentTransactionModel.create({
            userId: new Types.ObjectId(userId),
            applicationId: linkedApplication.applicationId,
            studentId: options.context === 'student-portal'
                ? (await this.studentModel.findOne({ userId: new Types.ObjectId(userId) }).select('_id').lean())?._id
                : undefined,
            accommodationApplicationId: accommodationApplication?._id,
            payerType: options.context === 'student-portal'
                ? PaymentPayerType.STUDENT
                : PaymentPayerType.APPLICANT,
            paymentContext: accommodationApplication
                ? PaymentContext.ACCOMMODATION_APPLICATION
                : options.context === 'student-portal'
                ? PaymentContext.STUDENT_ACCOUNT
                : PaymentContext.ADMISSION_APPLICATION,
            academicSessionId: billableSessionId
                ? new Types.ObjectId(billableSessionId)
                : linkedApplication.academicSessionId,
            paymentId: new Types.ObjectId(paymentId),
            amount: payment.amount,
            reference: this.buildManualTransferReference(),
            paidAt: new Date(),
            method: PaymentMethod.MANUAL_TRANSFER,
            channel: PaymentChannel.MANUAL_TRANSFER,
            status: PaymentStatus.PENDING,
            remarks: 'Payment submitted via manual transfer; awaiting staff verification',
            receiptUrl: receiptUpload.url,
            receiptKey: receiptUpload.key,
            receiptOriginalName: file.originalname,
            receiptUploadedAt: new Date(),
            retryCount: 0,
            ...this.buildDestinationSnapshot(manualTransferDestinationAccount),
        });

        return {
            id: paymentTransaction._id.toString(),
            reference: paymentTransaction.reference,
            amount: paymentTransaction.amount,
            status: paymentTransaction.status,
            method: paymentTransaction.method,
            remarks: paymentTransaction.remarks,
            receiptUrl: paymentTransaction.receiptUrl,
            receiptOriginalName: paymentTransaction.receiptOriginalName,
            receiptUploadedAt: paymentTransaction.receiptUploadedAt,
        };
    }

    async verifyManualTransferPayment(paymentTransactionId: string, staffId: string, remarks?: string) {
        if (!Types.ObjectId.isValid(paymentTransactionId)) {
            throw new Error('Invalid payment record ID');
        }

        const paymentTransaction = await this.paymentTransactionModel.findById(paymentTransactionId);
        if (!paymentTransaction) {
            throw new Error('Payment record not found');
        }

        if (paymentTransaction.method !== PaymentMethod.MANUAL_TRANSFER) {
            throw new Error('Only manual transfer payments can be verified here');
        }

        if (paymentTransaction.status !== PaymentStatus.PENDING) {
            throw new Error('Only pending manual transfer payments can be verified');
        }

        const duplicateSuccessQuery: any = {
            _id: { $ne: paymentTransaction._id },
            userId: paymentTransaction.userId,
            paymentId: paymentTransaction.paymentId,
            status: PaymentStatus.SUCCESSFUL,
        };

        if (paymentTransaction.academicSessionId) {
            duplicateSuccessQuery.academicSessionId = paymentTransaction.academicSessionId;
        }

        const existingSuccessfulPayment = await this.paymentTransactionModel.findOne(duplicateSuccessQuery);
        if (existingSuccessfulPayment) {
            throw new Error('A successful payment already exists for this charge');
        }

        paymentTransaction.status = PaymentStatus.SUCCESSFUL;
        paymentTransaction.remarks = 'Payment successful and verified by staff';
        paymentTransaction.verificationRemarks = remarks || 'Manual transfer verified by staff';
        paymentTransaction.verifiedBy = new Types.ObjectId(staffId);
        paymentTransaction.verifiedAt = new Date();

        await paymentTransaction.save();
        if (paymentTransaction.paymentContext === PaymentContext.ACCOMMODATION_APPLICATION) {
            await this.finalizeAccommodationPayment(paymentTransaction);
        } else {
            await this.updateApplicationStageAfterPayment(
                paymentTransaction.userId,
                paymentTransaction.paymentId,
                paymentTransaction.applicationId,
            );
        }

        return {
            id: paymentTransaction._id.toString(),
            reference: paymentTransaction.reference,
            status: paymentTransaction.status,
            remarks: paymentTransaction.remarks,
            verificationRemarks: paymentTransaction.verificationRemarks,
            verifiedAt: paymentTransaction.verifiedAt,
        };
    }

    async rejectManualTransferPayment(paymentTransactionId: string, staffId: string, remarks?: string) {
        if (!Types.ObjectId.isValid(paymentTransactionId)) {
            throw new Error('Invalid payment record ID');
        }

        const paymentTransaction = await this.paymentTransactionModel.findById(paymentTransactionId);
        if (!paymentTransaction) {
            throw new Error('Payment record not found');
        }

        if (paymentTransaction.method !== PaymentMethod.MANUAL_TRANSFER) {
            throw new Error('Only manual transfer payments can be rejected here');
        }

        if (paymentTransaction.status !== PaymentStatus.PENDING) {
            throw new Error('Only pending manual transfer payments can be rejected');
        }

        paymentTransaction.status = PaymentStatus.REJECTED;
        paymentTransaction.remarks = 'Manual transfer receipt rejected by staff';
        paymentTransaction.verificationRemarks = remarks || 'Manual transfer rejected by staff';
        paymentTransaction.rejectedBy = new Types.ObjectId(staffId);
        paymentTransaction.rejectedAt = new Date();

        await paymentTransaction.save();

        let externalAccommodationResumeToken: string | undefined;
        if (
            paymentTransaction.payerType === PaymentPayerType.EXTERNAL_RESIDENT
            && paymentTransaction.paymentContext === PaymentContext.ACCOMMODATION_APPLICATION
            && paymentTransaction.accommodationApplicationId
        ) {
            externalAccommodationResumeToken = crypto.randomBytes(32).toString('hex');
            const now = new Date();
            const applications = this.paymentTransactionModel.db.collection('accommodationapplications');
            await applications.updateOne(
                { _id: paymentTransaction.accommodationApplicationId },
                {
                    $set: {
                        status: AccommodationApplicationStatus.AWAITING_PAYMENT,
                        resumeTokenHash: crypto.createHash('sha256').update(externalAccommodationResumeToken).digest('hex'),
                        resumeTokenExpiresAt: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)),
                        updatedAt: now,
                    },
                },
            );
            await this.paymentTransactionModel.db.collection('accommodationaudits').insertOne({
                accommodationApplicationId: paymentTransaction.accommodationApplicationId,
                action: 'manual_transfer_rejected',
                actorType: 'staff',
                actorId: new Types.ObjectId(staffId),
                metadata: {
                    reference: paymentTransaction.reference,
                    reason: paymentTransaction.verificationRemarks,
                },
                createdAt: now,
                updatedAt: now,
            });
        }

        try {
            const [user, payment] = await Promise.all([
                this.userModel.findById(paymentTransaction.userId).lean(),
                this.paymentModel.findById(paymentTransaction.paymentId).lean(),
            ]);

            if (user?.email) {
                const portalUrl = externalAccommodationResumeToken
                    ? `${process.env.WEBSITE_URL || 'https://alecons.edu.ng'}/accommodation/external?resumeToken=${encodeURIComponent(externalAccommodationResumeToken)}`
                    : user.role === UserRole.STUDENT
                        ? process.env.STUDENT_PORTAL_URL
                        : process.env.APPLICATION_PORTAL_URL;

                await this.emailService.sendManualPaymentRejectedEmail(
                    user.email,
                    user.firstName || 'Applicant',
                    {
                        paymentName: payment?.name || 'Payment',
                        amount: paymentTransaction.amount,
                        reference: paymentTransaction.reference,
                        rejectedAt: paymentTransaction.rejectedAt,
                        reason: paymentTransaction.verificationRemarks,
                        portalUrl,
                    },
                );
            }
        } catch (error) {
            this.logger.error('Failed to send manual payment rejection email:', error instanceof Error ? error.message : error);
        }

        return {
            id: paymentTransaction._id.toString(),
            reference: paymentTransaction.reference,
            status: paymentTransaction.status,
            remarks: paymentTransaction.remarks,
            verificationRemarks: paymentTransaction.verificationRemarks,
            rejectedAt: paymentTransaction.rejectedAt,
        };
    }

    async getAvailablePaymentTransactions(userId: string, academicSessionId?: string) {
        // Get user to verify they are a student
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const { academicSessionId: billableSessionId, studentGroup } =
            await this.resolveStudentBillableSession(userId, academicSessionId);

        // Get all active payments for students
        let paymentQuery: any = {
            active: true,
            targetAudience: { $in: [PaymentAudience.STUDENT] }
        };

        const sessionControls = await this.getActivePaymentsForSession(billableSessionId, studentGroup);
        if (sessionControls.payments.length > 0) {
            paymentQuery._id = { $in: sessionControls.payments.map(p => new Types.ObjectId(p)) };
        } else {
            return [];
        }

        const availablePayments = await this.paymentModel.find(paymentQuery).lean();

        // Get already paid payments by this user for this session
        let paidQuery: any = {
            userId: new Types.ObjectId(userId),
            status: PaymentStatus.SUCCESSFUL
        };

        paidQuery.academicSessionId = new Types.ObjectId(billableSessionId);

        const paidPayments = await this.paymentTransactionModel
            .find(paidQuery)
            .select('paymentId')
            .lean();

        const paidPaymentIds = new Set(paidPayments.map(p => p.paymentId.toString()));

        // Filter out already paid payments
        return availablePayments
            .filter(payment => !paidPaymentIds.has(payment._id.toString()))
            .map(payment => ({
                id: payment._id,
                name: payment.name,
                description: payment.description,
                amount: payment.amount,
                paymentCode: payment.paymentCode,
                category: payment.category,
                isPaid: false
            }));
    }

    // Helper method to get active payments for a session
    private async getActivePaymentsForSession(
        academicSessionId: string,
        studentGroup?: 'new' | 'returning',
    ): Promise<{
        controls: string[];
        payments: string[];
    }> {
        try {
            // This would require importing SessionControlsService, but to avoid circular dependencies,
            // we'll implement the logic directly here
            const sessionControl = await this.paymentModel.db.collection('sessioncontrols')
                .findOne({ academicSessionId: new Types.ObjectId(academicSessionId) });

            if (!sessionControl) {
                return { controls: [], payments: [] };
            }

            const activePayments = (sessionControl.payments || [])
                .filter((p: any) =>
                    p.active
                    && (!studentGroup
                        || !p.eligibleStudentGroups?.length
                        || p.eligibleStudentGroups.includes(studentGroup)),
                )
                .map((p: any) => p.paymentId.toString());

            return {
                controls: sessionControl.controls?.filter((c: any) => c.active).map((c: any) => c.name) || [],
                payments: activePayments
            };
        } catch (error) {
            this.logger.error('Error getting active payments for session:', error);
            return { controls: [], payments: [] };
        }
    }

    // Helper method to check if payment is available for session
    private async isPaymentAvailableForSession(
        paymentId: string,
        academicSessionId: string,
        studentGroup: 'new' | 'returning',
    ): Promise<boolean> {
        const sessionControls = await this.getActivePaymentsForSession(academicSessionId, studentGroup);
        return sessionControls.payments.includes(paymentId);
    }

    // Helper method for Paystack initialization
    private async initializePaystackPayment(
        reference: string,
        email: string,
        amount: number,
        userId: string,
        paymentId: string,
        paymentName: string,
        destinationAccount?: Partial<PaymentDestinationAccount> | null,
    ) {
        try {
            const data = await this.initializePaystackTransactionWithFallback(
                this.buildPaystackInitializePayload({
                    email,
                    amount,
                    reference,
                    userId,
                    paymentId,
                    paymentName,
                    destinationAccount,
                    callbackUrl: `${process.env.STUDENT_PORTAL_URL}/payment/verify/${reference}`,
                }),
                destinationAccount,
            );

            return data.data;
        } catch (error) {
            this.logger.error('Paystack initialization error:', error);
            throw error;
        }
    }
}

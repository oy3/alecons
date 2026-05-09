import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument, PaymentAudience } from '../schemas/payment.schema';
import { StudentPayment, StudentPaymentDocument, PaymentMethod, PaymentStatus, PaymentChannel } from '../schemas/student-payment.schema';
import {
    PaymentDestinationAccount,
    PaymentDestinationAccountDocument,
    PaymentDestinationChannelType,
    PaymentDestinationProviderType,
} from '../schemas/payment-destination-account.schema';
import { Application, ApplicationDocument, ApplicationStatus } from '../schemas/application.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { AcademicSession, AcademicSessionDocument } from '../schemas/academic-session.schema';
import { TenancyAgreement, TenancyAgreementDocument } from '../schemas/tenancy-agreement.schema';
import { MatriculationService } from '../services/matriculation.service';
import { EmailService } from '../services/email.service';
import { UploadService } from '../services/upload.service';

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

export interface StudentPaymentsSummary {
    paidFees: PaymentSummary[];
    pendingFees?: PaymentSummary[];
    unpaidFees: PaymentSummary[];
    totalPaid: number;
    totalPending?: number;
    totalUnpaid: number;
    availableMethods?: PaymentMethodAvailability;
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

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    private readonly paystackBaseUrl = 'https://api.paystack.co';

    constructor(
        @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
        @InjectModel(StudentPayment.name) private studentPaymentModel: Model<StudentPaymentDocument>,
        @InjectModel(PaymentDestinationAccount.name) private paymentDestinationAccountModel: Model<PaymentDestinationAccountDocument>,
        @InjectModel(Application.name) private applicationModel: Model<ApplicationDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
        @InjectModel(AcademicSession.name) private academicSessionModel: Model<AcademicSessionDocument>,
        @InjectModel(TenancyAgreement.name) private tenancyAgreementModel: Model<TenancyAgreementDocument>,
        private matriculationService: MatriculationService,
        private emailService: EmailService,
        private uploadService: UploadService,
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

    private isManualTransferPending(payment: Partial<StudentPayment>): boolean {
        return payment.status === PaymentStatus.PENDING
            && payment.method === PaymentMethod.MANUAL_TRANSFER
            && !!payment.receiptUrl;
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

            if (typeof params.destinationAccount.transactionCharge === 'number') {
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
    ) {
        try {
            return await this.sendPaystackInitializeRequest(payload);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Paystack initialization failed';

            if (this.shouldFallbackFromInvalidSubaccount(message, destinationAccount)) {
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

    private async resolveLinkedApplication(userId: string | Types.ObjectId) {
        const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

        const directApplication = await this.applicationModel
            .findOne({ userId: userObjectId })
            .select('_id applicationNumber entryAcademicSession currentStage')
            .lean();

        if (directApplication) {
            return {
                applicationId: directApplication._id as Types.ObjectId,
                applicationNumber: directApplication.applicationNumber,
                academicSessionId: directApplication.entryAcademicSession as Types.ObjectId,
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

    private async assertAccommodationPaymentEligibility(userId: string, payment: PaymentDocument | Payment) {
        if (payment.paymentCode !== 'accommodationFee') {
            return;
        }

        const student = await this.studentModel.findOne({
            userId: new Types.ObjectId(userId),
        });

        if (!student) {
            throw new Error('Student record not found');
        }

        const tenancyAgreement = await this.tenancyAgreementModel.findOne({
            studentId: student._id,
        });

        if (!tenancyAgreement) {
            throw new Error('You must sign the tenancy agreement before making accommodation fee payments. Please go to the Tenancy Agreement section first.');
        }

        this.logger.log(`Accommodation payment authorized for user ${userId} - tenancy agreement signed`);
    }

    private extractSessionStartYear(session?: { sessionYear?: string; startDate?: Date | string } | null): number | null {
        if (!session) {
            return null;
        }

        const sessionYearMatch = session.sessionYear?.match(/\d{4}/);
        if (sessionYearMatch) {
            return Number(sessionYearMatch[0]);
        }

        if (session.startDate) {
            const startDate = new Date(session.startDate);
            if (!Number.isNaN(startDate.getTime())) {
                return startDate.getFullYear();
            }
        }

        return null;
    }

    private async getStudentEntryYear(userId: string): Promise<number | null> {
        const student = await this.studentModel
            .findOne({ userId: new Types.ObjectId(userId) })
            .select('admissionYear academicSession')
            .populate('academicSession', 'sessionYear startDate')
            .lean();

        if (typeof student?.admissionYear === 'number') {
            return student.admissionYear;
        }

        const studentAcademicSession = student?.academicSession && typeof student.academicSession === 'object'
            ? student.academicSession as any
            : null;

        const studentYear = this.extractSessionStartYear(studentAcademicSession);
        if (studentYear) {
            return studentYear;
        }

        const linkedApplication = await this.resolveLinkedApplication(userId);
        if (!linkedApplication.academicSessionId) {
            return null;
        }

        const applicationSession = await this.academicSessionModel
            .findById(linkedApplication.academicSessionId)
            .select('sessionYear startDate')
            .lean();

        return this.extractSessionStartYear(applicationSession as any);
    }

    private async canStudentAccessAcademicSession(userId: string, academicSessionId?: string): Promise<boolean> {
        if (!academicSessionId || !Types.ObjectId.isValid(academicSessionId)) {
            return true;
        }

        const entryYear = await this.getStudentEntryYear(userId);
        if (!entryYear) {
            return true;
        }

        const selectedSession = await this.academicSessionModel
            .findById(academicSessionId)
            .select('sessionYear startDate')
            .lean();

        const selectedYear = this.extractSessionStartYear(selectedSession as any);
        if (!selectedYear) {
            return true;
        }

        return selectedYear >= entryYear;
    }

    async getStudentPaymentsSummary(userId: string, context: 'application-portal' | 'student-portal' = 'application-portal'): Promise<StudentPaymentsSummary> {
        const userObjectId = new Types.ObjectId(userId);

        // Get user to determine their role
        const user = await this.userModel.findById(userObjectId).lean();
        if (!user) {
            throw new Error('User not found');
        }

        const userAudiences = this.getUserAudiencesForContext(user.role, context);
        const linkedApplication = await this.resolveLinkedApplication(userId);
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
        const studentPayments = await this.studentPaymentModel
            .find({
                userId: userObjectId,
                status: { $in: [PaymentStatus.SUCCESSFUL, PaymentStatus.PENDING] }
            })
            .populate('paymentId')
            .lean();

        // Separate paid and unpaid fees
        const paidFees: PaymentSummary[] = [];
        const pendingFees: PaymentSummary[] = [];
        const unpaidFees: PaymentSummary[] = [];

        const successfulPaymentsById = new Map<string, any>();
        const pendingManualPaymentsById = new Map<string, any>();

        studentPayments.forEach((studentPayment: any) => {
            const linkedPaymentId = studentPayment.paymentId?._id?.toString();
            if (!linkedPaymentId) {
                return;
            }

            if (studentPayment.status === PaymentStatus.SUCCESSFUL) {
                successfulPaymentsById.set(linkedPaymentId, studentPayment);
                return;
            }

            if (this.isManualTransferPending(studentPayment)) {
                const existingPending = pendingManualPaymentsById.get(linkedPaymentId);
                if (!existingPending || new Date(studentPayment.createdAt || 0).getTime() > new Date(existingPending.createdAt || 0).getTime()) {
                    pendingManualPaymentsById.set(linkedPaymentId, studentPayment);
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

    async initializePayment(userId: string, paymentId: string, email: string): Promise<PaystackInitializeResponse> {
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
            const existingSuccessfulPayment = await this.studentPaymentModel.findOne({
                userId: new Types.ObjectId(userId),
                paymentId: new Types.ObjectId(paymentId),
                status: PaymentStatus.SUCCESSFUL
            });

            if (existingSuccessfulPayment) {
                throw new Error('Payment has already been completed successfully for this charge');
            }

            const linkedApplication = await this.resolveLinkedApplication(userId);
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
            let existingAttempt = await this.studentPaymentModel.findOne({
                userId: new Types.ObjectId(userId),
                paymentId: new Types.ObjectId(paymentId),
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
                await this.studentPaymentModel.create({
                    userId: new Types.ObjectId(userId),
                    applicationId: linkedApplication.applicationId,
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

    private async updatePaymentStatus(studentPayment: any, transactionData: any) {
        studentPayment.status = PaymentStatus.SUCCESSFUL;
        studentPayment.remarks = 'Payment successful and verified';
        studentPayment.paidAt = new Date();
        studentPayment.method = studentPayment.method || PaymentMethod.PAYSTACK;
        studentPayment.channel = transactionData.channel;
        studentPayment.gatewayId = transactionData.id;
        studentPayment.authorizationCode = transactionData.authorization?.authorization_code;
        await studentPayment.save();
    } async verifyPayment(reference: string): Promise<any> {
        // Verify with Paystack
        const response = await fetch(`${this.paystackBaseUrl}/transaction/verify/${reference}`, {
            headers: {
                'Authorization': `Bearer ${this.paystackSecretKey}`,
            }
        });

        const data = await response.json();

        if (!data.status) {
            throw new Error(data.message || 'Failed to verify payment');
        }

        const transaction = data.data;

        // Find the student payment record
        const studentPayment = await this.studentPaymentModel.findOne({ reference });
        if (!studentPayment) {
            throw new Error('Payment record not found');
        }

        // Update payment status based on Paystack response
        if (transaction.status === 'success') {
            studentPayment.status = PaymentStatus.SUCCESSFUL;
            studentPayment.remarks = 'Payment successful and verified';
            studentPayment.paidAt = new Date();
            studentPayment.method = studentPayment.method || PaymentMethod.PAYSTACK;
            studentPayment.channel = transaction.channel;
            studentPayment.fee = transaction.fees ? (transaction.fees / 100) : 0; // Convert from kobo to naira
            studentPayment.gatewayId = transaction.id;
            studentPayment.authorizationCode = transaction.authorization?.authorization_code;

            await studentPayment.save();

            // Update application stage after successful payment
            await this.updateApplicationStageAfterPayment(studentPayment.userId, studentPayment.paymentId);

        } else {
            studentPayment.status = PaymentStatus.FAILED;
            studentPayment.remarks = `Payment failed: ${transaction.gateway_response}`;
            await studentPayment.save();
        }

        return {
            status: transaction.status,
            reference: transaction.reference,
            amount: transaction.amount,
            channel: transaction.channel,
            paid_at: transaction.paid_at,
            gateway_response: transaction.gateway_response
        };
    }

    /**
     * Update application stage after successful payment
     */
    private async updateApplicationStageAfterPayment(userId: Types.ObjectId, paymentId: Types.ObjectId): Promise<void> {
        try {
            // Get payment details to determine what stage to advance to
            const payment = await this.paymentModel.findById(paymentId);
            if (!payment) {
                this.logger.log('Payment not found for stage progression');
                return;
            }

            // Get user's application
            const application = await this.applicationModel.findOne({ userId });
            if (!application) {
                this.logger.log('Application not found for user:', userId);
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

            if (nextStage && nextStage > application.currentStage) {
                application.currentStage = nextStage;
                await application.save();

                this.logger.log(`Advanced application stage to ${nextStage} after ${payment.paymentCode} payment for user ${userId}`);

                // If this is the final payment (school fee), trigger application completion
                if (payment.paymentCode === 'schoolFee' && nextStage === 10) {
                    await this.completeApplicationProcess(userId, application);
                }
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
        const thirtyMinutesAgo = new Date(Date.now() - (30 * 60 * 1000));

        const result = await this.studentPaymentModel.updateMany(
            {
                status: PaymentStatus.PENDING,
                $or: [
                    { method: PaymentMethod.PAYSTACK },
                    { method: { $exists: false } },
                ],
                createdAt: { $lt: thirtyMinutesAgo }
            },
            {
                $set: {
                    status: PaymentStatus.FAILED,
                    remarks: 'Payment timed out - user did not complete payment within 30 minutes'
                }
            }
        );

        this.logger.log(`Marked ${result.modifiedCount} abandoned payments as failed`);
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

            const matriculationNumber = await this.matriculationService.generateMatriculationNumber(
                programId.toString(),
                academicSessionId.toString(),
            );

            // Update application with matriculation number and completion status
            fullApplication.matriculationNumber = matriculationNumber;
            fullApplication.status = ApplicationStatus.COMPLETED;
            fullApplication.currentStage = 10; // Set to final stage
            await fullApplication.save();

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
                        academicSession: academicSessionId
                    });

                    const newStudent = new this.studentModel({
                        userId: normalizedUserId,
                        applicationId: normalizedApplicationId,
                        matriculationNumber: matriculationNumber,
                        programId: fullApplication.programId,
                        admissionYear: admissionYear,
                        academicSession: academicSessionId, // Store ObjectId reference
                        status: 'active',
                        currentLevel: 1,
                        currentSemester: 1,
                        cumulativeGPA: 0.0,
                        isActive: true,
                        profileImageUrl: fullApplication.profileImageUrl // Copy profile image from application
                    });

                    await newStudent.save();
                    this.logger.log('✅ Student record created successfully:', newStudent._id);
                } else {
                    existingStudent.userId = normalizedUserId;
                    existingStudent.applicationId = normalizedApplicationId;
                    existingStudent.matriculationNumber = matriculationNumber;
                    existingStudent.programId = fullApplication.programId;
                    existingStudent.admissionYear = admissionYear;
                    existingStudent.academicSession = academicSessionId;
                    existingStudent.profileImageUrl = fullApplication.profileImageUrl;
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
                if (user.role === UserRole.APPLICANT) {
                    this.logger.log('Updating user role from APPLICANT to STUDENT...');
                    user.role = UserRole.STUDENT;
                    await user.save();
                    this.logger.log('✅ User role updated from APPLICANT to STUDENT:', user._id);
                } else {
                    this.logger.log('User role already set to:', user.role);
                }
            } catch (userError) {
                this.logger.error('❌ Error updating user role:', userError);
                throw userError;
            }

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
            // Check if payment is being used by any student payments
            const studentPaymentCount = await this.studentPaymentModel.countDocuments({
                paymentId: id
            });

            if (studentPaymentCount > 0) {
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
     * Get student payments statistics for staff dashboard
     */
    async getStudentPaymentsStats(filters: {
        academicSessionId?: string;
        status?: PaymentStatus;
        page?: number;
        limit?: number;
    } = {}) {
        try {
            const {
                academicSessionId,
                status = PaymentStatus.SUCCESSFUL,
                page = 1,
                limit = 1000
            } = filters;

            // Build query for successful payments
            const query: any = { status };

            // If academic session is specified, filter by users in that session
            let userIds: Types.ObjectId[] = [];
            if (academicSessionId) {
                const applications = await this.applicationModel
                    .find({ academicSessionId: new Types.ObjectId(academicSessionId) })
                    .select('userId')
                    .lean();

                userIds = applications.map(app => app.userId);
                query.userId = { $in: userIds };
            }

            // Get student payments with pagination
            const studentPayments = await this.studentPaymentModel
                .find(query)
                .populate('paymentId', 'name description amount')
                .populate('userId', 'firstName lastName email')
                .sort({ paidAt: -1 })
                .limit(limit)
                .skip((page - 1) * limit)
                .lean();

            // Calculate total revenue
            const totalRevenue = await this.studentPaymentModel.aggregate([
                { $match: query },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);

            // Get count for pagination
            const totalCount = await this.studentPaymentModel.countDocuments(query);

            const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

            return {
                payments: studentPayments,
                totalRevenue: revenue,
                totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            };
        } catch (error) {
            this.logger.error('Error getting student payments stats:', error);
            throw error;
        }
    }

    async getStudentPaymentsForManagement(filters: {
        page?: number;
        limit?: number;
        search?: string;
        date?: string;
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
                        $ifNull: ['$application.applicationNumber', '$studentApplication.applicationNumber'],
                    },
                    matriculationNumber: {
                        $ifNull: [
                            '$student.matriculationNumber',
                            {
                                $ifNull: ['$application.matriculationNumber', '$studentApplication.matriculationNumber'],
                            },
                        ],
                    },
                    userName: {
                        $trim: {
                            input: {
                                $concat: [
                                    { $ifNull: ['$user.firstName', ''] },
                                    ' ',
                                    { $ifNull: ['$user.otherName', ''] },
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

        if (filters.date) {
            const start = new Date(filters.date);
            if (Number.isNaN(start.getTime())) {
                throw new Error('Invalid date filter');
            }

            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(end.getDate() + 1);

            pipeline.push({
                $match: {
                    effectivePaidAt: {
                        $gte: start,
                        $lt: end,
                    },
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
                            receiptOriginalName: 1,
                            receiptUploadedAt: 1,
                            verificationRemarks: 1,
                            remarks: 1,
                            channel: 1,
                        },
                    },
                ],
                totalCount: [
                    { $count: 'count' },
                ],
            },
        });

        const [result] = await this.studentPaymentModel.aggregate(pipeline);

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

    // Student Portal Specific Methods

    async getStudentPaymentsSummaryWithSession(userId: string, academicSessionId?: string): Promise<StudentPaymentsSummary> {
        const userObjectId = new Types.ObjectId(userId);

        // Get user to verify they exist
        const user = await this.userModel.findById(userObjectId).lean();
        if (!user) {
            throw new Error('User not found');
        }

        const canAccessSelectedSession = await this.canStudentAccessAcademicSession(userId, academicSessionId);
        if (!canAccessSelectedSession) {
            return {
                paidFees: [],
                pendingFees: [],
                unpaidFees: [],
                totalPaid: 0,
                totalPending: 0,
                totalUnpaid: 0,
                availableMethods: {
                    paystackEnabled: false,
                    manualTransferEnabled: false,
                },
            };
        }

        const availableMethods = await this.getPaymentMethodAvailability('student-portal', academicSessionId);

        // Get student's successful payments for this session
        let studentPaymentQuery: any = {
            userId: userObjectId,
            status: { $in: [PaymentStatus.SUCCESSFUL, PaymentStatus.PENDING] }
        };

        if (academicSessionId) {
            studentPaymentQuery.academicSessionId = new Types.ObjectId(academicSessionId);
        }

        const studentPayments = await this.studentPaymentModel
            .find(studentPaymentQuery)
            .populate('paymentId')
            .lean();

        // Get currently active payments for unpaid calculation (filtered by session controls)
        let unpaidPaymentsQuery: any = {
            active: true,
            targetAudience: { $in: [PaymentAudience.STUDENT] }
        };

        // Filter unpaid payments by session controls if academic session is provided
        if (academicSessionId) {
            const sessionControls = await this.getActivePaymentsForSession(academicSessionId);
            if (sessionControls.payments.length > 0) {
                unpaidPaymentsQuery._id = { $in: sessionControls.payments.map(p => new Types.ObjectId(p)) };
            } else {
                unpaidPaymentsQuery = null; // No active payments for this session
            }
        }

        const activePaymentsForUnpaid = unpaidPaymentsQuery ? await this.paymentModel.find(unpaidPaymentsQuery).lean() : [];

        const destinationAccountsMap = await this.getDestinationAccountsMap(
            [
                ...studentPayments.flatMap((studentPayment: any) => {
                    const payment = studentPayment.paymentId as any;
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

        studentPayments.forEach((studentPayment: any) => {
            const linkedPaymentId = studentPayment.paymentId?._id?.toString();
            if (!linkedPaymentId) {
                return;
            }

            if (studentPayment.status === PaymentStatus.SUCCESSFUL) {
                successfulPaymentsById.set(linkedPaymentId, studentPayment);
                return;
            }

            if (this.isManualTransferPending(studentPayment)) {
                const existingPending = pendingManualPaymentsById.get(linkedPaymentId);
                if (!existingPending || new Date(studentPayment.createdAt || 0).getTime() > new Date(existingPending.createdAt || 0).getTime()) {
                    pendingManualPaymentsById.set(linkedPaymentId, studentPayment);
                }
            }
        });

        // First, add all paid fees from student payments (even if payment is no longer active)
        studentPayments.forEach(studentPayment => {
            if (studentPayment.status === PaymentStatus.SUCCESSFUL && studentPayment.paymentId && typeof studentPayment.paymentId === 'object') {
                const payment = studentPayment.paymentId as any; // Type assertion since it's populated
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
                    amount: studentPayment.amount, // Use actual paid amount
                    isPaid: true,
                    paymentCode: payment.paymentCode,
                    paidAt: studentPayment.paidAt,
                    reference: studentPayment.reference,
                    status: studentPayment.status,
                    channel: studentPayment.channel,
                    fee: studentPayment.fee,
                    method: studentPayment.method,
                    remarks: studentPayment.remarks,
                    receiptUrl: studentPayment.receiptUrl,
                    receiptOriginalName: studentPayment.receiptOriginalName,
                    receiptUploadedAt: studentPayment.receiptUploadedAt,
                    manualTransferDetails,
                    paystackDestinationAccount,
                    manualTransferDestinationAccount,
                });
            }
        });

        Array.from(pendingManualPaymentsById.values()).forEach((studentPayment: any) => {
            if (studentPayment.paymentId && typeof studentPayment.paymentId === 'object') {
                const payment = studentPayment.paymentId as any;
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
                    amount: studentPayment.amount,
                    isPaid: false,
                    paymentCode: payment.paymentCode,
                    paidAt: studentPayment.paidAt,
                    reference: studentPayment.reference,
                    status: studentPayment.status,
                    channel: studentPayment.channel,
                    method: studentPayment.method,
                    remarks: studentPayment.remarks,
                    receiptUrl: studentPayment.receiptUrl,
                    receiptOriginalName: studentPayment.receiptOriginalName,
                    receiptUploadedAt: studentPayment.receiptUploadedAt,
                    manualTransferDetails,
                    paystackDestinationAccount,
                    manualTransferDestinationAccount,
                });
            }
        });

        // Then, add unpaid fees from currently active payments
        activePaymentsForUnpaid.forEach(payment => {
            const paymentId = payment._id.toString();
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

    async getStudentPaymentHistory(
        userId: string,
        academicSessionId?: string,
        options: { page?: number; limit?: number } = {}
    ) {
        const { page = 1, limit = 10 } = options;
        const userObjectId = new Types.ObjectId(userId);

        const canAccessSelectedSession = await this.canStudentAccessAcademicSession(userId, academicSessionId);
        if (!canAccessSelectedSession) {
            return {
                payments: [],
                totalPaid: 0,
                pagination: {
                    page,
                    limit,
                    totalCount: 0,
                    totalPages: 0,
                }
            };
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
        const payments = await this.studentPaymentModel
            .find(query)
            .populate('paymentId', 'name description amount paymentCode')
            .populate('academicSessionId', 'sessionYear')
            .sort({ paidAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .lean();

        // Get total count for pagination
        const totalCount = await this.studentPaymentModel.countDocuments(query);

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

        const payments = await this.studentPaymentModel
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
            failedCount: mappedPayments.filter(payment => payment.status === PaymentStatus.FAILED).length,
            cancelledCount: mappedPayments.filter(payment => payment.status === PaymentStatus.CANCELLED).length,
        };
    }

    async initializeStudentPayment(
        userId: string,
        paymentId: string,
        email: string,
        academicSessionId?: string
    ): Promise<PaystackInitializeResponse> {
        if (academicSessionId) {
            const canAccessSelectedSession = await this.canStudentAccessAcademicSession(userId, academicSessionId);
            if (!canAccessSelectedSession) {
                throw new Error('Selected academic session is not available for this student');
            }
        }

        // Check if payment is available for the academic session
        if (academicSessionId) {
            const isAvailable = await this.isPaymentAvailableForSession(paymentId, academicSessionId);
            if (!isAvailable) {
                throw new Error('Payment is not available for the selected academic session');
            }
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
            academicSessionId,
        );

        await this.assertAccommodationPaymentEligibility(userId, payment);

        const linkedApplication = await this.resolveLinkedApplication(userId);

        // Generate unique reference
        const reference = this.buildPaymentReference();

        // Create student payment record
        const studentPayment = new this.studentPaymentModel({
            userId: new Types.ObjectId(userId),
            applicationId: linkedApplication.applicationId,
            paymentId: new Types.ObjectId(paymentId),
            academicSessionId: academicSessionId ? new Types.ObjectId(academicSessionId) : undefined,
            amount: payment.amount,
            reference: reference,
            status: PaymentStatus.PENDING,
            method: PaymentMethod.PAYSTACK,
            remarks: 'Payment initialized - awaiting user action',
            ...this.buildDestinationSnapshot(paystackDestinationAccount),
        });

        await studentPayment.save();

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

        if (options.context === 'student-portal') {
            const canAccessSelectedSession = await this.canStudentAccessAcademicSession(userId, options.academicSessionId);
            if (!canAccessSelectedSession) {
                throw new Error('Selected academic session is not available for this student');
            }

            if (!options.academicSessionId) {
                throw new Error('Academic session is required for student payments');
            }

            const isAvailable = await this.isPaymentAvailableForSession(paymentId, options.academicSessionId);
            if (!isAvailable) {
                throw new Error('Payment is not available for the selected academic session');
            }

            await this.assertAccommodationPaymentEligibility(userId, payment);
        }

        const linkedApplication = await this.resolveLinkedApplication(userId);
        if (!linkedApplication.applicationNumber) {
            throw new Error('Application record not found for receipt storage');
        }

        const manualTransferDestinationAccount = await this.resolveDestinationForPayment(
            payment,
            PaymentDestinationChannelType.MANUAL_TRANSFER,
        );

        await this.assertPaymentMethodEnabled(
            PaymentMethod.MANUAL_TRANSFER,
            options.context,
            options.context === 'student-portal'
                ? options.academicSessionId
                : linkedApplication.academicSessionId,
        );

        const successQuery: any = {
            userId: new Types.ObjectId(userId),
            paymentId: new Types.ObjectId(paymentId),
            status: PaymentStatus.SUCCESSFUL,
        };

        if (options.academicSessionId) {
            successQuery.academicSessionId = new Types.ObjectId(options.academicSessionId);
        }

        const existingSuccessfulPayment = await this.studentPaymentModel.findOne(successQuery);
        if (existingSuccessfulPayment) {
            throw new Error('Payment has already been completed successfully for this charge');
        }

        const pendingManualPaymentQuery: any = {
            userId: new Types.ObjectId(userId),
            paymentId: new Types.ObjectId(paymentId),
            method: PaymentMethod.MANUAL_TRANSFER,
            status: PaymentStatus.PENDING,
        };

        if (options.academicSessionId) {
            pendingManualPaymentQuery.academicSessionId = new Types.ObjectId(options.academicSessionId);
        }

        const pendingManualPayment = await this.studentPaymentModel.findOne(pendingManualPaymentQuery);

        if (pendingManualPayment) {
            throw new Error('A manual transfer receipt has already been submitted for this payment and is awaiting staff verification');
        }

        const receiptUpload = await this.uploadService.uploadPaymentReceipt(
            file,
            linkedApplication.applicationNumber,
            payment.name,
        );

        const studentPayment = await this.studentPaymentModel.create({
            userId: new Types.ObjectId(userId),
            applicationId: linkedApplication.applicationId,
            academicSessionId: options.academicSessionId
                ? new Types.ObjectId(options.academicSessionId)
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
            id: studentPayment._id.toString(),
            reference: studentPayment.reference,
            amount: studentPayment.amount,
            status: studentPayment.status,
            method: studentPayment.method,
            remarks: studentPayment.remarks,
            receiptUrl: studentPayment.receiptUrl,
            receiptOriginalName: studentPayment.receiptOriginalName,
            receiptUploadedAt: studentPayment.receiptUploadedAt,
        };
    }

    async verifyManualTransferPayment(studentPaymentId: string, staffId: string, remarks?: string) {
        if (!Types.ObjectId.isValid(studentPaymentId)) {
            throw new Error('Invalid payment record ID');
        }

        const studentPayment = await this.studentPaymentModel.findById(studentPaymentId);
        if (!studentPayment) {
            throw new Error('Payment record not found');
        }

        if (studentPayment.method !== PaymentMethod.MANUAL_TRANSFER) {
            throw new Error('Only manual transfer payments can be verified here');
        }

        if (studentPayment.status !== PaymentStatus.PENDING) {
            throw new Error('Only pending manual transfer payments can be verified');
        }

        const duplicateSuccessQuery: any = {
            _id: { $ne: studentPayment._id },
            userId: studentPayment.userId,
            paymentId: studentPayment.paymentId,
            status: PaymentStatus.SUCCESSFUL,
        };

        if (studentPayment.academicSessionId) {
            duplicateSuccessQuery.academicSessionId = studentPayment.academicSessionId;
        }

        const existingSuccessfulPayment = await this.studentPaymentModel.findOne(duplicateSuccessQuery);
        if (existingSuccessfulPayment) {
            throw new Error('A successful payment already exists for this charge');
        }

        studentPayment.status = PaymentStatus.SUCCESSFUL;
        studentPayment.remarks = 'Payment successful and verified by staff';
        studentPayment.verificationRemarks = remarks || 'Manual transfer verified by staff';
        studentPayment.verifiedBy = new Types.ObjectId(staffId);
        studentPayment.verifiedAt = new Date();

        await studentPayment.save();
        await this.updateApplicationStageAfterPayment(studentPayment.userId, studentPayment.paymentId);

        return {
            id: studentPayment._id.toString(),
            reference: studentPayment.reference,
            status: studentPayment.status,
            remarks: studentPayment.remarks,
            verificationRemarks: studentPayment.verificationRemarks,
            verifiedAt: studentPayment.verifiedAt,
        };
    }

    async rejectManualTransferPayment(studentPaymentId: string, staffId: string, remarks?: string) {
        if (!Types.ObjectId.isValid(studentPaymentId)) {
            throw new Error('Invalid payment record ID');
        }

        const studentPayment = await this.studentPaymentModel.findById(studentPaymentId);
        if (!studentPayment) {
            throw new Error('Payment record not found');
        }

        if (studentPayment.method !== PaymentMethod.MANUAL_TRANSFER) {
            throw new Error('Only manual transfer payments can be rejected here');
        }

        if (studentPayment.status !== PaymentStatus.PENDING) {
            throw new Error('Only pending manual transfer payments can be rejected');
        }

        studentPayment.status = PaymentStatus.FAILED;
        studentPayment.remarks = 'Manual transfer receipt rejected by staff';
        studentPayment.verificationRemarks = remarks || 'Manual transfer rejected by staff';
        studentPayment.rejectedBy = new Types.ObjectId(staffId);
        studentPayment.rejectedAt = new Date();

        await studentPayment.save();

        return {
            id: studentPayment._id.toString(),
            reference: studentPayment.reference,
            status: studentPayment.status,
            remarks: studentPayment.remarks,
            verificationRemarks: studentPayment.verificationRemarks,
            rejectedAt: studentPayment.rejectedAt,
        };
    }

    async getAvailableStudentPayments(userId: string, academicSessionId?: string) {
        // Get user to verify they are a student
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const canAccessSelectedSession = await this.canStudentAccessAcademicSession(userId, academicSessionId);
        if (!canAccessSelectedSession) {
            return [];
        }

        // Get all active payments for students
        let paymentQuery: any = {
            active: true,
            targetAudience: { $in: [PaymentAudience.STUDENT] }
        };

        // If academic session is provided, filter by session controls
        if (academicSessionId) {
            const sessionControls = await this.getActivePaymentsForSession(academicSessionId);
            if (sessionControls.payments.length > 0) {
                paymentQuery._id = { $in: sessionControls.payments.map(p => new Types.ObjectId(p)) };
            } else {
                return []; // No payments available for this session
            }
        }

        const availablePayments = await this.paymentModel.find(paymentQuery).lean();

        // Get already paid payments by this user for this session
        let paidQuery: any = {
            userId: new Types.ObjectId(userId),
            status: PaymentStatus.SUCCESSFUL
        };

        if (academicSessionId) {
            paidQuery.academicSessionId = new Types.ObjectId(academicSessionId);
        }

        const paidPayments = await this.studentPaymentModel
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
    private async getActivePaymentsForSession(academicSessionId: string): Promise<{
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

            const activePayments = sessionControl.payments
                .filter((p: any) => p.active)
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
    private async isPaymentAvailableForSession(paymentId: string, academicSessionId: string): Promise<boolean> {
        const sessionControls = await this.getActivePaymentsForSession(academicSessionId);
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

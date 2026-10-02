import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
    PaymentFulfilmentStatus,
    ProviderInitializationStatus,
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
import { hasSubmittedApplication } from '../utils/application-lifecycle.util';
import {
    PaymentProviderEvent,
    PaymentProviderEventDocument,
    ProviderEventProcessingStatus,
} from '../schemas/payment-provider-event.schema';
import {
    PaymentReconciliationCase,
    PaymentReconciliationCaseDocument,
    ReconciliationCaseStatus,
    ReconciliationCaseType,
} from '../schemas/payment-reconciliation-case.schema';
import {
    PaymentRefund,
    PaymentRefundDocument,
    PaymentRefundMethod,
    PaymentRefundStatus,
} from '../schemas/payment-refund.schema';
import { PaymentRecoveryRun, PaymentRecoveryRunDocument } from '../schemas/payment-recovery-run.schema';
import { PaymentAuditEvent, PaymentAuditEventDocument } from '../schemas/payment-audit-event.schema';

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
    fulfilmentStatus?: PaymentFulfilmentStatus;
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
        title?: string;
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
    authorization_url?: string;
    access_code?: string;
    reference: string;
    alreadyPaid?: boolean;
    pending?: boolean;
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
        @InjectModel(PaymentProviderEvent.name) private paymentProviderEventModel: Model<PaymentProviderEventDocument>,
        @InjectModel(PaymentReconciliationCase.name) private paymentReconciliationCaseModel: Model<PaymentReconciliationCaseDocument>,
        @InjectModel(PaymentRefund.name) private paymentRefundModel: Model<PaymentRefundDocument>,
        @InjectModel(PaymentRecoveryRun.name) private paymentRecoveryRunModel: Model<PaymentRecoveryRunDocument>,
        @InjectModel(PaymentAuditEvent.name) private paymentAuditEventModel: Model<PaymentAuditEventDocument>,
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

    private buildPaymentObligationKey(params: {
        paymentContext: PaymentContext | string;
        userId: Types.ObjectId | string;
        paymentId: Types.ObjectId | string;
        academicSessionId?: Types.ObjectId | string;
        applicationId?: Types.ObjectId | string;
        accommodationApplicationId?: Types.ObjectId | string;
    }): string {
        const owner = params.accommodationApplicationId
            || params.applicationId
            || params.userId;
        return [
            params.paymentContext,
            owner?.toString(),
            params.academicSessionId?.toString() || 'no-session',
            params.paymentId?.toString(),
        ].join(':');
    }

    private getTransactionObligationKey(paymentTransaction: any): string {
        return this.buildPaymentObligationKey({
            paymentContext: paymentTransaction.paymentContext,
            userId: paymentTransaction.userId,
            paymentId: paymentTransaction.paymentId,
            academicSessionId: paymentTransaction.academicSessionId,
            applicationId: paymentTransaction.applicationId,
            accommodationApplicationId: paymentTransaction.accommodationApplicationId,
        });
    }

    private buildTransactionObligationMatch(paymentTransaction: any): Record<string, unknown> {
        const match: Record<string, unknown> = {
            paymentContext: paymentTransaction.paymentContext,
            userId: paymentTransaction.userId,
            paymentId: paymentTransaction.paymentId,
            academicSessionId: paymentTransaction.academicSessionId,
        };

        if (paymentTransaction.paymentContext === PaymentContext.ACCOMMODATION_APPLICATION) {
            match.accommodationApplicationId = paymentTransaction.accommodationApplicationId;
        } else if (paymentTransaction.paymentContext === PaymentContext.ADMISSION_APPLICATION) {
            match.applicationId = paymentTransaction.applicationId;
        } else if (paymentTransaction.studentId) {
            match.studentId = paymentTransaction.studentId;
        }

        return match;
    }

    private async recordPaymentAudit(params: {
        action: string;
        description: string;
        paymentTransactionId?: Types.ObjectId | string;
        reconciliationCaseId?: Types.ObjectId | string;
        refundId?: Types.ObjectId | string;
        actorId?: Types.ObjectId | string;
        actorType?: 'system' | 'staff' | 'provider';
        metadata?: Record<string, unknown>;
    }) {
        await this.paymentAuditEventModel.create({
            ...params,
            paymentTransactionId: params.paymentTransactionId
                ? new Types.ObjectId(params.paymentTransactionId.toString())
                : undefined,
            reconciliationCaseId: params.reconciliationCaseId
                ? new Types.ObjectId(params.reconciliationCaseId.toString())
                : undefined,
            refundId: params.refundId ? new Types.ObjectId(params.refundId.toString()) : undefined,
            actorId: params.actorId ? new Types.ObjectId(params.actorId.toString()) : undefined,
            actorType: params.actorType || 'system',
        });
    }

    private validatePaystackTransaction(paymentTransaction: any, transaction: any): string[] {
        const mismatches: string[] = [];
        if (String(transaction?.reference || '') !== String(paymentTransaction.reference || '')) {
            mismatches.push('reference');
        }
        const providerAmountKobo = this.getPaystackRequestedAmountKobo(transaction);
        const expectedAmountKobo = Math.round(Number(paymentTransaction.amount) * 100);
        if (
            !Number.isFinite(providerAmountKobo)
            || !Number.isFinite(expectedAmountKobo)
            || providerAmountKobo !== expectedAmountKobo
        ) {
            mismatches.push('amount');
        }
        if (String(transaction?.currency || '').toUpperCase() !== 'NGN') {
            mismatches.push('currency');
        }

        const metadata = transaction?.metadata || {};
        const strictMetadata = paymentTransaction.providerInitializationStatus === ProviderInitializationStatus.INITIALIZED;
        if (strictMetadata) {
            if (String(metadata.paymentTransactionId || '') !== paymentTransaction._id?.toString()) {
                mismatches.push('metadata.paymentTransactionId');
            }
            if (String(metadata.userId || '') !== paymentTransaction.userId?.toString()) {
                mismatches.push('metadata.userId');
            }
            if (String(metadata.paymentId || '') !== paymentTransaction.paymentId?.toString()) {
                mismatches.push('metadata.paymentId');
            }
        }
        return mismatches;
    }

    private getPaystackRequestedAmountKobo(transaction: any): number {
        const requestedAmount = Number(transaction?.requested_amount);
        if (Number.isFinite(requestedAmount) && requestedAmount > 0) {
            return Math.round(requestedAmount);
        }

        const grossAmount = Number(transaction?.amount);
        return Number.isFinite(grossAmount) ? Math.round(grossAmount) : Number.NaN;
    }

    private getPaystackRequestedAmountNaira(transaction: any): number {
        return this.getPaystackRequestedAmountKobo(transaction) / 100;
    }

    private sanitizePaystackPayload(data: any): Record<string, unknown> {
        return {
            id: data?.id?.toString(),
            reference: data?.reference,
            transactionReference: data?.transaction_reference || data?.transaction?.reference,
            status: data?.status,
            amount: data?.amount,
            requestedAmount: data?.requested_amount,
            fees: data?.fees,
            currency: data?.currency,
            channel: data?.channel,
            paidAt: data?.paid_at,
            gatewayResponse: data?.gateway_response,
            customer: data?.customer ? {
                email: data.customer.email,
                customerCode: data.customer.customer_code,
            } : undefined,
            metadata: data?.metadata,
        };
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
        metadata?: Record<string, unknown>;
    }) {
        const payload: Record<string, unknown> = {
            email: params.email,
            amount: params.amount * 100,
            reference: params.reference,
            metadata: {
                userId: params.userId,
                paymentId: params.paymentId,
                paymentName: params.paymentName,
                ...params.metadata,
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
                .select('_id applicationNumber entryAcademicSession status admissionDecision submittedAt auditTrail profileImageUrl documents examinations referees academicBackground')
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
                applicationFormSubmitted: hasSubmittedApplication(selectedApplication as any),
            };
        }

        const directApplication = await this.applicationModel
            .findOne({ userId: userObjectId })
            .select('_id applicationNumber entryAcademicSession status admissionDecision submittedAt auditTrail profileImageUrl documents examinations referees academicBackground')
            .lean();

        if (directApplication) {
            return {
                applicationId: directApplication._id as Types.ObjectId,
                applicationNumber: directApplication.applicationNumber,
                academicSessionId: directApplication.entryAcademicSession as Types.ObjectId,
                status: directApplication.status,
                admissionDecision: directApplication.admissionDecision,
                applicationFormSubmitted: hasSubmittedApplication(directApplication as any),
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
        applicationFormSubmitted?: boolean;
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

        if (linkedApplication.applicationFormSubmitted) {
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
                return {
                    reference: existingSuccessfulPayment.reference,
                    alreadyPaid: true,
                };
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

            // Verify the latest attempt before deciding whether a new attempt is safe.
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

            if (existingAttempt) {
                this.logger.log('Found existing payment attempt:', {
                    status: existingAttempt.status,
                    reference: existingAttempt.reference,
                    createdAt: existingAttempt.createdAt
                });

                const transaction = await this.verifyPaystackTransaction(existingAttempt.reference);
                await this.applyPaystackTransactionState(existingAttempt, transaction);

                if (existingAttempt.status === PaymentStatus.SUCCESSFUL) {
                    return {
                        reference: existingAttempt.reference,
                        alreadyPaid: true,
                    };
                }

                if (existingAttempt.status !== PaymentStatus.FAILED) {
                    return {
                        reference: existingAttempt.reference,
                        pending: true,
                    };
                }

            }

            const reference = this.buildPaymentReference();
            const obligationKey = this.buildPaymentObligationKey({
                paymentContext: PaymentContext.ADMISSION_APPLICATION,
                userId,
                applicationId: linkedApplication.applicationId,
                academicSessionId: linkedApplication.academicSessionId,
                paymentId,
            });
            const activeAttemptKey = `active:${obligationKey}`;
            let attempt: any;
            try {
                attempt = await this.paymentTransactionModel.create({
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
                    providerInitializationStatus: ProviderInitializationStatus.CREATED,
                    activeAttemptKey,
                    fulfilmentStatus: PaymentFulfilmentStatus.UNAPPLIED,
                    remarks: existingAttempt
                        ? 'Payment retry created - awaiting Paystack initialization'
                        : 'Payment created - awaiting Paystack initialization',
                    retryCount: existingAttempt ? (existingAttempt.retryCount || 0) + 1 : 0,
                    ...this.buildDestinationSnapshot(paystackDestinationAccount),
                });
            } catch (error: any) {
                if (error?.code === 11000) {
                    const active = await this.paymentTransactionModel.findOne({ activeAttemptKey });
                    return { reference: active?.reference || reference, pending: true };
                }
                throw error;
            }

            try {
                const paystackData = await this.createPaystackTransaction(
                    payment,
                    email,
                    reference,
                    userId,
                    paymentId,
                    paystackDestinationAccount,
                    undefined,
                    {
                        paymentTransactionId: attempt._id?.toString(),
                        applicationId: linkedApplication.applicationId?.toString(),
                        academicSessionId: linkedApplication.academicSessionId?.toString(),
                        paymentContext: PaymentContext.ADMISSION_APPLICATION,
                    },
                );
                attempt.accessCode = paystackData.data.access_code;
                attempt.providerInitializationStatus = ProviderInitializationStatus.INITIALIZED;
                attempt.remarks = existingAttempt
                    ? 'Payment retry initialized - awaiting user action'
                    : 'Payment initialized - awaiting user action';
                if (typeof attempt.save === 'function') await attempt.save();
                return {
                    authorization_url: paystackData.data.authorization_url,
                    access_code: paystackData.data.access_code,
                    reference,
                };
            } catch (error: any) {
                attempt.status = PaymentStatus.FAILED;
                attempt.providerInitializationStatus = ProviderInitializationStatus.FAILED;
                attempt.providerInitializationError = error?.message || 'Paystack initialization failed';
                attempt.remarks = `Paystack initialization failed: ${attempt.providerInitializationError}`;
                attempt.activeAttemptKey = undefined;
                if (typeof attempt.save === 'function') await attempt.save();
                throw error;
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
        metadata?: Record<string, unknown>,
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
                metadata,
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
        const wasSuccessful = paymentTransaction.status === PaymentStatus.SUCCESSFUL;

        paymentTransaction.lastVerifiedAt = now;
        paymentTransaction.verificationAttempts = (paymentTransaction.verificationAttempts || 0) + 1;
        paymentTransaction.gatewayStatus = paystackStatus || transaction?.status;
        paymentTransaction.gatewayResponse = transaction?.gateway_response || paymentTransaction.gatewayResponse;

        if (this.isPaystackSuccessStatus(paystackStatus)) {
            const mismatches = this.validatePaystackTransaction(paymentTransaction, transaction);
            const gatewayOwner = transaction?.id
                ? await this.paymentTransactionModel.findOne({
                    _id: { $ne: paymentTransaction._id },
                    gatewayId: transaction.id.toString(),
                }).select('_id')
                : null;
            if (gatewayOwner) mismatches.push('gatewayId');
            if (mismatches.length) {
                paymentTransaction.fulfilmentStatus = PaymentFulfilmentStatus.QUARANTINED;
                paymentTransaction.activeAttemptKey = undefined;
                const amountDetail = mismatches.includes('amount')
                    ? ` (expected NGN ${Number(paymentTransaction.amount).toFixed(2)}, Paystack requested NGN ${this.getPaystackRequestedAmountNaira(transaction).toFixed(2)}, gross NGN ${(Number(transaction?.amount || 0) / 100).toFixed(2)})`
                    : '';
                paymentTransaction.remarks = `Paystack verification quarantined: ${mismatches.join(', ')} mismatch${amountDetail}`;
                await paymentTransaction.save();
                let reconciliationCase = paymentTransaction.reconciliationCaseId
                    ? await this.paymentReconciliationCaseModel.findById(paymentTransaction.reconciliationCaseId)
                    : null;
                if (!reconciliationCase) {
                    reconciliationCase = await this.paymentReconciliationCaseModel.create({
                        type: ReconciliationCaseType.PROVIDER_MISMATCH,
                        status: ReconciliationCaseStatus.OPEN,
                        provider: 'paystack',
                        reference: transaction?.reference || paymentTransaction.reference,
                        providerTransactionId: transaction?.id?.toString(),
                        paymentTransactionId: paymentTransaction._id,
                        userId: paymentTransaction.userId,
                        paymentId: paymentTransaction.paymentId,
                        academicSessionId: paymentTransaction.academicSessionId,
                        amount: this.getPaystackRequestedAmountNaira(transaction),
                        currency: transaction?.currency,
                        reason: `Verification mismatch: ${mismatches.join(', ')}`,
                        providerSnapshot: this.sanitizePaystackPayload(transaction),
                    });
                }
                paymentTransaction.reconciliationCaseId = reconciliationCase._id;
                await paymentTransaction.save();
                return {
                    status: paystackStatus,
                    reference: transaction.reference,
                    amount: transaction.amount,
                    quarantined: true,
                    mismatches,
                };
            }

            if (paymentTransaction.fulfilmentStatus === PaymentFulfilmentStatus.QUARANTINED) {
                paymentTransaction.fulfilmentStatus = PaymentFulfilmentStatus.UNAPPLIED;
                if (paymentTransaction.reconciliationCaseId) {
                    await this.paymentReconciliationCaseModel.updateOne(
                        { _id: paymentTransaction.reconciliationCaseId },
                        {
                            $set: {
                                status: ReconciliationCaseStatus.RESOLVED,
                                resolvedAt: now,
                                resolution: 'Transaction passed Paystack verification after recheck',
                            },
                        },
                    );
                }
            }

            paymentTransaction.status = PaymentStatus.SUCCESSFUL;
            paymentTransaction.remarks = 'Payment successful and verified';
            paymentTransaction.paidAt = transaction?.paid_at ? new Date(transaction.paid_at) : (paymentTransaction.paidAt || now);
            paymentTransaction.method = paymentTransaction.method || PaymentMethod.PAYSTACK;
            paymentTransaction.channel = transaction.channel;
            paymentTransaction.fee = transaction.fees ? (transaction.fees / 100) : (paymentTransaction.fee || 0);
            paymentTransaction.gatewayId = transaction.id;
            paymentTransaction.authorizationCode = transaction.authorization?.authorization_code;
            paymentTransaction.activeAttemptKey = undefined;

            if (
                !paymentTransaction.fulfilmentStatus
                || paymentTransaction.fulfilmentStatus === PaymentFulfilmentStatus.UNAPPLIED
            ) {
                const obligationKey = this.getTransactionObligationKey(paymentTransaction);
                const appliedTransaction = await this.paymentTransactionModel.findOne({
                    _id: { $ne: paymentTransaction._id },
                    status: PaymentStatus.SUCCESSFUL,
                    $and: [
                        {
                            $or: [
                                { fulfilmentStatus: PaymentFulfilmentStatus.APPLIED },
                                { fulfilmentStatus: { $exists: false } },
                            ],
                        },
                        {
                            $or: [
                                { fulfilledObligationKey: obligationKey },
                                {
                                    fulfilledObligationKey: { $exists: false },
                                    ...this.buildTransactionObligationMatch(paymentTransaction),
                                },
                            ],
                        },
                    ],
                }).sort({ paidAt: 1, createdAt: 1 });

                if (appliedTransaction) {
                    paymentTransaction.fulfilmentStatus = PaymentFulfilmentStatus.DUPLICATE;
                    paymentTransaction.duplicateOfTransactionId = appliedTransaction._id;
                    const duplicateCase = await this.paymentReconciliationCaseModel.create({
                        type: ReconciliationCaseType.REFUND_RECOMMENDED,
                        status: ReconciliationCaseStatus.OPEN,
                        provider: 'paystack',
                        reference: paymentTransaction.reference,
                        providerTransactionId: transaction?.id?.toString(),
                        paymentTransactionId: paymentTransaction._id,
                        appliedTransactionId: appliedTransaction._id,
                        userId: paymentTransaction.userId,
                        paymentId: paymentTransaction.paymentId,
                        academicSessionId: paymentTransaction.academicSessionId,
                        amount: paymentTransaction.amount,
                        currency: transaction?.currency || 'NGN',
                        reason: 'Another successful transaction already fulfilled this payment obligation',
                        providerSnapshot: this.sanitizePaystackPayload(transaction),
                    });
                    paymentTransaction.reconciliationCaseId = duplicateCase._id;
                } else {
                    paymentTransaction.fulfilmentStatus = PaymentFulfilmentStatus.APPLIED;
                    paymentTransaction.fulfilledObligationKey = obligationKey;
                }
            }

            if (!wasSuccessful) {
                this.markSuccessfulPaystackPaymentAwaitingRemittance(
                    paymentTransaction,
                    this.getPaystackRequestedAmountNaira(transaction) || paymentTransaction.amount,
                );
            }
        } else if (this.isPaystackFailureStatus(paystackStatus)) {
            if (paymentTransaction.status !== PaymentStatus.SUCCESSFUL) {
                paymentTransaction.status = PaymentStatus.FAILED;
                paymentTransaction.activeAttemptKey = undefined;
            }
            const referenceMatches = String(transaction?.reference || '') === String(paymentTransaction.reference || '');
            const gatewayOwner = transaction?.id
                ? await this.paymentTransactionModel.findOne({
                    _id: { $ne: paymentTransaction._id },
                    gatewayId: transaction.id.toString(),
                }).select('_id')
                : null;
            if (referenceMatches && !gatewayOwner && transaction?.id && paymentTransaction.status !== PaymentStatus.SUCCESSFUL) {
                paymentTransaction.gatewayId = transaction.id.toString();
                if (paymentTransaction.fulfilmentStatus === PaymentFulfilmentStatus.QUARANTINED) {
                    paymentTransaction.fulfilmentStatus = PaymentFulfilmentStatus.UNAPPLIED;
                    if (paymentTransaction.reconciliationCaseId) {
                        await this.paymentReconciliationCaseModel.updateOne(
                            { _id: paymentTransaction.reconciliationCaseId },
                            {
                                $set: {
                                    status: ReconciliationCaseStatus.RESOLVED,
                                    resolvedAt: now,
                                    resolution: 'Paystack recheck confirmed this reference was not a successful payment',
                                },
                            },
                        );
                    }
                }
            }
            paymentTransaction.remarks = `Payment ${paystackStatus || 'failed'}: ${transaction.gateway_response || 'Payment was not completed'}`;
        } else {
            if (paymentTransaction.status !== PaymentStatus.SUCCESSFUL) {
                paymentTransaction.status = PaymentStatus.PENDING;
                paymentTransaction.remarks = `Payment ${paystackStatus || 'pending'}: awaiting completion`;
            }
        }

        await paymentTransaction.save();

        if (
            paymentTransaction.status === PaymentStatus.SUCCESSFUL
            && paymentTransaction.fulfilmentStatus === PaymentFulfilmentStatus.APPLIED
        ) {
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

    private async releaseStaleGatewayIdOwner(
        transaction: any,
        actorId?: string,
    ): Promise<{ released: boolean; reason?: string }> {
        if (!transaction?.id || !transaction?.reference) return { released: true };

        const providerTransactionId = transaction.id.toString();
        const owner: any = await this.paymentTransactionModel.findOne({ gatewayId: providerTransactionId });
        if (!owner || String(owner.reference || '') === String(transaction.reference)) {
            return { released: true };
        }
        if (!owner.reference) {
            return { released: false, reason: 'The existing gateway ID owner has no reference to verify' };
        }

        let ownerTransaction: any;
        try {
            ownerTransaction = await this.verifyPaystackTransaction(owner.reference);
        } catch (error: any) {
            return {
                released: false,
                reason: `Could not verify the existing gateway ID owner's reference: ${error?.message || String(error)}`,
            };
        }

        if (
            String(ownerTransaction?.reference || '') !== String(owner.reference)
            || String(ownerTransaction?.id || '') === providerTransactionId
        ) {
            return { released: false, reason: 'Paystack did not confirm that the existing gateway ID link is stale' };
        }

        const previousGatewayId = owner.gatewayId?.toString();
        const ownerState = await this.applyPaystackTransactionState(owner, ownerTransaction);
        const verifiedOwnerGatewayId = ownerTransaction?.id?.toString();
        if (
            verifiedOwnerGatewayId
            && verifiedOwnerGatewayId !== providerTransactionId
            && String(owner.gatewayId || '') === providerTransactionId
        ) {
            const verifiedGatewayOwner = await this.paymentTransactionModel.findOne({
                _id: { $ne: owner._id },
                gatewayId: verifiedOwnerGatewayId,
            }).select('_id');
            if (!verifiedGatewayOwner) {
                owner.gatewayId = verifiedOwnerGatewayId;
                await owner.save();
            }
        }
        const remainingOwner = await this.paymentTransactionModel.findOne({
            _id: { $ne: owner._id },
            gatewayId: providerTransactionId,
        }).select('_id');
        if (remainingOwner || String(owner.gatewayId || '') === providerTransactionId) {
            return { released: false, reason: 'The conflicting gateway ID could not be safely released' };
        }

        await this.recordPaymentAudit({
            action: 'paystack_gateway_id_repaired',
            description: `Corrected stale Paystack gateway ID ownership while recovering ${transaction.reference}`,
            paymentTransactionId: owner._id,
            reconciliationCaseId: owner.reconciliationCaseId,
            actorId,
            actorType: actorId ? 'staff' : 'system',
            metadata: {
                previousGatewayId,
                correctedGatewayId: owner.gatewayId?.toString(),
                providerReference: ownerTransaction.reference,
                providerStatus: this.getPaystackStatus(ownerTransaction),
                quarantined: ownerState?.quarantined || false,
            },
        });

        return { released: true };
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
            fulfilmentStatus: paymentTransaction.fulfilmentStatus,
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
        const olderThanDate = new Date(Date.now() - olderThanMinutes * 60 * 1000);
        const candidates = await this.paymentTransactionModel.find({
            status: { $in: [PaymentStatus.PENDING, PaymentStatus.FAILED] },
            $or: [
                { method: PaymentMethod.PAYSTACK },
                { method: { $exists: false } },
            ],
            $and: [{
                $or: [
                    { status: PaymentStatus.PENDING },
                    { providerInitializationStatus: ProviderInitializationStatus.INITIALIZED },
                    { remarks: /verification|timed out|timeout|network/i },
                ],
            }],
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

            } catch (error) {
                summary.errors += 1;
                this.logger.error(
                    `Failed to reconcile pending Paystack payment ${candidate.reference}: ${error instanceof Error ? error.message : error}`,
                );

                candidate.lastVerifiedAt = new Date();
                candidate.remarks = `Paystack verification unavailable; reconciliation will retry: ${error instanceof Error ? error.message : error}`;
                await candidate.save();
            }
        }

        return summary;
    }

    async acceptPaystackWebhook(
        signature: string | undefined,
        rawBody: Buffer | undefined,
        payload: any,
    ): Promise<{ eventId: string; event: string; reference?: string; duplicate: boolean }> {
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

        const receivedSignature = Buffer.from(signature, 'utf8');
        const expectedSignature = Buffer.from(hash, 'utf8');
        if (
            receivedSignature.length !== expectedSignature.length
            || !crypto.timingSafeEqual(receivedSignature, expectedSignature)
        ) {
            throw new Error('Invalid Paystack webhook signature');
        }

        const event = String(payload?.event || '').toLowerCase();
        const data = payload?.data || {};
        const reference = data.reference || data.transaction_reference || data.transaction?.reference;
        const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
        const idempotencyKey = crypto.createHash('sha256')
            .update([event, data.id || '', reference || '', payloadHash].join(':'))
            .digest('hex');
        const existing = await this.paymentProviderEventModel.findOne({ idempotencyKey });
        if (existing) {
            return { eventId: existing._id.toString(), event, reference, duplicate: true };
        }

        let providerEvent: any;
        try {
            providerEvent = await this.paymentProviderEventModel.create({
                provider: 'paystack',
                eventType: event,
                idempotencyKey,
                reference,
                providerTransactionId: data.id?.toString() || data.transaction?.id?.toString(),
                amount: data.amount ? Number(data.amount) / 100 : undefined,
                currency: data.currency,
                customerEmail: data.customer?.email,
                metadata: data.metadata,
                payload: this.sanitizePaystackPayload(data),
                payloadHash,
                signatureVerified: true,
                processingStatus: ProviderEventProcessingStatus.RECEIVED,
            });
        } catch (error: any) {
            if (error?.code !== 11000) throw error;
            providerEvent = await this.paymentProviderEventModel.findOne({ idempotencyKey });
            if (!providerEvent) throw error;
            return { eventId: providerEvent._id.toString(), event, reference, duplicate: true };
        }

        return { eventId: providerEvent._id.toString(), event, reference, duplicate: false };
    }

    async processStoredPaystackEvent(eventId: string): Promise<void> {
        const providerEvent = await this.paymentProviderEventModel.findById(eventId);
        if (!providerEvent || providerEvent.processingStatus === ProviderEventProcessingStatus.PROCESSED) return;

        providerEvent.processingStatus = ProviderEventProcessingStatus.PROCESSING;
        providerEvent.processingAttempts = Number(providerEvent.processingAttempts || 0) + 1;
        await providerEvent.save();

        try {
            if (providerEvent.eventType.startsWith('refund.')) {
                await this.applyRefundProviderEvent(providerEvent);
                providerEvent.processingStatus = ProviderEventProcessingStatus.PROCESSED;
                providerEvent.processedAt = new Date();
                providerEvent.processingError = undefined;
                await providerEvent.save();
                return;
            }

            if (providerEvent.eventType !== 'charge.success' || !providerEvent.reference) {
                providerEvent.processingStatus = ProviderEventProcessingStatus.PROCESSED;
                providerEvent.processedAt = new Date();
                await providerEvent.save();
                return;
            }

            const paymentTransaction = await this.paymentTransactionModel.findOne({
                reference: providerEvent.reference,
            });
            if (!paymentTransaction) {
                const reconciliationCase = await this.paymentReconciliationCaseModel.create({
                    type: ReconciliationCaseType.UNMATCHED_SUCCESS,
                    status: ReconciliationCaseStatus.OPEN,
                    provider: 'paystack',
                    reference: providerEvent.reference,
                    providerTransactionId: providerEvent.providerTransactionId,
                    amount: providerEvent.amount,
                    currency: providerEvent.currency,
                    reason: 'Paystack reported a successful charge with no local transaction',
                    providerSnapshot: providerEvent.payload,
                });
                providerEvent.reconciliationCaseId = reconciliationCase._id;
                providerEvent.processingStatus = ProviderEventProcessingStatus.UNMATCHED;
                providerEvent.processedAt = new Date();
                await providerEvent.save();
                return;
            }

            const transaction = await this.verifyPaystackTransaction(providerEvent.reference);
            await this.applyPaystackTransactionState(paymentTransaction, transaction);
            providerEvent.paymentTransactionId = paymentTransaction._id;
            providerEvent.reconciliationCaseId = paymentTransaction.reconciliationCaseId;
            providerEvent.processingStatus = paymentTransaction.fulfilmentStatus === PaymentFulfilmentStatus.QUARANTINED
                ? ProviderEventProcessingStatus.QUARANTINED
                : ProviderEventProcessingStatus.PROCESSED;
            providerEvent.processedAt = new Date();
            providerEvent.processingError = undefined;
            await providerEvent.save();
        } catch (error: any) {
            providerEvent.processingStatus = ProviderEventProcessingStatus.FAILED;
            providerEvent.processingError = error?.message || String(error);
            await providerEvent.save();
            throw error;
        }
    }

    private async applyRefundProviderEvent(providerEvent: any): Promise<void> {
        const payload: any = providerEvent.payload || {};
        const providerRefundId = payload.id?.toString() || providerEvent.providerTransactionId;
        const transactionReference = payload.reference || payload.transactionReference || providerEvent.reference;
        const statusMap: Record<string, PaymentRefundStatus> = {
            'refund.pending': PaymentRefundStatus.PENDING,
            'refund.processing': PaymentRefundStatus.PROCESSING,
            'refund.needs-attention': PaymentRefundStatus.NEEDS_ATTENTION,
            'refund.processed': PaymentRefundStatus.PROCESSED,
            'refund.failed': PaymentRefundStatus.FAILED,
        };
        const refund = await this.paymentRefundModel.findOne({
            $or: [
                ...(providerRefundId ? [{ providerRefundId }] : []),
                ...(transactionReference ? [{ providerReference: transactionReference }] : []),
            ],
        });
        if (!refund) {
            throw new Error('Refund webhook could not be matched to a local refund request');
        }
        refund.status = statusMap[providerEvent.eventType] || refund.status;
        refund.providerSnapshot = payload;
        if (refund.status === PaymentRefundStatus.PROCESSED) refund.processedAt = new Date();
        if (refund.status === PaymentRefundStatus.FAILED) {
            refund.failureReason = payload.gatewayResponse || 'Paystack refund failed';
        }
        await refund.save();
        if (refund.status === PaymentRefundStatus.PROCESSED) {
            const transaction = await this.paymentTransactionModel.findById(refund.paymentTransactionId)
                .select('reconciliationCaseId');
            if (transaction?.reconciliationCaseId) {
                await this.paymentReconciliationCaseModel.updateOne(
                    { _id: transaction.reconciliationCaseId },
                    {
                        $set: {
                            status: ReconciliationCaseStatus.RESOLVED,
                            resolvedAt: new Date(),
                            resolution: 'Duplicate payment refund processed by Paystack',
                        },
                    },
                );
            }
        }
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

    private async fetchPaystackTransaction(identifier: string): Promise<any> {
        if (!this.paystackSecretKey) throw new Error('PAYSTACK_SECRET_KEY is not configured');
        const normalized = identifier.trim();
        const path = /^\d+$/.test(normalized)
            ? `transaction/${normalized}`
            : `transaction/verify/${encodeURIComponent(normalized)}`;
        const response = await fetch(`${this.paystackBaseUrl}/${path}`, {
            headers: { Authorization: `Bearer ${this.paystackSecretKey}` },
        });
        const body = await response.json();
        if (!response.ok || !body?.status || !body?.data) {
            throw new Error(body?.message || `Paystack transaction ${normalized} could not be fetched`);
        }
        return body.data;
    }

    private async findRecoveryOwner(transaction: any, academicSessionId: string) {
        const metadata = transaction?.metadata || {};
        let user: any = null;
        if (metadata.userId && Types.ObjectId.isValid(metadata.userId)) {
            user = await this.userModel.findById(metadata.userId).lean();
        }
        if (!user && transaction?.customer?.email) {
            user = await this.userModel.findOne({
                email: String(transaction.customer.email).trim().toLowerCase(),
            }).lean();
        }

        let payment: any = null;
        if (metadata.paymentId && Types.ObjectId.isValid(metadata.paymentId)) {
            payment = await this.paymentModel.findById(metadata.paymentId).lean();
        }
        if (!payment) {
            const amount = this.getPaystackRequestedAmountNaira(transaction);
            const matches = await this.paymentModel.find({ amount }).limit(3).lean();
            if (matches.length === 1) payment = matches[0];
        }

        if (!user || !payment) return { user, payment, application: null, student: null, academicSessionId: undefined, confidence: 'low' };
        const metadataApplicationId = metadata.applicationId && Types.ObjectId.isValid(metadata.applicationId)
            ? new Types.ObjectId(metadata.applicationId)
            : null;
        let application: any = metadataApplicationId
            ? await this.applicationModel.findOne({ _id: metadataApplicationId, userId: user._id }).lean()
            : null;
        let applicationMatchIsUnambiguous = Boolean(application);
        if (!application && !metadataApplicationId) {
            const userApplications = await this.applicationModel.find({ userId: user._id })
                .select('_id entryAcademicSession')
                .sort({ createdAt: -1 })
                .lean();
            applicationMatchIsUnambiguous = userApplications.length === 1;
            if (applicationMatchIsUnambiguous) application = userApplications[0];
            else {
                const selectedSessionId = new Types.ObjectId(academicSessionId);
                const sessionMatches = userApplications.filter((candidate: any) =>
                    candidate.entryAcademicSession?.toString() === selectedSessionId.toString(),
                );
                if (sessionMatches.length === 1) application = sessionMatches[0];
            }
        }
        const metadataSessionId = metadata.academicSessionId && Types.ObjectId.isValid(metadata.academicSessionId)
            ? new Types.ObjectId(metadata.academicSessionId)
            : null;
        const applicationSessionId = application?.entryAcademicSession;
        const linkedSessionId = applicationSessionId || metadataSessionId
            || (applicationMatchIsUnambiguous ? new Types.ObjectId(academicSessionId) : undefined);
        const student = await this.studentModel.findOne({ userId: user._id }).lean();
        const metadataExact = metadata.userId?.toString() === user._id.toString()
            && metadata.paymentId?.toString() === payment._id.toString();
        const metadataSessionConflict = Boolean(
            application && metadataSessionId && applicationSessionId
            && metadataSessionId.toString() !== applicationSessionId.toString(),
        );
        const applicationIdMatchesMetadata = Boolean(application && metadataApplicationId
            && application._id.toString() === metadataApplicationId.toString());
        return {
            user,
            payment,
            application,
            student,
            academicSessionId: linkedSessionId?.toString(),
            confidence: metadataExact && (applicationIdMatchesMetadata || applicationMatchIsUnambiguous
                || (!metadataApplicationId && !application && student && metadataSessionId))
                && !metadataSessionConflict ? 'high' : 'medium',
        };
    }

    async previewPaystackRecovery(params: {
        academicSessionId: string;
        identifiers: string[];
        actorId: string;
    }) {
        if (!Types.ObjectId.isValid(params.academicSessionId)) throw new Error('Select a valid academic session');
        const identifiers = [...new Set((params.identifiers || []).map((value) => String(value).trim()).filter(Boolean))];
        if (!identifiers.length || identifiers.length > 500) {
            throw new Error('Provide between 1 and 500 Paystack references or transaction IDs');
        }

        const results: any[] = [];
        for (const identifier of identifiers) {
            try {
                const transaction = await this.fetchPaystackTransaction(identifier);
                const referenceMatch = await this.paymentTransactionModel.findOne({
                    reference: transaction.reference,
                }).lean();
                const gatewayIdOwner = !referenceMatch && transaction.id
                    ? await this.paymentTransactionModel.findOne({ gatewayId: transaction.id.toString() }).lean()
                    : null;
                const existing = referenceMatch || gatewayIdOwner;
                const owner = await this.findRecoveryOwner(transaction, params.academicSessionId);
                let classification = 'unmatched';
                let appliedTransaction: any = null;
                if (referenceMatch) {
                    classification = existing.status === PaymentStatus.SUCCESSFUL
                        ? 'already_reconciled'
                        : 'recover_existing';
                } else if (gatewayIdOwner) {
                    classification = 'gateway_id_reference_conflict';
                } else if (
                    this.isPaystackSuccessStatus(this.getPaystackStatus(transaction))
                    && owner.user
                    && owner.payment
                    && owner.confidence === 'high'
                ) {
                    const query: any = {
                        userId: owner.user._id,
                        paymentId: owner.payment._id,
                        academicSessionId: owner.academicSessionId
                            ? new Types.ObjectId(owner.academicSessionId)
                            : new Types.ObjectId(params.academicSessionId),
                        ...(owner.application?._id ? { applicationId: owner.application._id } : {}),
                        status: PaymentStatus.SUCCESSFUL,
                    };
                    appliedTransaction = await this.paymentTransactionModel.findOne(query).sort({ paidAt: 1 }).lean();
                    classification = appliedTransaction ? 'duplicate_refund_recommended' : 'recover_and_apply';
                } else if (!this.isPaystackSuccessStatus(this.getPaystackStatus(transaction))) {
                    classification = 'not_successful';
                } else if (owner.user && owner.payment) {
                    classification = 'review_required';
                }

                results.push({
                    identifier,
                    classification,
                    confidence: owner.confidence,
                    provider: this.sanitizePaystackPayload(transaction),
                    existingTransactionId: existing?._id?.toString(),
                    existingReference: existing?.reference,
                    existingMatch: referenceMatch ? 'reference' : (gatewayIdOwner ? 'gateway_id' : undefined),
                    appliedTransactionId: appliedTransaction?._id?.toString(),
                    userId: owner.user?._id?.toString(),
                    userEmail: owner.user?.email || transaction?.customer?.email,
                    paymentId: owner.payment?._id?.toString(),
                    paymentName: owner.payment?.name,
                    applicationId: owner.application?._id?.toString(),
                    studentId: owner.student?._id?.toString(),
                    academicSessionId: owner.academicSessionId,
                });
            } catch (error: any) {
                results.push({ identifier, classification: 'error', error: error?.message || String(error) });
            }
        }

        const runId = `paystack-recovery-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const inputHash = crypto.createHash('sha256')
            .update(JSON.stringify({ academicSessionId: params.academicSessionId, identifiers }))
            .digest('hex');
        const run = await this.paymentRecoveryRunModel.create({
            runId,
            academicSessionId: new Types.ObjectId(params.academicSessionId),
            identifiers,
            inputHash,
            results,
            status: 'previewed',
            createdBy: new Types.ObjectId(params.actorId),
        });
        return this.toRecoveryRunResponse(run);
    }

    async applyPaystackRecovery(params: { runId: string; actorId: string; reason: string }) {
        if (!params.reason?.trim()) throw new Error('A recovery reason is required');
        const run = await this.paymentRecoveryRunModel.findOneAndUpdate(
            { runId: params.runId, status: 'previewed' },
            { $set: { status: 'applying' } },
            { new: true },
        );
        if (!run) {
            const existingRun = await this.paymentRecoveryRunModel.findOne({ runId: params.runId }).lean();
            if (!existingRun) throw new Error('Recovery preview not found');
            throw new Error('This recovery preview is already being applied, has been applied, or has expired');
        }

        const appliedResults: any[] = [];
        for (const preview of run.results as any[]) {
            if (!['recover_existing', 'recover_and_apply', 'duplicate_refund_recommended', 'gateway_id_reference_conflict'].includes(preview.classification)) {
                appliedResults.push({ identifier: preview.identifier, action: 'skipped', classification: preview.classification });
                continue;
            }
            try {
                const transaction = await this.fetchPaystackTransaction(preview.identifier);
                if (!this.isPaystackSuccessStatus(this.getPaystackStatus(transaction))) {
                    appliedResults.push({ identifier: preview.identifier, action: 'skipped', classification: 'no_longer_successful' });
                    continue;
                }

                const gatewayRelease = await this.releaseStaleGatewayIdOwner(transaction, params.actorId);
                if (!gatewayRelease.released) {
                    const reconciliationCase = await this.paymentReconciliationCaseModel.create({
                        type: ReconciliationCaseType.PROVIDER_MISMATCH,
                        status: ReconciliationCaseStatus.OPEN,
                        provider: 'paystack',
                        reference: transaction.reference,
                        providerTransactionId: transaction.id?.toString(),
                        userId: preview.userId ? new Types.ObjectId(preview.userId) : undefined,
                        paymentId: preview.paymentId ? new Types.ObjectId(preview.paymentId) : undefined,
                        academicSessionId: preview.academicSessionId
                            ? new Types.ObjectId(preview.academicSessionId)
                            : run.academicSessionId,
                        amount: this.getPaystackRequestedAmountNaira(transaction),
                        currency: transaction.currency,
                        reason: `Gateway ID ownership conflict: ${gatewayRelease.reason}`,
                        providerSnapshot: this.sanitizePaystackPayload(transaction),
                    });
                    appliedResults.push({
                        identifier: preview.identifier,
                        action: 'quarantined',
                        reason: gatewayRelease.reason,
                        reconciliationCaseId: reconciliationCase._id.toString(),
                    });
                    continue;
                }

                let local = await this.paymentTransactionModel.findOne({ reference: transaction.reference });
                if (!local) {
                    if (!preview.userId || !preview.paymentId || preview.confidence !== 'high') {
                        appliedResults.push({
                            identifier: preview.identifier,
                            action: 'quarantined',
                            reason: 'A high-confidence applicant and payment match is required to create the missing transaction record',
                        });
                        continue;
                    }
                    const paymentContext = preview.applicationId
                        ? PaymentContext.ADMISSION_APPLICATION
                        : PaymentContext.STUDENT_ACCOUNT;
                    local = await this.paymentTransactionModel.create({
                        userId: new Types.ObjectId(preview.userId),
                        applicationId: preview.applicationId ? new Types.ObjectId(preview.applicationId) : undefined,
                        studentId: preview.studentId ? new Types.ObjectId(preview.studentId) : undefined,
                        payerType: preview.applicationId ? PaymentPayerType.APPLICANT : PaymentPayerType.STUDENT,
                        paymentContext,
                        academicSessionId: preview.academicSessionId
                            ? new Types.ObjectId(preview.academicSessionId)
                            : run.academicSessionId,
                        paymentId: new Types.ObjectId(preview.paymentId),
                        amount: this.getPaystackRequestedAmountNaira(transaction),
                        reference: transaction.reference,
                        status: PaymentStatus.PENDING,
                        method: PaymentMethod.PAYSTACK,
                        fulfilmentStatus: PaymentFulfilmentStatus.UNAPPLIED,
                        gatewayId: transaction.id?.toString(),
                        recoveredAt: new Date(),
                        recoverySource: run.runId,
                        remarks: `Recovered from Paystack by historical recovery run ${run.runId}`,
                    });
                }
                const stateResult = await this.applyPaystackTransactionState(local, transaction);
                await this.recordPaymentAudit({
                    action: 'paystack_transaction_recovered',
                    description: `Paystack transaction recovered by ${run.runId}`,
                    paymentTransactionId: local._id,
                    reconciliationCaseId: local.reconciliationCaseId,
                    actorId: params.actorId,
                    actorType: 'staff',
                    metadata: { runId: run.runId, reason: params.reason, classification: local.fulfilmentStatus },
                });
                await this.paymentReconciliationCaseModel.updateMany(
                    {
                        type: ReconciliationCaseType.UNMATCHED_SUCCESS,
                        reference: transaction.reference,
                        status: { $in: [
                            ReconciliationCaseStatus.OPEN,
                            ReconciliationCaseStatus.INVESTIGATING,
                        ] },
                    },
                    {
                        $set: {
                            status: ReconciliationCaseStatus.RESOLVED,
                            paymentTransactionId: local._id,
                            resolvedBy: new Types.ObjectId(params.actorId),
                            resolvedAt: new Date(),
                            resolution: `Matched by historical recovery run ${run.runId}`,
                        },
                    },
                );
                const action = stateResult?.quarantined
                    || local.fulfilmentStatus === PaymentFulfilmentStatus.QUARANTINED
                    ? 'quarantined'
                    : local.status !== PaymentStatus.SUCCESSFUL
                        ? 'not_successful'
                        : local.fulfilmentStatus === PaymentFulfilmentStatus.DUPLICATE
                            ? 'recovered_duplicate'
                            : local.fulfilmentStatus === PaymentFulfilmentStatus.APPLIED
                                ? 'recovered_applied'
                                : 'quarantined';
                appliedResults.push({
                    identifier: preview.identifier,
                    action,
                    reference: transaction.reference,
                    providerStatus: this.getPaystackStatus(transaction),
                    paymentStatus: local.status,
                    fulfilmentStatus: local.fulfilmentStatus,
                    mismatches: stateResult?.mismatches,
                    paymentTransactionId: local._id.toString(),
                });
            } catch (error: any) {
                appliedResults.push({
                    identifier: preview.identifier,
                    action: 'error',
                    error: error?.message || String(error),
                });
            }
        }

        run.status = 'applied';
        run.appliedAt = new Date();
        run.appliedBy = new Types.ObjectId(params.actorId);
        run.reason = params.reason.trim();
        run.results = appliedResults;
        await run.save();
        return this.toRecoveryRunResponse(run);
    }

    private toRecoveryRunResponse(run: any) {
        return {
            runId: run.runId,
            academicSessionId: run.academicSessionId?.toString(),
            status: run.status,
            results: run.results,
            createdAt: run.createdAt,
            appliedAt: run.appliedAt,
        };
    }

    async getReconciliationCases(filters: { status?: string; type?: string; page?: number; limit?: number }) {
        const page = Math.max(1, Number(filters.page || 1));
        const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
        const query: any = {};
        if (filters.status) query.status = filters.status;
        if (filters.type) query.type = filters.type;
        const [cases, total] = await Promise.all([
            this.paymentReconciliationCaseModel.find(query)
                .populate('userId', 'firstName otherName lastName email phone')
                .populate('paymentId', 'name paymentCode amount')
                .populate('paymentTransactionId')
                .populate('appliedTransactionId')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            this.paymentReconciliationCaseModel.countDocuments(query),
        ]);
        return { cases, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
    }

    async resolveReconciliationCase(caseId: string, actorId: string, resolution: string) {
        if (!Types.ObjectId.isValid(caseId)) throw new Error('Invalid reconciliation case');
        if (!resolution?.trim()) throw new Error('A resolution reason is required');
        const reconciliationCase = await this.paymentReconciliationCaseModel.findById(caseId);
        if (!reconciliationCase) throw new Error('Reconciliation case not found');
        reconciliationCase.status = ReconciliationCaseStatus.RESOLVED;
        reconciliationCase.resolution = resolution.trim();
        reconciliationCase.resolvedBy = new Types.ObjectId(actorId);
        reconciliationCase.resolvedAt = new Date();
        await reconciliationCase.save();
        await this.recordPaymentAudit({
            action: 'reconciliation_case_resolved',
            description: resolution.trim(),
            paymentTransactionId: reconciliationCase.paymentTransactionId,
            reconciliationCaseId: reconciliationCase._id,
            actorId,
            actorType: 'staff',
        });
        return reconciliationCase;
    }

    async initiatePaystackRefund(paymentTransactionId: string, actorId: string, reason: string) {
        if (process.env.PAYSTACK_REFUNDS_ENABLED !== 'true') {
            throw new Error('Paystack refunds are disabled by configuration');
        }
        if (!reason?.trim()) throw new Error('A refund reason is required');
        const transaction = await this.paymentTransactionModel.findById(paymentTransactionId);
        if (!transaction) throw new Error('Payment transaction not found');
        if (transaction.method !== PaymentMethod.PAYSTACK || transaction.status !== PaymentStatus.SUCCESSFUL) {
            throw new Error('Only successful Paystack transactions can be refunded');
        }
        if (transaction.fulfilmentStatus !== PaymentFulfilmentStatus.DUPLICATE) {
            throw new Error('Only confirmed duplicate payments can be refunded from this workflow');
        }
        const activeRefund = await this.paymentRefundModel.findOne({
            paymentTransactionId: transaction._id,
            status: { $in: [
                PaymentRefundStatus.REQUESTED,
                PaymentRefundStatus.PENDING,
                PaymentRefundStatus.PROCESSING,
                PaymentRefundStatus.NEEDS_ATTENTION,
                PaymentRefundStatus.PROCESSED,
            ] },
        });
        if (activeRefund) return activeRefund;

        const refund = await this.paymentRefundModel.create({
            paymentTransactionId: transaction._id,
            amount: transaction.amount,
            currency: 'NGN',
            method: PaymentRefundMethod.PAYSTACK,
            status: PaymentRefundStatus.REQUESTED,
            reason: reason.trim(),
            providerReference: transaction.reference,
            requestedBy: new Types.ObjectId(actorId),
            requestedAt: new Date(),
        });

        try {
            const response = await fetch(`${this.paystackBaseUrl}/refund`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.paystackSecretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transaction: transaction.gatewayId || transaction.reference,
                    merchant_note: reason.trim(),
                    customer_note: 'Refund for a duplicate ALECONS payment',
                }),
            });
            const body = await response.json();
            if (!response.ok || !body?.status) throw new Error(body?.message || 'Paystack refund request failed');
            refund.providerRefundId = body.data?.id?.toString();
            refund.status = this.mapPaystackRefundStatus(body.data?.status);
            refund.providerSnapshot = body.data;
            await refund.save();
            if (transaction.reconciliationCaseId) {
                await this.paymentReconciliationCaseModel.updateOne(
                    { _id: transaction.reconciliationCaseId },
                    { $set: { status: ReconciliationCaseStatus.REFUND_PENDING } },
                );
            }
            await this.recordPaymentAudit({
                action: 'paystack_refund_initiated',
                description: reason.trim(),
                paymentTransactionId: transaction._id,
                reconciliationCaseId: transaction.reconciliationCaseId,
                refundId: refund._id,
                actorId,
                actorType: 'staff',
            });
            return refund;
        } catch (error: any) {
            refund.status = PaymentRefundStatus.FAILED;
            refund.failureReason = error?.message || String(error);
            await refund.save();
            throw error;
        }
    }

    private mapPaystackRefundStatus(status: string): PaymentRefundStatus {
        const normalized = String(status || '').replace(/-/g, '_').toLowerCase();
        return Object.values(PaymentRefundStatus).includes(normalized as PaymentRefundStatus)
            ? normalized as PaymentRefundStatus
            : PaymentRefundStatus.PENDING;
    }

    async recordManualRefund(params: {
        paymentTransactionId: string;
        actorId: string;
        reason: string;
        reference: string;
        amount?: number;
    }) {
        const transaction = await this.paymentTransactionModel.findById(params.paymentTransactionId);
        if (!transaction || transaction.status !== PaymentStatus.SUCCESSFUL) {
            throw new Error('A successful payment transaction is required');
        }
        if (!params.reason?.trim() || !params.reference?.trim()) {
            throw new Error('Refund reason and bank reference are required');
        }
        const amount = Number(params.amount || transaction.amount);
        if (amount <= 0 || amount > Number(transaction.amount)) throw new Error('Invalid refund amount');
        const refund = await this.paymentRefundModel.create({
            paymentTransactionId: transaction._id,
            amount,
            currency: 'NGN',
            method: PaymentRefundMethod.MANUAL,
            status: PaymentRefundStatus.PROCESSED,
            reason: params.reason.trim(),
            manualReference: params.reference.trim(),
            requestedBy: new Types.ObjectId(params.actorId),
            requestedAt: new Date(),
            processedAt: new Date(),
        });
        await this.recordPaymentAudit({
            action: 'manual_refund_recorded',
            description: params.reason.trim(),
            paymentTransactionId: transaction._id,
            reconciliationCaseId: transaction.reconciliationCaseId,
            refundId: refund._id,
            actorId: params.actorId,
            actorType: 'staff',
            metadata: { reference: params.reference, amount },
        });
        if (transaction.reconciliationCaseId) {
            await this.paymentReconciliationCaseModel.updateOne(
                { _id: transaction.reconciliationCaseId },
                {
                    $set: {
                        status: ReconciliationCaseStatus.RESOLVED,
                        resolvedBy: new Types.ObjectId(params.actorId),
                        resolvedAt: new Date(),
                        resolution: `Manual refund recorded: ${params.reference.trim()}`,
                    },
                },
            );
        }
        return refund;
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
        const obligationKey = this.buildPaymentObligationKey({
            paymentContext: PaymentContext.ACCOMMODATION_APPLICATION,
            userId: input.userId,
            accommodationApplicationId: input.accommodationApplicationId,
            academicSessionId: input.academicSessionId,
            paymentId: input.paymentId,
        });
        const activeAttemptKey = `active:${obligationKey}`;
        let paymentTransaction: any;
        try {
            paymentTransaction = await this.paymentTransactionModel.create({
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
                providerInitializationStatus: ProviderInitializationStatus.CREATED,
                activeAttemptKey,
                fulfilmentStatus: PaymentFulfilmentStatus.UNAPPLIED,
                remarks: 'External accommodation payment created - awaiting Paystack initialization',
                ...this.buildDestinationSnapshot(destination),
            });
        } catch (error: any) {
            if (error?.code === 11000) {
                const active = await this.paymentTransactionModel.findOne({ activeAttemptKey });
                return { reference: active?.reference || reference, pending: true };
            }
            throw error;
        }

        const payload = this.buildPaystackInitializePayload({
            email: input.email,
            amount: payment.amount,
            reference,
            userId: input.userId,
            paymentId: input.paymentId,
            paymentName: payment.name,
            destinationAccount: destination,
            callbackUrl: `${process.env.WEBSITE_URL || 'https://alecons.edu.ng'}/accommodation/external?paymentReference=${encodeURIComponent(reference)}`,
            metadata: {
                paymentTransactionId: paymentTransaction._id.toString(),
                externalResidentId: input.externalResidentId,
                accommodationApplicationId: input.accommodationApplicationId,
                academicSessionId: input.academicSessionId,
                paymentContext: PaymentContext.ACCOMMODATION_APPLICATION,
            },
        });
        let response: any;
        try {
            response = await this.initializePaystackTransactionWithFallback(payload, destination, false);
            paymentTransaction.accessCode = response.data.access_code;
            paymentTransaction.providerInitializationStatus = ProviderInitializationStatus.INITIALIZED;
            paymentTransaction.remarks = 'External accommodation payment initialized - awaiting user action';
            await paymentTransaction.save();
        } catch (error: any) {
            paymentTransaction.status = PaymentStatus.FAILED;
            paymentTransaction.providerInitializationStatus = ProviderInitializationStatus.FAILED;
            paymentTransaction.providerInitializationError = error?.message || 'Paystack initialization failed';
            paymentTransaction.activeAttemptKey = undefined;
            paymentTransaction.remarks = `Paystack initialization failed: ${paymentTransaction.providerInitializationError}`;
            await paymentTransaction.save();
            throw error;
        }

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

    async retryStudentEnrollment(applicationId: string, actorId: string, reason: string) {
        if (!Types.ObjectId.isValid(applicationId)) throw new BadRequestException('Invalid application ID');
        if (!reason?.trim()) throw new BadRequestException('A reason is required to retry student enrollment');

        const application: any = await this.applicationModel.findById(applicationId);
        if (!application) throw new NotFoundException('Application not found');
        if (
            application.status !== ApplicationStatus.ADMITTED
            || application.admissionDecision !== AdmissionDecision.ADMITTED
            || application.currentStage !== 9
        ) {
            throw new ConflictException('Student enrollment can only be retried for an admitted application at the School Fees stage');
        }

        const userId = application.userId?._id || application.userId;
        const sessionId = application.entryAcademicSession?._id || application.entryAcademicSession;
        if (!userId || !sessionId) {
            throw new ConflictException('The application is missing its applicant or academic session link');
        }

        const requiredCodes = ['formFee', 'acceptanceFee', 'sundryFee', 'schoolFee'];
        const requiredPayments = await this.paymentModel.find({ paymentCode: { $in: requiredCodes } })
            .select('_id paymentCode name')
            .lean();
        const paymentIdsByCode = new Map<string, Types.ObjectId>();
        requiredPayments.forEach((payment: any) => paymentIdsByCode.set(payment.paymentCode, payment._id));
        const missingPaymentSetup = requiredCodes.filter((code) => !paymentIdsByCode.has(code));
        if (missingPaymentSetup.length) {
            throw new ConflictException(`Required fee configuration is missing: ${missingPaymentSetup.join(', ')}`);
        }

        const successfulTransactions: any[] = await this.paymentTransactionModel.find({
            applicationId: application._id,
            userId,
            academicSessionId: sessionId,
            paymentId: { $in: [...paymentIdsByCode.values()] },
            status: PaymentStatus.SUCCESSFUL,
            $or: [
                { fulfilmentStatus: PaymentFulfilmentStatus.APPLIED },
                { fulfilmentStatus: null },
            ],
        }).populate('paymentId', 'paymentCode name').lean();
        const paidCodes = new Set(successfulTransactions.map((transaction) => transaction.paymentId?.paymentCode));
        const unpaidCodes = requiredCodes.filter((code) => !paidCodes.has(code));
        if (unpaidCodes.length) {
            const blockers = unpaidCodes.map((code) => `${code} is not confirmed as paid for this application and session`);
            if (unpaidCodes.includes('schoolFee')) {
                const schoolFeePaymentId = paymentIdsByCode.get('schoolFee');
                const candidates: any[] = schoolFeePaymentId
                    ? await this.paymentTransactionModel.find({
                        userId,
                        paymentId: schoolFeePaymentId,
                        status: PaymentStatus.SUCCESSFUL,
                    }).select('reference applicationId academicSessionId fulfilmentStatus').sort({ paidAt: -1 }).lean()
                    : [];
                const candidate = candidates[0];
                if (candidate) {
                    let detail = `Successful School Fee transaction ${candidate.reference} was found`;
                    if (candidate.applicationId?.toString() !== application._id.toString()) {
                        detail += ' but it is not linked to this application';
                    } else if (candidate.academicSessionId?.toString() !== sessionId.toString()) {
                        const [paymentSession, applicationSession] = await Promise.all([
                            candidate.academicSessionId
                                ? this.academicSessionModel.findById(candidate.academicSessionId).select('title sessionYear').lean()
                                : null,
                            this.academicSessionModel.findById(sessionId).select('title sessionYear').lean(),
                        ]);
                        const paymentSessionLabel = paymentSession?.title || paymentSession?.sessionYear || 'unknown session';
                        const applicationSessionLabel = applicationSession?.title || applicationSession?.sessionYear || 'unknown session';
                        detail += ` but it belongs to ${paymentSessionLabel}, while this application is for ${applicationSessionLabel}`;
                    } else {
                        detail += ` but its fulfilment status is ${candidate.fulfilmentStatus || 'legacy/unset'}`;
                    }
                    blockers[unpaidCodes.indexOf('schoolFee')] = detail;
                }
            }
            throw new ConflictException(`Enrollment cannot be completed: ${blockers.join('; ')}.`);
        }

        const schoolFeeTransaction = successfulTransactions.find(
            (transaction) => transaction.paymentId?.paymentCode === 'schoolFee',
        );
        const completion = await this.completeApplicationProcess(userId, application);

        const [completedApplication, student] = await Promise.all([
            this.applicationModel.findById(application._id).select('status currentStage matriculationNumber').lean(),
            this.studentModel.findOne({ $or: [{ userId }, { applicationId: application._id }] })
                .select('_id matriculationNumber')
                .lean(),
        ]);
        if (
            completedApplication?.status !== ApplicationStatus.COMPLETED
            || completedApplication.currentStage !== 10
            || !completedApplication.matriculationNumber
            || !student
        ) {
            throw new ConflictException('Enrollment completion did not finish. Review the application and try again.');
        }

        await this.recordPaymentAudit({
            action: 'student_enrollment_retried',
            description: reason.trim(),
            paymentTransactionId: schoolFeeTransaction?._id,
            actorId,
            actorType: 'staff',
            metadata: {
                applicationId: application._id.toString(),
                academicSessionId: sessionId.toString(),
                requiredPaymentCodes: requiredCodes,
                matriculationNumber: completedApplication.matriculationNumber,
                studentId: student._id.toString(),
                emailSent: completion.emailSent,
            },
        });

        return {
            success: true,
            message: 'Student enrollment completed successfully',
            data: {
                applicationId: application._id.toString(),
                studentId: student._id.toString(),
                matriculationNumber: completedApplication.matriculationNumber,
                email: (await this.userModel.findById(userId).select('email').lean())?.email,
                emailSent: completion.emailSent,
            },
        };
    }

    async lookupPaystackPaymentCorrection(reference: string) {
        const normalizedReference = String(reference || '').trim();
        if (!normalizedReference) throw new BadRequestException('Enter the Paystack reference');
        const transaction: any = await this.paymentTransactionModel.findOne({ reference: normalizedReference })
            .populate('paymentId', 'name paymentCode amount')
            .populate('academicSessionId', 'title sessionYear')
            .lean();
        if (!transaction) throw new NotFoundException('No local payment transaction was found for this reference');
        if (transaction.method !== PaymentMethod.PAYSTACK) {
            throw new ConflictException('Only Paystack transactions can be corrected with this utility');
        }
        const userId = transaction.userId?._id || transaction.userId;
        const applications: any[] = await this.applicationModel.find({ userId })
            .select('_id applicationNumber status admissionDecision currentStage entryAcademicSession programId')
            .populate('entryAcademicSession', 'title sessionYear')
            .populate('programId', 'name type mode')
            .sort({ createdAt: -1 })
            .lean();
        const currentApplicationId = transaction.applicationId?._id || transaction.applicationId;
        return {
            transaction: {
                id: transaction._id.toString(),
                reference: transaction.reference,
                amount: transaction.amount,
                status: transaction.status,
                method: transaction.method,
                fulfilmentStatus: transaction.fulfilmentStatus || 'legacy/unset',
                paymentContext: transaction.paymentContext,
                payment: transaction.paymentId,
                currentApplicationId: currentApplicationId?.toString(),
                currentApplicationNumber: applications.find((app) => app._id.toString() === currentApplicationId?.toString())?.applicationNumber,
                currentSession: transaction.academicSessionId,
                paidAt: transaction.paidAt,
            },
            applications: applications.map((application) => ({
                id: application._id.toString(),
                applicationNumber: application.applicationNumber,
                status: application.status,
                admissionDecision: application.admissionDecision,
                currentStage: application.currentStage,
                session: application.entryAcademicSession,
                program: application.programId,
            })),
        };
    }

    private async inspectPaystackPaymentCorrection(paymentTransactionId: string, targetApplicationId: string) {
        if (!Types.ObjectId.isValid(paymentTransactionId) || !Types.ObjectId.isValid(targetApplicationId)) {
            throw new BadRequestException('Select a valid payment and destination application');
        }
        const transaction: any = await this.paymentTransactionModel.findById(paymentTransactionId)
            .populate('paymentId', 'name paymentCode amount')
            .populate('academicSessionId', 'title sessionYear')
            .lean();
        if (!transaction) throw new NotFoundException('Payment transaction not found');
        if (transaction.method !== PaymentMethod.PAYSTACK || transaction.status !== PaymentStatus.SUCCESSFUL) {
            throw new ConflictException('Only successful Paystack transactions can be reassigned');
        }
        if (transaction.paymentContext !== PaymentContext.ADMISSION_APPLICATION || !transaction.applicationId) {
            throw new ConflictException('This is not currently linked to an admission application; use unmatched-payment recovery instead');
        }
        const target: any = await this.applicationModel.findById(targetApplicationId)
            .populate('entryAcademicSession', 'title sessionYear')
            .populate('programId', 'name type mode')
            .lean();
        if (!target) throw new NotFoundException('Destination application not found');
        if (target.userId?.toString() !== transaction.userId?.toString()) {
            throw new ConflictException('The destination application must belong to the same payer');
        }
        const targetSessionId = target.entryAcademicSession?._id || target.entryAcademicSession;
        if (!targetSessionId) throw new ConflictException('Destination application has no academic session');
        const sourceId = transaction.applicationId.toString();
        const targetId = target._id.toString();
        const source = sourceId === targetId
            ? target
            : await this.applicationModel.findById(sourceId).select('_id applicationNumber status currentStage matriculationNumber').lean();
        if (!source) throw new ConflictException('The current linked application no longer exists; manual review is required');
        if (sourceId !== targetId) {
            const sourceStudent = await this.studentModel.findOne({ $or: [{ applicationId: source._id }, { userId: transaction.userId, applicationId: source._id }] })
                .select('_id matriculationNumber')
                .lean();
            if (sourceStudent || source.status === ApplicationStatus.COMPLETED || source.currentStage >= 10 || source.matriculationNumber) {
                throw new ConflictException('The currently linked application has completed or created a student record. This reassignment needs manual review; no changes were made.');
            }
            if (transaction.fulfilmentStatus === PaymentFulfilmentStatus.APPLIED && source.currentStage > 9) {
                throw new ConflictException('The payment has already advanced the current application beyond School Fees. This reassignment needs manual review; no changes were made.');
            }
        }
        const paymentId = transaction.paymentId?._id || transaction.paymentId;
        const existing = await this.paymentTransactionModel.findOne({
            _id: { $ne: transaction._id },
            userId: transaction.userId,
            applicationId: target._id,
            academicSessionId: targetSessionId,
            paymentId,
            status: PaymentStatus.SUCCESSFUL,
            $or: [
                { fulfilmentStatus: PaymentFulfilmentStatus.APPLIED },
                { fulfilmentStatus: null },
            ],
        }).select('_id reference method fulfilmentStatus').lean();
        const currentSessionId = transaction.academicSessionId?._id || transaction.academicSessionId;
        return {
            transaction,
            target,
            source,
            targetSessionId,
            duplicatePayment: existing ? { id: existing._id.toString(), reference: existing.reference } : null,
            changes: {
                application: { from: source.applicationNumber, to: target.applicationNumber },
                session: {
                    from: currentSessionId?.toString(),
                    to: targetSessionId.toString(),
                    fromLabel: transaction.academicSessionId?.title || transaction.academicSessionId?.sessionYear || 'Unknown session',
                    toLabel: target.entryAcademicSession?.title || target.entryAcademicSession?.sessionYear || 'Unknown session',
                },
            },
        };
    }

    async previewPaystackPaymentCorrection(paymentTransactionId: string, targetApplicationId: string) {
        const inspection = await this.inspectPaystackPaymentCorrection(paymentTransactionId, targetApplicationId);
        const providerTransaction = await this.verifyPaystackTransaction(inspection.transaction.reference);
        const mismatches = this.validatePaystackTransaction(inspection.transaction, providerTransaction);
        if (!this.isPaystackSuccessStatus(this.getPaystackStatus(providerTransaction))) {
            throw new ConflictException('Paystack does not currently report this transaction as successful');
        }
        if (mismatches.length) {
            throw new ConflictException(`Provider verification does not match this payment: ${mismatches.join(', ')}`);
        }
        if (providerTransaction?.id) {
            const gatewayOwner = await this.paymentTransactionModel.findOne({
                _id: { $ne: inspection.transaction._id },
                gatewayId: providerTransaction.id.toString(),
            }).select('reference').lean();
            if (gatewayOwner) throw new ConflictException(`Paystack transaction is already owned by local reference ${gatewayOwner.reference}; manual review is required`);
        }
        return {
            reference: inspection.transaction.reference,
            amount: inspection.transaction.amount,
            payment: inspection.transaction.paymentId,
            fulfilmentStatus: inspection.transaction.fulfilmentStatus || 'legacy/unset',
            fromApplication: inspection.source.applicationNumber,
            toApplication: inspection.target.applicationNumber,
            fromSession: inspection.changes.session.fromLabel,
            toSession: inspection.changes.session.toLabel,
            duplicatePayment: inspection.duplicatePayment,
            willBeDuplicate: Boolean(inspection.duplicatePayment),
        };
    }

    async applyPaystackPaymentCorrection(params: { paymentTransactionId: string; targetApplicationId: string; actorId: string; reason: string }) {
        if (!params.reason?.trim()) throw new BadRequestException('A correction reason is required');
        const inspection = await this.inspectPaystackPaymentCorrection(params.paymentTransactionId, params.targetApplicationId);
        if (inspection.transaction.applicationId.toString() === inspection.target._id.toString()
            && inspection.transaction.academicSessionId?.toString() === inspection.targetSessionId.toString()) {
            throw new ConflictException('This payment is already linked to the selected application and session');
        }
        const providerTransaction = await this.verifyPaystackTransaction(inspection.transaction.reference);
        const mismatches = this.validatePaystackTransaction(inspection.transaction, providerTransaction);
        if (!this.isPaystackSuccessStatus(this.getPaystackStatus(providerTransaction)) || mismatches.length) {
            throw new ConflictException(`Paystack verification is not safe for reassignment${mismatches.length ? `: ${mismatches.join(', ')}` : ''}`);
        }
        if (providerTransaction?.id) {
            const gatewayOwner = await this.paymentTransactionModel.findOne({
                _id: { $ne: params.paymentTransactionId },
                gatewayId: providerTransaction.id.toString(),
            }).select('reference').lean();
            if (gatewayOwner) throw new ConflictException(`Paystack transaction is already owned by local reference ${gatewayOwner.reference}; no changes were made`);
        }

        const paymentTransaction: any = await this.paymentTransactionModel.findById(params.paymentTransactionId);
        if (!paymentTransaction || paymentTransaction.applicationId?.toString() !== inspection.transaction.applicationId.toString()
            || paymentTransaction.academicSessionId?.toString() !== inspection.transaction.academicSessionId?.toString()) {
            throw new ConflictException('Payment linkage changed after preview; run the preview again');
        }
        const before = {
            applicationId: paymentTransaction.applicationId?.toString(),
            academicSessionId: paymentTransaction.academicSessionId?.toString(),
            fulfilmentStatus: paymentTransaction.fulfilmentStatus,
            fulfilledObligationKey: paymentTransaction.fulfilledObligationKey,
            reconciliationCaseId: paymentTransaction.reconciliationCaseId?.toString(),
        };
        if (paymentTransaction.reconciliationCaseId) {
            await this.paymentReconciliationCaseModel.updateOne(
                {
                    _id: paymentTransaction.reconciliationCaseId,
                    status: { $in: [ReconciliationCaseStatus.OPEN, ReconciliationCaseStatus.INVESTIGATING] },
                },
                {
                    $set: {
                        status: ReconciliationCaseStatus.RESOLVED,
                        resolvedBy: new Types.ObjectId(params.actorId),
                        resolvedAt: new Date(),
                        resolution: `Payment linkage corrected to ${inspection.target.applicationNumber}`,
                    },
                },
            );
        }
        paymentTransaction.applicationId = inspection.target._id;
        paymentTransaction.academicSessionId = inspection.targetSessionId;
        paymentTransaction.paymentContext = PaymentContext.ADMISSION_APPLICATION;
        paymentTransaction.payerType = PaymentPayerType.APPLICANT;
        paymentTransaction.studentId = undefined;
        paymentTransaction.fulfilmentStatus = PaymentFulfilmentStatus.UNAPPLIED;
        paymentTransaction.fulfilledObligationKey = undefined;
        paymentTransaction.duplicateOfTransactionId = undefined;
        paymentTransaction.reconciliationCaseId = undefined;
        await paymentTransaction.save();
        const stateResult = await this.applyPaystackTransactionState(paymentTransaction, providerTransaction);
        await this.recordPaymentAudit({
            action: 'paystack_payment_application_reassigned',
            description: params.reason.trim(),
            paymentTransactionId: paymentTransaction._id,
            actorId: params.actorId,
            actorType: 'staff',
            metadata: {
                reference: paymentTransaction.reference,
                paymentCode: inspection.transaction.paymentId?.paymentCode,
                before,
                after: {
                    applicationId: inspection.target._id.toString(),
                    applicationNumber: inspection.target.applicationNumber,
                    academicSessionId: inspection.targetSessionId.toString(),
                    sessionTitle: inspection.target.entryAcademicSession?.title || inspection.target.entryAcademicSession?.sessionYear,
                    fulfilmentStatus: paymentTransaction.fulfilmentStatus,
                },
                sourceApplicationId: inspection.source._id.toString(),
                duplicatePayment: inspection.duplicatePayment,
            },
        });
        if (stateResult?.quarantined) throw new ConflictException('Linkage was corrected but provider state is quarantined. Review the payment reconciliation case before proceeding.');
        return {
            reference: paymentTransaction.reference,
            applicationNumber: inspection.target.applicationNumber,
            sessionTitle: inspection.target.entryAcademicSession?.title || inspection.target.entryAcademicSession?.sessionYear,
            fulfilmentStatus: paymentTransaction.fulfilmentStatus,
            duplicateOfReference: inspection.duplicatePayment?.reference,
            message: paymentTransaction.fulfilmentStatus === PaymentFulfilmentStatus.DUPLICATE
                ? 'Payment was linked to the selected application and marked as a duplicate collection for refund review.'
                : 'Payment was linked to the selected application and standard verification was re-run.',
        };
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
    private async completeApplicationProcess(userId: Types.ObjectId, application: any): Promise<{ emailSent: boolean }> {
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

            const existingStudent = await this.studentModel.findOne({
                $or: [
                    { userId: normalizedUserId },
                    { applicationId: normalizedApplicationId },
                ],
            });
            let matriculationNumber = fullApplication.matriculationNumber
                || existingStudent?.matriculationNumber
                || await this.matriculationService.generateMatriculationNumber(
                programId.toString(),
                academicSessionId.toString(),
            );

            if (!fullApplication.matriculationNumber) {
                const reservedApplication = await this.applicationModel.findOneAndUpdate(
                    {
                        _id: normalizedApplicationId,
                        $or: [
                            { matriculationNumber: { $exists: false } },
                            { matriculationNumber: null },
                            { matriculationNumber: '' },
                        ],
                    },
                    { $set: { matriculationNumber } },
                    { new: true },
                ).select('matriculationNumber').lean();
                if (!reservedApplication) {
                    const currentApplication = await this.applicationModel.findById(normalizedApplicationId)
                        .select('matriculationNumber')
                        .lean();
                    matriculationNumber = currentApplication?.matriculationNumber || matriculationNumber;
                } else {
                    matriculationNumber = reservedApplication.matriculationNumber;
                }
                fullApplication.matriculationNumber = matriculationNumber;
            }

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
            let emailSent = false;
            try {
                await this.emailService.sendMatriculationEmail(
                    user.email,
                    user.firstName,
                    matriculationNumber,
                    studentPortalUrl
                );
                emailSent = true;
            } catch (emailError) {
                this.logger.error('Enrollment completed, but matriculation email could not be sent:', emailError);
            }

            this.logger.log('Application completion process finished successfully for user:', userId);
            this.logger.log('Generated matriculation number:', matriculationNumber);
            this.logger.log('Student record created and user role updated');
            this.logger.log(emailSent
                ? `Matriculation email sent to ${user.email}`
                : `Matriculation email delivery failed for ${user.email}; enrollment remains complete`);

            return { emailSent };

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
            const [refundSummary] = await this.paymentRefundModel.aggregate([
                { $match: { status: PaymentRefundStatus.PROCESSED } },
                {
                    $lookup: {
                        from: 'paymenttransactions',
                        localField: 'paymentTransactionId',
                        foreignField: '_id',
                        as: 'transaction',
                    },
                },
                { $unwind: '$transaction' },
                ...(match.academicSessionId ? [{ $match: { 'transaction.academicSessionId': match.academicSessionId } }] : []),
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]);
            const [duplicateSummary] = await this.paymentTransactionModel.aggregate([
                {
                    $match: {
                        ...match,
                        status: PaymentStatus.SUCCESSFUL,
                        fulfilmentStatus: PaymentFulfilmentStatus.DUPLICATE,
                    },
                },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]);
            const grossRevenue = Number(totals.totalRevenue || 0);
            const refundedAmount = Number(refundSummary?.total || 0);

            return {
                totalRevenue: grossRevenue,
                grossRevenue,
                refundedAmount,
                netRevenue: grossRevenue - refundedAmount,
                duplicateAmount: Number(duplicateSummary?.total || 0),
                duplicateCount: Number(duplicateSummary?.count || 0),
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
                $lookup: {
                    from: 'paymentrefunds',
                    localField: '_id',
                    foreignField: 'paymentTransactionId',
                    as: 'refunds',
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
                    latestRefund: { $arrayElemAt: ['$refunds', -1] },
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
                            gatewayId: 1,
                            gatewayResponse: 1,
                            lastVerifiedAt: 1,
                            verificationAttempts: 1,
                            rejectedBy: {
                                firstName: '$rejectedByUser.firstName',
                                lastName: '$rejectedByUser.lastName',
                            },
                            channel: 1,
                            fulfilmentStatus: 1,
                            duplicateOfTransactionId: 1,
                            reconciliationCaseId: 1,
                            recoveredAt: 1,
                            recoverySource: 1,
                            refundStatus: '$latestRefund.status',
                            refundedAmount: '$latestRefund.amount',
                            refundId: '$latestRefund._id',
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
            .populate('academicSessionId', 'sessionYear title')
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

        const transactionQuery: any = { userId: userObjectId };
        if (applicationObjectId) transactionQuery.applicationId = applicationObjectId;
        if (academicSessionObjectId) transactionQuery.academicSessionId = academicSessionObjectId;

        const payments = await this.paymentTransactionModel
            .find(transactionQuery)
            .populate('paymentId', 'name description amount paymentCode')
            .populate('academicSessionId', 'sessionYear title')
            .populate('verifiedBy', 'firstName lastName')
            .populate('rejectedBy', 'firstName lastName')
            .sort({ createdAt: -1, paidAt: -1 })
            .lean();

        const mappedPayments = payments.map(payment => {
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
                fulfilmentStatus: payment.fulfilmentStatus,
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
                        title: (payment.academicSessionId as any).title,
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
            providerInitializationStatus: ProviderInitializationStatus.CREATED,
            activeAttemptKey: `active:${this.buildPaymentObligationKey({
                paymentContext: accommodationApplication
                    ? PaymentContext.ACCOMMODATION_APPLICATION
                    : PaymentContext.STUDENT_ACCOUNT,
                userId,
                applicationId: linkedApplication.applicationId,
                accommodationApplicationId: accommodationApplication?._id,
                academicSessionId: billableSessionId,
                paymentId,
            })}`,
            fulfilmentStatus: PaymentFulfilmentStatus.UNAPPLIED,
            remarks: 'Payment created - awaiting Paystack initialization',
            ...this.buildDestinationSnapshot(paystackDestinationAccount),
        });

        try {
            await paymentTransaction.save();
        } catch (error: any) {
            if (error?.code === 11000) {
                const active = await this.paymentTransactionModel.findOne({
                    activeAttemptKey: paymentTransaction.activeAttemptKey,
                });
                return {
                    reference: active?.reference || reference,
                    authorization_url: active?.accessCode
                        ? `https://checkout.paystack.com/${active.accessCode}`
                        : undefined,
                    access_code: active?.accessCode,
                    pending: true,
                };
            }
            throw error;
        }

        // Initialize with Paystack
        let paystackResponse: any;
        try {
            paystackResponse = await this.initializePaystackPayment(
                reference,
                email,
                payment.amount,
                userId,
                paymentId,
                payment.name,
                paystackDestinationAccount,
                {
                    paymentTransactionId: paymentTransaction._id.toString(),
                    applicationId: linkedApplication.applicationId?.toString(),
                    studentId: student._id?.toString(),
                    accommodationApplicationId: accommodationApplication?._id?.toString(),
                    academicSessionId: billableSessionId,
                    paymentContext: paymentTransaction.paymentContext,
                },
            );
            paymentTransaction.accessCode = paystackResponse.access_code;
            paymentTransaction.providerInitializationStatus = ProviderInitializationStatus.INITIALIZED;
            paymentTransaction.remarks = 'Payment initialized - awaiting user action';
            await paymentTransaction.save();
        } catch (error: any) {
            paymentTransaction.status = PaymentStatus.FAILED;
            paymentTransaction.providerInitializationStatus = ProviderInitializationStatus.FAILED;
            paymentTransaction.providerInitializationError = error?.message || 'Paystack initialization failed';
            paymentTransaction.activeAttemptKey = undefined;
            paymentTransaction.remarks = `Paystack initialization failed: ${paymentTransaction.providerInitializationError}`;
            await paymentTransaction.save();
            throw error;
        }

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

        const obligationKey = this.getTransactionObligationKey(paymentTransaction);
        const duplicateSuccessQuery: any = {
            _id: { $ne: paymentTransaction._id },
            status: PaymentStatus.SUCCESSFUL,
            $or: [
                { fulfilledObligationKey: obligationKey },
                {
                    fulfilledObligationKey: { $exists: false },
                    ...this.buildTransactionObligationMatch(paymentTransaction),
                },
            ],
        };

        const existingSuccessfulPayment = await this.paymentTransactionModel.findOne(duplicateSuccessQuery);
        if (existingSuccessfulPayment) {
            throw new Error('A successful payment already exists for this charge');
        }

        paymentTransaction.status = PaymentStatus.SUCCESSFUL;
        paymentTransaction.fulfilmentStatus = PaymentFulfilmentStatus.APPLIED;
        paymentTransaction.fulfilledObligationKey = obligationKey;
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
        metadata?: Record<string, unknown>,
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
                    metadata,
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

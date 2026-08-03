import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
    StudentPayment,
    StudentPaymentDocument,
    PaymentMethod,
    PaymentStatus,
    RemittanceStatus,
} from '../schemas/student-payment.schema';

interface RemittanceSyncOptions {
    academicSessionId?: string;
}

interface RemittanceListFilters {
    tab?: 'unremitted' | 'remitted';
    academicSessionId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

interface PaystackMeta {
    page?: number;
    pageCount?: number;
    total?: number;
    perPage?: number;
}

interface PaystackSettlement {
    id: number | string;
    status?: string;
    settlement_date?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface PaystackSettlementTransaction {
    reference?: string;
    amount?: number;
}

@Injectable()
export class PaymentRemittanceService {
    private readonly logger = new Logger(PaymentRemittanceService.name);
    private readonly paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    private readonly paystackBaseUrl = 'https://api.paystack.co';
    private syncInProgress = false;

    constructor(
        @InjectModel(StudentPayment.name)
        private readonly studentPaymentModel: Model<StudentPaymentDocument>,
    ) { }

    private escapeRegex(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private ensurePaystackSecretKey() {
        if (!this.paystackSecretKey) {
            throw new Error('PAYSTACK_SECRET_KEY is not configured');
        }
    }

    private getEffectiveSuccessDate(payment: {
        paidAt?: Date;
        verifiedAt?: Date;
        createdAt?: Date;
    }) {
        return payment.paidAt || payment.verifiedAt || payment.createdAt || new Date();
    }

    private normalizeRemittanceStatus(status?: string): RemittanceStatus {
        switch (status) {
            case RemittanceStatus.SUCCESS:
                return RemittanceStatus.SUCCESS;
            case RemittanceStatus.PROCESSING:
                return RemittanceStatus.PROCESSING;
            case RemittanceStatus.FAILED:
                return RemittanceStatus.FAILED;
            case RemittanceStatus.PENDING:
            default:
                return RemittanceStatus.PENDING;
        }
    }

    private normalizePaystackAmountToNaira(amount?: number) {
        if (typeof amount !== 'number' || Number.isNaN(amount)) {
            return 0;
        }

        return amount / 100;
    }

    private async fetchPaystackJson<T>(
        path: string,
        query: Record<string, string | number | undefined> = {},
    ): Promise<{ status: boolean; message?: string; data?: T; meta?: PaystackMeta }> {
        this.ensurePaystackSecretKey();

        const searchParams = new URLSearchParams();
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                searchParams.append(key, String(value));
            }
        });

        const url = searchParams.toString()
            ? `${this.paystackBaseUrl}${path}?${searchParams.toString()}`
            : `${this.paystackBaseUrl}${path}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.paystackSecretKey}`,
                'Content-Type': 'application/json',
            },
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload.status === false) {
            throw new Error(payload.message || `Paystack request failed: ${response.status}`);
        }

        return payload;
    }

    async syncPaystackRemittance(options: RemittanceSyncOptions = {}) {
        if (this.syncInProgress) {
            throw new Error('A remittance sync is already in progress');
        }

        this.syncInProgress = true;
        const syncStartedAt = new Date();

        try {
            const candidateMatch: any = {
                method: PaymentMethod.PAYSTACK,
                status: PaymentStatus.SUCCESSFUL,
                $or: [
                    { remittanceStatus: { $exists: false } },
                    { remittanceStatus: { $ne: RemittanceStatus.SUCCESS } },
                ],
            };

            if (options.academicSessionId) {
                if (!Types.ObjectId.isValid(options.academicSessionId)) {
                    throw new Error('Invalid academic session filter');
                }

                candidateMatch.academicSessionId = new Types.ObjectId(options.academicSessionId);
            }

            const candidates = await this.studentPaymentModel.find(candidateMatch)
                .select('_id reference amount paidAt verifiedAt createdAt remittanceStatus remittanceSettlementId')
                .lean();

            if (!candidates.length) {
                return {
                    scannedCount: 0,
                    matchedCount: 0,
                    updatedCount: 0,
                    unresolvedCount: 0,
                    settlementPagesProcessed: 0,
                    transactionPagesProcessed: 0,
                    lastSyncedAt: syncStartedAt.toISOString(),
                };
            }

            const candidateMap = new Map(
                candidates
                    .filter((candidate) => candidate.reference)
                    .map((candidate) => [candidate.reference, candidate]),
            );
            const unresolvedReferences = new Set(candidateMap.keys());
            const matchedUpdates = new Map<string, {
                remittanceStatus: RemittanceStatus;
                remittanceSettlementId: string;
                remittanceSettledAt?: Date;
                remittanceLastSyncedAt: Date;
                remittanceAmount: number;
            }>();

            const earliestCandidateDate = candidates.reduce((earliest, candidate) => {
                const candidateDate = this.getEffectiveSuccessDate(candidate);
                if (!earliest || candidateDate < earliest) {
                    return candidateDate;
                }
                return earliest;
            }, undefined as Date | undefined);

            let settlementPagesProcessed = 0;
            let transactionPagesProcessed = 0;
            let matchedCount = 0;
            let settlementPage = 1;
            const pageSize = 100;

            outerLoop:
            while (true) {
                const settlementsResponse = await this.fetchPaystackJson<PaystackSettlement[]>('/settlement', {
                    page: settlementPage,
                    perPage: pageSize,
                    from: earliestCandidateDate?.toISOString(),
                    to: syncStartedAt.toISOString(),
                });

                const settlements = settlementsResponse.data || [];
                settlementPagesProcessed += 1;

                for (const settlement of settlements) {
                    if (!settlement?.id) {
                        continue;
                    }

                    let transactionPage = 1;

                    while (true) {
                        const transactionsResponse = await this.fetchPaystackJson<PaystackSettlementTransaction[]>(
                            `/settlement/${settlement.id}/transactions`,
                            {
                                page: transactionPage,
                                perPage: pageSize,
                                from: earliestCandidateDate?.toISOString(),
                                to: syncStartedAt.toISOString(),
                            },
                        );

                        const transactions = transactionsResponse.data || [];
                        transactionPagesProcessed += 1;

                        for (const transaction of transactions) {
                            if (!transaction.reference || !candidateMap.has(transaction.reference)) {
                                continue;
                            }

                            unresolvedReferences.delete(transaction.reference);
                            matchedCount += 1;
                            matchedUpdates.set(transaction.reference, {
                                remittanceStatus: this.normalizeRemittanceStatus(settlement.status),
                                remittanceSettlementId: String(settlement.id),
                                remittanceSettledAt: settlement.status === RemittanceStatus.SUCCESS && settlement.settlement_date
                                    ? new Date(settlement.settlement_date)
                                    : undefined,
                                remittanceLastSyncedAt: syncStartedAt,
                                remittanceAmount: this.normalizePaystackAmountToNaira(transaction.amount),
                            });
                        }

                        const transactionPageCount = transactionsResponse.meta?.pageCount || 1;
                        if (transactionPage >= transactionPageCount || transactions.length === 0) {
                            break;
                        }

                        transactionPage += 1;
                    }

                    if (!unresolvedReferences.size) {
                        break outerLoop;
                    }
                }

                const settlementPageCount = settlementsResponse.meta?.pageCount || 1;
                if (settlementPage >= settlementPageCount || settlements.length === 0) {
                    break;
                }

                settlementPage += 1;
            }

            const operations = candidates.map((candidate) => {
                const matchedUpdate = matchedUpdates.get(candidate.reference);
                const update: any = {
                    $set: {
                        remittanceLastSyncedAt: syncStartedAt,
                    },
                };

                if (matchedUpdate) {
                    update.$set.remittanceStatus = matchedUpdate.remittanceStatus;
                    update.$set.remittanceSettlementId = matchedUpdate.remittanceSettlementId;
                    update.$set.remittanceAmount = matchedUpdate.remittanceAmount || candidate.amount;

                    if (matchedUpdate.remittanceSettledAt) {
                        update.$set.remittanceSettledAt = matchedUpdate.remittanceSettledAt;
                    } else {
                        update.$unset = {
                            ...(update.$unset || {}),
                            remittanceSettledAt: '',
                        };
                    }
                } else {
                    update.$set.remittanceStatus = candidate.remittanceStatus || RemittanceStatus.PENDING;
                    update.$set.remittanceAmount = candidate.amount;
                }

                return {
                    updateOne: {
                        filter: { _id: candidate._id },
                        update,
                    },
                };
            });

            if (operations.length) {
                await this.studentPaymentModel.bulkWrite(operations);
            }

            return {
                scannedCount: candidates.length,
                matchedCount,
                updatedCount: operations.length,
                unresolvedCount: unresolvedReferences.size,
                settlementPagesProcessed,
                transactionPagesProcessed,
                lastSyncedAt: syncStartedAt.toISOString(),
            };
        } finally {
            this.syncInProgress = false;
        }
    }

    async getRemittanceRecords(filters: RemittanceListFilters = {}) {
        const page = Math.max(1, Number(filters.page) || 1);
        const limit = Math.max(1, Number(filters.limit) || 10);
        const skip = (page - 1) * limit;
        const tab = filters.tab === 'remitted' ? 'remitted' : 'unremitted';
        const sortDirection = filters.sortOrder === 'asc' ? 1 : -1;
        const sortFieldMap: Record<string, string> = {
            amount: 'amount',
            userName: 'userName',
            paymentName: 'paymentName',
            remittanceDate: 'remittanceRelevantDate',
            remittanceStatus: 'normalizedRemittanceStatus',
        };
        const sortField = sortFieldMap[filters.sortBy || 'remittanceDate'] || 'remittanceRelevantDate';

        const baseMatch: any = {
            method: PaymentMethod.PAYSTACK,
            status: PaymentStatus.SUCCESSFUL,
        };

        if (filters.academicSessionId) {
            if (!Types.ObjectId.isValid(filters.academicSessionId)) {
                throw new Error('Invalid academic session filter');
            }

            baseMatch.academicSessionId = new Types.ObjectId(filters.academicSessionId);
        }

        const pipeline: any[] = [
            { $match: baseMatch },
            {
                $addFields: {
                    normalizedRemittanceStatus: {
                        $ifNull: ['$remittanceStatus', RemittanceStatus.PENDING],
                    },
                    effectivePaidAt: {
                        $ifNull: [
                            '$paidAt',
                            {
                                $ifNull: ['$verifiedAt', '$createdAt'],
                            },
                        ],
                    },
                },
            },
            {
                $addFields: {
                    remittanceRelevantDate: {
                        $ifNull: ['$remittanceSettledAt', '$effectivePaidAt'],
                    },
                },
            },
            {
                $match: tab === 'remitted'
                    ? { normalizedRemittanceStatus: RemittanceStatus.SUCCESS }
                    : { normalizedRemittanceStatus: { $ne: RemittanceStatus.SUCCESS } },
            },
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
                                    { $ifNull: ['$user.lastName', ''] },
                                ],
                            },
                        },
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

        if (filters.dateFrom || filters.dateTo) {
            const remittanceDateMatch: Record<string, Date> = {};

            if (filters.dateFrom) {
                const start = new Date(filters.dateFrom);
                if (Number.isNaN(start.getTime())) {
                    throw new Error('Invalid from date filter');
                }
                start.setHours(0, 0, 0, 0);
                remittanceDateMatch.$gte = start;
            }

            if (filters.dateTo) {
                const end = new Date(filters.dateTo);
                if (Number.isNaN(end.getTime())) {
                    throw new Error('Invalid to date filter');
                }
                end.setHours(23, 59, 59, 999);
                remittanceDateMatch.$lte = end;
            }

            if (remittanceDateMatch.$gte && remittanceDateMatch.$lte && remittanceDateMatch.$gte > remittanceDateMatch.$lte) {
                throw new Error('From date cannot be later than to date');
            }

            pipeline.push({
                $match: {
                    remittanceRelevantDate: remittanceDateMatch,
                },
            });
        }

        if (filters.search?.trim()) {
            const searchRegex = new RegExp(this.escapeRegex(filters.search.trim()), 'i');
            pipeline.push({
                $match: {
                    $or: [
                        { userName: searchRegex },
                        { email: searchRegex },
                        { paymentName: searchRegex },
                        { applicationNumber: searchRegex },
                        { matriculationNumber: searchRegex },
                        { reference: searchRegex },
                        { remittanceSettlementId: searchRegex },
                    ],
                },
            });
        }

        pipeline.push({
            $facet: {
                records: [
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
                            userName: 1,
                            email: '$user.email',
                            applicationNumber: 1,
                            matriculationNumber: 1,
                            programName: 1,
                            programTypeLabel: 1,
                            programModeLabel: 1,
                            academicSessionLabel: 1,
                            paymentName: 1,
                            amount: 1,
                            reference: 1,
                            remittanceStatus: '$normalizedRemittanceStatus',
                            remittanceSettlementId: 1,
                            remittanceSettledAt: 1,
                            remittanceLastSyncedAt: 1,
                            remittanceAmount: 1,
                            effectivePaidAt: 1,
                            remittanceRelevantDate: 1,
                            method: 1,
                            channel: 1,
                        },
                    },
                ],
                totalCount: [
                    { $count: 'count' },
                ],
                totalAmount: [
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$amount' },
                        },
                    },
                ],
            },
        });

        const [result] = await this.studentPaymentModel.aggregate(pipeline);
        const records = result?.records || [];
        const totalItems = result?.totalCount?.[0]?.count || 0;
        const totalAmount = result?.totalAmount?.[0]?.total || 0;
        const totalPages = Math.max(1, Math.ceil(totalItems / limit));

        return {
            records,
            pagination: {
                totalItems,
                currentPage: page,
                totalPages,
                limit,
            },
            totalAmount,
        };
    }
}

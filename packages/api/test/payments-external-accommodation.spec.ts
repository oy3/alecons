import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { PaymentsService } from '../src/payments/payments.service';
import { AccommodationService } from '../src/services/accommodation.service';
import { PaymentAudience } from '../src/schemas/payment.schema';
import { PaymentDestinationProviderType } from '../src/schemas/payment-destination-account.schema';
import {
    PaymentFulfilmentStatus,
    PaymentStatus,
    ProviderInitializationStatus,
} from '../src/schemas/payment-transaction.schema';

function setup(previous: any = null) {
    const service = Object.create(PaymentsService.prototype) as any;
    const paymentId = new Types.ObjectId();
    const input = {
        userId: new Types.ObjectId().toString(),
        externalResidentId: new Types.ObjectId().toString(),
        accommodationApplicationId: new Types.ObjectId().toString(),
        academicSessionId: new Types.ObjectId().toString(),
        paymentId: paymentId.toString(),
        email: 'resident@example.com',
    };
    const created: any[] = [];
    const verified: string[] = [];
    const providerPayloads: any[] = [];
    service.logger = { log() {}, error() {}, warn() {} };
    service.paymentModel = {
        findById: async () => ({
            _id: paymentId,
            active: true,
            targetAudience: [PaymentAudience.EXTERNAL_RESIDENT],
            amount: 100000,
        }),
    };
    service.resolveDestinationForPayment = async () => ({
        providerType: PaymentDestinationProviderType.SUBACCOUNT,
        paystackSubaccountCode: 'ACCT-test',
    });
    service.buildDestinationSnapshot = () => ({});
    service.buildPaymentReference = () => 'ALC-new-reference';
    service.paymentTransactionModel = {
        findOne: (query: any) => {
            if (query.activeAttemptKey) return Promise.resolve(previous);
            if (query.status === PaymentStatus.SUCCESSFUL)
                return Promise.resolve(
                    previous?.status === PaymentStatus.SUCCESSFUL
                        ? previous
                        : null,
                );
            return { sort: async () => previous };
        },
        create: async (fields: any) => {
            const transaction = {
                ...fields,
                _id: new Types.ObjectId(),
                save: async () => {},
            };
            created.push(transaction);
            return transaction;
        },
    };
    service.verifyPaystackTransaction = async (reference: string) => {
        verified.push(reference);
        return { status: 'pending' };
    };
    service.applyPaystackTransactionState = async (
        transaction: any,
        provider: any,
    ) => {
        transaction.gatewayStatus = provider.status;
        if (provider.status === 'success') {
            transaction.status = PaymentStatus.SUCCESSFUL;
            transaction.fulfilmentStatus = PaymentFulfilmentStatus.APPLIED;
        } else if (
            ['failed', 'abandoned', 'reversed'].includes(provider.status)
        ) {
            transaction.status = PaymentStatus.FAILED;
            transaction.activeAttemptKey = undefined;
        } else transaction.status = PaymentStatus.PENDING;
    };
    service.buildPaystackInitializePayload = (payload: any) => {
        providerPayloads.push(payload);
        return payload;
    };
    service.initializePaystackTransactionWithFallback = async () => ({
        data: {
            access_code: 'new-access-code',
            authorization_url: 'https://checkout.paystack.com/new-access-code',
        },
    });
    return { service, input, created, verified, providerPayloads };
}

const attempt = () => ({
    _id: new Types.ObjectId(),
    reference: 'ALC-original',
    status: PaymentStatus.PENDING,
    providerInitializationStatus: ProviderInitializationStatus.INITIALIZED,
    accessCode: 'original-code',
    fulfilmentStatus: PaymentFulfilmentStatus.UNAPPLIED,
});

test('external popup initialization preserves authoritative owner, session, destination and reference', async () => {
    const { service, input, created, providerPayloads } = setup();
    const result = await service.initializeExternalAccommodationPayment(input);
    assert.equal(result.access_code, 'new-access-code');
    assert.equal(result.reference, created[0].reference);
    assert.equal(String(created[0].academicSessionId), input.academicSessionId);
    assert.equal(
        String(created[0].externalResidentId),
        input.externalResidentId,
    );
    assert.equal(providerPayloads[0].amount, 100000);
    assert.equal(
        providerPayloads[0].metadata.accommodationApplicationId,
        input.accommodationApplicationId,
    );
});

test('an existing pending or unverifiable payment blocks another external charge', async () => {
    for (const outage of [false, true]) {
        const previous = attempt();
        const { service, input, created } = setup(previous);
        if (outage)
            service.verifyPaystackTransaction = async () => {
                throw new Error('Provider unavailable');
            };
        const result =
            await service.initializeExternalAccommodationPayment(input);
        assert.equal(result.pending, true);
        assert.equal(result.reference, 'ALC-original');
        assert.equal(result.access_code, undefined);
        assert.equal(created.length, 0);
    }
});

test('an ongoing checkout resumes its existing access code without changing reference', async () => {
    const previous = attempt();
    const { service, input, created } = setup(previous);
    service.verifyPaystackTransaction = async () => ({ status: 'ongoing' });
    const result = await service.initializeExternalAccommodationPayment(input);
    assert.equal(result.access_code, 'original-code');
    assert.equal(result.reference, 'ALC-original');
    assert.equal(created.length, 0);
});

test('confirmed abandonment permits a new attempt and preserves the original record', async () => {
    const previous = attempt();
    const { service, input, created } = setup(previous);
    service.verifyPaystackTransaction = async () => ({ status: 'abandoned' });
    const result = await service.initializeExternalAccommodationPayment(input);
    assert.equal(previous.reference, 'ALC-original');
    assert.equal(previous.status, PaymentStatus.FAILED);
    assert.equal(result.reference, created[0].reference);
    assert.notEqual(result.reference, previous.reference);
});

test('provider success or a quarantined payment cannot initialize another charge', async () => {
    const previous = attempt();
    const { service, input, created } = setup(previous);
    service.verifyPaystackTransaction = async () => ({ status: 'success' });
    assert.equal(
        (await service.initializeExternalAccommodationPayment(input))
            .alreadyPaid,
        true,
    );
    assert.equal(created.length, 0);
    previous.fulfilmentStatus = PaymentFulfilmentStatus.QUARANTINED;
    const blocked = await service.initializeExternalAccommodationPayment(input);
    assert.equal(blocked.pending, true);
    assert.equal(blocked.alreadyPaid, false);
    assert.equal(created.length, 0);
});

test('an initialization still in progress is not treated as a safe retry', async () => {
    const previous = {
        ...attempt(),
        providerInitializationStatus: ProviderInitializationStatus.CREATED,
        accessCode: undefined,
    };
    const { service, input, created, verified } = setup(previous);
    assert.equal(
        (await service.initializeExternalAccommodationPayment(input)).pending,
        true,
    );
    assert.equal(created.length, 0);
    assert.equal(verified.length, 0);
});

test('a concurrent initialization returns its existing reference, never a fabricated reference', async () => {
    const { service, input, created } = setup();
    service.paymentTransactionModel.create = async () => {
        throw { code: 11000 };
    };
    const originalFindOne = service.paymentTransactionModel.findOne;
    service.paymentTransactionModel.findOne = (query: any) =>
        query.activeAttemptKey
            ? Promise.resolve(attempt())
            : originalFindOne(query);
    const result = await service.initializeExternalAccommodationPayment(input);
    assert.deepEqual(result, { reference: 'ALC-original', pending: true });
    assert.equal(created.length, 0);
});

function verificationSetup(transaction: any) {
    const service = Object.create(AccommodationService.prototype) as any;
    const appId = new Types.ObjectId();
    const queries: any[] = [];
    let allocations = 0;
    service.applicationFromResumeToken = async () => ({ _id: appId });
    service.transactionModel = {
        findOne: async (query: any) => {
            queries.push(query);
            return transaction;
        },
        findById: () => ({ lean: async () => transaction }),
    };
    service.paymentsService = {
        verifyPayment: async () => {},
        retryAccommodationPaymentFulfilment: async () => {},
        externalAccommodationPaymentState: (value: any) =>
            PaymentsService.prototype.externalAccommodationPaymentState(value),
    };
    service.allocateAutomatically = async () => {
        allocations += 1;
    };
    service.externalApplicationView = async () => ({
        _id: appId,
        status: allocations ? 'allocated' : 'awaiting_payment',
    });
    return { service, appId, queries, allocations: () => allocations };
}

test('external verification scopes references to the authenticated accommodation application', async () => {
    const { service, appId, queries } = verificationSetup(null);
    await assert.rejects(
        service.verifyExternalPayment('resume-token', 'OTHER-REFERENCE'),
        /not found/,
    );
    assert.equal(String(queries[0].accommodationApplicationId), String(appId));
    assert.equal(queries[0].reference, 'OTHER-REFERENCE');
});

test('a quarantined success does not allocate and does not expose the access code', async () => {
    const { service, allocations } = verificationSetup({
        ...attempt(),
        status: PaymentStatus.SUCCESSFUL,
        fulfilmentStatus: PaymentFulfilmentStatus.QUARANTINED,
    });
    const result = await service.verifyExternalPayment(
        'resume-token',
        'ALC-original',
    );
    assert.equal(allocations(), 0);
    assert.equal(result.paymentAttempt.needsReview, true);
    assert.equal(result.paymentAttempt.accessCode, undefined);
});

test('webhook-first confirmation remains successful when the provider recheck is temporarily unavailable', async () => {
    const { service, allocations } = verificationSetup({
        ...attempt(),
        status: PaymentStatus.SUCCESSFUL,
        fulfilmentStatus: PaymentFulfilmentStatus.APPLIED,
    });
    service.paymentsService.verifyPayment = async () => {
        throw new Error('Provider unavailable');
    };
    const result = await service.verifyExternalPayment(
        'resume-token',
        'ALC-original',
    );
    assert.equal(result.status, 'allocated');
    assert.equal(allocations(), 1);
});

test('late concurrent payment confirmation cannot downgrade an allocated application', async () => {
    const service = Object.create(PaymentsService.prototype) as any;
    const appId = new Types.ObjectId();
    const application = { status: 'allocated' };
    service.paymentTransactionModel = {
        db: {
            collection: (name: string) => {
                if (name === 'accommodationapplications')
                    return {
                        updateOne: async (filter: any, update: any) => {
                            if (filter.status?.$ne !== application.status)
                                application.status = update.$set.status;
                        },
                    };
                if (name === 'accommodationassignments')
                    return {
                        findOne: async () => ({
                            accommodationApplicationId: appId,
                        }),
                    };
                return { updateOne: async () => {} };
            },
        },
    };
    await service.finalizeAccommodationPayment({
        accommodationApplicationId: appId,
        reference: 'ALC-original',
    });
    assert.equal(application.status, 'allocated');
});

test('status checks retry interrupted fulfilment only for applied payments still awaiting progression', async () => {
    const { service } = setup();
    let applicationStatus = 'awaiting_payment';
    let retries = 0;
    service.paymentTransactionModel.db = {
        collection: () => ({
            findOne: async () => ({ status: applicationStatus }),
        }),
    };
    service.finalizeAccommodationPayment = async () => {
        retries += 1;
    };
    const transaction = {
        ...attempt(),
        status: PaymentStatus.SUCCESSFUL,
        fulfilmentStatus: PaymentFulfilmentStatus.APPLIED,
        paymentContext: 'accommodation_application',
    };
    await service.retryAccommodationPaymentFulfilment(transaction);
    assert.equal(retries, 1);
    applicationStatus = 'allocated';
    await service.retryAccommodationPaymentFulfilment(transaction);
    assert.equal(retries, 1);
    transaction.fulfilmentStatus = PaymentFulfilmentStatus.QUARANTINED;
    applicationStatus = 'awaiting_payment';
    await service.retryAccommodationPaymentFulfilment(transaction);
    assert.equal(retries, 1);
});

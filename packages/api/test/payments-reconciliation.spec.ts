import { strict as assert } from 'node:assert';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { PaymentsService } from '../src/payments/payments.service';
import {
    PaymentContext,
    PaymentFulfilmentStatus,
    PaymentMethod,
    PaymentStatus,
    ProviderInitializationStatus,
} from '../src/schemas/payment-transaction.schema';

function serviceWithoutConstructor() {
    const service = Object.create(PaymentsService.prototype) as any;
    service.logger = { log() { }, error() { } };
    return service;
}

test('strict Paystack validation rejects amount and metadata mismatches', () => {
    const service = serviceWithoutConstructor();
    const paymentTransactionId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const paymentId = new Types.ObjectId();
    const mismatches = service.validatePaystackTransaction({
        _id: paymentTransactionId,
        reference: 'ALC-expected',
        amount: 20000,
        userId,
        paymentId,
        providerInitializationStatus: ProviderInitializationStatus.INITIALIZED,
    }, {
        reference: 'ALC-expected',
        amount: 1999900,
        currency: 'NGN',
        metadata: {
            paymentTransactionId: paymentTransactionId.toString(),
            userId: new Types.ObjectId().toString(),
            paymentId: paymentId.toString(),
        },
    });

    assert.deepEqual(mismatches, ['amount', 'metadata.userId']);
});

test('a newly initialized successful payment moves from unapplied to applied once', async () => {
    const service = serviceWithoutConstructor();
    const applicationId = new Types.ObjectId();
    const transaction: any = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        applicationId,
        paymentId: new Types.ObjectId(),
        academicSessionId: new Types.ObjectId(),
        paymentContext: PaymentContext.ADMISSION_APPLICATION,
        reference: 'ALC-success',
        amount: 20000,
        status: PaymentStatus.PENDING,
        method: PaymentMethod.PAYSTACK,
        providerInitializationStatus: ProviderInitializationStatus.INITIALIZED,
        fulfilmentStatus: PaymentFulfilmentStatus.UNAPPLIED,
        verificationAttempts: 0,
        saveCount: 0,
        async save() { this.saveCount += 1; },
    };
    let stageUpdates = 0;
    let duplicateQuery: any;
    service.paymentTransactionModel = {
        findOne(query: any) {
            if (query.gatewayId) return { select: async () => null };
            duplicateQuery = query;
            return { sort: async () => null };
        },
    };
    service.paymentReconciliationCaseModel = { create: async () => { throw new Error('not expected'); } };
    service.updateApplicationStageAfterPayment = async () => { stageUpdates += 1; };
    service.markSuccessfulPaystackPaymentAwaitingRemittance = () => { };

    await service.applyPaystackTransactionState(transaction, {
        id: 6534675537,
        reference: transaction.reference,
        status: 'success',
        amount: 2000000,
        currency: 'NGN',
        paid_at: new Date().toISOString(),
        channel: 'card',
        metadata: {
            paymentTransactionId: transaction._id.toString(),
            userId: transaction.userId.toString(),
            paymentId: transaction.paymentId.toString(),
        },
    });

    assert.equal(transaction.status, PaymentStatus.SUCCESSFUL);
    assert.equal(transaction.fulfilmentStatus, PaymentFulfilmentStatus.APPLIED);
    assert.equal(stageUpdates, 1);
    assert.equal(transaction.saveCount, 1);
    assert.equal(
        duplicateQuery.$and[1].$or[1].applicationId.toString(),
        applicationId.toString(),
    );
});

test('Paystack webhook acceptance verifies its signature and is idempotent', async () => {
    const service = serviceWithoutConstructor();
    service.paystackSecretKey = 'test-secret';
    const eventId = new Types.ObjectId();
    let storedEvent: any = null;
    service.paymentProviderEventModel = {
        findOne: async () => storedEvent,
        create: async (data: any) => {
            storedEvent = { _id: eventId, ...data };
            return storedEvent;
        },
    };
    const payload = {
        event: 'charge.success',
        data: { id: 6534675537, reference: 'ALC-webhook', amount: 2000000, currency: 'NGN' },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha512', service.paystackSecretKey).update(rawBody).digest('hex');

    const first = await service.acceptPaystackWebhook(signature, rawBody, payload);
    const second = await service.acceptPaystackWebhook(signature, rawBody, payload);

    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    assert.equal(first.eventId, second.eventId);
    await assert.rejects(
        () => service.acceptPaystackWebhook('invalid', rawBody, payload),
        /Invalid Paystack webhook signature/,
    );
});

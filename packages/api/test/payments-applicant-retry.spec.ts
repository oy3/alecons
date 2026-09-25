import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { PaymentStatus } from '../src/schemas/payment-transaction.schema';
import { PaymentsService } from '../src/payments/payments.service';

function createService(existingAttempt: any) {
    const createdTransactions: any[] = [];
    const service = Object.create(PaymentsService.prototype) as any;
    const existingSuccessfulPayment = null;
    let findOneCallCount = 0;
    let paystackInitializationCount = 0;

    service.logger = { log() { }, error() { } };
    service.paymentModel = {
        findById: async () => ({ _id: new Types.ObjectId(), amount: 20000, name: 'Form Fee' }),
    };
    service.paymentTransactionModel = {
        findOne: () => {
            findOneCallCount += 1;
            if (findOneCallCount === 1) {
                return Promise.resolve(existingSuccessfulPayment);
            }
            return {
                sort: async () => existingAttempt,
            };
        },
        create: async (transaction: any) => {
            createdTransactions.push(transaction);
            return transaction;
        },
    };
    service.resolveLinkedApplication = async () => ({
        applicationId: new Types.ObjectId(),
        academicSessionId: new Types.ObjectId(),
    });
    service.assertApplicationPortalPaymentAllowed = async () => { };
    service.resolveDestinationForPayment = async () => null;
    service.assertPaymentMethodEnabled = async () => { };
    service.buildDestinationSnapshot = () => ({});
    service.verifyPaystackTransaction = async () => ({ status: 'success' });
    service.applyPaystackTransactionState = async (attempt: any, transaction: any) => {
        attempt.status = transaction.status === 'success' ? PaymentStatus.SUCCESSFUL : PaymentStatus.FAILED;
        await attempt.save();
    };
    service.createPaystackTransaction = async (_payment: any, _email: string, reference: string) => {
        paystackInitializationCount += 1;
        return {
            data: { authorization_url: 'https://checkout.test', access_code: 'access-code', reference },
        };
    };

    return { service, createdTransactions, getPaystackInitializationCount: () => paystackInitializationCount };
}

test('verified success stops applicant retry without replacing its reference', async () => {
    const originalReference = 'ALC-original';
    const existingAttempt = {
        reference: originalReference,
        status: PaymentStatus.PENDING,
        retryCount: 0,
        save: async () => { },
    };
    const { service, createdTransactions, getPaystackInitializationCount } = createService(existingAttempt);

    const result = await service.initializePayment(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
        'applicant@example.com',
        new Types.ObjectId().toString(),
    );

    assert.equal(result.alreadyPaid, true);
    assert.equal(result.reference, originalReference);
    assert.equal(existingAttempt.reference, originalReference);
    assert.equal(existingAttempt.status, PaymentStatus.SUCCESSFUL);
    assert.equal(createdTransactions.length, 0);
    assert.equal(getPaystackInitializationCount(), 0);
});

test('failed applicant attempt remains unchanged when a new retry is created', async () => {
    const originalReference = 'ALC-original';
    const existingAttempt = {
        reference: originalReference,
        status: PaymentStatus.FAILED,
        retryCount: 1,
        save: async () => { },
    };
    const { service, createdTransactions } = createService(existingAttempt);
    service.verifyPaystackTransaction = async () => ({ status: 'failed' });

    const result = await service.initializePayment(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
        'applicant@example.com',
        new Types.ObjectId().toString(),
    );

    assert.equal(result.reference, createdTransactions[0].reference);
    assert.notEqual(result.reference, originalReference);
    assert.equal(existingAttempt.reference, originalReference);
    assert.equal(existingAttempt.status, PaymentStatus.FAILED);
    assert.equal(createdTransactions.length, 1);
    assert.equal(createdTransactions[0].retryCount, 2);
});
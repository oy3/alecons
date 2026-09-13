import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SessionControlsService } from '../src/services/session-controls.service';

function sessionControlDocument(activeControls: string[]) {
    return {
        controls: [
            { name: 'application', active: activeControls.includes('application') },
            { name: 'admissionProcessing', active: activeControls.includes('admissionProcessing') },
        ],
        payments: [],
        save: async function () { return this; },
    } as any;
}

function service(document: any) {
    const sessionControlModel = {
        findOne: () => Promise.resolve(document),
    };
    return new SessionControlsService(sessionControlModel as any, {} as any);
}

function serviceWithPayments(document: any, payments: any[]) {
    const sessionControlModel = { findOne: () => Promise.resolve(document) };
    const paymentModel = {
        find: () => ({ select: () => ({ lean: () => Promise.resolve(payments) }) }),
    };
    return new SessionControlsService(sessionControlModel as any, paymentModel as any);
}

test('closing the application control only saves controls and does not expire applications', async () => {
    const document = sessionControlDocument(['application']);
    const controls = service(document);
    const result = await controls.updateControls(
        new Types.ObjectId().toString(),
        {
            controls: [
                { name: 'application', active: false },
                { name: 'admissionProcessing', active: true },
            ],
        },
        new Types.ObjectId().toString(),
    );

    assert.equal(result, document);
    assert.equal(document.controls.find((item: any) => item.name === 'application').active, false);
    assert.equal(document.controls.find((item: any) => item.name === 'admissionProcessing').active, true);
});

test('application intake assertion follows the application control', async () => {
    await service(sessionControlDocument(['application']))
        .assertApplicationIntakeOpen(new Types.ObjectId());

    await assert.rejects(
        () => service(sessionControlDocument([])).assertApplicationIntakeOpen(new Types.ObjectId()),
        (error: unknown) => error instanceof ConflictException,
    );
});

test('admission processing assertion is independent from application intake', async () => {
    const controls = service(sessionControlDocument(['admissionProcessing']));
    await controls.assertAdmissionProcessingEnabled(new Types.ObjectId());
    await assert.rejects(
        () => controls.assertApplicationIntakeOpen(new Types.ObjectId()),
        /Applications for this academic session are currently closed/,
    );
});

test('an accommodation intake cannot open without its payment mapping', async () => {
    const document = sessionControlDocument([]);
    await assert.rejects(
        () => serviceWithPayments(document, []).updateControls(
            new Types.ObjectId().toString(),
            {
                accommodation: {
                    internalApplicationsOpen: false,
                    externalApplicationsOpen: true,
                    categories: [{ code: 'pre_degree', label: 'Pre-degree', active: true, isDefault: true }],
                },
            },
            new Types.ObjectId().toString(),
        ),
        /Select an external accommodation payment/,
    );
});

test('external accommodation requires an active external-resident payment', async () => {
    const document = sessionControlDocument([]);
    const paymentId = new Types.ObjectId();
    await assert.rejects(
        () => serviceWithPayments(document, [{ _id: paymentId, targetAudience: ['student'] }]).updateControls(
            new Types.ObjectId().toString(),
            {
                accommodation: {
                    internalApplicationsOpen: false,
                    externalApplicationsOpen: true,
                    externalPaymentId: paymentId.toString(),
                    categories: [{ code: 'pre_degree', label: 'Pre-degree', active: true, isDefault: true }],
                },
            },
            new Types.ObjectId().toString(),
        ),
        /available to external residents/,
    );
});

test('literal undefined accommodation payment is treated as unselected', async () => {
    const document = sessionControlDocument([]);
    await assert.rejects(
        () => serviceWithPayments(document, []).updateControls(
            new Types.ObjectId().toString(),
            {
                accommodation: {
                    internalApplicationsOpen: false,
                    externalApplicationsOpen: true,
                    externalPaymentId: 'undefined',
                    categories: [{ code: 'pre_degree', label: 'Pre-degree', active: true, isDefault: true }],
                },
            },
            new Types.ObjectId().toString(),
        ),
        /Select an external accommodation payment/,
    );
});

test('invalid accommodation payment identifiers are rejected before querying MongoDB', async () => {
    const document = sessionControlDocument([]);
    await assert.rejects(
        () => serviceWithPayments(document, []).updateControls(
            new Types.ObjectId().toString(),
            {
                accommodation: {
                    internalApplicationsOpen: false,
                    externalApplicationsOpen: false,
                    externalPaymentId: 'not-an-object-id',
                    categories: [{ code: 'pre_degree', label: 'Pre-degree', active: true, isDefault: true }],
                },
            },
            new Types.ObjectId().toString(),
        ),
        /Select a valid accommodation payment/,
    );
});

test('accommodation dates must form a valid window', async () => {
    const document = sessionControlDocument([]);
    await assert.rejects(
        () => serviceWithPayments(document, []).updateControls(
            new Types.ObjectId().toString(),
            {
                accommodation: {
                    internalApplicationsOpen: false,
                    externalApplicationsOpen: false,
                    applicationOpenAt: '2026-10-02T00:00:00.000Z',
                    applicationCloseAt: '2026-10-01T00:00:00.000Z',
                    categories: [{ code: 'pre_degree', label: 'Pre-degree', active: true, isDefault: true }],
                },
            },
            new Types.ObjectId().toString(),
        ),
        /closing date must be later/,
    );
});

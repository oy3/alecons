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

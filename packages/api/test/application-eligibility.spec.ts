import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ApplicationEligibilityService } from '../src/services/application-eligibility.service';

test('closed application control uses the academic session title in its message', async () => {
    const openSession = {
        _id: 'session-id',
        sessionYear: '2026/2027',
        title: '2026/2027 Batch B',
        status: 'open',
        active: true,
    };
    const sessionModel = {
        findOne: () => ({
            sort: async () => openSession,
        }),
    };
    const sessionControlModel = {
        findOne: async () => ({
            controls: [{ name: 'application', active: false }],
        }),
    };
    const service = new ApplicationEligibilityService(
        sessionModel as any,
        sessionControlModel as any,
    );

    const result = await service.checkRegistrationEligibility();

    assert.equal(result.eligible, false);
    assert.equal(
        result.reason,
        'Applications for 2026/2027 Batch B are currently closed.',
    );
    assert.equal(result.reason?.includes('disabled'), false);
});

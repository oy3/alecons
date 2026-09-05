import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
    canRevokeAdmissionDecision,
    getScheduledLagosDateTime,
    hasSubmittedApplication,
    isUnfinishedApplication,
} from '../src/utils/application-lifecycle.util';

test('expiry eligibility uses explicit terminal state and matriculation checks', () => {
    assert.equal(isUnfinishedApplication({ status: 'pending' }), true);
    assert.equal(isUnfinishedApplication({ status: 'admitted', admissionDecision: 'admitted' }), true);
    assert.equal(isUnfinishedApplication({ status: 'cleared', admissionDecision: 'admitted' }), true);
    assert.equal(isUnfinishedApplication({ status: 'completed' }), false);
    assert.equal(isUnfinishedApplication({ status: 'rejected' }), false);
    assert.equal(isUnfinishedApplication({ status: 'expired' }), false);
    assert.equal(
        isUnfinishedApplication({ status: 'admitted', matriculationNumber: 'ALC/ND/26/000001' }),
        false,
    );
});

test('admission revocation is limited to unfinished admitted applications', () => {
    assert.equal(
        canRevokeAdmissionDecision({ status: 'admitted', admissionDecision: 'admitted' }),
        true,
    );
    assert.equal(
        canRevokeAdmissionDecision({ status: 'pending', admissionDecision: 'admitted' }),
        true,
    );
    assert.equal(
        canRevokeAdmissionDecision({ status: 'pending', admissionDecision: 'pending' }),
        false,
    );
    assert.equal(
        canRevokeAdmissionDecision({ status: 'completed', admissionDecision: 'admitted' }),
        false,
    );
});

test('submission detection supports new and legacy application records', () => {
    assert.equal(hasSubmittedApplication({ submittedAt: new Date() }), true);
    assert.equal(
        hasSubmittedApplication({ auditTrail: [{ action: 'application_submitted' }] }),
        true,
    );
    assert.equal(
        hasSubmittedApplication({
            profileImageUrl: 'https://example.test/profile.jpg',
            academicBackground: { primary: {}, secondary: {} },
            documents: { olevelResults: [{}], referenceLetters: [{}] },
            examinations: [{}],
            referees: [{}],
        }),
        true,
    );
    assert.equal(hasSubmittedApplication({ status: 'pending' }), false);
});

test('screening schedule combines stored date with Africa/Lagos time', () => {
    const scheduledAt = getScheduledLagosDateTime('2026-09-05', '14:30');
    assert.equal(scheduledAt?.toISOString(), '2026-09-05T13:30:00.000Z');
    assert.equal(getScheduledLagosDateTime('2026-09-05', '25:00'), null);
    assert.equal(getScheduledLagosDateTime(undefined, '14:30'), null);
});

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AccommodationAssignmentSchema } from '../src/schemas/accommodation-assignment.schema';
import { AccommodationApplicationStatus } from '../src/schemas/accommodation-application.schema';
import { TenancyAgreementSchema } from '../src/schemas/tenancy-agreement.schema';
import { UpdateHostelBlockDto, UpdateHostelDto, UpdateHostelRoomDto } from '../src/dto/accommodation.dto';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
    SaveInternalAccommodationAgreementDraftDto,
    SubmitInternalAccommodationAgreementDto,
} from '../src/dto/internal-accommodation.dto';
import { AccommodationApplicationSchema } from '../src/schemas/accommodation-application.schema';

test('assignment indexes preserve transfer history while enforcing one active allocation', () => {
    const indexes = AccommodationAssignmentSchema.indexes();
    const activeApplicationIndex = indexes.find(([keys, options]) =>
        keys.accommodationApplicationId === 1 && options.name === 'uniq_active_assignment_per_application',
    );
    const activeSlotIndex = indexes.find(([, options]) => options.name === 'uniq_active_room_slot_per_session');

    assert.ok(activeApplicationIndex);
    assert.equal(activeApplicationIndex?.[1].unique, true);
    assert.deepEqual(activeApplicationIndex?.[1].partialFilterExpression, { status: 'active' });
    assert.ok(activeSlotIndex);
});

test('accommodation lifecycle exposes separate payment-review and allocation states', () => {
    assert.equal(AccommodationApplicationStatus.AWAITING_AGREEMENT, 'awaiting_agreement');
    assert.equal(AccommodationApplicationStatus.PAYMENT_PENDING_REVIEW, 'payment_pending_review');
    assert.equal(AccommodationApplicationStatus.PAID_AWAITING_ALLOCATION, 'paid_awaiting_allocation');
    assert.equal(AccommodationApplicationStatus.ALLOCATED, 'allocated');
});

test('tenancy agreements enforce one record per resident and session', () => {
    const indexes = TenancyAgreementSchema.indexes();
    const studentIndex = indexes.find(([, options]) => options.name === 'uniq_tenancy_student_session');
    const externalIndex = indexes.find(([, options]) => options.name === 'uniq_tenancy_external_session');

    assert.equal(studentIndex?.[1].unique, true);
    assert.deepEqual(studentIndex?.[1].partialFilterExpression, { studentId: { $type: 'objectId' } });
    assert.equal(externalIndex?.[1].unique, true);
    assert.deepEqual(externalIndex?.[1].partialFilterExpression, { externalResidentId: { $type: 'objectId' } });
});

test('external tenancy execution waits for payment and allocation documents', () => {
    const statusValues = (TenancyAgreementSchema.path('status') as any).enumValues;
    assert.ok(statusValues.includes('signed_awaiting_payment'));
    assert.ok(statusValues.includes('payment_confirmed_awaiting_allocation'));
    assert.ok(statusValues.includes('executed'));
});

test('inventory updates support validated partial edits', () => {
    const hostel = Object.assign(new UpdateHostelDto(), { name: 'Daniel Hostel' });
    const block = Object.assign(new UpdateHostelBlockDto(), { allocationOrder: 2 });
    const room = Object.assign(new UpdateHostelRoomDto(), { capacity: 12 });

    assert.equal(validateSync(hostel).length, 0);
    assert.equal(validateSync(block).length, 0);
    assert.equal(validateSync(room).length, 0);
});

test('inventory room edits reject unsafe field values at the request boundary', () => {
    const room = Object.assign(new UpdateHostelRoomDto(), { capacity: 0, allocationOrder: 0 });
    const fields = validateSync(room).flatMap((error) => error.property);

    assert.ok(fields.includes('capacity'));
    assert.ok(fields.includes('allocationOrder'));
});

test('accommodation agreement drafts allow incomplete validated fields', () => {
    const draft = plainToInstance(SaveInternalAccommodationAgreementDraftDto, {
        personalInfo: { residentialAddress: '12 College Road' },
        guarantorInfo: { relationship: 'mother' },
    });
    assert.equal(validateSync(draft).length, 0);
    assert.equal((AccommodationApplicationSchema.path('agreementDraft') as any).options.select, false);
});

test('final accommodation agreement submission requires complete details and acceptance', () => {
    const incomplete = plainToInstance(SubmitInternalAccommodationAgreementDto, {
        personalInfo: {}, parentInfo: {}, guarantorInfo: {}, agreementTerms: { agreedToTerms: true },
    });
    assert.ok(validateSync(incomplete).length > 0);

    const complete = plainToInstance(SubmitInternalAccommodationAgreementDto, {
        personalInfo: {
            tenantName: 'Ada Student', courseOfStudy: 'ND Nursing',
            residentialAddress: '12 College Road', phoneNumber: '08031234567',
        },
        parentInfo: { name: 'Pat Student', phoneNumber: '08039876543' },
        guarantorInfo: {
            name: 'Pat Student', phoneNumber: '08039876543', address: '12 College Road',
            occupation: 'Teacher', relationship: 'mother',
        },
        agreementTerms: { agreedToTerms: true },
    });
    assert.equal(validateSync(complete).length, 0);
});

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { GradingService } from '../src/services/grading.service';

function gradingServiceFixture(examStatus: 'completed' | 'graded', attemptStatuses: string[]) {
    const updates: Array<{ id: string; update: Record<string, unknown> }> = [];
    const examId = new Types.ObjectId();
    const examModel = {
        findById() {
            return {
                lean: async () => ({ _id: examId, status: examStatus }),
            };
        },
        async findByIdAndUpdate(id: string, update: Record<string, unknown>) {
            updates.push({ id, update });
        },
    };
    const attemptModel = {
        find() {
            return {
                lean: async () => attemptStatuses.map((status) => ({ status, isValid: true })),
            };
        },
    };
    const service = new GradingService(
        {} as any,
        {} as any,
        attemptModel as any,
        examModel as any,
        {} as any,
    );

    return { service, examId, updates };
}

test('completed exam becomes graded when every valid attempt is graded', async () => {
    const { service, examId, updates } = gradingServiceFixture('completed', ['graded', 'graded']);

    const status = await service.reconcileExamGradingStatus(examId.toString());

    assert.equal(status, 'graded');
    assert.deepEqual(updates, [
        { id: examId.toString(), update: { status: 'graded' } },
    ]);
});

test('an unfinished valid attempt keeps the exam completed', async () => {
    const { service, examId, updates } = gradingServiceFixture('completed', ['graded', 'in-progress']);

    const status = await service.reconcileExamGradingStatus(examId.toString());

    assert.equal(status, 'completed');
    assert.deepEqual(updates, []);
});

test('an exam with no valid attempts remains completed', async () => {
    const { service, examId, updates } = gradingServiceFixture('completed', []);

    const status = await service.reconcileExamGradingStatus(examId.toString());

    assert.equal(status, 'completed');
    assert.deepEqual(updates, []);
});

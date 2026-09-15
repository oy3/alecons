import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { ExamService } from '../src/services/exam.service';

test('CBT application lookup selects the newest application deterministically', async () => {
    let appliedSort: Record<string, number> | undefined;
    const expectedApplication = { _id: new Types.ObjectId() };
    const applicationQuery = {
        sort(sort: Record<string, number>) {
            appliedSort = sort;
            return this;
        },
        select() {
            return this;
        },
        async exec() {
            return expectedApplication;
        },
    };

    const applicationModel = {
        findOne() {
            return applicationQuery;
        },
    };
    const service = new ExamService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        applicationModel as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
    );

    const result = await (service as any).getLatestUserApplication(
        new Types.ObjectId().toString(),
    );

    assert.deepEqual(appliedSort, { createdAt: -1, _id: -1 });
    assert.equal(result, expectedApplication);
});

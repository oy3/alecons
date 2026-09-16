import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validate } from 'class-validator';
import { UpdateEntranceExamScoreDto } from '../src/dto/update-entrance-exam-score.dto';

async function validationErrors(score: unknown, passed: unknown) {
    const dto = Object.assign(new UpdateEntranceExamScoreDto(), { score, passed });
    return validate(dto);
}

test('entrance exam score accepts an explicit passed or did-not-pass outcome', async () => {
    assert.equal((await validationErrors(65, true)).length, 0);
    assert.equal((await validationErrors(42, false)).length, 0);
});

test('entrance exam score rejects a missing or non-boolean outcome', async () => {
    assert.ok((await validationErrors(65, undefined)).length > 0);
    assert.ok((await validationErrors(65, null)).length > 0);
    assert.ok((await validationErrors(65, 'false')).length > 0);
});

test('entrance exam score must remain within zero and one hundred', async () => {
    assert.ok((await validationErrors(-1, true)).length > 0);
    assert.ok((await validationErrors(101, false)).length > 0);
});

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createQuestionFingerprint } from '../src/utils/question-fingerprint';

test('question fingerprints ignore harmless casing and whitespace differences', () => {
    const first = createQuestionFingerprint({
        type: 'mcq',
        questionText: '  What is a noun? ',
        options: { a: 'A person', b: 'An action' },
        answer: 'a',
    });
    const second = createQuestionFingerprint({
        type: 'MCQ',
        questionText: 'what  is a NOUN?',
        options: { b: 'an action', a: 'a person' },
        answer: 'A',
    });

    assert.equal(first, second);
});

test('question fingerprints do not merge questions with different answers', () => {
    const base = {
        type: 'mcq',
        questionText: 'What is a noun?',
        options: { a: 'A person', b: 'An action' },
    };

    assert.notEqual(
        createQuestionFingerprint({ ...base, answer: 'a' }),
        createQuestionFingerprint({ ...base, answer: 'b' }),
    );
});

test('multi-select answer order does not affect an exact duplicate fingerprint', () => {
    const base = {
        type: 'multi',
        questionText: 'Select the nouns.',
        options: { a: 'Teacher', b: 'Run', c: 'School' },
    };

    assert.equal(
        createQuestionFingerprint({ ...base, answer: ['a', 'c'] }),
        createQuestionFingerprint({ ...base, answer: ['c', 'a'] }),
    );
});

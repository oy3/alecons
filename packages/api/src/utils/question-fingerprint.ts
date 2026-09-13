import { createHash } from 'crypto';

const normalizeText = (value: unknown): string => String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export function normalizeQuestionOptions(options: unknown): Record<string, string> {
    if (!options || typeof options !== 'object' || Array.isArray(options)) return {};
    return Object.entries(options as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .reduce((result, [key, value]) => {
            result[normalizeText(key)] = normalizeText(value);
            return result;
        }, {} as Record<string, string>);
}

export function createQuestionFingerprint(question: {
    questionText?: unknown;
    type?: unknown;
    options?: unknown;
    answer?: unknown;
    mediaUrls?: unknown;
}): string {
    const answers = Array.isArray(question.answer)
        ? question.answer.map(normalizeText).sort()
        : normalizeText(question.answer);
    const mediaUrls = Array.isArray(question.mediaUrls)
        ? question.mediaUrls.map(normalizeText).sort()
        : [];
    const canonical = JSON.stringify({
        type: normalizeText(question.type),
        questionText: normalizeText(question.questionText),
        options: normalizeQuestionOptions(question.options),
        answer: answers,
        mediaUrls,
    });
    return createHash('sha256').update(canonical).digest('hex');
}

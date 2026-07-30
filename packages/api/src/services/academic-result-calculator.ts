import { BadRequestException } from '@nestjs/common';
import { AcademicResultAttemptType, AcademicResultSpecialStatus, AcademicResultWorkflowStatus } from '../schemas/academic-result.schema';

export function roundAcademicValue(value: number): number {
    return Number(Number(value).toFixed(4));
}

export function nextAcademicAttemptType(latestPublished?: { attemptType?: AcademicResultAttemptType; isPass?: boolean } | null): AcademicResultAttemptType | null {
    if (!latestPublished || latestPublished.isPass === true) return null;
    if (latestPublished.attemptType === AcademicResultAttemptType.INITIAL) return AcademicResultAttemptType.RESIT;
    if (latestPublished.attemptType === AcademicResultAttemptType.RESIT) return AcademicResultAttemptType.REPEAT;
    return null;
}

const ACADEMIC_WORKFLOW_TRANSITIONS: Partial<Record<AcademicResultWorkflowStatus, AcademicResultWorkflowStatus[]>> = {
    [AcademicResultWorkflowStatus.DRAFT]: [AcademicResultWorkflowStatus.SUBMITTED_TO_HOD],
    [AcademicResultWorkflowStatus.RETURNED_BY_HOD]: [AcademicResultWorkflowStatus.SUBMITTED_TO_HOD],
    [AcademicResultWorkflowStatus.RETURNED_BY_PROVOST]: [AcademicResultWorkflowStatus.SUBMITTED_TO_HOD],
    [AcademicResultWorkflowStatus.SUBMITTED_TO_HOD]: [AcademicResultWorkflowStatus.HOD_APPROVED, AcademicResultWorkflowStatus.RETURNED_BY_HOD],
    [AcademicResultWorkflowStatus.HOD_APPROVED]: [AcademicResultWorkflowStatus.SUBMITTED_TO_PROVOST],
    [AcademicResultWorkflowStatus.SUBMITTED_TO_PROVOST]: [AcademicResultWorkflowStatus.PROVOST_APPROVED, AcademicResultWorkflowStatus.RETURNED_BY_PROVOST],
    [AcademicResultWorkflowStatus.PROVOST_APPROVED]: [AcademicResultWorkflowStatus.PUBLISHED],
};

export function assertAcademicWorkflowTransition(previous: AcademicResultWorkflowStatus, next: AcademicResultWorkflowStatus): void {
    if (!ACADEMIC_WORKFLOW_TRANSITIONS[previous]?.includes(next)) {
        throw new BadRequestException(`Academic result cannot move from ${previous} to ${next}`);
    }
}

export function validateAcademicResultSubmission(
    attemptType: AcademicResultAttemptType,
    results: any[],
    expectedStudentIds: string[] = [],
    registeredStudentIds?: string[],
): void {
    if (!results.length) throw new BadRequestException('There are no results to submit');

    const actual = new Set(results.map((result) => String(result.studentId?._id || result.studentId)));
    const registered = new Set((registeredStudentIds || []).map(String));
    if (registeredStudentIds && [...actual].some((studentId) => !registered.has(studentId))) {
        throw new BadRequestException('Every submitted result requires an active approved registration for this course and session');
    }

    if (expectedStudentIds.length || attemptType === AcademicResultAttemptType.INITIAL) {
        const expected = new Set(expectedStudentIds.map(String));
        if (expected.size !== actual.size || [...expected].some((studentId) => !actual.has(studentId))) {
            throw new BadRequestException(
                `Enter a result for every eligible ${attemptType} student with an approved current course registration before submitting`,
            );
        }
    }

    results.forEach((result) => assertSupportedAcademicResultStatus(result.specialStatus));
    if (results.some((result) => result.finalScore === undefined || result.gradePoint === undefined)) {
        throw new BadRequestException('Complete all mandatory assessment marks before submitting');
    }
}

export function assertSupportedAcademicResultStatus(status?: AcademicResultSpecialStatus): void {
    if ((status || AcademicResultSpecialStatus.NORMAL) !== AcademicResultSpecialStatus.NORMAL) {
        throw new BadRequestException(
            'Whole-result special statuses cannot enter the approval workflow until their institutional policy is configured. Use component-level absence where permitted',
        );
    }
}

export function validateGradeBands(bands: any[], gpaScale: number): void {
    if (!Array.isArray(bands) || !bands.length) {
        throw new BadRequestException('Add at least one grade band');
    }
    const ordered = [...bands].sort((left, right) => Number(left.minScore) - Number(right.minScore));
    let expectedMinimum = 0;
    const letters = new Set<string>();

    for (const band of ordered) {
        const minimum = Number(band.minScore);
        const maximum = Number(band.maxScore);
        const gradePoint = Number(band.gradePoint);
        const letter = band.letter?.trim();
        if (
            !letter ||
            !Number.isFinite(minimum) ||
            !Number.isFinite(maximum) ||
            minimum !== expectedMinimum ||
            maximum < minimum ||
            maximum > 100 ||
            gradePoint < 0 ||
            gradePoint > gpaScale ||
            letters.has(letter)
        ) {
            throw new BadRequestException(
                'Grade bands must cover 0-100 without gaps or overlaps and use valid grade points',
            );
        }
        letters.add(letter);
        expectedMinimum = maximum + 1;
    }
    if (expectedMinimum !== 101) {
        throw new BadRequestException('Grade bands must end at 100');
    }
}

export function validateAssessmentComponents(components: any[]): void {
    const active = (components || []).filter((component) => component.active !== false);
    if (!active.length) {
        throw new BadRequestException(
            'Configure assessment components for this program course before entering scores',
        );
    }
    const orders = new Set<number>();
    let scaledWeight = 0;
    for (const component of active) {
        const order = Number(component.displayOrder);
        if (
            !component.title?.trim() ||
            Number(component.maximumMark) <= 0 ||
            Number(component.weightPercent) <= 0 ||
            orders.has(order)
        ) {
            throw new BadRequestException(
                'Assessment components require unique order, title, positive maximum mark, and positive weight',
            );
        }
        orders.add(order);
        scaledWeight += Math.round(Number(component.weightPercent) * 10000);
    }
    if (scaledWeight !== 100 * 10000) {
        throw new BadRequestException('Active assessment component weights must total exactly 100%');
    }
}

export function calculateAcademicResult(
    components: any[],
    submittedScores: any[],
    bands: any[],
    requestedStatus: AcademicResultSpecialStatus = AcademicResultSpecialStatus.NORMAL,
    allowIncomplete = false,
) {
    if (
        !Object.values(AcademicResultSpecialStatus).includes(requestedStatus) ||
        requestedStatus === AcademicResultSpecialStatus.ACADEMIC_REVIEW
    ) {
        throw new BadRequestException('Invalid result status');
    }
    const input = new Map(submittedScores.map((score: any) => [Number(score.componentOrder), score]));
    const componentScores = components
        .filter((component: any) => component.active !== false)
        .map((component: any) => {
            const score: any = input.get(Number(component.displayOrder));
            const absent = Boolean(score?.absent);
            const rawMark = score?.rawMark === '' || score?.rawMark === undefined || score?.rawMark === null
                ? undefined
                : Number(score.rawMark);
            if (absent && !component.absenceAllowed) {
                throw new BadRequestException(`${component.title} does not permit an absence`);
            }
            if (
                !absent &&
                rawMark !== undefined &&
                (!Number.isFinite(rawMark) || rawMark < 0 || rawMark > Number(component.maximumMark))
            ) {
                throw new BadRequestException(
                    `${component.title} requires a mark from 0 to ${component.maximumMark}`,
                );
            }
            if (!absent && rawMark === undefined && !allowIncomplete) {
                throw new BadRequestException(
                    `${component.title} requires a mark from 0 to ${component.maximumMark}`,
                );
            }
            return {
                componentOrder: component.displayOrder,
                componentTitle: component.title,
                componentType: component.componentType,
                maximumMarkSnapshot: Number(component.maximumMark),
                weightPercentSnapshot: Number(component.weightPercent),
                mandatorySnapshot: component.mandatory !== false,
                absenceAllowedSnapshot: component.absenceAllowed === true,
                rawMark,
                absent,
                weightedContribution: absent
                    ? 0
                    : rawMark === undefined
                        ? undefined
                        : roundAcademicValue(
                            rawMark / Number(component.maximumMark) * Number(component.weightPercent),
                        ),
            };
        });

    if (requestedStatus !== AcademicResultSpecialStatus.NORMAL) {
        return {
            componentScores,
            specialStatus: requestedStatus,
            finalScore: undefined,
            gradeLetter: undefined,
            gradePoint: undefined,
            qualityPoints: undefined,
            isPass: false,
        };
    }
    if (componentScores.some((score) =>
        score.mandatorySnapshot && !score.absent && score.rawMark === undefined,
    )) {
        return {
            componentScores,
            specialStatus: requestedStatus,
            finalScore: undefined,
            gradeLetter: undefined,
            gradePoint: undefined,
            qualityPoints: undefined,
            isPass: undefined,
        };
    }

    const finalScore = roundAcademicValue(
        componentScores.reduce(
            (total, score) => total + Number(score.weightedContribution || 0),
            0,
        ),
    );
    const orderedBands = [...bands].sort(
        (left: any, right: any) => Number(left.minScore) - Number(right.minScore),
    );
    const band = orderedBands.find((item: any, index: number) =>
        finalScore >= Number(item.minScore) &&
        (index === orderedBands.length - 1 || finalScore < Number(orderedBands[index + 1].minScore)),
    );
    if (!band) throw new BadRequestException('The active grade scale cannot resolve this score');
    return {
        componentScores,
        specialStatus: requestedStatus,
        finalScore,
        gradeLetter: band.letter,
        gradePoint: Number(band.gradePoint),
        qualityPoints: 0,
        isPass: Boolean(band.isPass),
    };
}

export function calculateGpa(results: Array<{ unitsSnapshot?: number; qualityPoints?: number }>) {
    const applicableUnits = results.reduce((sum, result) => sum + Number(result.unitsSnapshot || 0), 0);
    const qualityPoints = results.reduce((sum, result) => sum + Number(result.qualityPoints || 0), 0);
    return {
        applicableUnits,
        qualityPoints: roundAcademicValue(qualityPoints),
        gpa: applicableUnits ? roundAcademicValue(qualityPoints / applicableUnits) : 0,
    };
}

function documentId(value: any): string {
    return String(value?._id || value || '');
}

export function buildAcademicProgress(registrations: any[], publishedResults: any[]) {
    const orderedRegistrations = [...registrations].sort((left, right) => {
        const leftDate = new Date(left.academicSessionId?.startDate || left.createdAt || 0).getTime();
        const rightDate = new Date(right.academicSessionId?.startDate || right.createdAt || 0).getTime();
        return leftDate - rightDate || Number(left.semester) - Number(right.semester);
    });
    const latestByCourseAndSession = new Map<string, any>();
    for (const result of publishedResults) {
        const courseId = documentId(result.programCourseId);
        const sessionId = documentId(result.academicSessionId);
        const key = `${courseId}:${sessionId || '*'}`;
        const current = latestByCourseAndSession.get(key);
        if (
            !current ||
            Number(result.attemptNumber || 0) > Number(current.attemptNumber || 0) ||
            (
                Number(result.attemptNumber || 0) === Number(current.attemptNumber || 0) &&
                new Date(result.publishedAt || result.createdAt || 0).getTime() >
                    new Date(current.publishedAt || current.createdAt || 0).getTime()
            )
        ) {
            latestByCourseAndSession.set(key, result);
        }
    }

    const periods: any[] = [];
    for (const registration of orderedRegistrations) {
        const sessionId = documentId(registration.academicSessionId);
        const expectedCourseIds = [...new Set<string>(
            (registration.items || [])
                .map((item: any) => documentId(item.programCourseId))
                .filter(Boolean),
        )];
        if (!expectedCourseIds.length) continue;

        const latestResults = expectedCourseIds
            .map((courseId) => latestByCourseAndSession.get(`${courseId}:${sessionId}`)
                || latestByCourseAndSession.get(`${courseId}:*`))
            .filter(Boolean);
        const resolvedResults = latestResults.filter((result) =>
            [
                AcademicResultSpecialStatus.NORMAL,
                AcademicResultSpecialStatus.ACADEMIC_REVIEW,
            ].includes(result.specialStatus) &&
            Number.isFinite(Number(result.gradePoint)) &&
            Number.isFinite(Number(result.qualityPoints)),
        );
        const isComplete = resolvedResults.length === expectedCourseIds.length;
        const periodGpa = isComplete ? calculateGpa(resolvedResults) : null;
        periods.push({
            academicSessionId: documentId(registration.academicSessionId),
            academicSession: registration.academicSessionId,
            semester: Number(registration.semester),
            level: Number(registration.level),
            expectedCourses: expectedCourseIds.length,
            publishedCourses: latestResults.length,
            resolvedCourses: resolvedResults.length,
            isComplete,
            semesterGPA: periodGpa?.gpa ?? null,
            applicableUnits: periodGpa?.applicableUnits ?? null,
            earnedUnits: isComplete
                ? resolvedResults
                    .filter((result) => result.isPass === true)
                    .reduce((sum, result) => sum + Number(result.unitsSnapshot || 0), 0)
                : null,
            qualityPoints: periodGpa?.qualityPoints ?? null,
            cumulativeGPA: null,
            cumulativeApplicableUnits: null,
            cumulativeQualityPoints: null,
            resolvedResults,
        });
    }

    const cumulativeResultsByCourse = new Map<string, any>();
    let officialChainComplete = true;
    let completedPeriods = 0;
    for (const period of periods) {
        if (!officialChainComplete || !period.isComplete) {
            officialChainComplete = false;
            continue;
        }
        completedPeriods++;
        for (const result of period.resolvedResults) {
            cumulativeResultsByCourse.set(documentId(result.programCourseId), result);
        }
        const cumulative = calculateGpa([...cumulativeResultsByCourse.values()]);
        period.cumulativeApplicableUnits = cumulative.applicableUnits;
        period.cumulativeQualityPoints = cumulative.qualityPoints;
        period.cumulativeGPA = cumulative.gpa;
    }

    for (const period of periods) delete period.resolvedResults;
    const latestCompletedPeriod = [...periods].reverse().find((period) => period.cumulativeGPA !== null);

    return {
        periods,
        completedPeriods,
        officialCumulativeGPA: completedPeriods ? latestCompletedPeriod?.cumulativeGPA ?? null : null,
    };
}

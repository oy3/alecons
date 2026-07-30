import { AcademicResultAttemptType } from '../schemas/academic-result.schema';
import { StudentAnnualOutcome, StudentSemesterOutcome } from '../schemas/student-academic-session.schema';

function documentId(value: any): string {
    return String(value?._id || value || '');
}

function latestByCourse(results: any[], attemptType?: AcademicResultAttemptType): Map<string, any> {
    const latest = new Map<string, any>();
    for (const result of results) {
        if (attemptType && result.attemptType !== attemptType) continue;
        const courseId = documentId(result.programCourseId);
        const current = latest.get(courseId);
        if (!current || Number(result.attemptNumber || 0) > Number(current.attemptNumber || 0)) {
            latest.set(courseId, result);
        }
    }
    return latest;
}

export function calculateSemesterProgression(
    registration: any | null,
    publishedResults: any[],
    isRepeatYear: boolean,
) {
    if (!registration) {
        return {
            semester: 0,
            outcome: StudentSemesterOutcome.IN_PROGRESS,
            registeredCourseCount: 0,
            failedCourseCount: 0,
            resitLimitSnapshot: undefined,
            resitProgramCourseIds: [],
            unresolvedProgramCourseIds: [],
        };
    }

    const semester = Number(registration.semester);
    const expectedCourseIds: string[] = [...new Set<string>(
        (registration.items || []).map((item: any) => documentId(item.programCourseId)).filter(Boolean),
    )];
    const resitLimitSnapshot = Number(registration.resitLimitSnapshot);
    if (!expectedCourseIds.length || !Number.isInteger(resitLimitSnapshot) || resitLimitSnapshot < 1) {
        return {
            semester,
            outcome: StudentSemesterOutcome.RESULTS_INCOMPLETE,
            registeredCourseCount: expectedCourseIds.length,
            failedCourseCount: 0,
            resitLimitSnapshot: Number.isInteger(resitLimitSnapshot) ? resitLimitSnapshot : undefined,
            resitProgramCourseIds: [],
            unresolvedProgramCourseIds: expectedCourseIds,
        };
    }

    if (isRepeatYear) {
        const repeatByCourse = latestByCourse(publishedResults, AcademicResultAttemptType.REPEAT);
        const unresolved = expectedCourseIds.filter((courseId) => !repeatByCourse.has(courseId));
        if (unresolved.length) {
            return {
                semester,
                outcome: StudentSemesterOutcome.RESULTS_INCOMPLETE,
                registeredCourseCount: expectedCourseIds.length,
                failedCourseCount: 0,
                resitLimitSnapshot,
                resitProgramCourseIds: [],
                unresolvedProgramCourseIds: unresolved,
            };
        }
        const failed = expectedCourseIds.filter((courseId) => repeatByCourse.get(courseId)?.isPass !== true);
        return {
            semester,
            outcome: failed.length ? StudentSemesterOutcome.REPEAT_CANDIDATE : StudentSemesterOutcome.PASSED,
            registeredCourseCount: expectedCourseIds.length,
            failedCourseCount: failed.length,
            resitLimitSnapshot,
            resitProgramCourseIds: [],
            unresolvedProgramCourseIds: failed,
        };
    }

    const initialByCourse = latestByCourse(publishedResults, AcademicResultAttemptType.INITIAL);
    const missingInitial = expectedCourseIds.filter((courseId) => !initialByCourse.has(courseId));
    if (missingInitial.length) {
        return {
            semester,
            outcome: StudentSemesterOutcome.RESULTS_INCOMPLETE,
            registeredCourseCount: expectedCourseIds.length,
            failedCourseCount: 0,
            resitLimitSnapshot,
            resitProgramCourseIds: [],
            unresolvedProgramCourseIds: missingInitial,
        };
    }

    const initialFailures = expectedCourseIds.filter((courseId) => initialByCourse.get(courseId)?.isPass !== true);
    if (!initialFailures.length) {
        return {
            semester,
            outcome: StudentSemesterOutcome.PASSED,
            registeredCourseCount: expectedCourseIds.length,
            failedCourseCount: 0,
            resitLimitSnapshot,
            resitProgramCourseIds: [],
            unresolvedProgramCourseIds: [],
        };
    }
    if (initialFailures.length > resitLimitSnapshot) {
        return {
            semester,
            outcome: StudentSemesterOutcome.REPEAT_CANDIDATE,
            registeredCourseCount: expectedCourseIds.length,
            failedCourseCount: initialFailures.length,
            resitLimitSnapshot,
            resitProgramCourseIds: [],
            unresolvedProgramCourseIds: initialFailures,
        };
    }

    const resitByCourse = latestByCourse(publishedResults, AcademicResultAttemptType.RESIT);
    const pendingResits = initialFailures.filter((courseId) => !resitByCourse.has(courseId));
    if (pendingResits.length) {
        return {
            semester,
            outcome: pendingResits.length === initialFailures.length
                ? StudentSemesterOutcome.RESIT_REQUIRED
                : StudentSemesterOutcome.RESIT_IN_PROGRESS,
            registeredCourseCount: expectedCourseIds.length,
            failedCourseCount: initialFailures.length,
            resitLimitSnapshot,
            resitProgramCourseIds: initialFailures,
            unresolvedProgramCourseIds: pendingResits,
        };
    }

    const failedResits = initialFailures.filter((courseId) => resitByCourse.get(courseId)?.isPass !== true);
    return {
        semester,
        outcome: failedResits.length ? StudentSemesterOutcome.REPEAT_CANDIDATE : StudentSemesterOutcome.PASSED,
        registeredCourseCount: expectedCourseIds.length,
        failedCourseCount: failedResits.length,
        resitLimitSnapshot,
        resitProgramCourseIds: initialFailures,
        unresolvedProgramCourseIds: failedResits,
    };
}

export function calculateAnnualProgression(
    semesterProgressions: any[],
    isRepeatYear: boolean,
    level: number,
    durationYears: number,
): StudentAnnualOutcome {
    const semesterOne = semesterProgressions.find((item) => Number(item.semester) === 1);
    const semesterTwo = semesterProgressions.find((item) => Number(item.semester) === 2);
    if (!semesterOne || !semesterTwo) return StudentAnnualOutcome.IN_PROGRESS;

    const terminal = [StudentSemesterOutcome.PASSED, StudentSemesterOutcome.REPEAT_CANDIDATE];
    if (!terminal.includes(semesterOne.outcome) || !terminal.includes(semesterTwo.outcome)) {
        return [semesterOne.outcome, semesterTwo.outcome].includes(StudentSemesterOutcome.RESULTS_INCOMPLETE)
            ? StudentAnnualOutcome.RESULTS_INCOMPLETE
            : StudentAnnualOutcome.IN_PROGRESS;
    }

    const allPassed = semesterOne.outcome === StudentSemesterOutcome.PASSED
        && semesterTwo.outcome === StudentSemesterOutcome.PASSED;
    if (isRepeatYear) {
        if (!allPassed) return StudentAnnualOutcome.ACADEMIC_REVIEW;
        return level >= durationYears
            ? StudentAnnualOutcome.GRADUATION_REVIEW
            : StudentAnnualOutcome.ELIGIBLE_FOR_PROGRESSION;
    }
    if (!allPassed) return StudentAnnualOutcome.REPEAT_YEAR_REQUIRED;
    return level >= durationYears
        ? StudentAnnualOutcome.GRADUATION_REVIEW
        : StudentAnnualOutcome.ELIGIBLE_FOR_PROGRESSION;
}

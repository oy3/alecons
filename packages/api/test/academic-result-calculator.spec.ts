import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { AcademicResultAttemptType, AcademicResultSpecialStatus, AcademicResultWorkflowStatus } from '../src/schemas/academic-result.schema';
import {
    calculateAcademicResult,
    assertSupportedAcademicResultStatus,
    assertAcademicWorkflowTransition,
    calculateGpa,
    buildAcademicProgress,
    nextAcademicAttemptType,
    validateAssessmentComponents,
    validateAcademicResultSubmission,
    validateGradeBands,
} from '../src/services/academic-result-calculator';
import { hasAcademicResultPermission, isAssignedAcademicOwner } from '../src/services/academic-result-access';
import { filterStudentsWithCurrentCourseRegistration } from '../src/services/academic-result-roster';
import { calculateAnnualProgression, calculateSemesterProgression } from '../src/services/academic-progression-calculator';
import { StudentAnnualOutcome, StudentSemesterOutcome } from '../src/schemas/student-academic-session.schema';

const bands = [
    { letter: 'F', minScore: 0, maxScore: 29, gradePoint: 0, isPass: false },
    { letter: 'E', minScore: 30, maxScore: 39, gradePoint: 0.5, isPass: false },
    { letter: 'D', minScore: 40, maxScore: 49, gradePoint: 1, isPass: false },
    { letter: 'C', minScore: 50, maxScore: 59, gradePoint: 2, isPass: true },
    { letter: 'B', minScore: 60, maxScore: 69, gradePoint: 3, isPass: true },
    { letter: 'A', minScore: 70, maxScore: 100, gradePoint: 4, isPass: true },
];

const components = [
    { title: 'Quiz', maximumMark: 20, weightPercent: 10, displayOrder: 1, mandatory: true },
    { title: 'Assignment', maximumMark: 30, weightPercent: 15, displayOrder: 2, mandatory: true },
    { title: 'Practical', maximumMark: 50, weightPercent: 25, displayOrder: 3, mandatory: true },
    { title: 'Examination', maximumMark: 100, weightPercent: 50, displayOrder: 4, mandatory: true },
];

test('validates the configured ALECONS grade bands', () => {
    assert.doesNotThrow(() => validateGradeBands(bands, 4));
});

test('requires assessment weights to equal exactly 100 percent', () => {
    assert.doesNotThrow(() => validateAssessmentComponents(components));
    assert.throws(() => validateAssessmentComponents([
        { ...components[0], weightPercent: 9.99 },
        ...components.slice(1),
    ]));
    assert.throws(() => validateAssessmentComponents([
        { ...components[0], weightPercent: 10.01 },
        ...components.slice(1),
    ]));
});

test('calculates a dynamic weighted score on the backend', () => {
    const result = calculateAcademicResult(components, [
        { componentOrder: 1, rawMark: 16 },
        { componentOrder: 2, rawMark: 24 },
        { componentOrder: 3, rawMark: 40 },
        { componentOrder: 4, rawMark: 80 },
    ], bands);
    assert.equal(result.finalScore, 80);
    assert.equal(result.gradeLetter, 'A');
    assert.equal(result.gradePoint, 4);
    assert.equal(result.isPass, true);
});

test('uses unrounded totals for grade boundaries', () => {
    const single = [{ title: 'Total', maximumMark: 100, weightPercent: 100, displayOrder: 1 }];
    assert.equal(calculateAcademicResult(single, [{ componentOrder: 1, rawMark: 69.999 }], bands).gradeLetter, 'B');
    assert.equal(calculateAcademicResult(single, [{ componentOrder: 1, rawMark: 70 }], bands).gradeLetter, 'A');
    assert.equal(calculateAcademicResult(single, [{ componentOrder: 1, rawMark: 59.999 }], bands).gradeLetter, 'C');
    assert.equal(calculateAcademicResult(single, [{ componentOrder: 1, rawMark: 60 }], bands).gradeLetter, 'B');
});

test('enforces the single resit and repeat attempt sequence', () => {
    assert.equal(nextAcademicAttemptType(null), null);
    assert.equal(nextAcademicAttemptType({ attemptType: AcademicResultAttemptType.INITIAL, isPass: true }), null);
    assert.equal(nextAcademicAttemptType({ attemptType: AcademicResultAttemptType.INITIAL, isPass: false }), AcademicResultAttemptType.RESIT);
    assert.equal(nextAcademicAttemptType({ attemptType: AcademicResultAttemptType.RESIT, isPass: false }), AcademicResultAttemptType.REPEAT);
    assert.equal(nextAcademicAttemptType({ attemptType: AcademicResultAttemptType.REPEAT, isPass: false }), null);
});

test('enforces the lecturer, HOD, Provost, and publication state machine', () => {
    assert.doesNotThrow(() => assertAcademicWorkflowTransition(AcademicResultWorkflowStatus.DRAFT, AcademicResultWorkflowStatus.SUBMITTED_TO_HOD));
    assert.doesNotThrow(() => assertAcademicWorkflowTransition(AcademicResultWorkflowStatus.SUBMITTED_TO_HOD, AcademicResultWorkflowStatus.HOD_APPROVED));
    assert.doesNotThrow(() => assertAcademicWorkflowTransition(AcademicResultWorkflowStatus.HOD_APPROVED, AcademicResultWorkflowStatus.SUBMITTED_TO_PROVOST));
    assert.doesNotThrow(() => assertAcademicWorkflowTransition(AcademicResultWorkflowStatus.SUBMITTED_TO_PROVOST, AcademicResultWorkflowStatus.PROVOST_APPROVED));
    assert.doesNotThrow(() => assertAcademicWorkflowTransition(AcademicResultWorkflowStatus.PROVOST_APPROVED, AcademicResultWorkflowStatus.PUBLISHED));
    assert.throws(() => assertAcademicWorkflowTransition(AcademicResultWorkflowStatus.DRAFT, AcademicResultWorkflowStatus.PUBLISHED));
    assert.throws(() => assertAcademicWorkflowTransition(AcademicResultWorkflowStatus.PUBLISHED, AcademicResultWorkflowStatus.DRAFT));
});

test('requires the complete eligible roster for every attempt type', () => {
    const complete = (studentId: string) => ({
        studentId,
        specialStatus: AcademicResultSpecialStatus.NORMAL,
        finalScore: 70,
        gradePoint: 4,
    });
    assert.doesNotThrow(() => validateAcademicResultSubmission(
        AcademicResultAttemptType.INITIAL,
        [complete('student-1'), complete('student-2')],
        ['student-1', 'student-2'],
    ));
    assert.throws(() => validateAcademicResultSubmission(
        AcademicResultAttemptType.INITIAL,
        [complete('student-1')],
        ['student-1', 'student-2'],
    ));
    assert.doesNotThrow(() => validateAcademicResultSubmission(
        AcademicResultAttemptType.RESIT,
        [complete('student-1')],
        ['student-1'],
        ['student-1', 'student-2'],
    ));
    assert.doesNotThrow(() => validateAcademicResultSubmission(
        AcademicResultAttemptType.REPEAT,
        [complete('student-1')],
        ['student-1'],
        ['student-1', 'student-2'],
    ));
    assert.throws(() => validateAcademicResultSubmission(
        AcademicResultAttemptType.RESIT,
        [complete('student-2')],
        [],
        ['student-1'],
    ));
});

test('authorizes semester resits only when failures stay within the program snapshot', () => {
    const registration = {
        semester: 1,
        resitLimitSnapshot: 2,
        items: [{ programCourseId: 'course-1' }, { programCourseId: 'course-2' }, { programCourseId: 'course-3' }],
    };
    const results = [
        { programCourseId: 'course-1', attemptType: AcademicResultAttemptType.INITIAL, attemptNumber: 1, isPass: false },
        { programCourseId: 'course-2', attemptType: AcademicResultAttemptType.INITIAL, attemptNumber: 1, isPass: false },
        { programCourseId: 'course-3', attemptType: AcademicResultAttemptType.INITIAL, attemptNumber: 1, isPass: true },
    ];
    const progression = calculateSemesterProgression(registration, results, false);
    assert.equal(progression.outcome, StudentSemesterOutcome.RESIT_REQUIRED);
    assert.deepEqual(progression.resitProgramCourseIds, ['course-1', 'course-2']);

    const overLimit = calculateSemesterProgression({ ...registration, resitLimitSnapshot: 1 }, results, false);
    assert.equal(overLimit.outcome, StudentSemesterOutcome.REPEAT_CANDIDATE);
    assert.deepEqual(overLimit.resitProgramCourseIds, []);
});

test('requires a repeat year after any failed resit and waits for both semesters', () => {
    const registration = {
        semester: 1,
        resitLimitSnapshot: 2,
        items: [{ programCourseId: 'course-1' }],
    };
    const failedResit = calculateSemesterProgression(registration, [
        { programCourseId: 'course-1', attemptType: AcademicResultAttemptType.INITIAL, attemptNumber: 1, isPass: false },
        { programCourseId: 'course-1', attemptType: AcademicResultAttemptType.RESIT, attemptNumber: 2, isPass: false },
    ], false);
    assert.equal(failedResit.outcome, StudentSemesterOutcome.REPEAT_CANDIDATE);
    assert.equal(calculateAnnualProgression([
        failedResit,
        { semester: 2, outcome: StudentSemesterOutcome.RESIT_IN_PROGRESS },
    ], false, 1, 3), StudentAnnualOutcome.IN_PROGRESS);
    assert.equal(calculateAnnualProgression([
        failedResit,
        { semester: 2, outcome: StudentSemesterOutcome.PASSED },
    ], false, 1, 3), StudentAnnualOutcome.REPEAT_YEAR_REQUIRED);
});

test('a repeat year requires repeat attempts for the full course load and never creates resits', () => {
    const registration = {
        semester: 1,
        resitLimitSnapshot: 3,
        items: [{ programCourseId: 'course-1' }, { programCourseId: 'course-2' }],
    };
    const incomplete = calculateSemesterProgression(registration, [
        { programCourseId: 'course-1', attemptType: AcademicResultAttemptType.REPEAT, attemptNumber: 2, isPass: true },
    ], true);
    assert.equal(incomplete.outcome, StudentSemesterOutcome.RESULTS_INCOMPLETE);
    assert.deepEqual(incomplete.resitProgramCourseIds, []);

    const failed = calculateSemesterProgression(registration, [
        { programCourseId: 'course-1', attemptType: AcademicResultAttemptType.REPEAT, attemptNumber: 2, isPass: true },
        { programCourseId: 'course-2', attemptType: AcademicResultAttemptType.REPEAT, attemptNumber: 2, isPass: false },
    ], true);
    assert.equal(failed.outcome, StudentSemesterOutcome.REPEAT_CANDIDATE);
    assert.equal(calculateAnnualProgression([
        failed,
        { semester: 2, outcome: StudentSemesterOutcome.PASSED },
    ], true, 1, 3), StudentAnnualOutcome.ACADEMIC_REVIEW);
});

test('keeps unsupported whole-result statuses out of the approval workflow', () => {
    assert.throws(() => validateAcademicResultSubmission(
        AcademicResultAttemptType.INITIAL,
        [{ studentId: 'student-1', specialStatus: AcademicResultSpecialStatus.WITHHELD }],
        ['student-1'],
    ));
    assert.throws(() => assertSupportedAcademicResultStatus(AcademicResultSpecialStatus.CANCELLED));
    assert.doesNotThrow(() => assertSupportedAcademicResultStatus(AcademicResultSpecialStatus.NORMAL));
});

test('uses current approved registration instead of student level for repeat rosters', () => {
    const students = [
        { _id: 'student-1', currentLevel: 2, academicSession: { _id: 'session-2' } },
        { _id: 'student-2', currentLevel: 1, academicSession: { _id: 'session-1' } },
    ];
    const registrations = [
        { studentId: 'student-1', academicSessionId: 'session-2' },
        { studentId: 'student-2', academicSessionId: 'old-session' },
    ];
    assert.deepEqual(
        filterStudentsWithCurrentCourseRegistration(students, registrations).map((student) => student._id),
        ['student-1'],
    );
});

test('maps Result Grading permissions and exact academic ownership', () => {
    const lecturerRole = { modules: [{ module: 'academicResults', permissions: ['view', 'enter_scores', 'submit'] }] };
    const hodRole = { modules: [{ module: 'academicResults', permissions: ['view', 'review_hod'] }] };
    const managerRole = { modules: [{ module: 'academicResults', permissions: ['manage'] }] };
    assert.equal(hasAcademicResultPermission(lecturerRole, 'enter_scores'), true);
    assert.equal(hasAcademicResultPermission(lecturerRole, 'review_hod'), false);
    assert.equal(hasAcademicResultPermission(hodRole, 'review_hod'), true);
    assert.equal(hasAcademicResultPermission(managerRole, 'publish'), true);
    assert.equal(hasAcademicResultPermission(null, 'view'), false);
    assert.equal(isAssignedAcademicOwner('user-1', ['user-1']), true);
    assert.equal(isAssignedAcademicOwner('user-1', [{ _id: 'user-1' }]), true);
    assert.equal(isAssignedAcademicOwner('user-1', ['user-2']), false);
});

test('keeps D as a failed grade while preserving its grade point', () => {
    const single = [{ title: 'Total', maximumMark: 100, weightPercent: 100, displayOrder: 1 }];
    const result = calculateAcademicResult(single, [{ componentOrder: 1, rawMark: 45 }], bands);
    assert.equal(result.gradePoint, 1);
    assert.equal(result.isPass, false);
});

test('permits incomplete drafts without inventing a numeric result', () => {
    const result = calculateAcademicResult(
        components,
        [{ componentOrder: 1, rawMark: 10 }],
        bands,
        AcademicResultSpecialStatus.NORMAL,
        true,
    );
    assert.equal(result.finalScore, undefined);
    assert.equal(result.gradeLetter, undefined);
});

test('calculates GPA from quality points and credit units', () => {
    assert.deepEqual(calculateGpa([
        { unitsSnapshot: 3, qualityPoints: 12 },
        { unitsSnapshot: 2, qualityPoints: 4 },
    ]), { applicableUnits: 5, qualityPoints: 16, gpa: 3.2 });
    assert.equal(calculateGpa([]).gpa, 0);
});

test('keeps a semester summary pending until every approved course is resolved', () => {
    const registrations = [{
        academicSessionId: { _id: 'session-1', startDate: '2026-09-01' },
        semester: 1,
        level: 1,
        items: [{ programCourseId: 'course-1' }, { programCourseId: 'course-2' }],
    }];
    const progress = buildAcademicProgress(registrations, [{
        programCourseId: 'course-1',
        attemptNumber: 1,
        specialStatus: AcademicResultSpecialStatus.NORMAL,
        isPass: true,
        gradePoint: 3,
        unitsSnapshot: 2,
        qualityPoints: 6,
    }]);
    assert.equal(progress.periods[0].publishedCourses, 1);
    assert.equal(progress.periods[0].expectedCourses, 2);
    assert.equal(progress.periods[0].isComplete, false);
    assert.equal(progress.officialCumulativeGPA, null);
});

test('publishes official GPA only for a contiguous chain of complete periods', () => {
    const registrations = [
        { academicSessionId: { _id: 'session-1', startDate: '2026-09-01' }, semester: 1, level: 1, items: [{ programCourseId: 'course-1' }] },
        { academicSessionId: { _id: 'session-2', startDate: '2027-09-01' }, semester: 1, level: 2, items: [{ programCourseId: 'course-2' }] },
    ];
    const progress = buildAcademicProgress(registrations, [
        { programCourseId: 'course-1', attemptNumber: 1, specialStatus: AcademicResultSpecialStatus.NORMAL, isPass: true, gradePoint: 3, unitsSnapshot: 2, qualityPoints: 6 },
    ]);
    assert.equal(progress.periods[0].semesterGPA, 3);
    assert.equal(progress.periods[1].isComplete, false);
    assert.equal(progress.officialCumulativeGPA, 3);
});

test('includes a published failed grade in GPA without awarding earned credits', () => {
    const registrations = [{
        academicSessionId: { _id: 'session-1', startDate: '2026-09-01' },
        semester: 1,
        level: 1,
        items: [{ programCourseId: 'course-1' }],
    }];
    const progress = buildAcademicProgress(registrations, [{
        programCourseId: 'course-1',
        attemptNumber: 1,
        specialStatus: AcademicResultSpecialStatus.NORMAL,
        isPass: false,
        gradePoint: 1,
        unitsSnapshot: 2,
        qualityPoints: 2,
    }]);
    assert.equal(progress.periods[0].publishedCourses, 1);
    assert.equal(progress.periods[0].resolvedCourses, 1);
    assert.equal(progress.periods[0].isComplete, true);
    assert.equal(progress.periods[0].semesterGPA, 1);
    assert.equal(progress.periods[0].earnedUnits, 0);
    assert.equal(progress.officialCumulativeGPA, 1);
});

test('uses the latest published attempt once a resit replaces an initial result', () => {
    const registrations = [{
        academicSessionId: { _id: 'session-1', startDate: '2026-09-01' },
        semester: 1,
        level: 1,
        items: [{ programCourseId: 'course-1' }],
    }];
    const progress = buildAcademicProgress(registrations, [
        {
            programCourseId: 'course-1',
            attemptNumber: 1,
            specialStatus: AcademicResultSpecialStatus.NORMAL,
            isPass: false,
            gradePoint: 1,
            unitsSnapshot: 2,
            qualityPoints: 2,
        },
        {
            programCourseId: 'course-1',
            attemptNumber: 2,
            specialStatus: AcademicResultSpecialStatus.NORMAL,
            isPass: true,
            gradePoint: 3,
            unitsSnapshot: 2,
            qualityPoints: 6,
        },
    ]);
    assert.equal(progress.periods[0].semesterGPA, 3);
    assert.equal(progress.periods[0].earnedUnits, 2);
    assert.equal(progress.officialCumulativeGPA, 3);
});

test('keeps historical semester GPA while repeat grades replace prior grades in CGPA', () => {
    const registrations = [
        {
            academicSessionId: { _id: 'session-1', startDate: '2026-09-01' },
            semester: 1,
            level: 1,
            items: [{ programCourseId: 'course-1' }, { programCourseId: 'course-2' }],
        },
        {
            academicSessionId: { _id: 'session-2', startDate: '2027-09-01' },
            semester: 1,
            level: 1,
            items: [{ programCourseId: 'course-1' }, { programCourseId: 'course-2' }],
        },
    ];
    const progress = buildAcademicProgress(registrations, [
        { academicSessionId: 'session-1', programCourseId: 'course-1', attemptNumber: 1, specialStatus: AcademicResultSpecialStatus.NORMAL, isPass: false, gradePoint: 1, unitsSnapshot: 2, qualityPoints: 2 },
        { academicSessionId: 'session-1', programCourseId: 'course-2', attemptNumber: 1, specialStatus: AcademicResultSpecialStatus.NORMAL, isPass: true, gradePoint: 3, unitsSnapshot: 2, qualityPoints: 6 },
        { academicSessionId: 'session-2', programCourseId: 'course-1', attemptNumber: 2, attemptType: AcademicResultAttemptType.REPEAT, specialStatus: AcademicResultSpecialStatus.NORMAL, isPass: true, gradePoint: 4, unitsSnapshot: 2, qualityPoints: 8 },
        { academicSessionId: 'session-2', programCourseId: 'course-2', attemptNumber: 2, attemptType: AcademicResultAttemptType.REPEAT, specialStatus: AcademicResultSpecialStatus.NORMAL, isPass: true, gradePoint: 4, unitsSnapshot: 2, qualityPoints: 8 },
    ]);
    assert.equal(progress.periods[0].semesterGPA, 2);
    assert.equal(progress.periods[1].semesterGPA, 4);
    assert.equal(progress.periods[1].cumulativeApplicableUnits, 4);
    assert.equal(progress.officialCumulativeGPA, 4);
});

test('keeps a semester pending for an unresolved special result status', () => {
    const registrations = [{
        academicSessionId: { _id: 'session-1', startDate: '2026-09-01' },
        semester: 1,
        level: 1,
        items: [{ programCourseId: 'course-1' }],
    }];
    const progress = buildAcademicProgress(registrations, [{
        programCourseId: 'course-1',
        attemptNumber: 1,
        specialStatus: AcademicResultSpecialStatus.INCOMPLETE,
        isPass: false,
        unitsSnapshot: 2,
    }]);
    assert.equal(progress.periods[0].publishedCourses, 1);
    assert.equal(progress.periods[0].resolvedCourses, 0);
    assert.equal(progress.periods[0].isComplete, false);
    assert.equal(progress.officialCumulativeGPA, null);
});

test('includes a failed permitted repeat marked for academic review in GPA', () => {
    const registrations = [{
        academicSessionId: { _id: 'session-1', startDate: '2026-09-01' },
        semester: 1,
        level: 1,
        items: [{ programCourseId: 'course-1' }],
    }];
    const progress = buildAcademicProgress(registrations, [{
        programCourseId: 'course-1',
        attemptNumber: 3,
        attemptType: AcademicResultAttemptType.REPEAT,
        specialStatus: AcademicResultSpecialStatus.ACADEMIC_REVIEW,
        isPass: false,
        gradePoint: 0.5,
        unitsSnapshot: 2,
        qualityPoints: 1,
    }]);
    assert.equal(progress.periods[0].isComplete, true);
    assert.equal(progress.periods[0].semesterGPA, 0.5);
    assert.equal(progress.periods[0].earnedUnits, 0);
});

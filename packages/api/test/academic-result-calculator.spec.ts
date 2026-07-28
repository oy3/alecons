import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { AcademicResultAttemptType, AcademicResultSpecialStatus, AcademicResultWorkflowStatus } from '../src/schemas/academic-result.schema';
import {
    calculateAcademicResult,
    assertAcademicWorkflowTransition,
    calculateGpa,
    buildAcademicProgress,
    nextAcademicAttemptType,
    validateAssessmentComponents,
    validateGradeBands,
} from '../src/services/academic-result-calculator';

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

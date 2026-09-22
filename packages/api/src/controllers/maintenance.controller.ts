import { BadRequestException, Controller, Post, Body, UseGuards, Logger, Request } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AcademicSessionsService } from '../services/academic-sessions.service';
import {
    AdmissionDecision,
    Application,
    ApplicationDocument,
    ApplicationStatus,
} from '../schemas/application.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { PaymentTransaction, PaymentTransactionDocument } from '../schemas/payment-transaction.schema';
import {
    StudentAcademicSession,
    StudentAcademicSessionDocument,
    StudentAcademicSessionStatus,
} from '../schemas/student-academic-session.schema';
import { UploadService } from '../services/upload.service';
import { AcademicResultsService } from '../services/academic-results.service';
import { StudentProgressionService } from '../services/student-progression.service';
import { createQuestionFingerprint } from '../utils/question-fingerprint';

@Controller('admin/maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class MaintenanceController {
    private readonly logger = new Logger(MaintenanceController.name);

    constructor(
        @InjectConnection() private readonly connection: Connection,
        private readonly academicResultsService: AcademicResultsService,
        private readonly studentProgressionService: StudentProgressionService,
        private readonly academicSessionsService: AcademicSessionsService,
        @InjectModel(Application.name) private readonly applicationModel: Model<ApplicationDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
        @InjectModel(PaymentTransaction.name) private readonly paymentTransactionModel: Model<PaymentTransactionDocument>,
        @InjectModel(StudentAcademicSession.name) private readonly studentAcademicSessionModel: Model<StudentAcademicSessionDocument>,
        private readonly uploadService: UploadService,
    ) { }

    @Post('migrate-screening-workflow')
    async migrateScreeningWorkflow(
        @Body() body: { academicSessionId?: string; apply?: boolean },
        @Request() req: any,
    ) {
        const academicSessionId = body?.academicSessionId;
        if (!academicSessionId || !Types.ObjectId.isValid(academicSessionId)) {
            throw new BadRequestException('Select a valid academic session');
        }

        const sessionObjectId = new Types.ObjectId(academicSessionId);
        const baseFilter = {
            entryAcademicSession: sessionObjectId,
            admissionDecision: AdmissionDecision.GRANTED,
            status: ApplicationStatus.PENDING,
            isActive: true,
        };
        const scheduledFilter = {
            ...baseFilter,
            'screening.date': { $exists: true, $ne: null },
            'screening.time': { $exists: true, $nin: [null, ''] },
            'screening.venue': { $exists: true, $nin: [null, ''] },
        };
        const unscheduledFilter = {
            ...baseFilter,
            $or: [
                { screening: { $exists: false } },
                { screening: null },
                { 'screening.date': { $exists: false } },
                { 'screening.date': null },
                { 'screening.time': { $exists: false } },
                { 'screening.time': { $in: [null, ''] } },
                { 'screening.venue': { $exists: false } },
                { 'screening.venue': { $in: [null, ''] } },
            ],
        };

        const [scheduledApplications, unscheduledApplications] = await Promise.all([
            this.applicationModel
                .find(scheduledFilter)
                .select('_id applicationNumber currentStage')
                .lean(),
            this.applicationModel
                .find(unscheduledFilter)
                .select('_id applicationNumber currentStage')
                .lean(),
        ]);

        let migrated = 0;
        if (body?.apply) {
            const actorId = this.toObjectId(req.user?.userId || req.user?.id);
            const migratedAt = new Date();
            for (const application of scheduledApplications) {
                const previousStage = Number(application.currentStage || 0);
                const result = await this.applicationModel.updateOne(
                    {
                        _id: application._id,
                        ...scheduledFilter,
                    },
                    {
                        $set: {
                            status: ApplicationStatus.ADMITTED,
                            currentStage: Math.max(previousStage, 7),
                        },
                        $push: {
                            auditTrail: {
                                action: 'screening_workflow_migrated',
                                description: 'Scheduled screening was migrated to the non-blocking post-admission workflow.',
                                performedBy: actorId,
                                actorRole: req.user?.role,
                                metadata: {
                                    academicSessionId,
                                    previousStatus: ApplicationStatus.PENDING,
                                    nextStatus: ApplicationStatus.ADMITTED,
                                    previousStage,
                                    nextStage: Math.max(previousStage, 7),
                                },
                                createdAt: migratedAt,
                            },
                        },
                    },
                );
                migrated += result.modifiedCount;
            }
        }

        return {
            success: true,
            message: body?.apply
                ? 'Screening workflow migration completed'
                : 'Screening workflow migration preview completed',
            data: {
                apply: Boolean(body?.apply),
                academicSessionId,
                eligibleScheduled: scheduledApplications.length,
                migrated,
                manualSchedulingRequired: unscheduledApplications.length,
                scheduledApplicationNumbers: scheduledApplications
                    .slice(0, 50)
                    .map((application) => application.applicationNumber),
                unscheduledApplicationNumbers: unscheduledApplications
                    .slice(0, 50)
                    .map((application) => application.applicationNumber),
            },
        };
    }

    @Post('migrate-question-bank')
    async migrateQuestionBank(
        @Body() body: { apply?: boolean; finalize?: boolean },
        @Request() req: any,
    ) {
        try {
            const apply = Boolean(body?.apply);
            const finalize = Boolean(body?.finalize);
            const actorId = this.toObjectId(req.user?.userId || req.user?.id);
            const legacyCollection = this.connection.collection('questions');
            const bankCollection = this.connection.collection('questionBankItems');
            const examQuestionsCollection = this.connection.collection('examQuestions');
            const activityCollection = this.connection.collection('questionBankActivities');
            const attemptsCollection = this.connection.collection('examAttempts');
            const resultsCollection = this.connection.collection('examResults');

            const legacyExists = (await this.connection.db.listCollections({ name: 'questions' }).toArray()).length > 0;
            const legacyQuestions = legacyExists ? await legacyCollection.find({}).toArray() : [];
            const groups = new Map<string, any[]>();
            for (const question of legacyQuestions) {
                const fingerprint = createQuestionFingerprint(question as any);
                const group = groups.get(fingerprint) || [];
                group.push(question);
                groups.set(fingerprint, group);
            }
            const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
            const duplicateQuestions = duplicateGroups.reduce((total, group) => total + group.length - 1, 0);
            let bankItemsCreated = 0;
            let examQuestionsCreated = 0;

            if (apply && legacyQuestions.length) {
                const examQuestionIndexes = await examQuestionsCollection.indexes();
                const uniqueBankLinkIndex = examQuestionIndexes.find((index) =>
                    index.unique &&
                    index.key?.examId === 1 &&
                    index.key?.questionBankItemId === 1,
                );
                if (uniqueBankLinkIndex?.name) {
                    await examQuestionsCollection.dropIndex(uniqueBankLinkIndex.name);
                    await examQuestionsCollection.createIndex(
                        { examId: 1, questionBankItemId: 1 },
                        {
                            name: uniqueBankLinkIndex.name,
                            partialFilterExpression: { questionBankItemId: { $type: 'objectId' } },
                        },
                    );
                }

                for (const [fingerprint, group] of groups) {
                    const canonical = group.slice().sort((a, b) =>
                        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
                    )[0];
                    const tags = [...new Set(group.flatMap((question) => question.tags || []).filter(Boolean))];
                    const legacyQuestionIds = group.map((question) => question._id);
                    const existingBankItem = await bankCollection.findOne({ fingerprint }, { projection: { _id: 1 } });
                    const bankResult: any = await bankCollection.findOneAndUpdate(
                        { fingerprint },
                        {
                            $setOnInsert: {
                                questionText: canonical.questionText,
                                type: canonical.type,
                                options: canonical.options,
                                answer: canonical.answer,
                                defaultMark: canonical.mark || 1,
                                mediaUrls: canonical.mediaUrls || [],
                                metadata: canonical.metadata || { difficulty: 'medium' },
                                fingerprint,
                                version: 1,
                                status: group.some((question) => question.status !== 'inactive') ? 'active' : 'archived',
                                createdBy: canonical.createdBy || actorId,
                                createdAt: canonical.createdAt || new Date(),
                                usageCount: 0,
                            },
                            $addToSet: { legacyQuestionIds: { $each: legacyQuestionIds }, tags: { $each: tags } },
                            $set: { updatedAt: new Date() },
                        },
                        { upsert: true, returnDocument: 'after' },
                    );
                    const bankItem = bankResult?.value || bankResult;
                    if (!bankItem?._id) throw new Error('Could not create or locate migrated bank item');
                    if (!existingBankItem) bankItemsCreated++;

                    for (const question of group) {
                        const {
                            _id: legacyQuestionId,
                            questionBankItemId: _questionBankItemId,
                            bankVersion: _bankVersion,
                            copiedBy: _copiedBy,
                            copiedAt: _copiedAt,
                            ...legacyQuestion
                        } = question;
                        const result = await examQuestionsCollection.updateOne(
                            { _id: legacyQuestionId },
                            {
                                $setOnInsert: {
                                    ...legacyQuestion,
                                    copiedBy: question.createdBy || actorId,
                                    copiedAt: question.createdAt || new Date(),
                                },
                                $set: { questionBankItemId: bankItem._id, bankVersion: 1 },
                            },
                            { upsert: true },
                        );
                        examQuestionsCreated += result.upsertedCount;
                    }
                }

                const usages = await examQuestionsCollection.aggregate([
                    { $match: { questionBankItemId: { $type: 'objectId' } } },
                    { $group: { _id: '$questionBankItemId', usageCount: { $sum: 1 }, lastUsedAt: { $max: '$copiedAt' } } },
                ]).toArray();
                for (const usage of usages) {
                    await bankCollection.updateOne(
                        { _id: usage._id },
                        { $set: { usageCount: usage.usageCount, lastUsedAt: usage.lastUsedAt || new Date() } },
                    );
                }
                await activityCollection.insertOne({
                    action: duplicateQuestions ? 'duplicates_merged' : 'migrated',
                    actorUserId: actorId,
                    affectedCount: Math.max(1, legacyQuestions.length),
                    metadata: { legacyQuestions: legacyQuestions.length, uniqueBankItems: groups.size, duplicateQuestions },
                    createdAt: new Date(), updatedAt: new Date(),
                });
            }

            const [bankItemCount, targetQuestionCount] = await Promise.all([
                bankCollection.countDocuments(),
                examQuestionsCollection.countDocuments(),
            ]);
            const missingTargetIds = legacyQuestions.length
                ? await legacyCollection.aggregate([
                    { $lookup: { from: 'examQuestions', localField: '_id', foreignField: '_id', as: 'target' } },
                    { $match: { target: { $size: 0 } } },
                    { $count: 'count' },
                ]).toArray()
                : [];
            const missingExamQuestions = missingTargetIds[0]?.count || 0;
            const [missingAttemptRefsResult, missingResultRefsResult] = await Promise.all([
                attemptsCollection.aggregate([
                    { $unwind: '$answers' },
                    { $match: { 'answers.questionId': { $type: 'objectId' } } },
                    { $lookup: { from: 'examQuestions', localField: 'answers.questionId', foreignField: '_id', as: 'question' } },
                    { $match: { question: { $size: 0 } } },
                    { $count: 'count' },
                ]).toArray(),
                resultsCollection.aggregate([
                    { $unwind: '$questionResults' },
                    { $match: { 'questionResults.questionId': { $type: 'objectId' } } },
                    { $lookup: { from: 'examQuestions', localField: 'questionResults.questionId', foreignField: '_id', as: 'question' } },
                    { $match: { question: { $size: 0 } } },
                    { $count: 'count' },
                ]).toArray(),
            ]);
            const missingAttemptQuestionRefs = missingAttemptRefsResult[0]?.count || 0;
            const missingResultQuestionRefs = missingResultRefsResult[0]?.count || 0;

            if (finalize) {
                if (!apply) throw new BadRequestException('Finalization requires apply=true');
                if (legacyExists && (
                    missingExamQuestions ||
                    missingAttemptQuestionRefs ||
                    missingResultQuestionRefs ||
                    targetQuestionCount < legacyQuestions.length
                )) {
                    throw new BadRequestException('Migration verification failed; the legacy collection was not removed');
                }
                if (legacyExists) await legacyCollection.drop();
            }

            return {
                success: true,
                data: {
                    applied: apply,
                    finalized: finalize,
                    legacyCollectionExists: legacyExists && !finalize,
                    legacyQuestions: legacyQuestions.length,
                    uniqueFingerprints: groups.size,
                    duplicateGroups: duplicateGroups.length,
                    duplicateQuestions,
                    bankItemsCreated,
                    examQuestionsCreated,
                    bankItemCount,
                    targetQuestionCount,
                    questionBankItems: bankItemCount,
                    examQuestions: targetQuestionCount,
                    missingExamQuestionIds: missingExamQuestions,
                    missingAttemptQuestionRefs,
                    missingResultQuestionRefs,
                    legacyCollectionDropped: finalize && legacyExists,
                    verified: !legacyExists || (
                        missingExamQuestions === 0 &&
                        missingAttemptQuestionRefs === 0 &&
                        missingResultQuestionRefs === 0 &&
                        targetQuestionCount >= legacyQuestions.length
                    ),
                },
            };
        } catch (error) {
            this.logger.error('migrateQuestionBank failed:', error?.message || error);
            if (error instanceof BadRequestException) throw error;
            return { success: false, error: error?.message || 'Question bank migration failed' };
        }
    }

    @Post('migrate-academic-progression')
    async migrateAcademicProgression(@Body('apply') apply?: boolean) {
        try {
            return {
                success: true,
                data: await this.studentProgressionService.migratePolicyFoundation(Boolean(apply)),
            };
        } catch (error) {
            this.logger.error('migrateAcademicProgression failed:', error?.message || error);
            return { success: false, error: error?.message || 'Academic progression migration failed' };
        }
    }

    @Post('rebuild-academic-result-summaries')
    async rebuildAcademicResultSummaries(@Body('apply') apply?: boolean) {
        try {
            return {
                success: true,
                data: await this.academicResultsService.rebuildAllAcademicSummaries(Boolean(apply)),
            };
        } catch (error) {
            this.logger.error('rebuildAcademicResultSummaries failed:', error?.message || error);
            return { success: false, error: error?.message || 'Academic summary rebuild failed' };
        }
    }

    @Post('migrate-academic-result-model')
    async migrateAcademicResultModel(@Body('apply') apply?: boolean) {
        try {
            const resultsCollection = this.connection.collection('academicresults');
            const offeringsCollection = this.connection.collection('courseofferings');
            const schemesCollection = this.connection.collection('assessmentschemes');
            const programCoursesCollection = this.connection.collection('programcourses');
            const programsCollection = this.connection.collection('programs');
            const coursesCollection = this.connection.collection('courses');
            const gradeScalesCollection = this.connection.collection('gradescaleversions');

            const legacyResults = await resultsCollection.find({
                $or: [
                    { courseOfferingId: { $exists: true } },
                    { assessmentSchemeId: { $exists: true } },
                    { programCourseId: { $exists: false } },
                    { programId: { $exists: false } },
                    { departmentId: { $exists: false } },
                    { level: { $exists: false } },
                    { semester: { $exists: false } },
                ],
            }).toArray();

            const resultOperations: any[] = [];
            const programCourseUpdates = new Map<string, { _id: Types.ObjectId; components: any[] }>();
            let unresolvedResults = 0;

            for (const result of legacyResults) {
                const offeringId = this.toObjectId(result.courseOfferingId);
                const offering = offeringId
                    ? await offeringsCollection.findOne({ _id: offeringId })
                    : null;
                const programCourseId = this.toObjectId(result.programCourseId || offering?.programCourseId);
                const programCourse = programCourseId
                    ? await programCoursesCollection.findOne({ _id: programCourseId })
                    : null;
                const programId = this.toObjectId(result.programId || offering?.programId || programCourse?.programId);
                const program = programId ? await programsCollection.findOne({ _id: programId }) : null;
                const courseId = this.toObjectId(offering?.courseId || programCourse?.courseId);
                const course = courseId ? await coursesCollection.findOne({ _id: courseId }) : null;
                const academicSessionId = this.toObjectId(result.academicSessionId || offering?.academicSessionId);
                const departmentId = this.toObjectId(result.departmentId || offering?.departmentId || program?.departmentId);
                const gradeScaleVersionId = this.toObjectId(result.gradeScaleVersionId || offering?.gradeScaleVersionId);
                const level = result.level || offering?.level || programCourse?.level;
                const semester = result.semester || offering?.semester || programCourse?.semester;
                const unitsSnapshot = result.unitsSnapshot || offering?.unitsSnapshot || programCourse?.units;
                const courseCodeSnapshot = result.courseCodeSnapshot || offering?.courseCodeSnapshot || course?.code;
                const courseTitleSnapshot = result.courseTitleSnapshot || offering?.courseTitleSnapshot || course?.title;

                if (
                    !programCourseId || !programId || !academicSessionId || !departmentId ||
                    !gradeScaleVersionId || !programCourse || !level || !semester || !unitsSnapshot ||
                    !courseCodeSnapshot || !courseTitleSnapshot
                ) {
                    unresolvedResults++;
                    continue;
                }

                resultOperations.push({
                    updateOne: {
                        filter: { _id: result._id },
                        update: {
                            $set: {
                                programCourseId,
                                programId,
                                academicSessionId,
                                departmentId,
                                gradeScaleVersionId,
                                level,
                                semester,
                                unitsSnapshot,
                                courseCodeSnapshot,
                                courseTitleSnapshot,
                            },
                            $unset: { courseOfferingId: '', assessmentSchemeId: '' },
                        },
                    },
                });

                if (!(programCourse.assessmentComponents || []).length && !programCourseUpdates.has(programCourseId.toString())) {
                    const relatedOffering = offering || await offeringsCollection.findOne(
                        { programCourseId },
                        { sort: { createdAt: -1 } },
                    );
                    if (relatedOffering) {
                        const scheme = await schemesCollection.findOne(
                            { courseOfferingId: relatedOffering._id, 'components.0': { $exists: true } },
                            { sort: { version: -1, createdAt: -1 } },
                        );
                        if (scheme?.components?.length) {
                            programCourseUpdates.set(programCourseId.toString(), {
                                _id: programCourseId,
                                components: scheme.components.map((component: any) => ({
                                    title: component.title,
                                    maximumMark: component.maximumMark,
                                    weightPercent: component.weightPercent,
                                    componentType: component.componentType,
                                    displayOrder: component.displayOrder,
                                    description: component.description,
                                    assessmentDate: component.assessmentDate,
                                    active: component.active !== false,
                                    mandatory: component.mandatory !== false,
                                    absenceAllowed: Boolean(component.absenceAllowed),
                                })),
                            });
                        }
                    }
                }
            }

            const unconfiguredProgramCourses = await programCoursesCollection.find({
                $or: [
                    { assessmentComponents: { $exists: false } },
                    { assessmentComponents: { $size: 0 } },
                ],
            }).toArray();
            for (const programCourse of unconfiguredProgramCourses) {
                const key = programCourse._id.toString();
                if (programCourseUpdates.has(key)) continue;
                const offering = await offeringsCollection.findOne(
                    { programCourseId: programCourse._id },
                    { sort: { createdAt: -1 } },
                );
                if (!offering) continue;
                const scheme = await schemesCollection.findOne(
                    { courseOfferingId: offering._id, 'components.0': { $exists: true } },
                    { sort: { version: -1, createdAt: -1 } },
                );
                if (!scheme?.components?.length) continue;
                programCourseUpdates.set(key, {
                    _id: programCourse._id,
                    components: scheme.components.map((component: any) => ({
                        title: component.title,
                        maximumMark: component.maximumMark,
                        weightPercent: component.weightPercent,
                        componentType: component.componentType,
                        displayOrder: component.displayOrder,
                        description: component.description,
                        assessmentDate: component.assessmentDate,
                        active: component.active !== false,
                        mandatory: component.mandatory !== false,
                        absenceAllowed: Boolean(component.absenceAllowed),
                    })),
                });
            }

            let indexes: any[] = [];
            try {
                indexes = await resultsCollection.indexes();
            } catch (error: any) {
                if (error?.codeName !== 'NamespaceNotFound') throw error;
            }
            const legacyIndexes = indexes.filter((index) =>
                Object.keys(index.key || {}).some((key) => ['courseOfferingId', 'assessmentSchemeId'].includes(key)),
            );
            const activeGradeScales = await gradeScalesCollection
                .find({ status: 'active' })
                .sort({ version: -1, createdAt: -1 })
                .toArray();
            let gradeScaleIndexes: any[] = [];
            try {
                gradeScaleIndexes = await gradeScalesCollection.indexes();
            } catch (error: any) {
                if (error?.codeName !== 'NamespaceNotFound') throw error;
            }
            const legacyGradeScaleIndexes = gradeScaleIndexes.filter((index) =>
                Object.keys(index.key || {}).includes('effectiveAcademicSessionId'),
            );

            let resultsMigrated = 0;
            let programCoursesMigrated = 0;
            let indexesRemoved = 0;
            let gradeScalesRetired = 0;
            if (apply) {
                if (resultOperations.length) {
                    const result = await resultsCollection.bulkWrite(resultOperations, { ordered: false });
                    resultsMigrated = result.modifiedCount;
                }
                if (programCourseUpdates.size) {
                    const result = await programCoursesCollection.bulkWrite(
                        [...programCourseUpdates.values()].map((item) => ({
                            updateOne: {
                                filter: { _id: item._id, 'assessmentComponents.0': { $exists: false } },
                                update: { $set: { assessmentComponents: item.components } },
                            },
                        })),
                        { ordered: false },
                    );
                    programCoursesMigrated = result.modifiedCount;
                }
                for (const index of legacyIndexes) {
                    await resultsCollection.dropIndex(index.name);
                    indexesRemoved++;
                }
                if (activeGradeScales.length > 1) {
                    const result = await gradeScalesCollection.updateMany(
                        { _id: { $in: activeGradeScales.slice(1).map((scale) => scale._id) } },
                        { $set: { status: 'retired', updatedAt: new Date() } },
                    );
                    gradeScalesRetired = result.modifiedCount;
                }
                for (const index of legacyGradeScaleIndexes) {
                    await gradeScalesCollection.dropIndex(index.name);
                    indexesRemoved++;
                }
                await gradeScalesCollection.createIndex(
                    { status: 1 },
                    {
                        unique: true,
                        partialFilterExpression: { status: 'active' },
                        name: 'one_active_grade_scale',
                    },
                );
            }

            return {
                success: true,
                data: {
                    legacyResults: legacyResults.length,
                    resultsReady: resultOperations.length,
                    resultsMigrated,
                    unresolvedResults,
                    programCoursesReady: programCourseUpdates.size,
                    programCoursesMigrated,
                    legacyIndexes: legacyIndexes.length,
                    legacyGradeScaleIndexes: legacyGradeScaleIndexes.length,
                    indexesRemoved,
                    extraActiveGradeScales: Math.max(0, activeGradeScales.length - 1),
                    gradeScalesRetired,
                    applied: Boolean(apply),
                },
            };
        } catch (error) {
            this.logger.error('migrateAcademicResultModel failed:', error?.message || error);
            return { success: false, error: error?.message || 'Academic result migration failed' };
        }
    }

    /**
     * Migrate applicant demographics and enrolled-student profile images into User profiles.
     * Body: { apply?: boolean }
     */
    @Post('migrate-user-demographics')
    async migrateUserDemographics(@Body('apply') apply?: boolean) {
        try {
            const applications = await this.applicationModel
                .find({
                    $or: [
                        { dob: { $exists: true, $ne: null } },
                        { gender: { $exists: true, $ne: null } },
                        { profileImageUrl: { $exists: true, $ne: null } },
                    ],
                })
                .select('userId dob gender profileImageUrl updatedAt')
                .sort({ updatedAt: -1, _id: -1 })
                .lean() as any[];

            let scanned = 0;
            let migrated = 0;
            let skipped = 0;
            let alreadySet = 0;
            let profileImagesEligible = 0;
            let profileImagesMigrated = 0;
            let profileImagesAlreadySet = 0;
            let profileImagesSkipped = 0;
            let profileImagesFailed = 0;

            for (const app of applications) {
                scanned++;
                const user = await this.userModel.findById(app.userId).select('dob gender').lean() as any;
                if (!user) { skipped++; continue; }

                const update: Record<string, any> = {};
                if (app.dob && !user.dob) update.dob = app.dob;
                if (app.gender && !user.gender) update.gender = app.gender;

                if (!Object.keys(update).length) { alreadySet++; continue; }

                if (apply) {
                    await this.userModel.updateOne({ _id: app.userId }, { $set: update });
                }
                migrated++;
            }

            const applicationsById = new Map(applications.map((app) => [app._id.toString(), app]));
            const students = await this.studentModel
                .find({})
                .select('userId applicationId matriculationNumber profileImageUrl')
                .lean() as any[];

            for (const student of students) {
                if (!student.matriculationNumber || !student.userId || !student.applicationId) {
                    profileImagesSkipped++;
                    continue;
                }

                const user = await this.userModel.findById(student.userId).select('profileImageUrl').lean() as any;
                if (!user) {
                    profileImagesSkipped++;
                    continue;
                }

                let application = applicationsById.get(student.applicationId.toString());
                if (!application) {
                    application = await this.applicationModel
                        .findById(student.applicationId)
                        .select('profileImageUrl')
                        .lean() as any;
                }

                const sourceUrl = user.profileImageUrl || student.profileImageUrl || application?.profileImageUrl;
                if (!sourceUrl) {
                    profileImagesSkipped++;
                    continue;
                }

                const destinationKey = this.uploadService.getStudentProfileKey(student.matriculationNumber, sourceUrl);
                if (!destinationKey) {
                    profileImagesSkipped++;
                    continue;
                }

                const destinationUrl = this.uploadService.getFileUrl(destinationKey);
                if (user.profileImageUrl === destinationUrl && student.profileImageUrl === destinationUrl) {
                    profileImagesAlreadySet++;
                    continue;
                }

                profileImagesEligible++;
                if (!apply) {
                    continue;
                }

                try {
                    const copiedProfileImage = await this.uploadService.copyProfileImageToStudentFolder(
                        sourceUrl,
                        student.matriculationNumber,
                    );
                    if (!copiedProfileImage) {
                        profileImagesSkipped++;
                        continue;
                    }

                    await Promise.all([
                        this.userModel.updateOne(
                            { _id: student.userId },
                            { $set: { profileImageUrl: copiedProfileImage.url } },
                        ),
                        this.studentModel.updateOne(
                            { _id: student._id },
                            { $set: { profileImageUrl: copiedProfileImage.url } },
                        ),
                    ]);
                    profileImagesMigrated++;
                } catch (imageError) {
                    profileImagesFailed++;
                    this.logger.error('Student profile image migration failed:', {
                        studentId: student._id?.toString(),
                        matriculationNumber: student.matriculationNumber,
                        error: imageError?.message || imageError,
                    });
                }
            }

            return {
                success: true,
                data: {
                    scanned,
                    migrated,
                    skipped,
                    alreadySet,
                    profileImagesEligible,
                    profileImagesMigrated,
                    profileImagesAlreadySet,
                    profileImagesSkipped,
                    profileImagesFailed,
                    applied: Boolean(apply),
                },
            };
        } catch (error) {
            this.logger.error('migrateUserDemographics failed:', error?.message || error);
            return { success: false, error: error?.message || 'Migration failed' };
        }
    }

    @Post('backfill-student-session-history')
    async backfillStudentSessionHistory(@Body('apply') apply?: boolean) {
        try {
            const students = await this.studentModel
                .find({ entryAcademicSession: { $exists: true }, academicSession: { $exists: true } })
                .select('_id userId entryAcademicSession academicSession createdAt')
                .lean() as any[];

            let scanned = 0;
            let recordsNeeded = 0;
            let recordsCreated = 0;
            let recordsAlreadyPresent = 0;
            const legacyStringSessionRecords = await this.studentAcademicSessionModel.collection
                .find({ academicSessionId: { $type: 'string' } })
                .toArray();
            const convertibleLegacyRecords = legacyStringSessionRecords.filter((record) =>
                Types.ObjectId.isValid(record.academicSessionId as string),
            );
            let legacyDuplicateRecords = 0;
            const legacyConversionOperations: any[] = [];

            for (const record of convertibleLegacyRecords) {
                const objectId = new Types.ObjectId(record.academicSessionId as string);
                const objectIdRecord = await this.studentAcademicSessionModel.collection.findOne({
                    studentId: record.studentId,
                    academicSessionId: objectId,
                });

                if (objectIdRecord) {
                    legacyDuplicateRecords++;
                    legacyConversionOperations.push({
                        deleteOne: { filter: { _id: record._id } },
                    });
                } else {
                    legacyConversionOperations.push({
                        updateOne: {
                            filter: { _id: record._id, academicSessionId: record.academicSessionId },
                            update: { $set: { academicSessionId: objectId } },
                        },
                    });
                }
            }

            if (apply && legacyConversionOperations.length) {
                await this.studentAcademicSessionModel.collection.bulkWrite(legacyConversionOperations);
            }

            for (const student of students) {
                scanned++;
                const paymentSessionIds = await this.paymentTransactionModel.distinct('academicSessionId', {
                    userId: student.userId,
                    academicSessionId: { $exists: true, $ne: null },
                });
                const sessionIds = new Set([
                    student.entryAcademicSession?.toString(),
                    student.academicSession?.toString(),
                    ...paymentSessionIds.map((id) => id.toString()),
                ].filter(Boolean));

                const existing = await this.studentAcademicSessionModel
                    .find({ studentId: student._id, academicSessionId: { $in: [...sessionIds] } })
                    .select('academicSessionId')
                    .lean() as any[];
                const existingIds = new Set(existing.map((record) => record.academicSessionId.toString()));

                const missingIds = [...sessionIds].filter((id) => !existingIds.has(id));
                recordsNeeded += missingIds.length;
                recordsAlreadyPresent += sessionIds.size - missingIds.length;

                if (apply && missingIds.length) {
                    const result = await this.studentAcademicSessionModel.bulkWrite(
                        missingIds.map((academicSessionId) => ({
                            updateOne: {
                                filter: {
                                    studentId: student._id,
                                    academicSessionId: new Types.ObjectId(academicSessionId),
                                },
                                update: {
                                    $setOnInsert: {
                                        status: academicSessionId === student.academicSession.toString()
                                            ? StudentAcademicSessionStatus.CURRENT
                                            : StudentAcademicSessionStatus.COMPLETED,
                                        startedAt: student.createdAt || new Date(),
                                        endedAt: academicSessionId === student.academicSession.toString()
                                            ? undefined
                                            : new Date(),
                                    },
                                },
                                upsert: true,
                            },
                        })),
                    );
                    recordsCreated += result.upsertedCount || 0;
                    recordsAlreadyPresent += missingIds.length - (result.upsertedCount || 0);
                }
            }

            return {
                success: true,
                data: {
                    scanned,
                    recordsNeeded,
                    recordsCreated,
                    recordsAlreadyPresent,
                    legacyStringSessionRecords: legacyStringSessionRecords.length,
                    legacyDuplicateRecords,
                    legacySessionIdsConverted: apply
                        ? convertibleLegacyRecords.length - legacyDuplicateRecords
                        : 0,
                    legacyDuplicateRecordsRemoved: apply ? legacyDuplicateRecords : 0,
                    applied: Boolean(apply),
                },
            };
        } catch (error) {
            this.logger.error('backfillStudentSessionHistory failed:', error?.message || error);
            return { success: false, error: error?.message || 'Backfill failed' };
        }
    }

    /**
     * Inspect legacy academic session index and optionally drop it.
     * Body: { apply?: boolean }
     */
    @Post('repair-academic-sessions')
    async repairAcademicSessions(@Body('apply') apply?: boolean) {
        try {
            const result = await this.academicSessionsService.inspectAndRepairLegacyIndex(Boolean(apply));
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error('repairAcademicSessions failed:', error?.message || error);
            return {
                success: false,
                error: error?.message || 'Repair failed',
            };
        }
    }

    private toObjectId(value: unknown): Types.ObjectId | null {
        if (value instanceof Types.ObjectId) return value;
        const normalized = value?.toString?.();
        return normalized && Types.ObjectId.isValid(normalized)
            ? new Types.ObjectId(normalized)
            : null;
    }
}

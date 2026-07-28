import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AcademicSessionsService } from '../services/academic-sessions.service';
import { Application, ApplicationDocument } from '../schemas/application.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { StudentPayment, StudentPaymentDocument } from '../schemas/student-payment.schema';
import {
    StudentAcademicSession,
    StudentAcademicSessionDocument,
    StudentAcademicSessionStatus,
} from '../schemas/student-academic-session.schema';
import { UploadService } from '../services/upload.service';
import { AcademicResultsService } from '../services/academic-results.service';

@Controller('admin/maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class MaintenanceController {
    private readonly logger = new Logger(MaintenanceController.name);

    constructor(
        @InjectConnection() private readonly connection: Connection,
        private readonly academicResultsService: AcademicResultsService,
        private readonly academicSessionsService: AcademicSessionsService,
        @InjectModel(Application.name) private readonly applicationModel: Model<ApplicationDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
        @InjectModel(StudentPayment.name) private readonly studentPaymentModel: Model<StudentPaymentDocument>,
        @InjectModel(StudentAcademicSession.name) private readonly studentAcademicSessionModel: Model<StudentAcademicSessionDocument>,
        private readonly uploadService: UploadService,
    ) { }

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
                const paymentSessionIds = await this.studentPaymentModel.distinct('academicSessionId', {
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

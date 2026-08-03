import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Application } from '../schemas/application.schema';
import { Student } from '../schemas/student.schema';
import { Program } from '../schemas/program.schema';

type ProgramRecord = {
    _id: Types.ObjectId;
    programTypeId?: Types.ObjectId;
    programModeId?: Types.ObjectId;
};

type RelatedRecord = {
    _id: Types.ObjectId;
    programId?: Types.ObjectId;
    programTypeId?: Types.ObjectId;
    programModeId?: Types.ObjectId;
    applicationNumber?: string;
    matriculationNumber?: string;
};

type DriftSampleRecord = {
    entityType: 'application' | 'student';
    recordId: string;
    recordLabel: string;
    issueType: 'legacy-fields-present' | 'missing-program' | 'missing-program-config';
    programId: string | null;
    currentProgramTypeId: string | null;
    currentProgramModeId: string | null;
    expectedProgramTypeId: string | null;
    expectedProgramModeId: string | null;
    action: 'unset-legacy-fields' | 'manual-program-repair-required';
};

type EntitySummary = {
    scanned: number;
    drifted: number;
};

type RawUnsetUpdate = {
    updateOne: {
        filter: { _id: Types.ObjectId };
        update: { $unset: { programTypeId: ''; programModeId: '' } };
    };
};

@Injectable()
export class ProgramDriftService {
    private readonly logger = new Logger(ProgramDriftService.name);

    constructor(
        @InjectModel(Application.name) private readonly applicationModel: Model<Application>,
        @InjectModel(Student.name) private readonly studentModel: Model<Student>,
        @InjectModel(Program.name) private readonly programModel: Model<Program>,
    ) { }

    async inspectAndRepair(options?: { apply?: boolean; sampleLimit?: number }) {
        const apply = Boolean(options?.apply);
        const sampleLimit = Math.max(1, options?.sampleLimit ?? 20);

        const [applications, students] = await Promise.all([
            this.applicationModel.collection
                .find({}, { projection: { _id: 1, applicationNumber: 1, programId: 1, programTypeId: 1, programModeId: 1 } })
                .toArray() as Promise<RelatedRecord[]>,
            this.studentModel.collection
                .find({}, { projection: { _id: 1, matriculationNumber: 1, programId: 1, programTypeId: 1, programModeId: 1 } })
                .toArray() as Promise<RelatedRecord[]>,
        ]);

        const programCache = new Map<string, ProgramRecord | null>();
        const sample: DriftSampleRecord[] = [];
        const applicationUpdates: RawUnsetUpdate[] = [];
        const studentUpdates: RawUnsetUpdate[] = [];

        let missingProgram = 0;
        let missingProgramConfig = 0;
        const applicationSummary: EntitySummary = { scanned: applications.length, drifted: 0 };
        const studentSummary: EntitySummary = { scanned: students.length, drifted: 0 };

        const inspectRecord = async (
            record: RelatedRecord,
            entityType: 'application' | 'student',
            updates: RawUnsetUpdate[],
            summary: EntitySummary,
        ) => {
            const recordLabel =
                entityType === 'application'
                    ? record.applicationNumber || record._id.toString()
                    : record.matriculationNumber || record._id.toString();
            const programId = record.programId?.toString() || null;
            const hasLegacyFields = Boolean(record.programTypeId || record.programModeId);

            if (hasLegacyFields) {
                summary.drifted += 1;
                updates.push({
                    updateOne: {
                        filter: { _id: record._id },
                        update: {
                            $unset: {
                                programTypeId: '',
                                programModeId: '',
                            },
                        },
                    },
                });
            }

            if (!record.programId) {
                missingProgram += 1;
                sample.push({
                    entityType,
                    recordId: record._id.toString(),
                    recordLabel,
                    issueType: 'missing-program',
                    programId: null,
                    currentProgramTypeId: record.programTypeId?.toString() || null,
                    currentProgramModeId: record.programModeId?.toString() || null,
                    expectedProgramTypeId: null,
                    expectedProgramModeId: null,
                    action: hasLegacyFields ? 'unset-legacy-fields' : 'manual-program-repair-required',
                });
                return;
            }

            if (!programCache.has(programId)) {
                const program = await this.programModel.collection.findOne(
                    { _id: record.programId },
                    { projection: { _id: 1, programTypeId: 1, programModeId: 1 } },
                ) as ProgramRecord | null;
                programCache.set(programId, program || null);
            }

            const program = programCache.get(programId);

            if (!program) {
                missingProgram += 1;
                sample.push({
                    entityType,
                    recordId: record._id.toString(),
                    recordLabel,
                    issueType: 'missing-program',
                    programId,
                    currentProgramTypeId: record.programTypeId?.toString() || null,
                    currentProgramModeId: record.programModeId?.toString() || null,
                    expectedProgramTypeId: null,
                    expectedProgramModeId: null,
                    action: hasLegacyFields ? 'unset-legacy-fields' : 'manual-program-repair-required',
                });
                return;
            }

            if (!program.programTypeId || !program.programModeId) {
                missingProgramConfig += 1;
                sample.push({
                    entityType,
                    recordId: record._id.toString(),
                    recordLabel,
                    issueType: 'missing-program-config',
                    programId,
                    currentProgramTypeId: record.programTypeId?.toString() || null,
                    currentProgramModeId: record.programModeId?.toString() || null,
                    expectedProgramTypeId: program.programTypeId?.toString() || null,
                    expectedProgramModeId: program.programModeId?.toString() || null,
                    action: hasLegacyFields ? 'unset-legacy-fields' : 'manual-program-repair-required',
                });
                return;
            }

            if (hasLegacyFields) {
                sample.push({
                    entityType,
                    recordId: record._id.toString(),
                    recordLabel,
                    issueType: 'legacy-fields-present',
                    programId,
                    currentProgramTypeId: record.programTypeId?.toString() || null,
                    currentProgramModeId: record.programModeId?.toString() || null,
                    expectedProgramTypeId: program.programTypeId.toString(),
                    expectedProgramModeId: program.programModeId.toString(),
                    action: 'unset-legacy-fields',
                });
            }
        };

        for (const application of applications) {
            await inspectRecord(application, 'application', applicationUpdates, applicationSummary);
        }

        for (const student of students) {
            await inspectRecord(student, 'student', studentUpdates, studentSummary);
        }

        let matched = 0;
        let modified = 0;

        const countLegacyRecords = async () => {
            const [remainingApplicationLegacyRecords, remainingStudentLegacyRecords] = await Promise.all([
                this.applicationModel.collection.countDocuments({
                    $or: [
                        { programTypeId: { $exists: true } },
                        { programModeId: { $exists: true } },
                    ],
                }),
                this.studentModel.collection.countDocuments({
                    $or: [
                        { programTypeId: { $exists: true } },
                        { programModeId: { $exists: true } },
                    ],
                }),
            ]);

            return {
                remainingApplicationLegacyRecords,
                remainingStudentLegacyRecords,
                remainingLegacyRecords: remainingApplicationLegacyRecords + remainingStudentLegacyRecords,
            };
        };

        let remainingLegacy = await countLegacyRecords();

        if (apply) {
            if (applicationUpdates.length) {
                const result = await this.applicationModel.collection.bulkWrite(applicationUpdates, { ordered: false });
                matched += result.matchedCount || 0;
                modified += result.modifiedCount || 0;
            }

            if (studentUpdates.length) {
                const result = await this.studentModel.collection.bulkWrite(studentUpdates, { ordered: false });
                matched += result.matchedCount || 0;
                modified += result.modifiedCount || 0;
            }

            remainingLegacy = await countLegacyRecords();

            this.logger.log(
                `Program drift repair completed. matched=${matched}, modified=${modified}, drifted=${applicationSummary.drifted + studentSummary.drifted}, remainingLegacy=${remainingLegacy.remainingLegacyRecords}`,
            );
        }

        return {
            apply,
            scanned: applicationSummary.scanned + studentSummary.scanned,
            drifted: applicationSummary.drifted + studentSummary.drifted,
            matched,
            modified,
            missingProgram,
            missingProgramConfig,
            applications: applicationSummary,
            students: studentSummary,
            ...remainingLegacy,
            sample: sample.slice(0, sampleLimit),
        };
    }
}
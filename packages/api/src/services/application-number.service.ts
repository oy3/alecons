import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AcademicSession } from '../schemas/academic-session.schema';

interface ApplicationCounter {
    _id: string;
    sequence: number;
    year: number;
    academicSessionId: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
    repairedAt?: Date;
}

@Injectable()
export class ApplicationNumberService {
    private readonly logger = new Logger(ApplicationNumberService.name);

    constructor(
        @InjectModel('Application') private applicationModel: Model<any>,
        @InjectModel('Program') private programModel: Model<any>,
        @InjectModel(AcademicSession.name) private academicSessionModel: Model<any>,
    ) { }

    private getCountersCollection() {
        return this.applicationModel.db.collection<ApplicationCounter>('application_counters');
    }

    /**
     * Generate a unique application number using atomic operations
     * Format: ALEC{YY}{PROGRAM_CODE}{SEQUENCE}
        * - YY: Last 2 digits of the entry academic session start year
     * - PROGRAM_CODE: 2-digit program code (padded with 0 if needed)
     * - SEQUENCE: 4-digit sequence starting from 0001, then continues to 99990, 99991, etc.
     */
    async generateApplicationNumber(programId: string, academicSessionId: string): Promise<string> {
        try {
            const { counterId, year, yearString } = await this.getCounterContext(academicSessionId);
            const programCode = await this.getProgramCode(programId);
            const counter = await this.getNextSequenceNumber(counterId, year, academicSessionId);
            const sequenceStr = this.formatSequence(counter.sequence);
            const applicationNumber = `ALEC${yearString}${programCode}${sequenceStr}`;

            this.logger.log(`Generated application number: ${applicationNumber} (sequence: ${counter.sequence})`);
            return applicationNumber;

        } catch (error) {
            this.logger.error('Error generating application number:', error);
            throw error;
        }
    }

    /**
     * Atomic sequence number generation using MongoDB's findOneAndUpdate
     */
    private async getNextSequenceNumber(counterId: string, year: number, academicSessionId: string): Promise<ApplicationCounter> {
        const countersCollection = this.getCountersCollection();

        const result = await countersCollection.findOneAndUpdate(
            { _id: counterId } as any,
            {
                $inc: { sequence: 1 },
                $set: {
                    updatedAt: new Date(),
                    year,
                    academicSessionId: new Types.ObjectId(academicSessionId),
                },
                $setOnInsert: {
                    createdAt: new Date(),
                }
            },
            {
                upsert: true,
                returnDocument: 'after'
            }
        );

        return result as ApplicationCounter;
    }

    private async getProgramCode(programId: string): Promise<string> {
        const program = await this.programModel.findById(programId).select('code');
        if (!program) {
            throw new Error('Program not found for application number generation');
        }

        return String(program.code).padStart(2, '0');
    }

    private async getCounterContext(academicSessionId: string): Promise<{
        academicSessionId: string;
        counterId: string;
        year: number;
        yearString: string;
    }> {
        const session = await this.academicSessionModel
            .findById(academicSessionId)
            .select('sessionYear');

        if (!session) {
            throw new Error('Academic session not found for application number generation');
        }

        const year = this.extractSessionStartYear(session.sessionYear);
        const yearString = year.toString().slice(-2);

        return {
            academicSessionId,
            counterId: `ALEC${yearString}`,
            year,
            yearString,
        };
    }

    private extractSessionStartYear(sessionYear: string): number {
        const match = sessionYear?.match(/\d{4}/);
        if (!match) {
            throw new Error(`Unable to extract application counter year from academic session: ${sessionYear}`);
        }

        return Number(match[0]);
    }

    private buildCounterIdFromYear(year: number): string {
        return `ALEC${year.toString().slice(-2)}`;
    }

    private formatSequence(sequence: number): string {
        if (sequence <= 9999) {
            return String(sequence).padStart(4, '0');
        }

        return String(sequence);
    }

    /**
     * Initialize or reset counter for a specific academic session year.
     */
    async initializeCounter(academicSessionId: string, startSequence: number = 0): Promise<void> {
        const { counterId, year } = await this.getCounterContext(academicSessionId);

        const countersCollection = this.getCountersCollection();

        await countersCollection.replaceOne(
            { _id: counterId } as any,
            {
                _id: counterId,
                sequence: startSequence,
                year,
                academicSessionId: new Types.ObjectId(academicSessionId),
                createdAt: new Date(),
                updatedAt: new Date()
            } as any,
            { upsert: true }
        );

        this.logger.log(`Initialized counter ${counterId} with sequence ${startSequence}`);
    }

    /**
     * Get current counter status for a year/session.
     */
    async getCounterStatus(academicSessionId?: string, year?: number): Promise<ApplicationCounter | null> {
        let counterId: string;

        if (academicSessionId) {
            counterId = (await this.getCounterContext(academicSessionId)).counterId;
        } else if (year) {
            counterId = this.buildCounterIdFromYear(year);
        } else {
            counterId = this.buildCounterIdFromYear(new Date().getFullYear());
        }

        const countersCollection = this.getCountersCollection();

        return await countersCollection.findOne({ _id: counterId });
    }

    /**
     * Validate application number format
     */
    validateApplicationNumber(applicationNumber: string): boolean {
        const pattern = /^ALEC\d{2}\d{2}\d{4,}$/;
        return pattern.test(applicationNumber);
    }

    /**
     * Get statistics about application numbers for a given year
     */
    async getApplicationNumberStats(year?: number): Promise<{
        year: number;
        totalApplications: number;
        byProgram: Array<{
            programCode: string;
            programName: string;
            count: number;
            latest: string;
        }>;
        counter: {
            id: string;
            sequence: number;
            nextSequence: number;
            academicSessionId?: string;
        } | null;
    }> {
        const targetYear = year || new Date().getFullYear();
        const yearString = targetYear.toString().slice(-2);
        const counterId = this.buildCounterIdFromYear(targetYear);

        const countersCollection = this.getCountersCollection();
        const counter = await countersCollection.findOne({ _id: counterId });

        if (!counter) {
            return {
                year: targetYear,
                totalApplications: 0,
                byProgram: [],
                counter: null,
            };
        }

        const applications = await this.applicationModel
            .find({ entryAcademicSession: counter.academicSessionId })
            .populate('programId', 'code name')
            .select('applicationNumber programId')
            .lean();

        const groupedPrograms = new Map<string, {
            programCode: string;
            programName: string;
            count: number;
            latest: string;
        }>();

        for (const app of applications) {
            const programCode = String(app.programId?.code || '').padStart(2, '0');
            const existing = groupedPrograms.get(programCode);

            if (!existing) {
                groupedPrograms.set(programCode, {
                    programCode,
                    programName: app.programId?.name || 'Unknown Program',
                    count: 1,
                    latest: app.applicationNumber,
                });
                continue;
            }

            existing.count += 1;
            if (app.applicationNumber > existing.latest) {
                existing.latest = app.applicationNumber;
            }
        }

        const byProgram = Array.from(groupedPrograms.values()).sort((left, right) => {
            if (left.programCode === right.programCode) {
                return 0;
            }
            return left.programCode < right.programCode ? -1 : 1;
        });

        return {
            year: targetYear,
            totalApplications: counter.sequence,
            byProgram,
            counter: {
                id: counter._id,
                sequence: counter.sequence,
                nextSequence: counter.sequence + 1,
                academicSessionId: counter.academicSessionId?.toString?.(),
            },
        };
    }

    /**
     * Repair year/session counters using actual applications.
     */
    async repairCounters(year?: number): Promise<{ repaired: string[]; errors: string[] }> {
        const targetYear = year || new Date().getFullYear();
        const repaired = [];
        const errors = [];

        try {
            const applications = await this.applicationModel
                .find({
                    applicationNumber: { $regex: `^${this.buildCounterIdFromYear(targetYear)}` },
                })
                .populate('entryAcademicSession', 'sessionYear')
                .select('applicationNumber entryAcademicSession')
                .lean();

            const countersByYear = new Map<string, {
                counterId: string;
                academicSessionId: string;
                year: number;
                count: number;
            }>();

            for (const app of applications) {
                const session = app.entryAcademicSession;
                if (!session?._id || !session?.sessionYear) {
                    continue;
                }

                const sessionYear = this.extractSessionStartYear(session.sessionYear);
                const counterId = this.buildCounterIdFromYear(sessionYear);
                const key = counterId;

                if (!countersByYear.has(key)) {
                    countersByYear.set(key, {
                        counterId,
                        academicSessionId: session._id.toString(),
                        year: sessionYear,
                        count: 0,
                    });
                }

                countersByYear.get(key)!.count += 1;
            }

            const countersCollection = this.getCountersCollection();

            for (const group of countersByYear.values()) {
                const currentCounter = await countersCollection.findOne({ _id: group.counterId });

                if (!currentCounter || currentCounter.sequence !== group.count) {
                    await countersCollection.replaceOne(
                        { _id: group.counterId },
                        {
                            _id: group.counterId,
                            sequence: group.count,
                            year: group.year,
                            academicSessionId: new Types.ObjectId(group.academicSessionId),
                            createdAt: currentCounter?.createdAt || new Date(),
                            updatedAt: new Date(),
                            repairedAt: new Date()
                        } as any,
                        { upsert: true }
                    );

                    repaired.push(`${group.counterId}: ${currentCounter?.sequence || 0} → ${group.count}`);
                    this.logger.log(`Repaired counter ${group.counterId}: ${currentCounter?.sequence || 0} → ${group.count}`);
                }
            }

        } catch (error) {
            errors.push(error instanceof Error ? error.message : 'Unknown repair error');
            this.logger.error('Error repairing counters:', error);
        }

        return { repaired, errors };
    }
}
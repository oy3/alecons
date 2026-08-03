import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
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
    async generateApplicationNumber(programId: string, academicSessionId: string, session?: ClientSession): Promise<string> {
        try {
            const { counterId, year, yearString } = await this.getCounterContext(academicSessionId);
            const programCode = await this.getProgramCode(programId);
            const counter = await this.getNextSequenceNumber(counterId, year, academicSessionId, session);
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
    private async getNextSequenceNumber(counterId: string, year: number, academicSessionId: string, session?: ClientSession): Promise<ApplicationCounter> {
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
                returnDocument: 'after',
                session,
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

    private extractSequenceFromApplicationNumber(applicationNumber: string): number {
        const match = applicationNumber?.match(/^ALEC\d{4}(\d{4,})$/);
        if (!match) {
            return 0;
        }

        return Number(match[1]) || 0;
    }

    /**
     * Get statistics about application numbers for a given year
     */
    async getApplicationNumberStats(year?: number): Promise<{
        year: number;
        totalApplications: number;
        highestSequence: number;
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
            status: 'healthy' | 'out-of-sync';
            drift: number;
        } | null;
    }> {
        const targetYear = year || new Date().getFullYear();
        const counterId = this.buildCounterIdFromYear(targetYear);

        const countersCollection = this.getCountersCollection();
        const counter = await countersCollection.findOne({ _id: counterId });

        const applications = await this.applicationModel
            .find({ applicationNumber: { $regex: `^${counterId}` } })
            .populate('programId', 'code name')
            .select('applicationNumber programId')
            .lean();

        const highestSequence = applications.reduce((highest: number, app: any) => {
            const sequence = this.extractSequenceFromApplicationNumber(app.applicationNumber);
            return sequence > highest ? sequence : highest;
        }, 0);

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
            totalApplications: applications.length,
            highestSequence,
            byProgram,
            counter: counter ? {
                id: counter._id,
                sequence: counter.sequence,
                nextSequence: counter.sequence + 1,
                academicSessionId: counter.academicSessionId?.toString?.(),
                status: counter.sequence === highestSequence ? 'healthy' : 'out-of-sync',
                drift: highestSequence - counter.sequence,
            } : null,
        };
    }

    /**
     * Repair year/session counters using actual applications.
     */
    async repairCounters(year?: number): Promise<{ repaired: Array<{ counterId: string; previousSequence: number; newSequence: number; highestSequence: number; totalApplications: number }>; errors: string[] }> {
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

            const countersCollection = this.getCountersCollection();

            const counterId = this.buildCounterIdFromYear(targetYear);
            const currentCounter = await countersCollection.findOne({ _id: counterId });

            if (!applications.length) {
                return { repaired, errors };
            }

            const highestSequence = applications.reduce((highest: number, app: any) => {
                const sequence = this.extractSequenceFromApplicationNumber(app.applicationNumber);
                return sequence > highest ? sequence : highest;
            }, 0);

            const sessionWithYear = applications.find((app: any) => app.entryAcademicSession?._id && app.entryAcademicSession?.sessionYear)?.entryAcademicSession;

            if (!sessionWithYear?._id || !sessionWithYear?.sessionYear) {
                throw new Error(`Unable to determine academic session for ${counterId} repair`);
            }

            const parsedYear = this.extractSessionStartYear(sessionWithYear.sessionYear);

            if (!currentCounter || currentCounter.sequence !== highestSequence) {
                await countersCollection.replaceOne(
                    { _id: counterId },
                    {
                        _id: counterId,
                        sequence: highestSequence,
                        year: parsedYear,
                        academicSessionId: new Types.ObjectId(sessionWithYear._id.toString()),
                        createdAt: currentCounter?.createdAt || new Date(),
                        updatedAt: new Date(),
                        repairedAt: new Date()
                    } as any,
                    { upsert: true }
                );

                repaired.push({
                    counterId,
                    previousSequence: currentCounter?.sequence || 0,
                    newSequence: highestSequence,
                    highestSequence,
                    totalApplications: applications.length,
                });
                this.logger.log(`Repaired counter ${counterId}: ${currentCounter?.sequence || 0} → ${highestSequence}`);
            }

        } catch (error) {
            errors.push(error instanceof Error ? error.message : 'Unknown repair error');
            this.logger.error('Error repairing counters:', error);
        }

        return { repaired, errors };
    }
}
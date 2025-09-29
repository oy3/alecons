import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// Counter schema for atomic sequence generation
interface ApplicationCounter {
    _id: string;
    sequence: number;
    year: number;
    programCode: string;
}

@Injectable()
export class ApplicationNumberService {
    private readonly logger = new Logger(ApplicationNumberService.name);

    constructor(
        @InjectModel('Application') private applicationModel: Model<any>,
        @InjectModel('Program') private programModel: Model<any>,
    ) { }

    /**
     * Generate a unique application number using atomic operations
     * Format: ALEC{YY}{PROGRAM_CODE}{SEQUENCE}
     * - YY: Last 2 digits of current year
     * - PROGRAM_CODE: 2-digit program code (padded with 0 if needed)
     * - SEQUENCE: 4-digit sequence starting from 0001, then continues to 99990, 99991, etc.
     */
    async generateApplicationNumber(programId: string): Promise<string> {
        try {
            const currentYear = new Date().getFullYear();
            const yearString = currentYear.toString().slice(-2);

            // Get program details
            const program = await this.programModel.findById(programId);
            if (!program) {
                throw new Error('Program not found for application number generation');
            }

            const programCode = String(program.code).padStart(2, '0');
            const counterId = `ALEC${yearString}${programCode}`;

            // Use atomic findOneAndUpdate to get next sequence number
            // This ensures no race conditions even with concurrent requests
            const counter = await this.getNextSequenceNumber(counterId, currentYear, programCode);

            // Format sequence number
            let sequenceStr: string;
            if (counter.sequence <= 9999) {
                sequenceStr = String(counter.sequence).padStart(4, '0');
            } else {
                // For numbers > 9999, use the number as-is (99990, 99991, etc.)
                sequenceStr = String(counter.sequence);
            }

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
    private async getNextSequenceNumber(counterId: string, year: number, programCode: string): Promise<ApplicationCounter> {
        // Create or get a collection for counters
        const db = this.applicationModel.db;
        const countersCollection = db.collection('application_counters');

        // Use atomic findOneAndUpdate with upsert to ensure uniqueness
        const result = await countersCollection.findOneAndUpdate(
            { _id: counterId } as any,
            {
                $inc: { sequence: 1 },
                $setOnInsert: {
                    year: year,
                    programCode: programCode,
                    createdAt: new Date()
                }
            },
            {
                upsert: true,
                returnDocument: 'after' // Return the updated document
            }
        );

        return result as unknown as ApplicationCounter;
    }

    /**
     * Initialize or reset counter for a specific year and program
     * Useful for testing or administrative purposes
     */
    async initializeCounter(programId: string, year?: number, startSequence: number = 0): Promise<void> {
        const targetYear = year || new Date().getFullYear();
        const yearString = targetYear.toString().slice(-2);

        const program = await this.programModel.findById(programId);
        if (!program) {
            throw new Error('Program not found');
        }

        const programCode = String(program.code).padStart(2, '0');
        const counterId = `ALEC${yearString}${programCode}`;

        const db = this.applicationModel.db;
        const countersCollection = db.collection('application_counters');

        await countersCollection.replaceOne(
            { _id: counterId } as any,
            {
                _id: counterId,
                sequence: startSequence,
                year: targetYear,
                programCode: programCode,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            { upsert: true }
        );

        this.logger.log(`Initialized counter ${counterId} with sequence ${startSequence}`);
    }

    /**
     * Get current counter status for a program and year
     */
    async getCounterStatus(programId: string, year?: number): Promise<ApplicationCounter | null> {
        const targetYear = year || new Date().getFullYear();
        const yearString = targetYear.toString().slice(-2);

        const program = await this.programModel.findById(programId);
        if (!program) {
            throw new Error('Program not found');
        }

        const programCode = String(program.code).padStart(2, '0');
        const counterId = `ALEC${yearString}${programCode}`;

        const db = this.applicationModel.db;
        const countersCollection = db.collection('application_counters');

        return await countersCollection.findOne({ _id: counterId } as any) as unknown as ApplicationCounter | null;
    }

    /**
     * Validate application number format
     */
    validateApplicationNumber(applicationNumber: string): boolean {
        // ALEC + 2 digits year + 2 digits program code + 4+ digits sequence
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
            nextSequence: number;
        }>;
    }> {
        const targetYear = year || new Date().getFullYear();
        const yearString = targetYear.toString().slice(-2);

        // Get all counters for the year
        const db = this.applicationModel.db;
        const countersCollection = db.collection('application_counters');

        const counters = await countersCollection.find({
            year: targetYear
        }).toArray();

        const byProgram = [];
        let totalApplications = 0;

        for (const counter of counters) {
            // Get program details
            const program = await this.programModel.findOne({ code: parseInt(counter.programCode) });

            // Get latest application number
            const prefix = `ALEC${yearString}${counter.programCode}`;
            const latestApp = await this.applicationModel
                .findOne({ applicationNumber: { $regex: `^${prefix}` } })
                .sort({ applicationNumber: -1 })
                .select('applicationNumber')
                .lean() as { applicationNumber?: string } | null;

            byProgram.push({
                programCode: counter.programCode,
                programName: program?.name || 'Unknown Program',
                count: counter.sequence,
                latest: latestApp?.applicationNumber || 'None',
                nextSequence: counter.sequence + 1
            });

            totalApplications += counter.sequence;
        }

        return {
            year: targetYear,
            totalApplications,
            byProgram
        };
    }

    /**
     * Repair any inconsistencies between counters and actual applications
     * Useful for data migration or fixing issues
     */
    async repairCounters(year?: number): Promise<{ repaired: string[]; errors: string[] }> {
        const targetYear = year || new Date().getFullYear();
        const yearString = targetYear.toString().slice(-2);
        const repaired = [];
        const errors = [];

        try {
            // Get all applications for the year
            const applications = await this.applicationModel
                .find({
                    applicationNumber: { $regex: `^ALEC${yearString}` },
                    createdAt: {
                        $gte: new Date(targetYear, 0, 1),
                        $lt: new Date(targetYear + 1, 0, 1)
                    }
                })
                .populate('programId', 'code name')
                .select('applicationNumber programId')
                .lean();

            // Group by program
            const programGroups = new Map();

            for (const app of applications) {
                const programCode = String(app.programId.code).padStart(2, '0');
                const key = `ALEC${yearString}${programCode}`;

                if (!programGroups.has(key)) {
                    programGroups.set(key, {
                        programId: app.programId._id,
                        programCode,
                        applications: []
                    });
                }

                programGroups.get(key).applications.push(app);
            }

            // Fix counters for each program
            const db = this.applicationModel.db;
            const countersCollection = db.collection('application_counters');

            for (const [counterId, group] of programGroups) {
                const actualCount = group.applications.length;
                const currentCounter = await countersCollection.findOne({ _id: counterId });

                if (!currentCounter || currentCounter.sequence !== actualCount) {
                    await countersCollection.replaceOne(
                        { _id: counterId },
                        {
                            _id: counterId,
                            sequence: actualCount,
                            year: targetYear,
                            programCode: group.programCode,
                            createdAt: currentCounter?.createdAt || new Date(),
                            updatedAt: new Date(),
                            repairedAt: new Date()
                        },
                        { upsert: true }
                    );

                    repaired.push(`${counterId}: ${currentCounter?.sequence || 0} → ${actualCount}`);
                    this.logger.log(`Repaired counter ${counterId}: ${currentCounter?.sequence || 0} → ${actualCount}`);
                }
            }

        } catch (error) {
            errors.push(error.message);
            this.logger.error('Error repairing counters:', error);
        }

        return { repaired, errors };
    }
}
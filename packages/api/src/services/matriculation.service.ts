import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

// Counter schema for atomic sequence generation
interface MatriculationCounter {
    _id: string;
    sequence: number;
    academicSessionId: string;
    sessionYear: string;
    yearSuffix: string;
    programTypeCode: string;
    programCode: string;
}

interface MatriculationAcademicSession {
    _id?: Types.ObjectId | string;
    sessionYear?: string;
    startDate?: Date | string;
}

@Injectable()
export class MatriculationService {
    private readonly logger = new Logger(MatriculationService.name);

    constructor(
        @InjectModel('Program') private programModel: Model<any>,
        @InjectModel('AcademicSession') private academicSessionModel: Model<any>,
        @InjectModel('Student') private studentModel: Model<any>,
    ) { }

    /**
     * Generate matriculation number in format: ALC/{programType.type}/{sessionYY}/{programCode}{sequence}
     * Example: ALC/ND/25/010001
     */
    async generateMatriculationNumber(programId: string, academicSessionId: string): Promise<string> {
        try {
            this.logger.log(`Starting matriculation number generation for programId: ${programId}, academicSessionId: ${academicSessionId}`);

            if (!Types.ObjectId.isValid(programId)) {
                throw new Error('Invalid program ID for matriculation number generation');
            }

            if (!Types.ObjectId.isValid(academicSessionId)) {
                throw new Error('Invalid academic session ID for matriculation number generation');
            }

            // Get program details to get the actual program code
            this.logger.log(`Looking up program with ID: ${programId}`);
            const program = await this.programModel
                .findById(programId)
                .populate('programTypeId', 'type')
                .exec();
            if (!program) {
                this.logger.error(`Program not found with ID: ${programId}`);
                throw new Error('Program not found for matriculation number generation');
            }

            const academicSessionResult = await this.academicSessionModel
                .findById(academicSessionId)
                .select('sessionYear startDate')
                .lean()
                .exec();

            const academicSession = (Array.isArray(academicSessionResult)
                ? academicSessionResult[0]
                : academicSessionResult) as MatriculationAcademicSession | null;

            if (!academicSession) {
                this.logger.error(`Academic session not found with ID: ${academicSessionId}`);
                throw new Error('Academic session not found for matriculation number generation');
            }

            const year = this.extractSessionStartYear(academicSession);
            const yearSuffix = String(year).slice(-2);
            const programTypeCode = this.normalizeProgramTypeCode(
                typeof program.programTypeId === 'object' ? program.programTypeId?.type : undefined,
            );

            this.logger.log(`Found program:`, { id: program._id, name: program.name, code: program.code });

            const programCode = String(program.code).padStart(2, '0');
            const counterId = this.buildCounterId(academicSessionId, programTypeCode, programCode);

            this.logger.log(`Generated counterId: ${counterId} (sessionYear: ${academicSession.sessionYear}, programTypeCode: ${programTypeCode}, programCode: ${programCode})`);

            // Use atomic counter to get next sequence number
            const counter = await this.getNextSequenceNumber(counterId, {
                academicSessionId,
                sessionYear: academicSession.sessionYear,
                yearSuffix,
                programTypeCode,
                programCode,
            });

            // Format sequence number (always at least 4 digits)
            let sequenceStr: string;
            if (counter.sequence <= 9999) {
                sequenceStr = String(counter.sequence).padStart(4, '0');
            } else {
                // For numbers > 9999, continue with 5 digits, etc.
                sequenceStr = String(counter.sequence);
            }

            const matriculationNumber = `ALC/${programTypeCode}/${yearSuffix}/${programCode}${sequenceStr}`;

            this.logger.log(`Generated matriculation number: ${matriculationNumber} (sequence: ${counter.sequence})`);
            return matriculationNumber;

        } catch (error) {
            this.logger.error('Error generating matriculation number:', error);
            throw error;
        }
    }

    /**
     * Atomic sequence number generation using MongoDB's findOneAndUpdate
     */
    private async getNextSequenceNumber(counterId: string, context: {
        academicSessionId: string;
        sessionYear: string;
        yearSuffix: string;
        programTypeCode: string;
        programCode: string;
    }): Promise<MatriculationCounter> {
        const db = this.studentModel.db;
        const countersCollection = db.collection('matriculation_counters');

        this.logger.log(`Attempting to get next sequence for counterId: ${counterId}, sessionYear: ${context.sessionYear}, programTypeCode: ${context.programTypeCode}, programCode: ${context.programCode}`);

        try {
            const counter = await countersCollection.findOneAndUpdate(
                { _id: counterId } as any,
                {
                    $inc: { sequence: 1 },
                    $setOnInsert: {
                        academicSessionId: context.academicSessionId,
                        sessionYear: context.sessionYear,
                        yearSuffix: context.yearSuffix,
                        programTypeCode: context.programTypeCode,
                        programCode: context.programCode,
                        createdAt: new Date()
                    }
                },
                {
                    upsert: true,
                    returnDocument: 'after'
                }
            );

            this.logger.log(`MongoDB findOneAndUpdate result:`, {
                hasValue: !!counter.value,
                hasDirectCounter: !!counter._id,
                ok: counter.ok,
                lastErrorObject: counter.lastErrorObject
            });

            // Check if the operation was successful
            // MongoDB might return the document directly or wrapped in a 'value' property
            let resultDocument = counter.value || counter;

            if (!resultDocument || !resultDocument._id) {
                this.logger.error('Counter operation failed. Full counter response:', counter);
                throw new Error(`Failed to create or update matriculation counter. MongoDB response: ${JSON.stringify(counter)}`);
            }

            this.logger.log(`Successfully retrieved counter:`, resultDocument);
            return resultDocument as MatriculationCounter;
        } catch (error) {
            this.logger.error('Error in getNextSequenceNumber:', error);
            throw error;
        }
    }

    /**
     * Validate matriculation number format
     */
    validateMatriculationNumber(matricNumber: string): boolean {
        const pattern = /^ALC\/[A-Z0-9]+\/\d{2}\/\d{2}\d{4,}$/;
        return pattern.test(matricNumber);
    }

    /**
     * Extract components from matriculation number
     */
    parseMatriculationNumber(matricNumber: string): {
        programType: string;
        year: string;
        programCode: string;
        sequence: string;
    } | null {
        if (!this.validateMatriculationNumber(matricNumber)) {
            return null;
        }

        const parts = matricNumber.split('/');
        const [, programType, year, combinedCode] = parts;
        const programCode = combinedCode.slice(0, 2);
        const sequence = combinedCode.slice(2);

        return {
            programType,
            year,
            programCode,
            sequence
        };
    }

    private buildCounterId(academicSessionId: string, programTypeCode: string, programCode: string) {
        return `ALC:${academicSessionId}:${programTypeCode}:${programCode}`;
    }

    private normalizeProgramTypeCode(programType?: string) {
        const normalized = String(programType || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');

        if (!normalized) {
            throw new Error('Program type code is required for matriculation number generation');
        }

        return normalized;
    }

    private extractSessionStartYear(academicSession: { sessionYear?: string; startDate?: Date | string }) {
        const sessionYearMatch = academicSession.sessionYear?.match(/\d{4}/);
        if (sessionYearMatch) {
            return Number(sessionYearMatch[0]);
        }

        if (academicSession.startDate) {
            const startDate = new Date(academicSession.startDate);
            if (!Number.isNaN(startDate.getTime())) {
                return startDate.getFullYear();
            }
        }

        throw new Error('Unable to derive matriculation year from academic session');
    }
}
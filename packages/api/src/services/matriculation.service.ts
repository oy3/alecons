import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// Counter schema for atomic sequence generation
interface MatriculationCounter {
    _id: string;
    sequence: number;
    year: number;
    programCode: string;
}

@Injectable()
export class MatriculationService {
    private readonly logger = new Logger(MatriculationService.name);

    constructor(
        @InjectModel('Program') private programModel: Model<any>,
        @InjectModel('Student') private studentModel: Model<any>,
    ) { }

    /**
     * Generate matriculation number in format: ALC/{YY}/{program.code}-nnnn
     * Example: ALC/25/01-0001
     */
    async generateMatriculationNumber(programId: string, year?: number): Promise<string> {
        try {
            this.logger.log(`Starting matriculation number generation for programId: ${programId}, year: ${year}`);

            const currentYear = year || new Date().getFullYear();
            const yearSuffix = currentYear.toString().slice(-2);

            // Get program details to get the actual program code
            this.logger.log(`Looking up program with ID: ${programId}`);
            const program = await this.programModel.findById(programId);
            if (!program) {
                this.logger.error(`Program not found with ID: ${programId}`);
                throw new Error('Program not found for matriculation number generation');
            }

            this.logger.log(`Found program:`, { id: program._id, name: program.name, code: program.code });

            const programCode = String(program.code).padStart(2, '0');
            const counterId = `ALC${yearSuffix}${programCode}`;

            this.logger.log(`Generated counterId: ${counterId} (year: ${currentYear}, programCode: ${programCode})`);

            // Use atomic counter to get next sequence number
            const counter = await this.getNextSequenceNumber(counterId, currentYear, programCode);

            // Format sequence number (always at least 4 digits)
            let sequenceStr: string;
            if (counter.sequence <= 9999) {
                sequenceStr = String(counter.sequence).padStart(4, '0');
            } else {
                // For numbers > 9999, continue with 5 digits, etc.
                sequenceStr = String(counter.sequence);
            }

            const matriculationNumber = `ALC/${yearSuffix}/${programCode}-${sequenceStr}`;

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
    private async getNextSequenceNumber(counterId: string, year: number, programCode: string): Promise<MatriculationCounter> {
        const db = this.studentModel.db;
        const countersCollection = db.collection('matriculation_counters');

        this.logger.log(`Attempting to get next sequence for counterId: ${counterId}, year: ${year}, programCode: ${programCode}`);

        try {
            const counter = await countersCollection.findOneAndUpdate(
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
        const pattern = /^ALC\/\d{2}\/\d{2}-\d{4}$/;
        return pattern.test(matricNumber);
    }

    /**
     * Extract components from matriculation number
     */
    parseMatriculationNumber(matricNumber: string): {
        year: string;
        programCode: string;
        sequence: string;
    } | null {
        if (!this.validateMatriculationNumber(matricNumber)) {
            return null;
        }

        const parts = matricNumber.split('/');
        const [, year] = parts;
        const [programCode, sequence] = parts[2].split('-');

        return {
            year,
            programCode,
            sequence
        };
    }
}
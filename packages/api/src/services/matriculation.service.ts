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
            const currentYear = year || new Date().getFullYear();
            const yearSuffix = currentYear.toString().slice(-2);

            // Get program details to get the actual program code
            const program = await this.programModel.findById(programId);
            if (!program) {
                throw new Error('Program not found for matriculation number generation');
            }

            const programCode = String(program.code).padStart(2, '0');
            const counterId = `ALC${yearSuffix}${programCode}`;

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

        return counter.value as MatriculationCounter;
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
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

// Counter schema for atomic sequence generation
interface MatriculationCounter {
    _id: string;
    sequence: number;
    yearSuffix: string;
    programTypeCode: string;
    programCode: string;
    scope: 'academic-year';
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

    async migrateCounterScope(apply = false) {
        const db = this.studentModel.db;
        const counters = db.collection<any>('matriculation_counters');
        const reservations = db.collection<any>('matriculation_reservations');
        const groups = new Map<string, any>();
        const unmappedCounters: any[] = [];
        const unmappedNumbers: any[] = [];
        const pattern = /^ALC\/([A-Z0-9]+)\/(\d{2})\/(\d{2})(\d{4,})$/i;

        const ensureGroup = (yearSuffix: string, programTypeCode: string, programCode: string) => {
            const type = programTypeCode.toUpperCase();
            const code = programCode.padStart(2, '0');
            const key = `ALC:${yearSuffix}:${type}:${code}`;
            if (!groups.has(key)) groups.set(key, {
                _id: key, yearSuffix, programTypeCode: type, programCode: code,
                sequence: 0, numbers: new Map<string, any>(), sources: new Set<string>(),
            });
            return groups.get(key);
        };
        const addNumber = (number: unknown, owner: string) => {
            if (typeof number !== 'string' || !number.trim()) return;
            const match = number.trim().match(pattern);
            if (!match) {
                unmappedNumbers.push({ owner, matriculationNumber: number });
                return;
            }
            const [, type, yearSuffix, code, sequenceText] = match;
            const sequence = Number(sequenceText);
            if (!Number.isSafeInteger(sequence) || sequence < 1) {
                unmappedNumbers.push({ owner, matriculationNumber: number });
                return;
            }
            const group = ensureGroup(yearSuffix, type, code);
            const normalized = `ALC/${type.toUpperCase()}/${yearSuffix}/${code}${String(sequence).padStart(4, '0')}`;
            group.sequence = Math.max(group.sequence, sequence);
            group.sources.add(owner.split(':')[0]);
            const record = group.numbers.get(normalized) || { sequence, owners: [] };
            record.owners.push(owner);
            group.numbers.set(normalized, record);
        };

        for await (const student of db.collection('students').find(
            { matriculationNumber: { $type: 'string', $ne: '' } },
            { projection: { _id: 1, applicationId: 1, matriculationNumber: 1 } },
        )) addNumber(student.matriculationNumber, `student:${student._id}:${student.applicationId || ''}`);

        for await (const application of db.collection('applications').find(
            { matriculationNumber: { $type: 'string', $ne: '' } },
            { projection: { _id: 1, matriculationNumber: 1 } },
        )) addNumber(application.matriculationNumber, `application:${application._id}`);

        for (const counter of await counters.find({}).toArray()) {
            const year = String(counter.yearSuffix || '').trim();
            const type = String(counter.programTypeCode || '').trim();
            const code = String(counter.programCode || '').trim();
            const sequence = Number(counter.sequence);
            if (!/^\d{2}$/.test(year) || !type || !code || !Number.isSafeInteger(sequence) || sequence < 0) {
                unmappedCounters.push({ id: counter._id, sequence: counter.sequence });
                continue;
            }
            const group = ensureGroup(year, type, code);
            group.sequence = Math.max(group.sequence, sequence);
            group.sources.add(counter.scope || 'legacy-counter');
        }

        for (const reservation of await reservations.find({}).toArray()) {
            addNumber(reservation._id, `reservation:${reservation._id}`);
        }

        const conflicts: any[] = [];
        const allNumbers: Array<{ group: any; number: string; record: any }> = [];
        for (const group of groups.values()) {
            for (const [number, record] of group.numbers) {
                allNumbers.push({ group, number, record });
                const studentApps = record.owners.filter((owner: string) => owner.startsWith('student:'))
                    .map((owner: string) => owner.split(':')[2]).filter(Boolean);
                const appIds = record.owners.filter((owner: string) => owner.startsWith('application:'))
                    .map((owner: string) => owner.split(':')[1]);
                if (studentApps.length > 1 || appIds.length > 1 || appIds.some((id: string) => !studentApps.includes(id))) {
                    conflicts.push({ matriculationNumber: number, owners: record.owners });
                }
            }
        }

        const report = {
            apply,
            counterGroups: [...groups.values()].map((group) => ({
                counterId: group._id,
                yearSuffix: group.yearSuffix,
                programTypeCode: group.programTypeCode,
                programCode: group.programCode,
                highestSequence: group.sequence,
                knownNumbers: group.numbers.size,
                sources: [...group.sources],
            })),
            reservationCount: allNumbers.length,
            conflictingAssignments: conflicts,
            unmappedCounters,
            unmappedMatriculationNumbers: unmappedNumbers,
        };

        if (!apply) return report;
        if (unmappedCounters.length) throw new Error('Cannot apply: one or more existing counters cannot be mapped safely.');
        if (conflicts.length) throw new Error('Cannot apply: conflicting matriculation assignments must be resolved first.');
        if (unmappedNumbers.length) throw new Error('Cannot apply: stored matriculation numbers need review before migration.');

        for (const { group, number, record } of allNumbers) {
            await reservations.updateOne(
                { _id: number } as any,
                { $setOnInsert: {
                    yearSuffix: group.yearSuffix,
                    programTypeCode: group.programTypeCode,
                    programCode: group.programCode,
                    sequence: record.sequence,
                    reservedAt: new Date(),
                    source: record.owners[0]?.split(':')[0] || 'migration',
                } },
                { upsert: true },
            );
        }
        for (const group of groups.values()) {
            await counters.updateOne(
                { _id: group._id } as any,
                {
                    $max: { sequence: group.sequence },
                    $set: {
                        yearSuffix: group.yearSuffix,
                        programTypeCode: group.programTypeCode,
                        programCode: group.programCode,
                        scope: 'academic-year',
                        updatedAt: new Date(),
                    },
                    $setOnInsert: { createdAt: new Date() },
                },
                { upsert: true },
            );
        }
        await db.collection('matriculation_counter_migration_state').updateOne(
            { _id: 'academic-year-scope-v1' } as any,
            { $set: { completedAt: new Date(), scope: 'academic-year', version: 1 } },
            { upsert: true },
        );
        return { ...report, apply: true, countersSeeded: groups.size, reservationsSeeded: allNumbers.length };
    }

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

            const migrationState = await this.studentModel.db
                .collection<any>('matriculation_counter_migration_state')
                .findOne({ _id: 'academic-year-scope-v1' });
            if (!migrationState?.completedAt) {
                throw new Error('Matriculation counters require migration in Utilities before enrollment can issue new numbers');
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
            const counterId = this.buildCounterId(yearSuffix, programTypeCode, programCode);

            this.logger.log(`Generated counterId: ${counterId} (sessionYear: ${academicSession.sessionYear}, programTypeCode: ${programTypeCode}, programCode: ${programCode})`);

            while (true) {
                const counter = await this.getNextSequenceNumber(counterId, {
                    yearSuffix,
                    programTypeCode,
                    programCode,
                });
                const sequenceStr = String(counter.sequence).padStart(4, '0');
                const matriculationNumber = `ALC/${programTypeCode}/${yearSuffix}/${programCode}${sequenceStr}`;

                const reserved = await this.reserveMatriculationNumber(matriculationNumber, {
                    yearSuffix,
                    programTypeCode,
                    programCode,
                    sequence: counter.sequence,
                });
                if (!reserved) {
                    this.logger.warn(`Skipping previously assigned matriculation number ${matriculationNumber}`);
                    continue;
                }

                this.logger.log(`Generated matriculation number: ${matriculationNumber} (sequence: ${counter.sequence})`);
                return matriculationNumber;
            }

        } catch (error) {
            this.logger.error('Error generating matriculation number:', error);
            throw error;
        }
    }

    /**
     * Atomic sequence number generation using MongoDB's findOneAndUpdate
     */
    private async getNextSequenceNumber(counterId: string, context: {
        yearSuffix: string;
        programTypeCode: string;
        programCode: string;
    }): Promise<MatriculationCounter> {
        const db = this.studentModel.db;
        const countersCollection = db.collection('matriculation_counters');

        this.logger.log(`Attempting to get next sequence for counterId: ${counterId}, yearSuffix: ${context.yearSuffix}, programTypeCode: ${context.programTypeCode}, programCode: ${context.programCode}`);

        try {
            const counter = await countersCollection.findOneAndUpdate(
                { _id: counterId } as any,
                {
                    $inc: { sequence: 1 },
                    $setOnInsert: {
                        yearSuffix: context.yearSuffix,
                        programTypeCode: context.programTypeCode,
                        programCode: context.programCode,
                        scope: 'academic-year',
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

    private async reserveMatriculationNumber(matriculationNumber: string, context: {
        yearSuffix: string;
        programTypeCode: string;
        programCode: string;
        sequence: number;
    }): Promise<boolean> {
        const reservations = this.studentModel.db.collection<any>('matriculation_reservations');
        const [student, application] = await Promise.all([
            this.studentModel.exists({ matriculationNumber }),
            this.studentModel.db.collection('applications').findOne(
                { matriculationNumber },
                { projection: { _id: 1 } },
            ),
        ]);
        if (student || application) return false;

        try {
            await reservations.insertOne({
                _id: matriculationNumber,
                ...context,
                reservedAt: new Date(),
            });
            return true;
        } catch (error: any) {
            if (error?.code === 11000) return false;
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

    private buildCounterId(yearSuffix: string, programTypeCode: string, programCode: string) {
        return `ALC:${yearSuffix}:${programTypeCode}:${programCode}`;
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

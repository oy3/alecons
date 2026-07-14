import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AcademicSession, AcademicSessionDocument, SessionStatus } from '../schemas/academic-session.schema';
import { CreateAcademicSessionDto, UpdateAcademicSessionDto, QueryAcademicSessionsDto } from '../dto/academic-session.dto';

@Injectable()
export class AcademicSessionsService {
    private readonly logger = new Logger(AcademicSessionsService.name);

    constructor(
        @InjectModel(AcademicSession.name)
        private academicSessionModel: Model<AcademicSessionDocument>,
    ) { }

    private generateSessionYear(startDate: string, endDate: string): string {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const startYear = start.getFullYear();
        const endYear = end.getFullYear();

        return `${startYear}/${endYear}`;
    }

    private async ensureSessionIndexes(): Promise<void> {
        try {
            const indexes = await this.academicSessionModel.collection.indexes();
            const legacyIndex = indexes.find((index) => index.key?.sessionYear === 1);

            if (legacyIndex?.name) {
                await this.academicSessionModel.collection.dropIndex(legacyIndex.name);
                this.logger.log(`Dropped legacy academic session index: ${legacyIndex.name}`);
            }
        } catch (error) {
            this.logger.warn('Could not refresh academic session indexes:', error);
        }
    }

    async create(createDto: CreateAcademicSessionDto, userId: string): Promise<AcademicSession> {
        const sessionYear = this.generateSessionYear(createDto.startDate, createDto.endDate);

        await this.ensureSessionIndexes();

        const academicSession = new this.academicSessionModel({
            ...createDto,
            sessionYear,
            status: createDto.status || SessionStatus.OPEN,
            active: createDto.active !== undefined ? createDto.active : true,
        });

        return academicSession.save();
    }

    async findAll(query: QueryAcademicSessionsDto): Promise<{
        sessions: AcademicSession[];
        pagination: {
            currentPage: number;
            totalPages: number;
            totalItems: number;
            itemsPerPage: number;
        };
    }> {
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filter: any = {};

        if (query.search) {
            filter.$or = [
                { sessionYear: { $regex: query.search, $options: 'i' } },
                { title: { $regex: query.search, $options: 'i' } },
                { description: { $regex: query.search, $options: 'i' } },
            ];
        }

        if (query.status) {
            filter.status = query.status;
        }

        if (query.active !== undefined) {
            filter.active = typeof query.active === 'string' ? query.active === 'true' : query.active;
        }

        // Build sort object
        const sort: any = {};
        const sortBy = query.sortBy || 'createdAt';
        const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
        sort[sortBy] = sortOrder;

        // Execute queries
        const [sessions, totalItems] = await Promise.all([
            this.academicSessionModel
                .find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .exec(),
            this.academicSessionModel.countDocuments(filter),
        ]);

        return {
            sessions,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalItems / limit),
                totalItems,
                itemsPerPage: limit,
            },
        };
    }

    async findById(id: string): Promise<AcademicSession> {
        const academicSession = await this.academicSessionModel.findById(id);
        if (!academicSession) {
            throw new NotFoundException('Academic session not found');
        }
        return academicSession;
    }

    async update(
        id: string,
        updateDto: UpdateAcademicSessionDto,
        userId: string,
    ): Promise<AcademicSession> {
        const updateData: any = { ...updateDto };

        // Regenerate session year if dates are updated
        if (updateDto.startDate || updateDto.endDate) {
            const existingSession = await this.findById(id);
            const startDate = updateDto.startDate || existingSession.startDate.toISOString();
            const endDate = updateDto.endDate || existingSession.endDate.toISOString();

            const newSessionYear = this.generateSessionYear(startDate, endDate);

            if (newSessionYear !== existingSession.sessionYear) {
                updateData.sessionYear = newSessionYear;
            }
        }

        const academicSession = await this.academicSessionModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true },
        );

        if (!academicSession) {
            throw new NotFoundException('Academic session not found');
        }

        return academicSession;
    }

    async delete(id: string): Promise<void> {
        const result = await this.academicSessionModel.findByIdAndDelete(id);
        if (!result) {
            throw new NotFoundException('Academic session not found');
        }
    }

    async findActiveSession(): Promise<AcademicSession | null> {
        return this.academicSessionModel.findOne({ active: true });
    }

    async setActiveSession(id: string): Promise<AcademicSession> {
        // First deactivate all sessions
        await this.academicSessionModel.updateMany({}, { active: false });

        // Then activate the specified session
        const academicSession = await this.academicSessionModel.findByIdAndUpdate(
            id,
            { active: true },
            { new: true },
        );

        if (!academicSession) {
            throw new NotFoundException('Academic session not found');
        }

        return academicSession;
    }

    /**
     * Inspect legacy index and detect duplicate sessionYear values.
     * If `apply` is true, drop the legacy unique index when found.
     */
    async inspectAndRepairLegacyIndex(apply = false): Promise<{
        legacyIndexName?: string | null;
        duplicateCount: number;
        duplicatesSample: Array<{ sessionYear: string; id: string }>;
        dropped?: boolean;
    }> {
        try {
            const coll = this.academicSessionModel.collection;

            let legacyIndexName: string | null = null;
            try {
                const indexes = await coll.indexes();
                const legacyIndex = indexes.find((index) => index.key?.sessionYear === 1 && index.unique);
                if (legacyIndex?.name) legacyIndexName = legacyIndex.name;
            } catch (err) {
                this.logger.warn('Failed to list indexes on academicsessions collection:', err?.message || err);
            }

            const cursor = coll.find({}).sort({ createdAt: 1 }).batchSize(100);
            const seen = new Map<string, string>();
            let duplicateCount = 0;
            const duplicatesSample: Array<{ sessionYear: string; id: string }> = [];

            for await (const doc of cursor) {
                const key = String(doc.sessionYear || '');
                if (!seen.has(key)) {
                    seen.set(key, String(doc._id));
                    continue;
                }

                duplicateCount += 1;
                if (duplicatesSample.length < 20) {
                    duplicatesSample.push({ sessionYear: key, id: String(doc._id) });
                }
            }

            let dropped = false;
            if (apply && legacyIndexName) {
                try {
                    await coll.dropIndex(legacyIndexName);
                    this.logger.log(`Dropped legacy academic session index: ${legacyIndexName}`);
                    dropped = true;
                } catch (err) {
                    this.logger.warn('Failed to drop legacy academic session index:', err?.message || err);
                }
            }

            return { legacyIndexName, duplicateCount, duplicatesSample, dropped };
        } catch (error) {
            this.logger.error('inspectAndRepairLegacyIndex failed:', error?.message || error);
            throw error;
        }
    }
}
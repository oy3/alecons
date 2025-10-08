import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AcademicSession, AcademicSessionDocument, SessionStatus } from '../schemas/academic-session.schema';
import { CreateAcademicSessionDto, UpdateAcademicSessionDto, QueryAcademicSessionsDto } from '../dto/academic-session.dto';

@Injectable()
export class AcademicSessionsService {
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

    async create(createDto: CreateAcademicSessionDto, userId: string): Promise<AcademicSession> {
        const sessionYear = this.generateSessionYear(createDto.startDate, createDto.endDate);

        // Check if session year already exists
        const existingSession = await this.academicSessionModel.findOne({ sessionYear });
        if (existingSession) {
            throw new ConflictException(`Academic session for ${sessionYear} already exists`);
        }

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

            // Check if new session year conflicts with existing sessions
            if (newSessionYear !== existingSession.sessionYear) {
                const conflictingSession = await this.academicSessionModel.findOne({
                    sessionYear: newSessionYear,
                    _id: { $ne: id },
                });

                if (conflictingSession) {
                    throw new ConflictException(`Academic session for ${newSessionYear} already exists`);
                }

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
}
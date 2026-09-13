import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Exam, ExamDocument } from '../schemas/exam.schema';
import { ExamAttempt, ExamAttemptDocument } from '../schemas/exam-attempt.schema';
import { ExamQuestion, ExamQuestionDocument } from '../schemas/exam-question.schema';
import { QuestionBankActivity, QuestionBankActivityDocument } from '../schemas/question-bank-activity.schema';
import { QuestionBankItem, QuestionBankItemDocument } from '../schemas/question-bank-item.schema';
import { ContentSanitizationService } from './content-sanitization.service';
import { createQuestionFingerprint } from '../utils/question-fingerprint';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class QuestionBankService {
    constructor(
        @InjectModel(QuestionBankItem.name) private readonly bankModel: Model<QuestionBankItemDocument>,
        @InjectModel(QuestionBankActivity.name) private readonly activityModel: Model<QuestionBankActivityDocument>,
        @InjectModel(ExamQuestion.name) private readonly examQuestionModel: Model<ExamQuestionDocument>,
        @InjectModel(Exam.name) private readonly examModel: Model<ExamDocument>,
        @InjectModel(ExamAttempt.name) private readonly attemptModel: Model<ExamAttemptDocument>,
        private readonly contentSanitizationService: ContentSanitizationService,
    ) {}

    private normalizePayload(payload: any) {
        const type = payload.type === 'multiple-choice' ? 'mcq' : payload.type;
        if (!['mcq', 'multi', 'essay'].includes(type)) {
            throw new BadRequestException('Question type must be mcq, multi, or essay');
        }
        const validation = this.contentSanitizationService.validateQuestionContent(payload.questionText);
        if (!validation.isValid) {
            throw new BadRequestException(`Invalid question content: ${validation.warnings.join(', ')}`);
        }
        let options: Record<string, string> | undefined;
        if (Array.isArray(payload.options)) {
            options = payload.options.reduce((result: Record<string, string>, option: unknown, index: number) => {
                result[String.fromCharCode(97 + index)] = String(option ?? '').trim();
                return result;
            }, {});
        } else if (payload.options && typeof payload.options === 'object') {
            options = Object.entries(payload.options).reduce((result: Record<string, string>, [key, option]) => {
                result[String(key).toLowerCase()] = String(option ?? '').trim();
                return result;
            }, {});
        }
        const rawAnswer = payload.correctAnswer ?? payload.answer;
        const answer = Array.isArray(rawAnswer)
            ? rawAnswer.map((value) => typeof value === 'number' ? String.fromCharCode(97 + value) : String(value).toLowerCase())
            : typeof rawAnswer === 'number'
                ? String.fromCharCode(97 + rawAnswer)
                : typeof rawAnswer === 'string'
                    ? rawAnswer.toLowerCase()
                    : rawAnswer;
        if (['mcq', 'multi'].includes(type) && (!options || !answer || (Array.isArray(answer) && !answer.length))) {
            throw new BadRequestException('Objective questions require options and a correct answer');
        }
        const metadata = {
            difficulty: payload.metadata?.difficulty || payload.difficulty || 'medium',
            subject: (payload.metadata?.subject || payload.subject || '').trim() || undefined,
            topic: (payload.metadata?.topic || payload.topic || '').trim() || undefined,
            learningObjective: (payload.metadata?.learningObjective || payload.learningObjective || '').trim() || undefined,
            contentMetadata: validation.metadata,
        };
        const normalized = {
            questionText: validation.sanitizedContent,
            type,
            options,
            answer: type === 'essay' ? undefined : answer,
            defaultMark: Number(payload.defaultMark ?? payload.mark ?? 1),
            mediaUrls: Array.isArray(payload.mediaUrls) ? payload.mediaUrls : [],
            tags: Array.isArray(payload.tags) ? [...new Set(payload.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean))] : [],
            metadata,
        };
        return { ...normalized, fingerprint: createQuestionFingerprint(normalized) };
    }

    async list(query: any) {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(100, Math.max(5, Number(query.limit) || 10));
        const filter: FilterQuery<QuestionBankItemDocument> = {};
        if (query.status && query.status !== 'all') filter.status = query.status;
        if (query.type && query.type !== 'all') filter.type = query.type;
        if (query.subject && query.subject !== 'all') filter['metadata.subject'] = query.subject;
        if (query.topic && query.topic !== 'all') filter['metadata.topic'] = query.topic;
        if (query.difficulty && query.difficulty !== 'all') filter['metadata.difficulty'] = query.difficulty;
        if (query.createdBy && Types.ObjectId.isValid(query.createdBy)) filter.createdBy = new Types.ObjectId(query.createdBy);
        if (query.used === 'yes') filter.usageCount = { $gt: 0 };
        if (query.used === 'no') filter.usageCount = 0;
        if (query.search?.trim()) {
            const regex = new RegExp(escapeRegex(query.search.trim()), 'i');
            filter.$or = [
                { questionText: regex },
                { tags: regex },
                { 'metadata.subject': regex },
                { 'metadata.topic': regex },
            ];
        }

        const sort: Record<string, 1 | -1> = query.sort === 'usage'
            ? { usageCount: -1, updatedAt: -1 }
            : { createdAt: -1 };
        const [items, total] = await Promise.all([
            this.bankModel.find(filter)
                .populate('createdBy', 'firstName lastName')
                .sort(sort).skip((page - 1) * limit).limit(limit).lean(),
            this.bankModel.countDocuments(filter),
        ]);
        return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
    }

    async facets() {
        const [subjects, topics, creators] = await Promise.all([
            this.bankModel.distinct('metadata.subject', { 'metadata.subject': { $nin: [null, ''] } }),
            this.bankModel.distinct('metadata.topic', { 'metadata.topic': { $nin: [null, ''] } }),
            this.bankModel.aggregate([
                { $group: { _id: '$createdBy' } },
                { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
                { $unwind: '$user' },
                { $project: { _id: 1, name: { $concat: ['$user.firstName', ' ', '$user.lastName'] } } },
                { $sort: { name: 1 } },
            ]),
        ]);
        return { subjects: subjects.sort(), topics: topics.sort(), creators };
    }

    async summary() {
        const [total, active, subjects, topSubject, lastAdded, types, mostUsed, recentActivity] = await Promise.all([
            this.bankModel.countDocuments(),
            this.bankModel.countDocuments({ status: 'active' }),
            this.bankModel.distinct('metadata.subject', { 'metadata.subject': { $nin: [null, ''] } }),
            this.bankModel.aggregate([
                { $match: { 'metadata.subject': { $nin: [null, ''] } } },
                { $group: { _id: '$metadata.subject', count: { $sum: 1 } } },
                { $sort: { count: -1, _id: 1 } }, { $limit: 1 },
            ]),
            this.bankModel.findOne().sort({ createdAt: -1 }).populate('createdBy', 'firstName lastName').lean(),
            this.bankModel.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
            this.bankModel.find({ usageCount: { $gt: 0 } }).sort({ usageCount: -1 }).limit(5).select('questionText usageCount').lean(),
            this.activityModel.find().sort({ createdAt: -1 }).limit(5).populate('actorUserId', 'firstName lastName').lean(),
        ]);
        return {
            total,
            active,
            activePercentage: total ? Math.round((active / total) * 1000) / 10 : 0,
            subjectCount: subjects.length,
            topSubject: topSubject[0] || null,
            lastAdded,
            types,
            mostUsed,
            recentActivity,
        };
    }

    async create(payload: any, actorId: string) {
        const normalized = this.normalizePayload(payload);
        const duplicate = await this.bankModel.findOne({ fingerprint: normalized.fingerprint }).lean();
        if (duplicate) throw new BadRequestException('An identical question already exists in the question bank');
        const item = await this.bankModel.create({ ...normalized, createdBy: new Types.ObjectId(actorId) });
        await this.activityModel.create({ questionBankItemId: item._id, action: 'created', actorUserId: actorId });
        return item;
    }

    async bulkCreate(questions: any[], actorId: string) {
        if (!Array.isArray(questions) || !questions.length) throw new BadRequestException('No questions were supplied');
        let created = 0;
        let duplicates = 0;
        const errors: Array<{ index: number; message: string }> = [];
        for (let index = 0; index < questions.length; index++) {
            try {
                const normalized = this.normalizePayload(questions[index]);
                const result = await this.bankModel.updateOne(
                    { fingerprint: normalized.fingerprint },
                    { $setOnInsert: { ...normalized, createdBy: new Types.ObjectId(actorId) } },
                    { upsert: true },
                );
                if (result.upsertedCount) created++;
                else duplicates++;
            } catch (error) {
                errors.push({ index, message: error?.message || 'Invalid question' });
            }
        }
        if (created) {
            await this.activityModel.create({ action: 'imported', actorUserId: actorId, affectedCount: created, metadata: { duplicates, errors: errors.length } });
        }
        return { created, duplicates, errors };
    }

    async update(id: string, payload: any, actorId: string) {
        if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Question bank item not found');
        const existing = await this.bankModel.findById(id);
        if (!existing) throw new NotFoundException('Question bank item not found');
        const normalized = this.normalizePayload({ ...existing.toObject(), ...payload });
        const duplicate = await this.bankModel.findOne({ fingerprint: normalized.fingerprint, _id: { $ne: existing._id } }).lean();
        if (duplicate) throw new BadRequestException('This update would duplicate another bank question');
        Object.assign(existing, normalized, { version: existing.version + 1, updatedBy: new Types.ObjectId(actorId) });
        await existing.save();
        await this.activityModel.create({ questionBankItemId: existing._id, action: 'updated', actorUserId: actorId });
        return existing;
    }

    async setStatus(ids: string[], status: 'active' | 'archived', actorId: string) {
        if (!['active', 'archived'].includes(status)) throw new BadRequestException('Status must be active or archived');
        const objectIds = ids.filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
        if (!objectIds.length) throw new BadRequestException('Select at least one question');
        const result = await this.bankModel.updateMany(
            { _id: { $in: objectIds } },
            { $set: { status, updatedBy: actorId } },
            { runValidators: true },
        );
        await this.activityModel.create({
            action: status === 'active' ? 'restored' : 'archived', actorUserId: actorId,
            affectedCount: Math.max(1, result.modifiedCount), metadata: { questionIds: objectIds },
        });
        return { modified: result.modifiedCount };
    }

    async usage(id: string) {
        if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Question bank item not found');
        return this.examQuestionModel.find({ questionBankItemId: new Types.ObjectId(id) })
            .populate({ path: 'examId', select: 'title status academicSession', populate: { path: 'academicSession', select: 'sessionYear' } })
            .select('examId mark bankVersion copiedAt').sort({ copiedAt: -1 }).lean();
    }

    async reuse(examId: string, bankItemIds: string[], actorId: string) {
        if (!Types.ObjectId.isValid(examId)) throw new NotFoundException('Exam not found');
        const uniqueIds = [...new Set(bankItemIds)].filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
        if (!uniqueIds.length) throw new BadRequestException('Select at least one question');
        const exam = await this.examModel.findById(examId);
        if (!exam) throw new NotFoundException('Exam not found');
        const attempts = await this.attemptModel.countDocuments({ examId: exam._id });
        if (attempts || ['in-progress', 'completed', 'graded'].includes(exam.status) || new Date() >= new Date(exam.examTimestamp)) {
            throw new BadRequestException('Questions cannot be changed after an exam starts or receives an attempt');
        }
        const [currentCount, existing, items] = await Promise.all([
            this.examQuestionModel.countDocuments({ examId: exam._id, status: 'active' }),
            this.examQuestionModel.distinct('questionBankItemId', { examId: exam._id, questionBankItemId: { $in: uniqueIds } }),
            this.bankModel.find({ _id: { $in: uniqueIds }, status: 'active' }).lean(),
        ]);
        const existingSet = new Set(existing.map(String));
        const eligible = items.filter((item) => !existingSet.has(String(item._id)));
        const remaining = exam.totalQuestions - currentCount;
        if (eligible.length > remaining) throw new BadRequestException(`Only ${Math.max(0, remaining)} question slots remain in this exam`);
        const last = await this.examQuestionModel.findOne({ examId: exam._id }).sort({ order: -1 }).select('order').lean();
        const now = new Date();
        const documents = eligible.map((item, index) => ({
            examId: exam._id,
            questionBankItemId: item._id,
            bankVersion: item.version,
            questionText: item.questionText,
            type: item.type,
            options: item.options,
            answer: item.answer,
            mark: item.defaultMark,
            mediaUrls: item.mediaUrls,
            tags: item.tags,
            metadata: item.metadata,
            order: (last?.order || 0) + index + 1,
            status: 'active', createdBy: actorId, copiedBy: actorId, copiedAt: now,
        }));
        if (documents.length) await this.examQuestionModel.insertMany(documents, { ordered: true });
        if (eligible.length) {
            await this.bankModel.updateMany(
                { _id: { $in: eligible.map((item) => item._id) } },
                { $inc: { usageCount: 1 }, $set: { lastUsedAt: now } },
            );
            await this.activityModel.create({ examId: exam._id, action: 'reused', actorUserId: actorId, affectedCount: eligible.length });
        }
        return { added: eligible.length, skippedDuplicates: uniqueIds.length - eligible.length, currentCount: currentCount + eligible.length };
    }
}

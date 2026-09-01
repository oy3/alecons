import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { ContentSanitizationService } from './content-sanitization.service';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { Staff, StaffDocument } from '../schemas/staff.schema';
import { Role, RoleDocument } from '../schemas/role.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { Application, ApplicationDocument } from '../schemas/application.schema';
import {
    Notification,
    NotificationAudienceType,
    NotificationDocument,
    NOTIFICATION_MESSAGE_TEXT_MAX_LENGTH,
    NotificationStatus,
} from '../schemas/notification.schema';
import {
    NotificationRecipient,
    NotificationRecipientDocument,
} from '../schemas/notification-recipient.schema';
import { NotificationAudit, NotificationAuditDocument } from '../schemas/notification-audit.schema';
import {
    AudiencePreviewDto,
    CreateNotificationDto,
    NotificationAudienceDto,
    UpdateNotificationDto,
} from '../dto/notification.dto';

type ResolvedUser = { _id: Types.ObjectId; role: string; firstName?: string; lastName?: string; email?: string };

@Injectable()
export class NotificationsService {
    constructor(
        @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
        @InjectModel(NotificationRecipient.name) private readonly recipientModel: Model<NotificationRecipientDocument>,
        @InjectModel(NotificationAudit.name) private readonly auditModel: Model<NotificationAuditDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Staff.name) private readonly staffModel: Model<StaffDocument>,
        @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
        @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
        @InjectModel(Program.name) private readonly programModel: Model<ProgramDocument>,
        @InjectModel(Application.name) private readonly applicationModel: Model<ApplicationDocument>,
        private readonly sanitizer: ContentSanitizationService,
    ) {}

    async createSystemNotification(input: {
        actorUserId: string | Types.ObjectId;
        recipientUserId: string | Types.ObjectId;
        title: string;
        message: string;
        actionUrl?: string;
        actionLabel?: string;
        category?: string;
        priority?: string;
    }) {
        const actorId = this.objectId(input.actorUserId, 'actor');
        const recipientId = this.objectId(input.recipientUserId, 'recipient');
        const recipient = await this.userModel.findOne({ _id: recipientId, isActive: true }).select('_id').lean();
        if (!recipient) throw new BadRequestException('Notification recipient is inactive or unavailable');
        const messageText = String(input.message || '').trim().slice(0, NOTIFICATION_MESSAGE_TEXT_MAX_LENGTH);
        if (!messageText) throw new BadRequestException('System notification message is required');
        const notification = await this.notificationModel.create({
            title: String(input.title || '').trim().slice(0, 140),
            messageHtml: `<p>${this.escapeHtml(messageText)}</p>`,
            messageText,
            category: input.category || 'general',
            priority: input.priority || 'normal',
            action: input.actionUrl ? {
                label: String(input.actionLabel || 'Open').slice(0, 50),
                url: this.validateActionUrl(input.actionUrl),
            } : undefined,
            audience: { type: NotificationAudienceType.SPECIFIC_USERS, userIds: [recipientId] },
            audienceSummary: '1 specific user',
            status: NotificationStatus.PROCESSING,
            createdBy: actorId,
            updatedBy: actorId,
        });
        await this.audit(notification._id, actorId, 'system_notification_created', undefined, NotificationStatus.PROCESSING);
        return notification;
    }

    async assertPermission(userId: string, permission: string) {
        const actorId = this.objectId(userId, 'user');
        const user = await this.userModel.findById(actorId).select('role').lean();
        if (!user) throw new ForbiddenException('User account not found');
        if (user.role === UserRole.ADMIN) return;

        const staff = await this.staffModel.findOne({ userId: actorId, isActive: true }).select('roleId').lean();
        const role = staff?.roleId
            ? await this.roleModel.findOne({ _id: staff.roleId, active: true }).select('modules').lean()
            : null;
        const moduleAccess = role?.modules?.find((item) => item.module === 'notifications');
        if (!moduleAccess || (!moduleAccess.permissions.includes(permission) && !moduleAccess.permissions.includes('manage'))) {
            throw new ForbiddenException('You do not have the required notifications permission');
        }
    }

    async create(userId: string, payload: CreateNotificationDto) {
        await this.assertPermission(userId, 'create');
        const actorId = this.objectId(userId, 'user');
        const normalized = await this.normalizePayload(payload);
        const notification = await this.notificationModel.create({
            ...normalized,
            status: NotificationStatus.DRAFT,
            createdBy: actorId,
            updatedBy: actorId,
        });
        await this.audit(notification._id, actorId, 'created', undefined, NotificationStatus.DRAFT);
        return this.managementDetail(String(notification._id));
    }

    async update(userId: string, id: string, payload: UpdateNotificationDto) {
        await this.assertPermission(userId, 'edit');
        const notification = await this.getEditable(id);
        const merged = {
            title: payload.title ?? notification.title,
            messageHtml: payload.messageHtml ?? notification.messageHtml,
            category: payload.category ?? notification.category,
            priority: payload.priority ?? notification.priority,
            action: payload.action === undefined ? notification.action : payload.action,
            audience: payload.audience ?? this.serializeAudience(notification.audience),
            expiresAt: payload.expiresAt === undefined
                ? notification.expiresAt?.toISOString()
                : payload.expiresAt,
        } as CreateNotificationDto;
        const normalized = await this.normalizePayload(merged);
        const previousStatus = notification.status;
        Object.assign(notification, normalized, {
            updatedBy: this.objectId(userId, 'user'),
            status: previousStatus === NotificationStatus.CANCELLED ? NotificationStatus.DRAFT : previousStatus,
            scheduledAt: previousStatus === NotificationStatus.CANCELLED ? undefined : notification.scheduledAt,
        });
        await notification.save();
        await this.audit(notification._id, this.objectId(userId, 'user'), 'updated', previousStatus, notification.status);
        return this.managementDetail(id);
    }

    async removeDraft(userId: string, id: string) {
        await this.assertPermission(userId, 'edit');
        const notification = await this.getEditable(id);
        await this.audit(notification._id, this.objectId(userId, 'user'), 'deleted', notification.status, undefined);
        await notification.deleteOne();
        return { id };
    }

    async duplicate(userId: string, id: string) {
        await this.assertPermission(userId, 'create');
        const source: any = await this.notificationModel.findById(this.objectId(id, 'notification')).lean();
        if (!source) throw new NotFoundException('Notification not found');
        return this.create(userId, {
            title: `${source.title} (Copy)`.slice(0, 140),
            messageHtml: source.messageHtml,
            category: source.category,
            priority: source.priority,
            action: source.action?.label && source.action?.url ? { label: source.action.label, url: source.action.url } : undefined,
            audience: this.serializeAudience(source.audience),
            expiresAt: source.expiresAt && new Date(source.expiresAt).getTime() > Date.now() ? new Date(source.expiresAt).toISOString() : undefined,
        });
    }

    async preview(userId: string, payload: AudiencePreviewDto) {
        await this.assertPermission(userId, 'view');
        const users = await this.resolveAudience(payload.audience);
        return {
            count: users.length,
            sample: users.slice(0, 8).map((user) => ({
                id: String(user._id),
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                email: user.email,
                role: user.role,
            })),
            summary: await this.audienceSummary(payload.audience),
        };
    }

    async beginPublish(userId: string, id: string) {
        await this.assertPermission(userId, 'send');
        const actorId = this.objectId(userId, 'user');
        const notificationId = this.objectId(id, 'notification');
        const notification = await this.notificationModel.findOneAndUpdate(
            { _id: notificationId, status: NotificationStatus.DRAFT },
            { $set: { status: NotificationStatus.PROCESSING, updatedBy: actorId, lastError: null } },
            { new: true },
        );
        if (!notification) throw new BadRequestException('Only a draft notification can be published');
        const recipients = await this.resolveAudience(this.serializeAudience(notification.audience));
        if (!recipients.length) {
            notification.status = NotificationStatus.DRAFT;
            notification.lastError = 'No active recipients matched the selected audience';
            await notification.save();
            throw new BadRequestException('No active recipients match the selected audience');
        }
        await this.audit(notificationId, actorId, 'publishing_started', NotificationStatus.DRAFT, NotificationStatus.PROCESSING);
        return notification;
    }

    async schedule(userId: string, id: string, scheduledAt: Date) {
        await this.assertPermission(userId, 'send');
        if (scheduledAt.getTime() <= Date.now() + 60_000) {
            throw new BadRequestException('Scheduled time must be at least one minute in the future');
        }
        const notification = await this.getEditable(id);
        const previous = notification.status;
        notification.status = NotificationStatus.SCHEDULED;
        notification.scheduledAt = scheduledAt;
        notification.updatedBy = this.objectId(userId, 'user');
        await notification.save();
        await this.audit(notification._id, this.objectId(userId, 'user'), 'scheduled', previous, NotificationStatus.SCHEDULED, { scheduledAt });
        return this.managementDetail(id);
    }

    async cancel(userId: string, id: string, comment?: string) {
        await this.assertPermission(userId, 'send');
        const actorId = this.objectId(userId, 'user');
        const notification = await this.notificationModel.findOneAndUpdate(
            { _id: this.objectId(id, 'notification'), status: NotificationStatus.SCHEDULED },
            { $set: { status: NotificationStatus.CANCELLED, updatedBy: actorId } },
            { new: true },
        );
        if (!notification) throw new BadRequestException('Only a scheduled notification can be cancelled');
        await this.audit(notification._id, actorId, 'cancelled', NotificationStatus.SCHEDULED, NotificationStatus.CANCELLED, undefined, comment);
        return this.managementDetail(id);
    }

    async archive(userId: string, id: string, comment?: string) {
        await this.assertPermission(userId, 'archive');
        const actorId = this.objectId(userId, 'user');
        const previous = await this.notificationModel.findOne({
            _id: this.objectId(id, 'notification'),
            status: { $in: [NotificationStatus.SENT, NotificationStatus.PARTIALLY_FAILED] },
        }).select('status').lean();
        const notification = await this.notificationModel.findOneAndUpdate(
            { _id: this.objectId(id, 'notification'), status: { $in: [NotificationStatus.SENT, NotificationStatus.PARTIALLY_FAILED] } },
            { $set: { status: NotificationStatus.ARCHIVED, updatedBy: actorId } },
            { new: true },
        );
        if (!notification) throw new BadRequestException('Only a sent notification can be archived');
        await this.audit(notification._id, actorId, 'archived', previous?.status, NotificationStatus.ARCHIVED, undefined, comment);
        return this.managementDetail(id);
    }

    async claimDueScheduled() {
        return this.notificationModel.findOneAndUpdate(
            { status: NotificationStatus.SCHEDULED, scheduledAt: { $lte: new Date() } },
            { $set: { status: NotificationStatus.PROCESSING } },
            { new: true, sort: { scheduledAt: 1 } },
        );
    }

    async releaseQueueClaim(id: string, fallbackStatus: NotificationStatus, error: unknown) {
        const message = error instanceof Error ? error.message : 'Notification delivery could not be queued';
        await this.notificationModel.updateOne(
            { _id: this.objectId(id, 'notification'), status: NotificationStatus.PROCESSING },
            { $set: { status: fallbackStatus, lastError: message.slice(0, 500) } },
        );
    }

    async deliver(id: string) {
        const notification = await this.notificationModel.findOne({
            _id: this.objectId(id, 'notification'),
            status: { $in: [NotificationStatus.PROCESSING, NotificationStatus.PARTIALLY_FAILED] },
        });
        if (!notification) return;

        try {
            const users = await this.resolveAudience(this.serializeAudience(notification.audience));
            if (!users.length) throw new BadRequestException('No active recipients match the selected audience');
            const deliveredAt = new Date();
            const operations = users.map((user) => ({
                updateOne: {
                    filter: { notificationId: notification._id, userId: user._id },
                    update: {
                        $setOnInsert: {
                            notificationId: notification._id,
                            userId: user._id,
                            recipientRoleSnapshot: user.role,
                            deliveredAt,
                            readAt: null,
                        },
                    },
                    upsert: true,
                },
            }));
            for (let index = 0; index < operations.length; index += 500) {
                await this.recipientModel.bulkWrite(operations.slice(index, index + 500), { ordered: false });
            }
            notification.status = NotificationStatus.SENT;
            notification.sentAt = deliveredAt;
            notification.recipientCount = users.length;
            notification.failedCount = 0;
            notification.lastError = undefined;
            await notification.save();
            await this.audit(notification._id, notification.updatedBy, 'published', NotificationStatus.PROCESSING, NotificationStatus.SENT, { recipientCount: users.length });
        } catch (error) {
            notification.status = NotificationStatus.PARTIALLY_FAILED;
            notification.lastError = String(error?.message || error).slice(0, 1000);
            notification.recipientCount = await this.recipientModel.countDocuments({ notificationId: notification._id });
            notification.failedCount = 1;
            await notification.save();
            await this.audit(notification._id, notification.updatedBy, 'delivery_failed', NotificationStatus.PROCESSING, NotificationStatus.PARTIALLY_FAILED, { error: notification.lastError });
            throw error;
        }
    }

    async listManagement(userId: string, filters: { page?: number; limit?: number; status?: string; category?: string; search?: string }) {
        await this.assertPermission(userId, 'view');
        const page = Math.max(1, Number(filters.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
        const query: FilterQuery<NotificationDocument> = {};
        if (filters.status) query.status = filters.status as NotificationStatus;
        if (filters.category) query.category = filters.category;
        if (filters.search?.trim()) {
            const regex = new RegExp(this.escapeRegex(filters.search.trim()), 'i');
            query.$or = [{ title: regex }, { messageText: regex }, { audienceSummary: regex }];
        }
        const [notifications, total] = await Promise.all([
            this.notificationModel.find(query)
                .populate('createdBy', 'firstName lastName email')
                .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            this.notificationModel.countDocuments(query),
        ]);
        const ids = notifications.map((item: any) => item._id);
        const readCounts = ids.length ? await this.recipientModel.aggregate([
            { $match: { notificationId: { $in: ids }, readAt: { $ne: null } } },
            { $group: { _id: '$notificationId', count: { $sum: 1 } } },
        ]) : [];
        const readMap = new Map(readCounts.map((item) => [String(item._id), item.count]));
        return {
            notifications: notifications.map((item: any) => ({ ...item, id: String(item._id), readCount: readMap.get(String(item._id)) || 0 })),
            pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
        };
    }

    async managementStats(userId: string) {
        await this.assertPermission(userId, 'view');
        const [total, drafts, scheduled, sent, recipientTotal, readTotal] = await Promise.all([
            this.notificationModel.countDocuments({ status: { $ne: NotificationStatus.ARCHIVED } }),
            this.notificationModel.countDocuments({ status: NotificationStatus.DRAFT }),
            this.notificationModel.countDocuments({ status: NotificationStatus.SCHEDULED }),
            this.notificationModel.countDocuments({ status: { $in: [NotificationStatus.SENT, NotificationStatus.PARTIALLY_FAILED] } }),
            this.recipientModel.countDocuments(),
            this.recipientModel.countDocuments({ readAt: { $ne: null } }),
        ]);
        return { total, drafts, scheduled, sent, recipientTotal, readTotal, readRate: recipientTotal ? Math.round((readTotal / recipientTotal) * 1000) / 10 : 0 };
    }

    async managementDetail(id: string) {
        const notificationId = this.objectId(id, 'notification');
        const [notification, audits, readCount] = await Promise.all([
            this.notificationModel.findById(notificationId)
                .populate('createdBy', 'firstName lastName email')
                .populate('updatedBy', 'firstName lastName email')
                .populate('audience.programId', 'name code durationYears')
                .populate('audience.userIds', 'firstName otherName lastName email role')
                .lean(),
            this.auditModel.find({ notificationId }).populate('actorUserId', 'firstName lastName email').sort({ createdAt: 1 }).lean(),
            this.recipientModel.countDocuments({ notificationId, readAt: { $ne: null } }),
        ]);
        if (!notification) throw new NotFoundException('Notification not found');
        return { ...notification, id: String((notification as any)._id), readCount, audits };
    }

    async managementRecipients(userId: string, id: string, page = 1, limit = 20, read?: string) {
        await this.assertPermission(userId, 'view');
        const notificationId = this.objectId(id, 'notification');
        const query: any = { notificationId };
        if (read === 'read') query.readAt = { $ne: null };
        if (read === 'unread') query.readAt = null;
        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
        const [recipients, total] = await Promise.all([
            this.recipientModel.find(query).populate('userId', 'firstName lastName email role').sort({ deliveredAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
            this.recipientModel.countDocuments(query),
        ]);
        return { recipients, pagination: { page: safePage, limit: safeLimit, total, pages: Math.max(1, Math.ceil(total / safeLimit)) } };
    }

    async recipientSearch(userId: string, search: string, role?: string, limit = 20) {
        await this.assertPermission(userId, 'view');
        const query: any = { isActive: true };
        if (role && Object.values(UserRole).includes(role as UserRole)) query.role = role;
        if (search?.trim()) {
            const regex = new RegExp(this.escapeRegex(search.trim()), 'i');
            query.$or = [{ firstName: regex }, { lastName: regex }, { otherName: regex }, { email: regex }];
        }
        const users: any[] = await this.userModel.find(query).select('firstName otherName lastName email role').sort({ firstName: 1 }).limit(Math.min(50, Math.max(1, Number(limit) || 20))).lean();
        const userIds = users.map((user) => user._id);
        const [students, staffs, applications] = await Promise.all([
            this.studentModel.find({ userId: { $in: userIds } }).select('userId matriculationNumber').lean(),
            this.staffModel.find({ userId: { $in: userIds } }).select('userId staffId position').lean(),
            this.applicationModel.find({ userId: { $in: userIds } }).select('userId applicationNumber').sort({ createdAt: -1 }).lean(),
        ]);
        const studentMap = new Map(students.map((item: any) => [String(item.userId), item]));
        const staffMap = new Map(staffs.map((item: any) => [String(item.userId), item]));
        const applicationMap = new Map<string, any>();
        applications.forEach((item: any) => { if (!applicationMap.has(String(item.userId))) applicationMap.set(String(item.userId), item); });
        return users.map((user) => ({
            id: String(user._id),
            name: `${user.firstName || ''} ${user.otherName || ''} ${user.lastName || ''}`.replace(/\s+/g, ' ').trim(),
            email: user.email,
            role: user.role,
            identifier: studentMap.get(String(user._id))?.matriculationNumber || staffMap.get(String(user._id))?.staffId || applicationMap.get(String(user._id))?.applicationNumber || null,
        }));
    }

    async inbox(userId: string, limit = 15, before?: string, unreadOnly = false) {
        const userObjectId = this.objectId(userId, 'user');
        const safeLimit = Math.min(50, Math.max(1, Number(limit) || 15));
        const receiptMatch: any = { userId: userObjectId };
        if (unreadOnly) receiptMatch.readAt = null;
        if (before) {
            const parsed = new Date(before);
            if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid notification cursor');
            receiptMatch.deliveredAt = { $lt: parsed };
        }
        const rows: any[] = await this.recipientModel.aggregate([
            { $match: receiptMatch },
            { $sort: { deliveredAt: -1 } },
            { $lookup: { from: 'notifications', localField: 'notificationId', foreignField: '_id', as: 'notification' } },
            { $unwind: '$notification' },
            { $match: {
                'notification.status': { $in: [NotificationStatus.SENT, NotificationStatus.PARTIALLY_FAILED, NotificationStatus.ARCHIVED] },
                $or: [
                    { 'notification.expiresAt': null },
                    { 'notification.expiresAt': { $exists: false } },
                    { 'notification.expiresAt': { $gt: new Date() } },
                ],
            } },
            { $limit: safeLimit + 1 },
        ]);
        const hasMore = rows.length > safeLimit;
        const notifications = rows.slice(0, safeLimit).map((row) => this.serializeInboxRow({
            ...row,
            notificationId: row.notification,
        }));
        return {
            notifications,
            nextCursor: hasMore ? notifications[notifications.length - 1].deliveredAt : null,
        };
    }

    async unreadCount(userId: string) {
        const now = new Date();
        const result = await this.recipientModel.aggregate([
            { $match: { userId: this.objectId(userId, 'user'), readAt: null } },
            { $lookup: { from: 'notifications', localField: 'notificationId', foreignField: '_id', as: 'notification' } },
            { $unwind: '$notification' },
            { $match: {
                'notification.status': { $in: [NotificationStatus.SENT, NotificationStatus.PARTIALLY_FAILED, NotificationStatus.ARCHIVED] },
                $or: [
                    { 'notification.expiresAt': null },
                    { 'notification.expiresAt': { $exists: false } },
                    { 'notification.expiresAt': { $gt: now } },
                ],
            } },
            { $count: 'count' },
        ]);
        return { count: result[0]?.count || 0 };
    }

    async inboxDetail(userId: string, recipientId: string) {
        const row: any = await this.recipientModel.findOne({ _id: this.objectId(recipientId, 'notification recipient'), userId: this.objectId(userId, 'user') })
            .populate('notificationId', 'title messageHtml messageText category priority action audienceSummary sentAt expiresAt status').lean();
        if (!row?.notificationId) throw new NotFoundException('Notification not found');
        return this.serializeInboxRow(row);
    }

    async markRead(userId: string, recipientId: string) {
        const row = await this.recipientModel.findOneAndUpdate(
            { _id: this.objectId(recipientId, 'notification recipient'), userId: this.objectId(userId, 'user') },
            { $set: { readAt: new Date() } },
            { new: true },
        ).lean();
        if (!row) throw new NotFoundException('Notification not found');
        return { id: String(row._id), readAt: row.readAt };
    }

    async markAllRead(userId: string) {
        const readAt = new Date();
        const result = await this.recipientModel.updateMany({ userId: this.objectId(userId, 'user'), readAt: null }, { $set: { readAt } });
        return { modifiedCount: result.modifiedCount, readAt };
    }

    private async normalizePayload(payload: CreateNotificationDto) {
        const title = payload.title.trim();
        const messageHtml = this.sanitizer.sanitizeHtml(payload.messageHtml).trim();
        const messageText = this.sanitizer.extractTextContent(messageHtml).trim();
        if (!messageText) throw new BadRequestException('Notification message cannot be empty');
        if (messageText.length > NOTIFICATION_MESSAGE_TEXT_MAX_LENGTH) {
            throw new BadRequestException(
                `Notification message cannot exceed ${NOTIFICATION_MESSAGE_TEXT_MAX_LENGTH} characters`,
            );
        }
        const audience = this.normalizeAudience(payload.audience);
        await this.validateAudience(audience);
        const action = payload.action?.label && payload.action?.url
            ? { label: payload.action.label.trim(), url: this.validateActionUrl(payload.action.url.trim()) }
            : undefined;
        const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : undefined;
        if (expiresAt && expiresAt.getTime() <= Date.now()) throw new BadRequestException('Expiry date must be in the future');
        return {
            title,
            messageHtml,
            messageText,
            category: payload.category || 'general',
            priority: payload.priority || 'normal',
            action,
            audience,
            audienceSummary: await this.audienceSummary(payload.audience),
            expiresAt,
        };
    }

    private normalizeAudience(audience: NotificationAudienceDto) {
        return {
            type: audience.type,
            programId: audience.programId ? this.objectId(audience.programId, 'program') : undefined,
            level: audience.level,
            userIds: audience.userIds?.map((id) => this.objectId(id, 'user')),
        };
    }

    private serializeAudience(audience: any): NotificationAudienceDto {
        return {
            type: audience.type,
            programId: audience.programId?._id ? String(audience.programId._id) : audience.programId ? String(audience.programId) : undefined,
            level: audience.level,
            userIds: audience.userIds?.map((id) => String(id)),
        };
    }

    private async validateAudience(audience: any) {
        if (audience.type === NotificationAudienceType.STUDENT_COHORT) {
            const program = await this.programModel.findById(audience.programId).select('durationYears').lean();
            if (!program) throw new BadRequestException('Selected program does not exist');
            if (!audience.level || audience.level > program.durationYears) throw new BadRequestException('Selected level is not valid for this program');
        }
        if (audience.type === NotificationAudienceType.SPECIFIC_USERS && !audience.userIds?.length) {
            throw new BadRequestException('Select at least one recipient');
        }
    }

    private async audienceSummary(audience: NotificationAudienceDto) {
        const labels: Record<string, string> = {
            [NotificationAudienceType.ALL]: 'All active users',
            [NotificationAudienceType.STAFF]: 'All active staff',
            [NotificationAudienceType.STUDENTS]: 'All active students',
            [NotificationAudienceType.APPLICANTS]: 'All active applicants',
            [NotificationAudienceType.SPECIFIC_USERS]: `${audience.userIds?.length || 0} specific user${audience.userIds?.length === 1 ? '' : 's'}`,
        };
        if (audience.type !== NotificationAudienceType.STUDENT_COHORT) return labels[audience.type] || audience.type;
        const program = await this.programModel.findById(audience.programId).select('name').lean();
        return `${program?.name || 'Program'} · Level ${audience.level}`;
    }

    private async resolveAudience(audience: NotificationAudienceDto): Promise<ResolvedUser[]> {
        const baseSelect = 'firstName lastName email role';
        if (audience.type === NotificationAudienceType.ALL) {
            return this.userModel.find({ isActive: true }).select(baseSelect).lean() as any;
        }
        if (audience.type === NotificationAudienceType.APPLICANTS) {
            return this.userModel.find({ isActive: true, role: UserRole.APPLICANT }).select(baseSelect).lean() as any;
        }
        if (audience.type === NotificationAudienceType.STAFF) {
            const staff = await this.staffModel.find({ isActive: true }).select('userId').lean();
            return this.userModel.find({ _id: { $in: staff.map((item) => item.userId) }, isActive: true, role: { $in: [UserRole.STAFF, UserRole.ADMIN] } }).select(baseSelect).lean() as any;
        }
        if (audience.type === NotificationAudienceType.STUDENTS || audience.type === NotificationAudienceType.STUDENT_COHORT) {
            const studentQuery: any = { isActive: true, status: 'active' };
            if (audience.type === NotificationAudienceType.STUDENT_COHORT) {
                studentQuery.programId = this.objectId(audience.programId!, 'program');
                studentQuery.currentLevel = audience.level;
            }
            const students = await this.studentModel.find(studentQuery).select('userId').lean();
            return this.userModel.find({ _id: { $in: students.map((item) => item.userId) }, isActive: true, role: UserRole.STUDENT }).select(baseSelect).lean() as any;
        }
        if (audience.type === NotificationAudienceType.SPECIFIC_USERS) {
            const userIds = [...new Set(audience.userIds || [])].map((id) => this.objectId(id, 'user'));
            return this.userModel.find({ _id: { $in: userIds }, isActive: true }).select(baseSelect).lean() as any;
        }
        throw new BadRequestException('Unsupported notification audience');
    }

    private async getEditable(id: string) {
        const notification = await this.notificationModel.findOne({
            _id: this.objectId(id, 'notification'),
            status: { $in: [NotificationStatus.DRAFT, NotificationStatus.CANCELLED] },
        });
        if (!notification) throw new BadRequestException('Only draft or cancelled notifications can be edited');
        return notification;
    }

    private async audit(notificationId: any, actorUserId: Types.ObjectId, action: string, previousState?: string, newState?: string, metadata?: any, comment?: string) {
        const actor = await this.userModel.findById(actorUserId).select('role').lean();
        await this.auditModel.create({ notificationId, actorUserId, actorRole: actor?.role || 'staff', action, previousState, newState, metadata, comment: comment?.trim() || undefined });
    }

    private serializeInboxRow(row: any) {
        const notification = row.notificationId;
        return {
            id: String(row._id),
            notificationId: String(notification._id),
            title: notification.title,
            messageHtml: notification.messageHtml,
            messageText: notification.messageText,
            category: notification.category,
            priority: notification.priority,
            action: notification.action,
            audienceSummary: notification.audienceSummary,
            sentAt: notification.sentAt,
            expiresAt: notification.expiresAt,
            deliveredAt: row.deliveredAt,
            readAt: row.readAt,
            isRead: Boolean(row.readAt),
        };
    }

    private validateActionUrl(url: string) {
        if (url.startsWith('/') && !url.startsWith('//')) return url;
        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
            return parsed.toString();
        } catch {
            throw new BadRequestException('Action URL must be a safe internal path or HTTP(S) URL');
        }
    }

    private objectId(value: string | Types.ObjectId, label: string) {
        if (!value || !Types.ObjectId.isValid(value)) throw new BadRequestException(`Invalid ${label}`);
        return new Types.ObjectId(String(value));
    }

    private escapeRegex(value: string) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private escapeHtml(value: string) {
        return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
}

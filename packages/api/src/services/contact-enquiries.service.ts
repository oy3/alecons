import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  AssignContactEnquiryDto,
  ContactEnquiryListQueryDto,
  ContactEnquiryMessageDto,
  CreatePublicContactEnquiryDto,
  UpdateContactEnquiryDto,
} from '../dto/contact-enquiry.dto';
import {
  ContactEnquiry,
  ContactEnquiryCategory,
  ContactEnquiryDocument,
  ContactEnquiryStatus,
} from '../schemas/contact-enquiry.schema';
import {
  ContactEnquiryMessage,
  ContactEnquiryMessageDocument,
  ContactMessageDeliveryStatus,
  ContactMessageKind,
} from '../schemas/contact-enquiry-message.schema';
import {
  ContactEnquiryActivity,
  ContactEnquiryActivityDocument,
} from '../schemas/contact-enquiry-activity.schema';
import { Role, RoleDocument } from '../schemas/role.schema';
import { Staff, StaffDocument } from '../schemas/staff.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { ContactEnquiryAccessContext, ContactEnquiryAccessService } from './contact-enquiry-access.service';
import { EmailService } from './email.service';
import { NotificationsService } from './notifications.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationStatus } from '../schemas/notification.schema';

const CATEGORY_LABELS: Record<ContactEnquiryCategory, string> = {
  [ContactEnquiryCategory.ADMISSIONS]: 'Admissions enquiry',
  [ContactEnquiryCategory.PROGRAMMES]: 'Programme information enquiry',
  [ContactEnquiryCategory.STUDENT_SERVICES]: 'Student services enquiry',
  [ContactEnquiryCategory.FINANCE]: 'Financial services enquiry',
  [ContactEnquiryCategory.GENERAL]: 'General enquiry',
};

const STATUS_TRANSITIONS: Record<ContactEnquiryStatus, ContactEnquiryStatus[]> = {
  [ContactEnquiryStatus.NEW]: [ContactEnquiryStatus.IN_PROGRESS, ContactEnquiryStatus.RESOLVED, ContactEnquiryStatus.SPAM],
  [ContactEnquiryStatus.ASSIGNED]: [ContactEnquiryStatus.IN_PROGRESS, ContactEnquiryStatus.RESOLVED, ContactEnquiryStatus.SPAM],
  [ContactEnquiryStatus.IN_PROGRESS]: [ContactEnquiryStatus.AWAITING_ENQUIRER, ContactEnquiryStatus.RESOLVED, ContactEnquiryStatus.SPAM],
  [ContactEnquiryStatus.AWAITING_ENQUIRER]: [ContactEnquiryStatus.IN_PROGRESS, ContactEnquiryStatus.RESOLVED],
  [ContactEnquiryStatus.RESOLVED]: [ContactEnquiryStatus.IN_PROGRESS, ContactEnquiryStatus.CLOSED],
  [ContactEnquiryStatus.CLOSED]: [ContactEnquiryStatus.IN_PROGRESS],
  [ContactEnquiryStatus.SPAM]: [ContactEnquiryStatus.NEW],
};

@Injectable()
export class ContactEnquiriesService {
  constructor(
    @InjectModel(ContactEnquiry.name) private readonly enquiryModel: Model<ContactEnquiryDocument>,
    @InjectModel(ContactEnquiryMessage.name) private readonly messageModel: Model<ContactEnquiryMessageDocument>,
    @InjectModel(ContactEnquiryActivity.name) private readonly activityModel: Model<ContactEnquiryActivityDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Staff.name) private readonly staffModel: Model<StaffDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly access: ContactEnquiryAccessService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly notificationDelivery: NotificationDeliveryService,
  ) {}

  async createPublic(payload: CreatePublicContactEnquiryDto) {
    if (payload.website?.trim()) {
      return { reference: this.reference(), received: true };
    }

    let enquiry: ContactEnquiryDocument | null = null;
    for (let attempt = 0; attempt < 3 && !enquiry; attempt += 1) {
      try {
        enquiry = await this.enquiryModel.create({
          reference: this.reference(),
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone || undefined,
          category: payload.category,
          status: ContactEnquiryStatus.NEW,
          source: 'public-website',
          lastMessageAt: new Date(),
          lastActivityAt: new Date(),
        });
      } catch (error: any) {
        if (error?.code !== 11000 || attempt === 2) throw error;
      }
    }
    if (!enquiry) throw new BadRequestException('Unable to create enquiry');

    await Promise.all([
      this.messageModel.create({
        enquiryId: enquiry._id,
        kind: ContactMessageKind.ENQUIRER_MESSAGE,
        body: payload.message,
        senderEmail: payload.email,
        deliveryStatus: ContactMessageDeliveryStatus.NOT_APPLICABLE,
      }),
      this.activityModel.create({ enquiryId: enquiry._id, action: 'created', newState: ContactEnquiryStatus.NEW }),
    ]);

    try {
      const providerMessageId = await this.emailService.sendContactEnquiryAcknowledgement({
        to: enquiry.email,
        firstName: enquiry.firstName,
        reference: enquiry.reference,
        categoryLabel: CATEGORY_LABELS[enquiry.category],
      });
      await this.activityModel.create({
        enquiryId: enquiry._id,
        action: 'acknowledgement_sent',
        metadata: { providerMessageId },
      });
    } catch (error: any) {
      await this.activityModel.create({
        enquiryId: enquiry._id,
        action: 'acknowledgement_failed',
        comment: this.errorMessage(error),
      });
    }

    try {
      const providerMessageId = await this.emailService.sendContactEnquiryInternalAlert({
        reference: enquiry.reference,
        enquirerName: `${enquiry.firstName} ${enquiry.lastName}`,
        categoryLabel: CATEGORY_LABELS[enquiry.category],
      });
      await this.activityModel.create({ enquiryId: enquiry._id, action: 'intake_alert_sent', metadata: { providerMessageId } });
    } catch (error: any) {
      await this.activityModel.create({ enquiryId: enquiry._id, action: 'intake_alert_failed', comment: this.errorMessage(error) });
    }

    return { reference: enquiry.reference, received: true };
  }

  async list(userId: string, query: ContactEnquiryListQueryDto) {
    const context = await this.access.assertPermission(userId, 'view');
    const filter = this.listFilter(context, query);
    const page = query.page || 1;
    const limit = query.limit || 20;
    const [items, total] = await Promise.all([
      this.enquiryModel.find(filter)
        .populate('assignedToUserId', 'firstName otherName lastName email')
        .sort({ lastActivityAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.enquiryModel.countDocuments(filter),
    ]);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async exportCsv(userId: string, query: ContactEnquiryListQueryDto): Promise<string> {
    const context = await this.access.assertPermission(userId, 'export');
    const items: any[] = await this.enquiryModel.find(this.listFilter(context, query))
      .populate('assignedToUserId', 'firstName otherName lastName email')
      .sort({ createdAt: -1 })
      .limit(50_000)
      .lean();
    const rows = [
      ['Reference', 'First name', 'Last name', 'Email', 'Phone', 'Category', 'Status', 'Priority', 'Assigned to', 'Submitted', 'First response', 'Resolved'],
      ...items.map((item) => [
        item.reference, item.firstName, item.lastName, item.email, item.phone || '', CATEGORY_LABELS[item.category],
        item.status, item.priority, this.userName(item.assignedToUserId), item.createdAt, item.firstResponseAt || '', item.resolvedAt || '',
      ]),
    ];
    return rows.map((row) => row.map((value) => this.csvCell(value)).join(',')).join('\n');
  }

  async stats(userId: string) {
    const context = await this.access.assertPermission(userId, 'view');
    const match = this.accessFilter(context);
    const rows = await this.enquiryModel.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const counts = Object.values(ContactEnquiryStatus).reduce((result, status) => ({ ...result, [status]: 0 }), {} as Record<string, number>);
    rows.forEach((row) => { counts[row._id] = row.count; });
    return { counts, total: rows.reduce((sum, row) => sum + row.count, 0), globalQueue: this.access.hasGlobalQueue(context) };
  }

  async detail(userId: string, id: string) {
    const context = await this.access.assertPermission(userId, 'view');
    const enquiry = await this.findAccessible(context, id);
    const [messages, activities] = await Promise.all([
      this.messageModel.find({ enquiryId: enquiry._id })
        .populate('createdByUserId', 'firstName otherName lastName email')
        .sort({ createdAt: 1 }).lean(),
      this.activityModel.find({ enquiryId: enquiry._id })
        .populate('actorUserId', 'firstName otherName lastName email')
        .sort({ createdAt: 1 }).lean(),
    ]);
    return { enquiry, messages, activities, globalQueue: this.access.hasGlobalQueue(context) };
  }

  async assign(userId: string, id: string, payload: AssignContactEnquiryDto) {
    const context = await this.access.assertPermission(userId, 'assign');
    const assigneeId = new Types.ObjectId(payload.assignedToUserId);
    if (!await this.isEligibleAssignee(assigneeId)) {
      throw new BadRequestException('Selected staff member cannot respond to enquiries');
    }
    const enquiry = await this.getById(id);
    if (String(enquiry.assignedToUserId || '') === String(assigneeId)) {
      return this.detail(userId, id);
    }
    const previousAssignee = enquiry.assignedToUserId;
    const previousStatus = enquiry.status;
    enquiry.assignedToUserId = assigneeId;
    enquiry.assignedByUserId = context.actorId;
    enquiry.assignedAt = new Date();
    enquiry.lastActivityAt = new Date();
    if ([ContactEnquiryStatus.NEW, ContactEnquiryStatus.SPAM].includes(enquiry.status)) {
      enquiry.status = ContactEnquiryStatus.ASSIGNED;
    }
    await enquiry.save();
    await this.activityModel.create({
      enquiryId: enquiry._id,
      actorUserId: context.actorId,
      action: 'assigned',
      previousState: previousStatus,
      newState: enquiry.status,
      metadata: { previousAssignee: previousAssignee ? String(previousAssignee) : null, assignedToUserId: payload.assignedToUserId },
    });
    let assignmentNotification: any;
    try {
      assignmentNotification = await this.notificationsService.createSystemNotification({
        actorUserId: context.actorId,
        recipientUserId: assigneeId,
        title: `Enquiry assigned: ${enquiry.reference}`,
        message: `${enquiry.firstName} ${enquiry.lastName}'s ${CATEGORY_LABELS[enquiry.category].toLowerCase()} has been assigned to you.`,
        actionUrl: '/enquiries',
        actionLabel: 'Open enquiries',
        category: 'general',
        priority: enquiry.priority === 'urgent' ? 'urgent' : enquiry.priority,
      });
      await this.notificationDelivery.enqueue(String(assignmentNotification._id));
    } catch (error: any) {
      if (assignmentNotification?._id) {
        await this.notificationsService.releaseQueueClaim(String(assignmentNotification._id), NotificationStatus.PARTIALLY_FAILED, error);
      }
      await this.activityModel.create({
        enquiryId: enquiry._id,
        actorUserId: context.actorId,
        action: 'assignment_notification_failed',
        comment: this.errorMessage(error),
      });
    }
    return this.detail(userId, id);
  }

  async update(userId: string, id: string, payload: UpdateContactEnquiryDto) {
    if (!payload.status && !payload.priority) throw new BadRequestException('Provide a status or priority update');
    const context = await this.access.context(userId);
    const enquiry = await this.findAccessible(context, id);
    if (payload.priority && payload.priority !== enquiry.priority) {
      await this.access.assertPermission(userId, 'assign');
    }
    if (payload.status && payload.status !== enquiry.status) {
      await this.access.assertPermission(userId, 'update_status');
      if (!STATUS_TRANSITIONS[enquiry.status].includes(payload.status)) {
        throw new BadRequestException(`Cannot move enquiry from ${enquiry.status} to ${payload.status}`);
      }
    }
    const previousStatus = enquiry.status;
    const previousPriority = enquiry.priority;
    if (payload.status) enquiry.status = payload.status;
    if (payload.priority) enquiry.priority = payload.priority;
    const now = new Date();
    enquiry.lastActivityAt = now;
    if (payload.status === ContactEnquiryStatus.RESOLVED) enquiry.resolvedAt = now;
    if (payload.status === ContactEnquiryStatus.CLOSED) enquiry.closedAt = now;
    if (payload.status && ![ContactEnquiryStatus.RESOLVED, ContactEnquiryStatus.CLOSED].includes(payload.status)) {
      enquiry.closedAt = undefined;
      if (payload.status !== ContactEnquiryStatus.RESOLVED) enquiry.resolvedAt = undefined;
    }
    await enquiry.save();
    await this.activityModel.create({
      enquiryId: enquiry._id,
      actorUserId: context.actorId,
      action: payload.status && payload.status !== previousStatus ? 'status_changed' : 'priority_changed',
      previousState: payload.status ? previousStatus : previousPriority,
      newState: payload.status || payload.priority,
      comment: payload.comment,
    });
    return this.detail(userId, id);
  }

  async addNote(userId: string, id: string, payload: ContactEnquiryMessageDto) {
    const context = await this.access.assertPermission(userId, 'add_note');
    const enquiry = await this.findAccessible(context, id);
    await this.messageModel.create({
      enquiryId: enquiry._id,
      kind: ContactMessageKind.INTERNAL_NOTE,
      body: payload.body,
      createdByUserId: context.actorId,
      deliveryStatus: ContactMessageDeliveryStatus.NOT_APPLICABLE,
    });
    enquiry.lastActivityAt = new Date();
    await enquiry.save();
    await this.activityModel.create({ enquiryId: enquiry._id, actorUserId: context.actorId, action: 'internal_note_added' });
    return this.detail(userId, id);
  }

  async respond(userId: string, id: string, payload: ContactEnquiryMessageDto) {
    const context = await this.access.assertPermission(userId, 'respond');
    const enquiry = await this.findAccessible(context, id);
    if ([ContactEnquiryStatus.CLOSED, ContactEnquiryStatus.SPAM].includes(enquiry.status)) {
      throw new BadRequestException('Reopen this enquiry before sending a response');
    }
    const message = await this.messageModel.create({
      enquiryId: enquiry._id,
      kind: ContactMessageKind.STAFF_RESPONSE,
      body: payload.body,
      createdByUserId: context.actorId,
      deliveryStatus: ContactMessageDeliveryStatus.PENDING,
    });
    return this.deliverResponse(context, enquiry, message);
  }

  async retryResponse(userId: string, id: string, messageId: string) {
    const context = await this.access.assertPermission(userId, 'respond');
    const enquiry = await this.findAccessible(context, id);
    const message = await this.messageModel.findOne({
      _id: this.objectId(messageId, 'message'),
      enquiryId: enquiry._id,
      kind: ContactMessageKind.STAFF_RESPONSE,
      deliveryStatus: ContactMessageDeliveryStatus.FAILED,
    });
    if (!message) throw new NotFoundException('Failed response not found');
    message.deliveryStatus = ContactMessageDeliveryStatus.PENDING;
    message.deliveryError = undefined;
    await message.save();
    return this.deliverResponse(context, enquiry, message);
  }

  async assignees(userId: string, search = '') {
    await this.access.assertPermission(userId, 'assign');
    const roles = await this.roleModel.find({
      active: true,
      modules: { $elemMatch: { module: 'enquiries', permissions: { $in: ['respond', 'manage'] } } },
    }).select('_id').lean();
    const [roleStaff, adminUsers] = await Promise.all([
      this.staffModel.find({ isActive: true, roleId: { $in: roles.map((role) => role._id) } }).select('userId staffId department position').lean(),
      this.userModel.find({ role: UserRole.ADMIN, isActive: true }).select('_id').lean(),
    ]);
    const adminStaff = await this.staffModel.find({ isActive: true, userId: { $in: adminUsers.map((user) => user._id) } }).select('userId staffId department position').lean();
    const staff = [...new Map([...roleStaff, ...adminStaff].map((item: any) => [String(item.userId), item])).values()];
    const userIds = staff.map((item) => item.userId);
    const userFilter: any = { _id: { $in: userIds }, isActive: true };
    if (search.trim()) {
      const expression = new RegExp(this.escapeRegex(search.trim()), 'i');
      userFilter.$or = [{ firstName: expression }, { lastName: expression }, { email: expression }];
    }
    const users = await this.userModel.find(userFilter).select('firstName otherName lastName email').sort({ firstName: 1, lastName: 1 }).limit(100).lean();
    const staffByUser = new Map(staff.map((item: any) => [String(item.userId), item]));
    return users.map((user: any) => ({ ...user, staff: staffByUser.get(String(user._id)) }));
  }

  private async deliverResponse(context: ContactEnquiryAccessContext, enquiry: ContactEnquiryDocument, message: ContactEnquiryMessageDocument) {
    const actor = await this.userModel.findById(context.actorId).select('firstName otherName lastName').lean();
    const responderName = [actor?.firstName, actor?.otherName, actor?.lastName].filter(Boolean).join(' ') || 'ALECONS Staff';
    try {
      const providerMessageId = await this.emailService.sendContactEnquiryResponse({
        to: enquiry.email,
        name: enquiry.firstName,
        reference: enquiry.reference,
        response: message.body,
        responderName,
      });
      const now = new Date();
      message.deliveryStatus = ContactMessageDeliveryStatus.SENT;
      message.sentAt = now;
      message.providerMessageId = providerMessageId;
      await message.save();
      const previousStatus = enquiry.status;
      enquiry.status = ContactEnquiryStatus.AWAITING_ENQUIRER;
      enquiry.firstResponseAt = enquiry.firstResponseAt || now;
      enquiry.lastResponseAt = now;
      enquiry.lastMessageAt = now;
      enquiry.lastActivityAt = now;
      await enquiry.save();
      await this.activityModel.create({
        enquiryId: enquiry._id,
        actorUserId: context.actorId,
        action: 'response_sent',
        previousState: previousStatus,
        newState: enquiry.status,
        metadata: { messageId: String(message._id), providerMessageId },
      });
      return this.detail(String(context.actorId), String(enquiry._id));
    } catch (error: any) {
      message.deliveryStatus = ContactMessageDeliveryStatus.FAILED;
      message.deliveryError = this.errorMessage(error);
      await message.save();
      enquiry.lastActivityAt = new Date();
      await enquiry.save();
      await this.activityModel.create({
        enquiryId: enquiry._id,
        actorUserId: context.actorId,
        action: 'response_delivery_failed',
        comment: message.deliveryError,
        metadata: { messageId: String(message._id) },
      });
      throw new BadGatewayException('Response was saved but email delivery failed. You can retry it from the enquiry.');
    }
  }

  private accessFilter(context: ContactEnquiryAccessContext, requestedScope?: 'mine' | 'all' | 'unassigned'): FilterQuery<ContactEnquiryDocument> {
    if (!this.access.hasGlobalQueue(context)) return { assignedToUserId: context.actorId };
    if (requestedScope === 'mine') return { assignedToUserId: context.actorId };
    if (requestedScope === 'unassigned') return { assignedToUserId: { $exists: false } };
    return {};
  }

  private listFilter(context: ContactEnquiryAccessContext, query: ContactEnquiryListQueryDto): FilterQuery<ContactEnquiryDocument> {
    const filter = this.accessFilter(context, query.scope);
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.priority) filter.priority = query.priority;
    if (query.search) {
      const expression = new RegExp(this.escapeRegex(query.search), 'i');
      filter.$or = [{ reference: expression }, { firstName: expression }, { lastName: expression }, { email: expression }];
    }
    return filter;
  }

  private async findAccessible(context: ContactEnquiryAccessContext, id: string): Promise<ContactEnquiryDocument> {
    const filter = { _id: this.objectId(id, 'enquiry'), ...this.accessFilter(context) };
    const enquiry = await this.enquiryModel.findOne(filter).populate('assignedToUserId', 'firstName otherName lastName email');
    if (!enquiry) throw new NotFoundException('Enquiry not found');
    return enquiry;
  }

  private async getById(id: string): Promise<ContactEnquiryDocument> {
    const enquiry = await this.enquiryModel.findById(this.objectId(id, 'enquiry'));
    if (!enquiry) throw new NotFoundException('Enquiry not found');
    return enquiry;
  }

  private async isEligibleAssignee(userId: Types.ObjectId): Promise<boolean> {
    const staff = await this.staffModel.findOne({ userId, isActive: true }).select('roleId').lean();
    if (!staff?.roleId) return false;
    const user = await this.userModel.findOne({ _id: userId, isActive: true }).select('role').lean();
    if (user?.role === UserRole.ADMIN) return true;
    const role = await this.roleModel.findOne({
      _id: staff.roleId,
      active: true,
      modules: { $elemMatch: { module: 'enquiries', permissions: { $in: ['respond', 'manage'] } } },
    }).select('_id').lean();
    return Boolean(role);
  }

  private reference(): string {
    return `ENQ-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private objectId(value: string, label: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException(`Invalid ${label} id`);
    return new Types.ObjectId(value);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private errorMessage(error: any): string {
    return String(error?.message || 'Unknown delivery error').slice(0, 1000);
  }

  private userName(user: any): string {
    return [user?.firstName, user?.otherName, user?.lastName].filter(Boolean).join(' ');
  }

  private csvCell(value: unknown): string {
    let text = value instanceof Date ? value.toISOString() : String(value ?? '');
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }
}

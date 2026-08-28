import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { NotificationsService } from '../src/services/notifications.service';
import { NotificationAudienceType } from '../src/schemas/notification.schema';
import { UserRole } from '../src/schemas/user.schema';

function queryResult<T>(value: T, onQuery?: (query: any) => void) {
    return (query: any = {}) => {
        onQuery?.(query);
        const chain: any = {
            select: () => chain,
            sort: () => chain,
            limit: () => chain,
            lean: async () => value,
        };
        return chain;
    };
}

function service(overrides: Record<string, any> = {}) {
    const empty = queryResult([]);
    const models: any = {
        notificationModel: {}, recipientModel: {}, auditModel: {},
        userModel: { find: empty, findById: queryResult(null) },
        staffModel: { find: empty, findOne: queryResult(null) },
        roleModel: { findOne: queryResult(null) },
        studentModel: { find: empty }, programModel: { findById: queryResult(null) },
        applicationModel: { find: empty },
        ...overrides,
    };
    return new NotificationsService(
        models.notificationModel, models.recipientModel, models.auditModel,
        models.userModel, models.staffModel, models.roleModel,
        models.studentModel, models.programModel, models.applicationModel,
        { sanitizeHtml: (value: string) => value, extractTextContent: (value: string) => value.replace(/<[^>]*>/g, '') } as any,
    );
}

test('student cohort audience resolves only active students in the exact program and level', async () => {
    const programId = new Types.ObjectId();
    const studentUserId = new Types.ObjectId();
    let studentQuery: any;
    let userQuery: any;
    const notifications = service({
        studentModel: { find: queryResult([{ userId: studentUserId }], (query) => { studentQuery = query; }) },
        userModel: { find: queryResult([{ _id: studentUserId, role: UserRole.STUDENT }], (query) => { userQuery = query; }), findById: queryResult(null) },
    });

    const users = await (notifications as any).resolveAudience({
        type: NotificationAudienceType.STUDENT_COHORT,
        programId: String(programId),
        level: 1,
    });

    assert.equal(users.length, 1);
    assert.equal(String(studentQuery.programId), String(programId));
    assert.equal(studentQuery.currentLevel, 1);
    assert.equal(studentQuery.status, 'active');
    assert.equal(studentQuery.isActive, true);
    assert.equal(userQuery.role, UserRole.STUDENT);
    assert.equal(userQuery.isActive, true);
});

test('staff audience uses active staff records and includes staff and administrators', async () => {
    const userId = new Types.ObjectId();
    let userQuery: any;
    const notifications = service({
        staffModel: { find: queryResult([{ userId }]), findOne: queryResult(null) },
        userModel: { find: queryResult([{ _id: userId, role: UserRole.STAFF }], (query) => { userQuery = query; }), findById: queryResult(null) },
    });

    await (notifications as any).resolveAudience({ type: NotificationAudienceType.STAFF });
    assert.deepEqual(userQuery.role.$in, [UserRole.STAFF, UserRole.ADMIN]);
    assert.equal(userQuery.isActive, true);
    assert.deepEqual(userQuery._id.$in, [userId]);
});

test('specific recipients are deduplicated by the user query and restricted to active accounts', async () => {
    const first = new Types.ObjectId();
    let userQuery: any;
    const notifications = service({
        userModel: { find: queryResult([{ _id: first, role: UserRole.APPLICANT }], (query) => { userQuery = query; }), findById: queryResult(null) },
    });

    await (notifications as any).resolveAudience({
        type: NotificationAudienceType.SPECIFIC_USERS,
        userIds: [String(first), String(first)],
    });
    assert.equal(userQuery.isActive, true);
    assert.equal(userQuery._id.$in.length, 1);
});

test('mark read always scopes the update to both receipt and authenticated user', async () => {
    const userId = new Types.ObjectId();
    const recipientId = new Types.ObjectId();
    let capturedFilter: any;
    const notifications = service({
        recipientModel: {
            findOneAndUpdate: (filter: any) => {
                capturedFilter = filter;
                return { lean: async () => ({ _id: recipientId, readAt: new Date() }) };
            },
        },
    });

    await notifications.markRead(String(userId), String(recipientId));
    assert.equal(String(capturedFilter._id), String(recipientId));
    assert.equal(String(capturedFilter.userId), String(userId));
});

test('notification text validation matches the 12,000-character editor limit', async () => {
    const notifications = service();
    const validMessage = 'a'.repeat(7172);
    const normalized = await (notifications as any).normalizePayload({
        title: 'Long notification',
        messageHtml: `<p>${validMessage}</p>`,
        audience: { type: NotificationAudienceType.ALL },
    });

    assert.equal(normalized.messageText.length, 7172);
    await assert.rejects(
        () => (notifications as any).normalizePayload({
            title: 'Too long',
            messageHtml: 'a'.repeat(12001),
            audience: { type: NotificationAudienceType.ALL },
        }),
        /cannot exceed 12000 characters/,
    );
});

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { WebsiteAnnouncementsService } from '../src/services/website-announcements.service';

function setup() {
    let board: any = null;
    const permissions: string[] = [];
    const model = {
        findById: () => ({ lean: async () => structuredClone(board) }),
        updateOne: async (filter: any, update: any) => {
            if (!board || board.revision !== filter.revision)
                return { modifiedCount: 0 };
            board = {
                ...board,
                entries: structuredClone(update.$set.entries),
                revision: board.revision + 1,
            };
            return { modifiedCount: 1 };
        },
        create: async (value: any) => {
            if (board)
                throw Object.assign(new Error('Duplicate'), { code: 11000 });
            board = structuredClone(value);
        },
    };
    const service = new WebsiteAnnouncementsService(
        model as any,
        {
            assertPermission: async (_actor: string, permission: string) => {
                permissions.push(permission);
            },
        } as any,
    );
    return { service, permissions };
}

test('simultaneous publications cannot leave two announcements active', async () => {
    const { service } = setup();
    const outcomes = await Promise.allSettled([
        service.save('first-staff', { message: 'First', expectedRevision: 0 }),
        service.save('second-staff', {
            message: 'Second',
            expectedRevision: 0,
        }),
    ]);
    assert.equal(
        outcomes.filter((result) => result.status === 'fulfilled').length,
        1,
    );
    const result = await service.list('staff');
    assert.equal(
        result.entries.filter((entry) => entry.status === 'active').length,
        1,
    );
});

test('publishing and expiring use notification publishing and archive permissions', async () => {
    const { service, permissions } = setup();
    const first = await service.save('staff', {
        message: 'First',
        expectedRevision: 0,
    });
    assert.deepEqual(permissions.slice(0, 3), ['view', 'create', 'send']);
    permissions.length = 0;
    await service.expire('staff', first.entries[0].id, 1);
    assert.ok(permissions.includes('archive'));
});

test('publishing requires confirmation and atomically expires the current announcement', async () => {
    const { service } = setup();
    const first = await service.save('staff', {
        message: 'First',
        expectedRevision: 0,
    });
    await assert.rejects(
        service.save('staff', { message: 'Second', expectedRevision: 1 }),
        /Confirm replacement/,
    );
    assert.equal((await service.active())?.message, 'First');
    const result = await service.save('staff', {
        message: 'Second',
        expectedRevision: 1,
        replaceConfirmed: true,
    });
    assert.equal(
        result.entries.filter((entry) => entry.status === 'active').length,
        1,
    );
    assert.equal(
        result.entries.find((entry) => entry.id === first.entries[0].id)
            ?.status,
        'expired',
    );
    assert.equal((await service.active())?.message, 'Second');
});

test('a scheduled replacement switches at its start and cancelling it restores the original window', async () => {
    const { service } = setup();
    const first = await service.save('staff', {
        message: 'Current',
        expectedRevision: 0,
    });
    const startsAt = new Date(Date.now() + 3600000).toISOString();
    const result = await service.save('staff', {
        message: 'Upcoming',
        startsAt,
        expectedRevision: 1,
        replaceConfirmed: true,
    });
    const current = result.entries.find(
        (entry) => entry.id === first.entries[0].id,
    )!;
    const scheduled = result.entries.find(
        (entry) => entry.status === 'scheduled',
    )!;
    assert.equal(service.status(current, Date.parse(startsAt)), 'expired');
    assert.equal(service.status(scheduled, Date.parse(startsAt)), 'active');
    assert.equal((await service.active())?.message, 'Current');
    await service.expire('staff', scheduled.id, 2);
    assert.equal((await service.active())?.supersededAt, undefined);
});

test('rescheduling an upcoming replacement preserves one active and one scheduled record', async () => {
    const { service } = setup();
    await service.save('staff', { message: 'Current', expectedRevision: 0 });
    const result = await service.save('staff', {
        message: 'Next',
        startsAt: new Date(Date.now() + 3600000).toISOString(),
        expectedRevision: 1,
        replaceConfirmed: true,
    });
    const scheduled = result.entries.find(
        (entry) => entry.status === 'scheduled',
    )!;
    const startsAt = new Date(Date.now() + 7200000).toISOString();
    const updated = await service.save(
        'staff',
        {
            message: 'Next',
            startsAt,
            expectedRevision: 2,
            replaceConfirmed: true,
        },
        scheduled.id,
    );
    assert.equal(
        updated.entries.filter((entry) => entry.status === 'scheduled').length,
        1,
    );
    assert.equal(
        updated.entries.find((entry) => entry.status === 'active')
            ?.supersededAt,
        startsAt,
    );
});

test('republishing resets expired dates and changes the version; changing only the end does not', async () => {
    const { service } = setup();
    const first = await service.save('staff', {
        message: 'Notice',
        expectedRevision: 0,
    });
    const id = first.entries[0].id;
    await service.expire('staff', id, 1);
    const republished = await service.save(
        'staff',
        { message: 'Notice', expectedRevision: 2 },
        id,
    );
    assert.equal(republished.entries[0].version, 2);
    assert.equal(republished.entries[0].endsAt, undefined);
    const extended = await service.save(
        'staff',
        {
            message: 'Notice',
            expectedRevision: 3,
            endsAt: new Date(Date.now() + 3600000).toISOString(),
        },
        id,
    );
    assert.equal(extended.entries[0].version, 2);
    const changed = await service.save(
        'staff',
        { message: 'Updated notice', expectedRevision: 4 },
        id,
    );
    assert.equal(changed.entries[0].version, 3);
});

test('stale staff changes cannot overwrite a newer publication', async () => {
    const { service } = setup();
    await service.save('staff', { message: 'First', expectedRevision: 0 });
    await assert.rejects(
        service.save('staff', {
            message: 'Second',
            expectedRevision: 0,
            replaceConfirmed: true,
        }),
        /Announcements changed/,
    );
    assert.equal((await service.active())?.message, 'First');
});

test('invalid links and expired end times are rejected before publishing', async () => {
    const { service } = setup();
    await assert.rejects(
        service.save('staff', {
            message: 'Notice',
            expectedRevision: 0,
            linkUrl: 'javascript:alert(1)',
            linkLabel: 'Open',
        }),
        /HTTPS URL/,
    );
    await assert.rejects(
        service.save('staff', {
            message: 'Notice',
            expectedRevision: 0,
            endsAt: new Date(Date.now() - 10000).toISOString(),
        }),
        /Show until/,
    );
    assert.equal(await service.active(), null);
});

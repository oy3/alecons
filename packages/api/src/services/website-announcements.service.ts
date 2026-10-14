import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
    WebsiteAnnouncementBoard,
    WebsiteAnnouncementBoardDocument,
    WebsiteAnnouncementEntry,
} from '../schemas/website-announcement.schema';
import { NotificationsService } from './notifications.service';
import type { WebsiteAnnouncementDto } from '../controllers/website-announcements.controller';

@Injectable()
export class WebsiteAnnouncementsService {
    constructor(
        @InjectModel(WebsiteAnnouncementBoard.name)
        private readonly boards: Model<WebsiteAnnouncementBoardDocument>,
        private readonly permissions: NotificationsService,
    ) {}

    status(entry: WebsiteAnnouncementEntry, now = Date.now()) {
        if (
            entry.expiredAt ||
            (entry.endsAt && Date.parse(entry.endsAt) <= now) ||
            (entry.supersededAt && Date.parse(entry.supersededAt) <= now)
        )
            return 'expired';
        return Date.parse(entry.startsAt) > now ? 'scheduled' : 'active';
    }

    private async board() {
        return (
            (await this.boards.findById('website').lean()) || {
                revision: 0,
                entries: [],
            }
        );
    }

    async list(actorId: string) {
        await this.permissions.assertPermission(actorId, 'view');
        const board = await this.board();
        return {
            revision: board.revision,
            entries: board.entries
                .map((entry) => ({ ...entry, status: this.status(entry) }))
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        };
    }

    async active() {
        const board = await this.board();
        const entry = board.entries.find(
            (item) => this.status(item) === 'active',
        );
        if (!entry) return null;
        return {
            id: entry.id,
            message: entry.message,
            linkUrl: entry.linkUrl,
            linkLabel: entry.linkLabel,
            version: entry.version,
            endsAt: entry.endsAt,
            supersededAt: entry.supersededAt,
        };
    }

    private async commit(
        revision: number,
        entries: WebsiteAnnouncementEntry[],
    ) {
        const result = await this.boards.updateOne(
            { _id: 'website', revision },
            { $set: { entries }, $inc: { revision: 1 } },
        );
        if (result.modifiedCount) return;
        if (revision === 0) {
            try {
                await this.boards.create({
                    _id: 'website',
                    revision: 1,
                    entries,
                });
                return;
            } catch (error) {
                if (error.code !== 11000) throw error;
            }
        }
        throw new ConflictException(
            'Announcements changed. Refresh the list and review the replacement again.',
        );
    }

    async save(actorId: string, payload: WebsiteAnnouncementDto, id?: string) {
        await this.permissions.assertPermission(actorId, 'view');
        await this.permissions.assertPermission(
            actorId,
            id ? 'edit' : 'create',
        );
        await this.permissions.assertPermission(actorId, 'send');
        const board = await this.board();
        if (board.revision !== payload.expectedRevision)
            throw new ConflictException(
                'Announcements changed. Refresh the list and review again.',
            );
        const now = new Date().toISOString();
        const old = id
            ? board.entries.find((item) => item.id === id)
            : undefined;
        if (id && !old) throw new NotFoundException('Announcement not found');
        const republishing = old && this.status(old) === 'expired';
        const startsAt = payload.startsAt
            ? new Date(payload.startsAt).toISOString()
            : old && this.status(old) === 'active'
              ? old.startsAt
              : now;
        const endsAt = payload.endsAt
            ? new Date(payload.endsAt).toISOString()
            : undefined;
        if (
            endsAt &&
            (Date.parse(endsAt) <= Date.parse(startsAt) ||
                Date.parse(endsAt) <= Date.now())
        ) {
            throw new BadRequestException(
                'Show until must be after the start time and in the future.',
            );
        }
        if (
            (!old || this.status(old) !== 'active') &&
            payload.startsAt &&
            Date.parse(startsAt) < Date.now() - 60000
        ) {
            throw new BadRequestException(
                'Choose now or a future publication time.',
            );
        }
        const message = payload.message.trim();
        const linkUrl = payload.linkUrl?.trim() || undefined;
        const linkLabel = payload.linkLabel?.trim() || undefined;
        if (!message) throw new BadRequestException('Message is required');
        if (
            linkUrl &&
            (!linkLabel ||
                /[\\\u0000-\u001f\u007f]/.test(linkUrl) ||
                !/^(https:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i.test(linkUrl))
        ) {
            throw new BadRequestException(
                'Provide a link label and an HTTPS URL or website-relative path.',
            );
        }
        if (linkUrl && !linkUrl.startsWith('/')) {
            try {
                const url = new URL(linkUrl);
                if (!url.hostname || url.username || url.password)
                    throw new Error();
            } catch {
                throw new BadRequestException('The link URL is invalid');
            }
        }
        const entry: WebsiteAnnouncementEntry = {
            id: old?.id || new Types.ObjectId().toString(),
            message,
            linkUrl,
            linkLabel: linkUrl ? linkLabel : undefined,
            startsAt,
            endsAt,
            version: old ? old.version : 1,
            updatedAt: now,
            audit: [...(old?.audit || [])],
        };
        const active = board.entries.find(
            (item) => item.id !== id && this.status(item) === 'active',
        );
        const scheduled = board.entries.find(
            (item) => item.id !== id && this.status(item) === 'scheduled',
        );
        const publishing = !old || republishing;
        const changingStart = old && !republishing && startsAt !== old.startsAt;
        if (old && this.status(old) === 'active' && changingStart)
            throw new BadRequestException(
                'An active announcement can only have its end time changed. Expire it before scheduling a new start.',
            );
        const replacing = publishing || changingStart;
        if (replacing && (active || scheduled) && !payload.replaceConfirmed) {
            throw new ConflictException(
                'Confirm replacement of the active announcement or upcoming schedule.',
            );
        }
        // The whole board is saved with a revision condition so replacement is atomic.
        if (replacing) {
            if (scheduled) {
                scheduled.expiredAt = now;
                scheduled.updatedAt = now;
                scheduled.audit.push({
                    action: 'schedule_replaced',
                    actorId,
                    at: now,
                });
            }
            if (active) {
                active.supersededAt = startsAt;
                active.updatedAt = now;
                active.audit.push({
                    action: 'replacement_set',
                    actorId,
                    at: now,
                    previous: { replacementAt: startsAt },
                });
            }
        } else {
            entry.supersededAt = old?.supersededAt;
        }
        if (
            old &&
            (republishing ||
                old.message !== message ||
                old.linkUrl !== linkUrl ||
                old.linkLabel !== entry.linkLabel)
        )
            entry.version += 1;
        entry.audit.push({
            action: republishing ? 'republished' : old ? 'edited' : 'published',
            actorId,
            at: now,
            previous: old
                ? {
                      message: old.message,
                      linkUrl: old.linkUrl,
                      linkLabel: old.linkLabel,
                      startsAt: old.startsAt,
                      endsAt: old.endsAt,
                  }
                : undefined,
        });
        await this.commit(board.revision, [
            ...board.entries.filter((item) => item.id !== entry.id),
            entry,
        ]);
        return this.list(actorId);
    }

    async expire(actorId: string, id: string, revision: number) {
        await this.permissions.assertPermission(actorId, 'view');
        await this.permissions.assertPermission(actorId, 'archive');
        const board = await this.board();
        if (board.revision !== revision)
            throw new ConflictException(
                'Announcements changed. Refresh and try again.',
            );
        const entry = board.entries.find((item) => item.id === id);
        if (!entry) throw new NotFoundException('Announcement not found');
        const status = this.status(entry);
        if (status === 'expired')
            throw new ConflictException('Announcement is already expired');
        const now = new Date().toISOString();
        if (status === 'scheduled') {
            const active = board.entries.find(
                (item) => this.status(item) === 'active',
            );
            if (active) active.supersededAt = undefined;
        }
        entry.expiredAt = now;
        entry.updatedAt = now;
        entry.audit.push({ action: 'expired', actorId, at: now });
        await this.commit(board.revision, board.entries);
        return this.list(actorId);
    }
}

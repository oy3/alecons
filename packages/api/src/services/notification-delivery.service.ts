import { Injectable } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Cron } from '@nestjs/schedule';
import { Job, Queue } from 'bull';
import { NotificationStatus } from '../schemas/notification.schema';
import { NotificationsService } from './notifications.service';

export type NotificationDeliveryJob = { notificationId: string };

@Injectable()
export class NotificationDeliveryService {
    constructor(@InjectQueue('notification-delivery') private readonly queue: Queue) {}

    async enqueue(notificationId: string) {
        await this.queue.add('deliver', { notificationId }, {
            jobId: `notification:${notificationId}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 50,
            removeOnFail: 50,
        });
    }
}

@Processor('notification-delivery')
export class NotificationDeliveryProcessor {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Process('deliver')
    async deliver(job: Job<NotificationDeliveryJob>) {
        await this.notificationsService.deliver(job.data.notificationId);
    }
}

@Injectable()
export class NotificationScheduleService {
    constructor(
        private readonly notificationsService: NotificationsService,
        private readonly deliveryService: NotificationDeliveryService,
    ) {}

    @Cron('*/1 * * * *')
    async enqueueDueNotifications() {
        let notification = await this.notificationsService.claimDueScheduled();
        while (notification) {
            try {
                await this.deliveryService.enqueue(String(notification._id));
            } catch (error) {
                await this.notificationsService.releaseQueueClaim(
                    String(notification._id),
                    NotificationStatus.SCHEDULED,
                    error,
                );
                return;
            }
            notification = await this.notificationsService.claimDueScheduled();
        }
    }
}

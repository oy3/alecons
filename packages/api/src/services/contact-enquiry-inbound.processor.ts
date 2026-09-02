import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Cron } from '@nestjs/schedule';
import { Job, Queue } from 'bull';
import { ContactEnquiryInboundService } from './contact-enquiry-inbound.service';
import { ContactEnquiryGmailService } from './contact-enquiry-gmail.service';

export type ContactInboundSyncJob = {
  pubsubMessageId: string;
  emailAddress: string;
  historyId: string;
};

@Injectable()
export class ContactEnquiryInboundQueueService {
  constructor(@InjectQueue('contact-enquiry-inbound') private readonly queue: Queue) {}

  async enqueue(payload: ContactInboundSyncJob): Promise<void> {
    await this.queue.add('sync-mailbox', payload, {
      jobId: `gmail:${payload.pubsubMessageId}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 200,
      removeOnFail: 200,
    });
  }
}

@Processor('contact-enquiry-inbound')
export class ContactEnquiryInboundProcessor {
  constructor(private readonly inbound: ContactEnquiryInboundService) {}

  @Process('sync-mailbox')
  async synchronize(_job: Job<ContactInboundSyncJob>): Promise<void> {
    await this.inbound.syncMailbox();
  }
}

@Injectable()
export class ContactEnquiryGmailScheduleService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ContactEnquiryGmailScheduleService.name);

  constructor(
    private readonly gmail: ContactEnquiryGmailService,
    private readonly inbound: ContactEnquiryInboundService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.gmail.isEnabled()) return;
    setTimeout(() => {
      this.inbound.ensureWatch().catch((error) =>
        this.logger.error(`Could not initialize Gmail watch: ${error.message}`),
      );
    }, 5000);
  }

  @Cron('0 3 * * *')
  async renewWatch(): Promise<void> {
    if (!this.gmail.isEnabled()) return;
    try {
      await this.inbound.ensureWatch();
    } catch (error: any) {
      this.logger.error(`Could not renew Gmail watch: ${error.message}`);
    }
  }

  @Cron('*/15 * * * *')
  async recoverMissedNotifications(): Promise<void> {
    if (!this.gmail.isEnabled()) return;
    try {
      await this.inbound.syncMailbox();
    } catch (error: any) {
      this.logger.error(`Inbound Gmail recovery sync failed: ${error.message}`);
    }
  }
}

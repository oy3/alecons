import { Injectable } from '@nestjs/common';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { PaymentsService } from './payments.service';

type PaystackWebhookJob = { eventId: string };

@Injectable()
export class PaystackWebhookQueueService {
    constructor(@InjectQueue('paystack-webhook') private readonly queue: Queue) { }

    async enqueue(eventId: string) {
        await this.queue.add('process', { eventId }, {
            jobId: `paystack-webhook:${eventId}`,
            attempts: 6,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 200,
        });
    }
}

@Processor('paystack-webhook')
export class PaystackWebhookProcessor {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Process('process')
    async process(job: Job<PaystackWebhookJob>) {
        await this.paymentsService.processStoredPaystackEvent(job.data.eventId);
    }
}

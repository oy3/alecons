import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentsReconciliationScheduler {
    private readonly logger = new Logger(PaymentsReconciliationScheduler.name);

    constructor(private readonly paymentsService: PaymentsService) { }

    @Cron(CronExpression.EVERY_10_MINUTES)
    async reconcilePendingPaystackPayments() {
        try {
            const result = await this.paymentsService.reconcilePendingPaystackPayments({
                olderThanMinutes: 10,
                batchSize: 200,
                hardTimeoutHours: 24,
            });

            if (result.scanned > 0) {
                this.logger.log(`Scheduled pending payment reconciliation completed: ${JSON.stringify(result)}`);
            }
        } catch (error) {
            this.logger.error(
                `Scheduled pending payment reconciliation failed: ${error instanceof Error ? error.message : error}`,
            );
        }
    }
}

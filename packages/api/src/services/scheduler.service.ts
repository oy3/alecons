import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExamService } from './exam.service';
import { QueueService } from './queue.service';

@Injectable()
export class SchedulerService {
    private readonly logger = new Logger(SchedulerService.name);

    constructor(
        private examService: ExamService,
        private queueService: QueueService,
    ) { }

    /**
     * Run every 5 minutes to update exam statuses and auto-submit expired attempts
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleExamStatusUpdates() {
        try {
            this.logger.log('Running exam status updates...');
            await this.examService.updateExamStatusesByTime();
            this.logger.log('Exam status updates completed');
        } catch (error) {
            this.logger.error('Error in exam status updates cron job:', error.message);
        }
    }

    /**
     * Run every hour to schedule reminders for upcoming exams
     */
    @Cron(CronExpression.EVERY_HOUR)
    async handleExamReminderScheduling() {
        try {
            this.logger.log('Scheduling reminders for upcoming exams...');
            const result = await this.queueService.scheduleAllUpcomingExamReminders();
            this.logger.log(`Reminder scheduling completed: ${result.scheduled} scheduled, ${result.errors.length} errors`);

            if (result.errors.length > 0) {
                this.logger.warn('Reminder scheduling errors:', result.errors);
            }
        } catch (error) {
            this.logger.error('Error in exam reminder scheduling cron job:', error.message);
        }
    }

    /**
     * Run at midnight to clean up old completed jobs
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleQueueCleanup() {
        try {
            this.logger.log('Cleaning up completed queue jobs...');

            // Clean completed jobs from all queues
            const queues = ['grading', 'import', 'results'];
            for (const queueName of queues) {
                try {
                    await this.queueService.clearQueue(queueName, 'completed');
                } catch (error) {
                    this.logger.error(`Error cleaning queue ${queueName}:`, error.message);
                }
            }

            this.logger.log('Queue cleanup completed');
        } catch (error) {
            this.logger.error('Error in queue cleanup cron job:', error.message);
        }
    }
}
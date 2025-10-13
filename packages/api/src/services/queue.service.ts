import { Injectable, Logger } from '@nestjs/common';
import { Queue, Job } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { GradingService } from './grading.service';
import { ExamService } from './exam.service';

export interface GradingJobData {
    attemptId: string;
    examId: string;
    userId: string;
    priority?: number;
}

export interface BulkImportJobData {
    examId: string;
    questionsData: any[];
    uploadedBy: string;
    filename: string;
}

export interface ResultProcessingJobData {
    examId: string;
    batchSize?: number;
}

@Injectable()
export class QueueService {
    private readonly logger = new Logger(QueueService.name);

    constructor(
        @InjectQueue('exam-grading') private gradingQueue: Queue,
        @InjectQueue('bulk-import') private importQueue: Queue,
        @InjectQueue('result-processing') private resultQueue: Queue,
        private gradingService: GradingService,
        private examService: ExamService,
    ) {
        this.setupJobProcessors();
    }

    private setupJobProcessors(): void {
        // Grading job processor
        this.gradingQueue.process('grade-exam', async (job: Job<GradingJobData>) => {
            try {
                this.logger.log(`Processing grading job for attempt: ${job.data.attemptId}`);

                const result = await this.gradingService.gradeExam(job.data.attemptId);

                this.logger.log(`Grading completed for attempt: ${job.data.attemptId}`);
                return { success: true, resultId: result._id };

            } catch (error) {
                this.logger.error(`Grading job failed for attempt ${job.data.attemptId}:`, error.message);
                throw error;
            }
        });

        // Bulk import processor
        this.importQueue.process('import-questions', async (job: Job<BulkImportJobData>) => {
            try {
                this.logger.log(`Processing bulk import job for exam: ${job.data.examId}`);

                const importResult = await this.processBulkImport(job.data);

                this.logger.log(`Bulk import completed for exam: ${job.data.examId}`);
                return importResult;

            } catch (error) {
                this.logger.error(`Bulk import job failed for exam ${job.data.examId}:`, error.message);
                throw error;
            }
        });

        // Result processing processor
        this.resultQueue.process('process-results', async (job: Job<ResultProcessingJobData>) => {
            try {
                this.logger.log(`Processing results for exam: ${job.data.examId}`);

                await this.gradingService.batchGradeExams(job.data.examId);
                const statistics = await this.gradingService.calculateExamStatistics(job.data.examId);

                this.logger.log(`Result processing completed for exam: ${job.data.examId}`);
                return { success: true, statistics };

            } catch (error) {
                this.logger.error(`Result processing failed for exam ${job.data.examId}:`, error.message);
                throw error;
            }
        });
    }

    async queueGradingJob(data: GradingJobData): Promise<Job<GradingJobData>> {
        try {
            const job = await this.gradingQueue.add('grade-exam', data, {
                priority: data.priority || 1,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: 10,
                removeOnFail: 5,
            });

            this.logger.log(`Grading job queued for attempt: ${data.attemptId}`);
            return job;

        } catch (error) {
            this.logger.error(`Failed to queue grading job for attempt ${data.attemptId}:`, error.message);
            throw error;
        }
    }

    async queueBulkImportJob(data: BulkImportJobData): Promise<Job<BulkImportJobData>> {
        try {
            const job = await this.importQueue.add('import-questions', data, {
                attempts: 2,
                backoff: {
                    type: 'fixed',
                    delay: 5000,
                },
                removeOnComplete: 5,
                removeOnFail: 3,
            });

            this.logger.log(`Bulk import job queued for exam: ${data.examId}`);
            return job;

        } catch (error) {
            this.logger.error(`Failed to queue bulk import job for exam ${data.examId}:`, error.message);
            throw error;
        }
    }

    async queueResultProcessingJob(data: ResultProcessingJobData): Promise<Job<ResultProcessingJobData>> {
        try {
            const job = await this.resultQueue.add('process-results', data, {
                delay: 60000, // Wait 1 minute before processing
                attempts: 2,
                removeOnComplete: 5,
                removeOnFail: 3,
            });

            this.logger.log(`Result processing job queued for exam: ${data.examId}`);
            return job;

        } catch (error) {
            this.logger.error(`Failed to queue result processing job for exam ${data.examId}:`, error.message);
            throw error;
        }
    }

    private async processBulkImport(data: BulkImportJobData): Promise<any> {
        const { examId, questionsData, uploadedBy, filename } = data;
        const importResults = {
            filename,
            totalRows: questionsData.length,
            successCount: 0,
            errorCount: 0,
            errors: [] as any[]
        };

        // TODO: Implement actual question import logic
        // This would involve:
        // 1. Validating each question data
        // 2. Creating Question documents
        // 3. Handling duplicates
        // 4. Updating exam metadata

        for (let i = 0; i < questionsData.length; i++) {
            try {
                const questionData = questionsData[i];

                // Validate question structure
                const validationResult = this.validateQuestionData(questionData, i + 1);
                if (!validationResult.isValid) {
                    importResults.errors.push({
                        row: i + 1,
                        errors: validationResult.errors
                    });
                    importResults.errorCount++;
                    continue;
                }

                // TODO: Create question in database
                // const question = await this.createQuestionFromImport(examId, questionData, uploadedBy);

                importResults.successCount++;

            } catch (error) {
                importResults.errors.push({
                    row: i + 1,
                    errors: [error.message]
                });
                importResults.errorCount++;
            }
        }

        return importResults;
    }

    private validateQuestionData(questionData: any, rowNumber: number): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Required fields validation
        if (!questionData.questionText || questionData.questionText.trim() === '') {
            errors.push('Question text is required');
        }

        if (!questionData.type || !['mcq', 'multi', 'essay'].includes(questionData.type)) {
            errors.push('Valid question type is required (mcq, multi, essay)');
        }

        if (questionData.type === 'mcq') {
            if (!questionData.options || typeof questionData.options !== 'object') {
                errors.push('MCQ questions must have options object with at least 2 options');
            }

            if (!questionData.answer) {
                errors.push('MCQ questions must have a correct answer specified');
            }
        }

        if (questionData.type === 'multi') {
            if (!questionData.options || typeof questionData.options !== 'object') {
                errors.push('Multiple select questions must have options object with at least 2 options');
            }

            if (!questionData.answer || !Array.isArray(questionData.answer) || questionData.answer.length === 0) {
                errors.push('Multiple select questions must have at least one correct answer');
            }
        }

        // Optional numeric validations
        if (questionData.mark && (isNaN(questionData.mark) || questionData.mark <= 0)) {
            errors.push('Mark must be a positive number');
        }

        if (questionData.order && (isNaN(questionData.order) || questionData.order < 0)) {
            errors.push('Order must be a non-negative number');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    async getJobStatus(queueName: string, jobId: string): Promise<any> {
        try {
            let queue: Queue;

            switch (queueName) {
                case 'grading':
                    queue = this.gradingQueue;
                    break;
                case 'import':
                    queue = this.importQueue;
                    break;
                case 'results':
                    queue = this.resultQueue;
                    break;
                default:
                    throw new Error('Invalid queue name');
            }

            const job = await queue.getJob(jobId);

            if (!job) {
                return { status: 'not_found' };
            }

            return {
                id: job.id,
                name: job.name,
                data: job.data,
                progress: job.progress(),
                state: await job.getState(),
                createdAt: new Date(job.timestamp),
                processedAt: job.processedOn ? new Date(job.processedOn) : null,
                finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
                failedReason: job.failedReason,
                returnValue: job.returnvalue
            };

        } catch (error) {
            this.logger.error(`Error getting job status for ${queueName}:${jobId}:`, error.message);
            throw error;
        }
    }

    async getQueueStats(queueName: string): Promise<any> {
        try {
            let queue: Queue;

            switch (queueName) {
                case 'grading':
                    queue = this.gradingQueue;
                    break;
                case 'import':
                    queue = this.importQueue;
                    break;
                case 'results':
                    queue = this.resultQueue;
                    break;
                default:
                    throw new Error('Invalid queue name');
            }

            const [waiting, active, completed, failed, delayed] = await Promise.all([
                queue.getWaiting(),
                queue.getActive(),
                queue.getCompleted(),
                queue.getFailed(),
                queue.getDelayed()
            ]);

            return {
                waiting: waiting.length,
                active: active.length,
                completed: completed.length,
                failed: failed.length,
                delayed: delayed.length
            };

        } catch (error) {
            this.logger.error(`Error getting queue stats for ${queueName}:`, error.message);
            throw error;
        }
    }

    async retryFailedJobs(queueName: string): Promise<void> {
        try {
            let queue: Queue;

            switch (queueName) {
                case 'grading':
                    queue = this.gradingQueue;
                    break;
                case 'import':
                    queue = this.importQueue;
                    break;
                case 'results':
                    queue = this.resultQueue;
                    break;
                default:
                    throw new Error('Invalid queue name');
            }

            const failedJobs = await queue.getFailed();

            for (const job of failedJobs) {
                await job.retry();
            }

            this.logger.log(`Retried ${failedJobs.length} failed jobs in queue: ${queueName}`);

        } catch (error) {
            this.logger.error(`Error retrying failed jobs in queue ${queueName}:`, error.message);
            throw error;
        }
    }

    async clearQueue(queueName: string, jobState: 'completed' | 'failed' | 'active' = 'completed'): Promise<void> {
        try {
            let queue: Queue;

            switch (queueName) {
                case 'grading':
                    queue = this.gradingQueue;
                    break;
                case 'import':
                    queue = this.importQueue;
                    break;
                case 'results':
                    queue = this.resultQueue;
                    break;
                default:
                    throw new Error('Invalid queue name');
            }

            await queue.clean(0, jobState);

            this.logger.log(`Cleared ${jobState} jobs from queue: ${queueName}`);

        } catch (error) {
            this.logger.error(`Error clearing queue ${queueName}:`, error.message);
            throw error;
        }
    }
}
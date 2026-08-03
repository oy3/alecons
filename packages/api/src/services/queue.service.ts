import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Queue, Job } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { GradingService } from './grading.service';
import { ExamService } from './exam.service';
import { EmailService } from './email.service';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse';

export interface GradingJobData {
    attemptId: string;
    examId: string;
    userId: string;
    priority?: number;
}

export interface BulkImportJobData {
    examId: string;
    uploadedBy: string;
    filename: string;
    fileBuffer: Buffer;
    format: string;
}

export interface ResultProcessingJobData {
    examId: string;
    batchSize?: number;
}

export interface ExamReminderJobData {
    examId: string;
    examTitle: string;
    examDate: Date;
    targetEmails: string[];
}

export interface ExamSchedulingJobData {
    examId: string;
}

@Injectable()
export class QueueService {
    private readonly logger = new Logger(QueueService.name);

    constructor(
        @InjectQueue('exam-grading') private gradingQueue: Queue,
        @InjectQueue('bulk-import') private importQueue: Queue,
        @InjectQueue('result-processing') private resultQueue: Queue,
        @InjectQueue('exam-reminders') private reminderQueue: Queue,
        private gradingService: GradingService,
        @Inject(forwardRef(() => ExamService)) private examService: ExamService,
        @Inject(forwardRef(() => EmailService)) private emailService: EmailService,
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

        // Exam reminder processor
        this.reminderQueue.process('send-reminder', async (job: Job<ExamReminderJobData>) => {
            try {
                this.logger.log(`Processing exam reminder for exam: ${job.data.examId}`);

                // Send bulk reminder emails
                const result = await this.emailService.sendBulkEmails(
                    job.data.targetEmails,
                    this.emailService.sendExamReminderEmail,
                    'Student', // Default name - could be enhanced to use actual names
                    job.data.examTitle,
                    job.data.examDate
                );

                this.logger.log(`Exam reminder sent for exam: ${job.data.examId} (${result.successful} successful, ${result.failed.length} failed)`);
                return {
                    success: true,
                    emailsSent: result.successful,
                    emailsFailed: result.failed.length,
                    failedEmails: result.failed
                };

            } catch (error) {
                this.logger.error(`Exam reminder failed for exam ${job.data.examId}:`, error.message);
                throw error;
            }
        });

        // Exam scheduling processor (for scheduling reminder jobs)
        this.reminderQueue.process('schedule-exam-jobs', async (job: Job<ExamSchedulingJobData>) => {
            try {
                this.logger.log(`Setting up reminder jobs for exam: ${job.data.examId}`);

                const result = await this.scheduleExamReminders(job.data.examId);

                this.logger.log(`Reminder jobs scheduled for exam: ${job.data.examId}`);
                return { success: true, jobsScheduled: result };

            } catch (error) {
                this.logger.error(`Failed to schedule reminder jobs for exam ${job.data.examId}:`, error.message);
                throw error;
            }
        });
    }

    async queueGradingJob(data: GradingJobData): Promise<Job<GradingJobData> | null> {
        try {
            // Add a timeout to prevent long waits when Redis is slow
            const timeoutPromise = new Promise<null>((_, reject) => {
                setTimeout(() => reject(new Error('Queue operation timeout')), 5000); // 5 second timeout
            });

            const jobPromise = this.gradingQueue.add('grade-exam', data, {
                priority: data.priority || 1,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: 10,
                removeOnFail: 5,
            });

            const job = await Promise.race([jobPromise, timeoutPromise]);

            if (job) {
                this.logger.log(`Grading job queued for attempt: ${data.attemptId}`);
                return job;
            } else {
                this.logger.warn(`Queue operation timed out for attempt: ${data.attemptId}`);
                return null;
            }

        } catch (error) {
            this.logger.error(`Failed to queue grading job for attempt ${data.attemptId}:`, error.message);
            // For background operations, we should not throw but handle gracefully
            // Return null to indicate failure without breaking the calling code
            return null;
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
        const { examId, uploadedBy, filename, fileBuffer, format } = data;
        const importResults = {
            filename,
            totalRows: 0,
            successCount: 0,
            errorCount: 0,
            errors: [] as any[]
        };

        try {
            let questionsData = [];

            switch (format.toLowerCase()) {
                case 'docx':
                    questionsData = await this.processDocxFile(fileBuffer);
                    break;
                case 'excel':
                    questionsData = await this.processExcelFile(fileBuffer);
                    break;
                case 'csv':
                    questionsData = await this.processCsvFile(fileBuffer);
                    break;
                default:
                    throw new Error(`Unsupported file format: ${format}`);
            }

            importResults.totalRows = questionsData.length;

            for (const [index, questionData] of questionsData.entries()) {
                try {
                    const validationResult = await this.validateQuestionData(questionData, index + 1);
                    if (!validationResult.isValid) {
                        importResults.errors.push({
                            row: index + 1,
                            errors: validationResult.errors
                        });
                        importResults.errorCount++;
                        continue;
                    }

                    // Create the question in the database
                    await this.examService.createQuestion(examId, questionData, uploadedBy);
                    importResults.successCount++;
                } catch (error) {
                    importResults.errors.push({
                        row: index + 1,
                        errors: [error.message]
                    });
                    importResults.errorCount++;
                }
            }
        } catch (error) {
            this.logger.error('Error processing bulk import:', error);
            throw error;
        }

        return importResults;
    }

    private async processDocxFile(fileBuffer: Buffer): Promise<any[]> {
        try {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            const text = result.value;
            // Split the document into questions based on numbering or formatting
            const questions = text.split(/\n(?=\d+\.|\[Q\d+\])/);
            return questions.map(q => this.parseDocxQuestion(q.trim()));
        } catch (error) {
            this.logger.error('Error processing DOCX file:', error);
            throw error;
        }
    }

    private parseDocxQuestion(text: string): any {
        // Basic parsing - adjust based on your document format
        const lines = text.split('\n').map(l => l.trim());
        const questionText = lines[0].replace(/^\d+\.\s*|\[Q\d+\]\s*/, '');
        const options = {};
        let correctAnswer = '';

        // Parse options and correct answer
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const optionMatch = line.match(/^[A-D]\)\s*(.+)/);
            if (optionMatch) {
                options[optionMatch[0][0].toLowerCase()] = optionMatch[1].trim();
            }
            const answerMatch = line.match(/^Answer:\s*([A-D])/i);
            if (answerMatch) {
                correctAnswer = answerMatch[1].toLowerCase();
            }
        }

        return {
            questionText,
            options,
            correctAnswer,
            type: 'multiple-choice',
            difficulty: 'medium', // Default value
            mark: 1 // Default value
        };
    }

    private async processExcelFile(fileBuffer: Buffer): Promise<any[]> {
        try {
            const workbook = XLSX.read(fileBuffer);
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);
            return data.map(row => ({
                questionText: row['Question'],
                options: {
                    a: row['Option A'],
                    b: row['Option B'],
                    c: row['Option C'],
                    d: row['Option D']
                },
                correctAnswer: (row['Correct Answer'] || '').toLowerCase(),
                mark: row['Mark'] || 1,
                difficulty: row['Difficulty'] || 'medium',
                type: row['Type'] || 'multiple-choice'
            }));
        } catch (error) {
            this.logger.error('Error processing Excel file:', error);
            throw error;
        }
    }

    private async processCsvFile(fileBuffer: Buffer): Promise<any[]> {
        try {
            return new Promise((resolve, reject) => {
                parse(fileBuffer, {
                    columns: true,
                    skip_empty_lines: true
                }, (err, records) => {
                    if (err) reject(err);
                    else resolve(records.map(row => ({
                        questionText: row['Question'],
                        options: {
                            a: row['Option A'],
                            b: row['Option B'],
                            c: row['Option C'],
                            d: row['Option D']
                        },
                        correctAnswer: (row['Correct Answer'] || '').toLowerCase(),
                        mark: row['Mark'] || 1,
                        difficulty: row['Difficulty'] || 'medium',
                        type: row['Type'] || 'multiple-choice'
                    })));
                });
            });
        } catch (error) {
            this.logger.error('Error processing CSV file:', error);
            throw error;
        }
    }

    private validateQuestionData(questionData: any, rowNumber: number): { isValid: boolean; errors: string[] } {
        const errors = [];

        if (!questionData.questionText) {
            errors.push(`Row ${rowNumber}: Question text is required`);
        }

        if (questionData.type === 'multiple-choice') {
            if (!questionData.options || Object.keys(questionData.options).length < 2) {
                errors.push(`Row ${rowNumber}: Multiple choice questions require at least 2 options`);
            }
            if (!questionData.correctAnswer) {
                errors.push(`Row ${rowNumber}: Correct answer is required for multiple choice questions`);
            }
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

    /**
     * Queue a job to schedule all reminder jobs for an exam
     */
    async queueExamSchedulingJob(examId: string): Promise<Job<ExamSchedulingJobData>> {
        try {
            const job = await this.reminderQueue.add('schedule-exam-jobs', { examId }, {
                attempts: 2,
                backoff: {
                    type: 'fixed',
                    delay: 10000,
                },
                removeOnComplete: 5,
                removeOnFail: 3,
            });

            this.logger.log(`Exam scheduling job queued for exam: ${examId}`);
            return job;

        } catch (error) {
            this.logger.error(`Failed to queue exam scheduling job for exam ${examId}:`, error.message);
            throw error;
        }
    }

    /**
     * Queue a reminder job for a specific exam
     */
    async queueReminderJob(data: ExamReminderJobData, delayMs: number): Promise<Job<ExamReminderJobData>> {
        try {
            const job = await this.reminderQueue.add('send-reminder', data, {
                delay: delayMs,
                attempts: 2,
                backoff: {
                    type: 'fixed',
                    delay: 30000,
                },
                removeOnComplete: 5,
                removeOnFail: 3,
            });

            this.logger.log(`Reminder job queued for exam: ${data.examId}, delay: ${delayMs}ms`);
            return job;

        } catch (error) {
            this.logger.error(`Failed to queue reminder job for exam ${data.examId}:`, error.message);
            throw error;
        }
    }

    /**
     * Schedule reminder jobs for an exam (30 minutes before start)
     */
    private async scheduleExamReminders(examId: string): Promise<number> {
        try {
            // Get exam details with population
            const exam = await this.examService.getExamDetails(examId, 'system'); // Using system as user ID for internal operations

            if (!exam) {
                throw new Error(`Exam not found: ${examId}`);
            }

            const now = new Date();
            const examStartTime = new Date(exam.examTimestamp);
            const reminderTime = new Date(examStartTime.getTime() - (30 * 60 * 1000)); // 30 minutes before

            // Don't schedule if reminder time has already passed
            if (reminderTime <= now) {
                this.logger.warn(`Reminder time has passed for exam ${examId}, skipping reminder scheduling`);
                return 0;
            }

            // Get target audience emails
            const emails = await this.examService.getTargetAudienceEmails(examId);

            if (emails.length === 0) {
                this.logger.warn(`No target audience found for exam ${examId}, skipping reminder scheduling`);
                return 0;
            }

            // Calculate delay in milliseconds
            const delayMs = reminderTime.getTime() - now.getTime();

            // Queue the reminder job
            await this.queueReminderJob({
                examId,
                examTitle: exam.title,
                examDate: examStartTime,
                targetEmails: emails
            }, delayMs);

            this.logger.log(`Scheduled reminder for exam ${examId} at ${reminderTime.toISOString()} for ${emails.length} recipients`);
            return 1;

        } catch (error) {
            this.logger.error(`Error scheduling reminders for exam ${examId}:`, error.message);
            throw error;
        }
    }

    /**
     * Schedule reminders for all upcoming exams that don't have reminders yet
     */
    async scheduleAllUpcomingExamReminders(): Promise<{ scheduled: number; errors: string[] }> {
        try {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));

            // Find exams scheduled for the next 24 hours with 'scheduled' status
            // We'll use the examService's examModel directly for date filtering
            const upcomingExams = await this.examService['examModel'].find({
                status: 'scheduled',
                examTimestamp: {
                    $gte: now,
                    $lte: tomorrow
                },
                isActive: true
            }).limit(100);

            let scheduled = 0;
            const errors: string[] = [];

            for (const exam of upcomingExams) {
                try {
                    // Check if reminder jobs already exist for this exam
                    const existingJobs = await this.reminderQueue.getJobs(['delayed', 'waiting'], 0, -1);
                    const hasExistingReminder = existingJobs.some(job =>
                        job.data.examId === exam._id.toString()
                    );

                    if (!hasExistingReminder) {
                        await this.queueExamSchedulingJob(exam._id.toString());
                        scheduled++;
                    }
                } catch (error) {
                    const errorMsg = `Failed to schedule reminder for exam ${exam._id}: ${error.message}`;
                    errors.push(errorMsg);
                    this.logger.error(errorMsg);
                }
            }

            this.logger.log(`Scheduled reminders for ${scheduled} exams, ${errors.length} errors`);
            return { scheduled, errors };

        } catch (error) {
            this.logger.error('Error scheduling upcoming exam reminders:', error.message);
            throw error;
        }
    }
}
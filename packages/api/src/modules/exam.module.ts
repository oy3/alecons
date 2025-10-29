import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { ExamController } from '../controllers/exam.controller';
import { QuestionController } from '../controllers/question.controller';
import { ExamService } from '../services/exam.service';
import { GradingService } from '../services/grading.service';
import { QueueService } from '../services/queue.service';
import { Exam, ExamSchema } from '../schemas/exam.schema';
import { Question, QuestionSchema } from '../schemas/question.schema';
import { ExamPassword, ExamPasswordSchema } from '../schemas/exam-password.schema';
import { ExamAttempt, ExamAttemptSchema } from '../schemas/exam-attempt.schema';
import { ExamResult, ExamResultSchema } from '../schemas/exam-result.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { EmailService } from '../services/email.service';
import { SchedulerService } from '../services/scheduler.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Exam.name, schema: ExamSchema },
            { name: Question.name, schema: QuestionSchema },
            { name: ExamPassword.name, schema: ExamPasswordSchema },
            { name: ExamAttempt.name, schema: ExamAttemptSchema },
            { name: ExamResult.name, schema: ExamResultSchema },
            { name: Application.name, schema: ApplicationSchema },
            { name: User.name, schema: UserSchema },
        ]),
        BullModule.registerQueue(
            { name: 'exam-grading' },
            { name: 'bulk-import' },
            { name: 'result-processing' },
            { name: 'exam-reminders' }
        ),
    ],
    controllers: [ExamController, QuestionController],
    providers: [ExamService, GradingService, QueueService, EmailService, SchedulerService],
    exports: [ExamService, GradingService, QueueService, EmailService, SchedulerService],
})
export class ExamModule { }
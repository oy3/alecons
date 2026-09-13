import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { ExamController } from '../controllers/exam.controller';
import { QuestionController } from '../controllers/question.controller';
import { ExamService } from '../services/exam.service';
import { QuestionBankService } from '../services/question-bank.service';
import { GradingService } from '../services/grading.service';
import { QueueService } from '../services/queue.service';
import { Exam, ExamSchema } from '../schemas/exam.schema';
import { ExamQuestion, ExamQuestionSchema } from '../schemas/exam-question.schema';
import { QuestionBankItem, QuestionBankItemSchema } from '../schemas/question-bank-item.schema';
import { QuestionBankActivity, QuestionBankActivitySchema } from '../schemas/question-bank-activity.schema';
import { QuestionBankController } from '../controllers/question-bank.controller';
import { ExamPassword, ExamPasswordSchema } from '../schemas/exam-password.schema';
import { ExamAttempt, ExamAttemptSchema } from '../schemas/exam-attempt.schema';
import { ExamResult, ExamResultSchema } from '../schemas/exam-result.schema';
import { Application, ApplicationSchema } from '../schemas/application.schema';
import { User, UserSchema } from '../schemas/user.schema';
import { EmailService } from '../services/email.service';
import { SchedulerService } from '../services/scheduler.service';
import { ContentSanitizationService } from '../services/content-sanitization.service';
import { AcademicSessionsModule } from './academic-sessions.module';

@Module({
    imports: [
        AcademicSessionsModule,
        MongooseModule.forFeature([
            { name: Exam.name, schema: ExamSchema },
            { name: ExamQuestion.name, schema: ExamQuestionSchema },
            { name: QuestionBankItem.name, schema: QuestionBankItemSchema },
            { name: QuestionBankActivity.name, schema: QuestionBankActivitySchema },
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
    controllers: [ExamController, QuestionController, QuestionBankController],
    providers: [ExamService, QuestionBankService, GradingService, QueueService, EmailService, SchedulerService, ContentSanitizationService],
    exports: [ExamService, QuestionBankService, GradingService, QueueService, EmailService, SchedulerService, ContentSanitizationService],
})
export class ExamModule { }

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { ExamController } from '../controllers/exam.controller';
import { ExamService } from '../services/exam.service';
import { GradingService } from '../services/grading.service';
import { QueueService } from '../services/queue.service';
import { Exam, ExamSchema } from '../schemas/exam.schema';
import { Question, QuestionSchema } from '../schemas/question.schema';
import { ExamPassword, ExamPasswordSchema } from '../schemas/exam-password.schema';
import { ExamAttempt, ExamAttemptSchema } from '../schemas/exam-attempt.schema';
import { ExamResult, ExamResultSchema } from '../schemas/exam-result.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exam.name, schema: ExamSchema },
      { name: Question.name, schema: QuestionSchema },
      { name: ExamPassword.name, schema: ExamPasswordSchema },
      { name: ExamAttempt.name, schema: ExamAttemptSchema },
      { name: ExamResult.name, schema: ExamResultSchema },
    ]),
    BullModule.registerQueue(
      { name: 'exam-grading' },
      { name: 'bulk-import' },
      { name: 'result-processing' }
    ),
  ],
  controllers: [ExamController],
  providers: [ExamService, GradingService, QueueService],
  exports: [ExamService, GradingService, QueueService],
})
export class ExamModule {}
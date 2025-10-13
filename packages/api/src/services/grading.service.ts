import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Question, QuestionDocument } from '../schemas/question.schema';
import { ExamResult, ExamResultDocument } from '../schemas/exam-result.schema';
import { ExamAttempt, ExamAttemptDocument } from '../schemas/exam-attempt.schema';
import { Exam, ExamDocument } from '../schemas/exam.schema';

export interface GradingOptions {
  negativeMarking?: boolean;
  negativePercentage?: number;
  passingPercentage?: number;
}

export interface QuestionResult {
  questionId: string;
  userAnswer: any;
  correctAnswer: any;
  isCorrect: boolean;
  marksAwarded: number;
  maxMarks: number;
  explanation?: string;
}

@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);

  constructor(
    @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
    @InjectModel(ExamResult.name) private resultModel: Model<ExamResultDocument>,
    @InjectModel(ExamAttempt.name) private attemptModel: Model<ExamAttemptDocument>,
    @InjectModel(Exam.name) private examModel: Model<ExamDocument>,
  ) {}

  async gradeExam(attemptId: string): Promise<ExamResultDocument> {
    try {
      this.logger.log(`Starting grading for attempt: ${attemptId}`);

      // Get attempt with exam details
      const attempt = await this.attemptModel
        .findById(attemptId)
        .populate('examId')
        .lean();

      if (!attempt) {
        throw new Error('Attempt not found');
      }

      // Get all questions for the exam
      const questions = await this.questionModel
        .find({ examId: attempt.examId })
        .lean();

      if (!questions.length) {
        throw new Error('No questions found for exam');
      }

      // Process each question and calculate scores
      const questionResults: QuestionResult[] = [];
      let correctAnswers = 0;
      let totalScore = 0;
      let maxScore = 0;

      for (const question of questions) {
        const userAnswer = attempt.answers.find(a => 
          a.questionId.toString() === question._id.toString()
        );
        const result = this.gradeQuestion(question, userAnswer);
        
        questionResults.push(result);
        
        if (result.isCorrect) {
          correctAnswers++;
        }
        
        totalScore += result.marksAwarded;
        maxScore += result.maxMarks;
      }

      // Calculate percentage and determine pass/fail
      const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
      const exam = attempt.examId as any;
      const passingPercentage = exam.passingPercentage || 50;
      const status = percentage >= passingPercentage ? 'pass' : 'fail';

      // Update or create result document
      const resultData = {
        examId: attempt.examId,
        userId: attempt.userId,
        attemptId: attempt._id,
        totalQuestions: questions.length,
        questionsAttempted: attempt.answers.filter(a => a.selected).length,
        correctAnswers,
        totalScore,
        maxScore,
        percentage: Math.round(percentage * 100) / 100,
        status,
        gradingType: 'auto',
        questionResults,
        gradedAt: new Date(),
        released: true // Auto-release for objective questions
      };

      const existingResult = await this.resultModel.findOne({
        attemptId: new Types.ObjectId(attemptId)
      });

      let result: ExamResultDocument;
      
      if (existingResult) {
        result = await this.resultModel.findByIdAndUpdate(
          existingResult._id,
          resultData,
          { new: true }
        );
      } else {
        result = new this.resultModel(resultData);
        await result.save();
      }

      this.logger.log(`Grading completed for attempt ${attemptId}. Score: ${totalScore}/${maxScore} (${percentage}%)`);
      
      return result;

    } catch (error) {
      this.logger.error(`Error grading exam for attempt ${attemptId}:`, error.message);
      throw error;
    }
  }

  private gradeQuestion(question: QuestionDocument, userAnswer: any): QuestionResult {
    const maxMarks = question.mark || 1;
    let isCorrect = false;
    let marksAwarded = 0;

    if (!userAnswer || !userAnswer.selected) {
      // No answer provided
      return {
        questionId: question._id.toString(),
        userAnswer: null,
        correctAnswer: question.answer,
        isCorrect: false,
        marksAwarded: 0,
        maxMarks,
        explanation: question.metadata?.learningObjective || ''
      };
    }

    switch (question.type) {
      case 'mcq':
        isCorrect = this.gradeMCQ(question, userAnswer);
        break;
      
      case 'multi':
        isCorrect = this.gradeMultipleSelect(question, userAnswer);
        break;
      
      case 'essay':
        // Essays require manual grading
        marksAwarded = 0;
        return {
          questionId: question._id.toString(),
          userAnswer: userAnswer.text || userAnswer.selected,
          correctAnswer: 'Manual grading required',
          isCorrect: false,
          marksAwarded: 0,
          maxMarks,
          explanation: 'This question requires manual grading'
        };
      
      default:
        this.logger.warn(`Unknown question type: ${question.type}`);
        break;
    }

    marksAwarded = isCorrect ? maxMarks : 0;

    return {
      questionId: question._id.toString(),
      userAnswer: userAnswer.selected || userAnswer.text,
      correctAnswer: question.answer,
      isCorrect,
      marksAwarded,
      maxMarks,
      explanation: question.metadata?.learningObjective || ''
    };
  }

  private gradeMCQ(question: QuestionDocument, userAnswer: any): boolean {
    const correctOption = question.answer;
    const userSelection = userAnswer.selected;
    
    return correctOption === userSelection;
  }

  private gradeMultipleSelect(question: QuestionDocument, userAnswer: any): boolean {
    const correctAnswers = question.answer as string[];
    const userSelections = userAnswer.selected as string[];
    
    if (!Array.isArray(correctAnswers) || !Array.isArray(userSelections)) {
      return false;
    }
    
    // Check if arrays have same length and same elements
    if (correctAnswers.length !== userSelections.length) {
      return false;
    }
    
    const sortedCorrect = [...correctAnswers].sort();
    const sortedUser = [...userSelections].sort();
    
    return sortedCorrect.every((answer, index) => answer === sortedUser[index]);
  }

  async batchGradeExams(examId: string): Promise<void> {
    try {
      this.logger.log(`Starting batch grading for exam: ${examId}`);

      // Get all submitted attempts for the exam
      const attempts = await this.attemptModel
        .find({
          examId: new Types.ObjectId(examId),
          status: 'submitted'
        })
        .lean();

      this.logger.log(`Found ${attempts.length} submitted attempts to grade`);

      // Grade each attempt
      const gradingPromises = attempts.map(attempt => 
        this.gradeExam(attempt._id.toString())
      );

      await Promise.all(gradingPromises);

      this.logger.log(`Batch grading completed for exam ${examId}`);

    } catch (error) {
      this.logger.error(`Error in batch grading for exam ${examId}:`, error.message);
      throw error;
    }
  }

  async calculateExamStatistics(examId: string): Promise<any> {
    try {
      const results = await this.resultModel
        .find({ examId: new Types.ObjectId(examId) })
        .lean();

      if (!results.length) {
        return {
          totalAttempts: 0,
          averageScore: 0,
          passRate: 0,
          highestScore: 0,
          lowestScore: 0,
          scoreDistribution: []
        };
      }

      const scores = results.map(r => r.percentage);
      const passCount = results.filter(r => r.status === 'pass').length;

      const statistics = {
        totalAttempts: results.length,
        averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
        passRate: (passCount / results.length) * 100,
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores),
        scoreDistribution: this.calculateScoreDistribution(scores)
      };

      return statistics;

    } catch (error) {
      this.logger.error(`Error calculating statistics for exam ${examId}:`, error.message);
      throw error;
    }
  }

  private calculateScoreDistribution(scores: number[]): any[] {
    const ranges = [
      { label: '90-100%', min: 90, max: 100, count: 0 },
      { label: '80-89%', min: 80, max: 89, count: 0 },
      { label: '70-79%', min: 70, max: 79, count: 0 },
      { label: '60-69%', min: 60, max: 69, count: 0 },
      { label: '50-59%', min: 50, max: 59, count: 0 },
      { label: '0-49%', min: 0, max: 49, count: 0 }
    ];

    scores.forEach(score => {
      const range = ranges.find(r => score >= r.min && score <= r.max);
      if (range) {
        range.count++;
      }
    });

    return ranges;
  }

  async releaseResults(examId: string, releaseAll: boolean = true): Promise<void> {
    try {
      const filter: any = { examId: new Types.ObjectId(examId) };
      
      if (!releaseAll) {
        filter.gradingType = 'auto'; // Only release auto-graded results
      }

      await this.resultModel.updateMany(filter, { released: true });
      
      this.logger.log(`Results released for exam ${examId}`);

    } catch (error) {
      this.logger.error(`Error releasing results for exam ${examId}:`, error.message);
      throw error;
    }
  }

  async retractResults(examId: string): Promise<void> {
    try {
      await this.resultModel.updateMany(
        { examId: new Types.ObjectId(examId) },
        { released: false }
      );
      
      this.logger.log(`Results retracted for exam ${examId}`);

    } catch (error) {
      this.logger.error(`Error retracting results for exam ${examId}:`, error.message);
      throw error;
    }
  }
}
import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Inject,
    forwardRef,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Exam, ExamDocument } from "../schemas/exam.schema";
import { Question, QuestionDocument } from "../schemas/question.schema";
import {
    ExamPassword,
    ExamPasswordDocument,
} from "../schemas/exam-password.schema";
import {
    ExamAttempt,
    ExamAttemptDocument,
} from "../schemas/exam-attempt.schema";
import { ExamResult, ExamResultDocument } from "../schemas/exam-result.schema";
import {
    Application,
    ApplicationDocument,
} from "../schemas/application.schema";
import { User, UserDocument } from "../schemas/user.schema";
import { EmailService } from "./email.service";
import { QueueService } from "./queue.service";
import { GradingService } from "./grading.service";
import { ContentSanitizationService } from "./content-sanitization.service";
import { SessionControlsService } from "./session-controls.service";
import * as bcrypt from "bcrypt";
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";
import { parse } from "csv-parse";
const pdfParse = require("pdf-parse");

@Injectable()
export class ExamService {
    private readonly logger = new Logger(ExamService.name);

    constructor(
        @InjectModel(Exam.name) private examModel: Model<ExamDocument>,
        @InjectModel(Question.name) private questionModel: Model<QuestionDocument>,
        @InjectModel(ExamPassword.name)
        private passwordModel: Model<ExamPasswordDocument>,
        @InjectModel(ExamAttempt.name)
        private attemptModel: Model<ExamAttemptDocument>,
        @InjectModel(ExamResult.name)
        private resultModel: Model<ExamResultDocument>,
        @InjectModel(Application.name)
        private applicationModel: Model<ApplicationDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @Inject(forwardRef(() => EmailService)) private emailService: EmailService,
        @Inject(forwardRef(() => QueueService)) private queueService: QueueService,
        @Inject(forwardRef(() => GradingService))
        private gradingService: GradingService,
        private contentSanitizationService: ContentSanitizationService,
        private sessionControlsService: SessionControlsService,
    ) { }

    private async getUserApplication(userId: string) {
        return this.applicationModel
            .findOne({ userId: new Types.ObjectId(userId) })
            .select('programId entryAcademicSession currentStage isJambExempt')
            .exec();
    }

    async getExamQuestionsForManagement(
        examId: string
    ): Promise<QuestionDocument[]> {
        try {
            const exam = await this.examModel.findById(examId);
            if (!exam) {
                throw new NotFoundException("Exam not found");
            }

            const questions = await this.questionModel
                .find({ examId: new Types.ObjectId(examId) })
                .sort({ createdAt: "asc" });

            return questions;
        } catch (error) {
            this.logger.error(
                "Error getting exam questions for management:",
                error.message
            );
            throw error;
        }
    }

    async createQuestion(
        examId: string,
        questionData: any,
        userId: string
    ): Promise<QuestionDocument> {
        try {
            const exam = await this.examModel.findById(examId);
            if (!exam) {
                throw new NotFoundException("Exam not found");
            }

            // Check if the exam has reached its totalQuestions limit
            const currentQuestionCount = await this.questionModel.countDocuments({
                examId: new Types.ObjectId(examId),
            });
            if (currentQuestionCount >= exam.totalQuestions) {
                throw new BadRequestException(
                    `Cannot add more questions. Exam already has ${currentQuestionCount} questions, which is the maximum allowed (${exam.totalQuestions}).`
                );
            }

            this.logger.log(
                `Creating question with data:`,
                JSON.stringify(questionData, null, 2)
            );

            // Validate and sanitize question content
            const contentValidation = this.contentSanitizationService.validateQuestionContent(
                questionData.questionText
            );

            if (!contentValidation.isValid) {
                throw new BadRequestException(
                    `Invalid question content: ${contentValidation.warnings.join(', ')}`
                );
            }

            // Log warnings if any
            if (contentValidation.warnings.length > 0) {
                this.logger.warn(
                    `Question content warnings: ${contentValidation.warnings.join(', ')}`
                );
            }

            // Normalize question type - map 'multiple-choice' to 'mcq'
            let normalizedType = questionData.type;
            if (questionData.type === "multiple-choice") {
                normalizedType = "mcq";
            }

            // Transform the data to match the schema
            const questionDoc = {
                examId: new Types.ObjectId(examId),
                questionText: contentValidation.sanitizedContent, // Use sanitized content
                type: normalizedType,
                mark: questionData.mark || 1,
                status: "active",
                metadata: {
                    difficulty: questionData.difficulty || "medium",
                    contentMetadata: contentValidation.metadata, // Store content metadata
                },
                createdBy: new Types.ObjectId(userId),
            };

            // Handle options and answers based on question type
            if (
                ["mcq", "multi"].includes(normalizedType) ||
                questionData.type === "multiple-choice"
            ) {
                // Check if options is already an object with keys (from our parser)
                if (
                    typeof questionData.options === "object" &&
                    !Array.isArray(questionData.options)
                ) {
                    // Options are already in the correct format {a: 'text', b: 'text', etc.}
                    questionDoc["options"] = questionData.options;
                } else if (Array.isArray(questionData.options)) {
                    // Options are in array format, convert to object
                    const options = {};
                    questionData.options.forEach((text: string, index: number) => {
                        options[String.fromCharCode(97 + index)] = text; // a, b, c, d, e
                    });
                    questionDoc["options"] = options;
                }

                // Handle correct answer
                if (questionData.correctAnswer) {
                    // Answer is already a letter (from our parser)
                    questionDoc["answer"] = questionData.correctAnswer;
                } else if (typeof questionData.answer === "number") {
                    // Answer is an index, convert to letter
                    questionDoc["answer"] = String.fromCharCode(97 + questionData.answer);
                } else if (Array.isArray(questionData.answer)) {
                    // Multiple answers (for multi type)
                    questionDoc["answer"] = questionData.answer.map((index: number) =>
                        String.fromCharCode(97 + index)
                    );
                } else {
                    // Answer is already in correct format
                    questionDoc["answer"] = questionData.answer;
                }
            }

            this.logger.log(
                `Creating question document:`,
                JSON.stringify(questionDoc, null, 2)
            );

            const question = await this.questionModel.create(questionDoc);
            this.logger.log(
                `Successfully created question ${question._id} for exam ${examId}`
            );

            // Check if we should update exam status to 'scheduled'
            await this.checkAndUpdateExamStatus(examId);

            return question;
        } catch (error) {
            this.logger.error("Error creating question:", error.message);
            this.logger.error(
                "Question data that failed:",
                JSON.stringify(questionData, null, 2)
            );
            throw error;
        }
    }

    async updateQuestion(
        questionId: string,
        questionData: any,
        userId: string,
        userRole?: string
    ): Promise<QuestionDocument> {
        try {
            const existingQuestion = await this.questionModel.findById(questionId);
            if (!existingQuestion) {
                throw new NotFoundException("Question not found");
            }

            // Check permissions - allow update if user is admin, staff, or creator
            const isCreator =
                existingQuestion.createdBy &&
                existingQuestion.createdBy.equals(new Types.ObjectId(userId));
            const isPrivileged = userRole === "admin" || userRole === "staff";

            if (!isCreator && !isPrivileged) {
                throw new BadRequestException(
                    "You do not have permission to update this question"
                );
            }

            // Get the exam to check status
            const exam = await this.examModel.findById(existingQuestion.examId);
            if (!exam) {
                throw new NotFoundException("Associated exam not found");
            }

            // Check if exam is in a state that allows question editing
            if (!["draft", "scheduled"].includes(exam.status)) {
                throw new BadRequestException(
                    `Cannot update questions in exam with status "${exam.status}". Only draft or scheduled exams can be modified.`
                );
            }

            // Prepare update data
            const updateData: any = {
                questionText: questionData.questionText,
                type: questionData.type,
                mark: questionData.mark || 1,
                difficulty: questionData.difficulty,
                updatedBy: new Types.ObjectId(userId),
                updatedAt: new Date(),
            };

            // Handle different question types
            const normalizedType = questionData.type?.toLowerCase();
            if (
                ["mcq", "multi"].includes(normalizedType) ||
                questionData.type === "multiple-choice"
            ) {
                // Handle options
                if (Array.isArray(questionData.options)) {
                    // Options are in array format, convert to object
                    const options = {};
                    questionData.options.forEach((text: string, index: number) => {
                        options[String.fromCharCode(97 + index)] = text; // a, b, c, d, e
                    });
                    updateData["options"] = options;
                } else if (
                    typeof questionData.options === "object" &&
                    questionData.options !== null
                ) {
                    // Options are already in object format
                    updateData["options"] = questionData.options;
                }

                // Handle correct answer
                if (typeof questionData.answer === "number") {
                    // Answer is an index, convert to letter
                    updateData["answer"] = String.fromCharCode(97 + questionData.answer);
                } else if (Array.isArray(questionData.answer)) {
                    // Multiple answers (for multi type)
                    updateData["answer"] = questionData.answer.map((index: number) =>
                        String.fromCharCode(97 + index)
                    );
                } else {
                    // Answer is already in correct format (letter or array of letters)
                    updateData["answer"] = questionData.answer;
                }
            }

            this.logger.log(
                `Updating question ${questionId} with data:`,
                JSON.stringify(updateData, null, 2)
            );

            const updatedQuestion = await this.questionModel.findByIdAndUpdate(
                questionId,
                updateData,
                { new: true, runValidators: true }
            );

            if (!updatedQuestion) {
                throw new NotFoundException("Question not found after update");
            }

            this.logger.log(`Successfully updated question ${questionId}`);

            return updatedQuestion;
        } catch (error) {
            this.logger.error("Error updating question:", error.message);
            this.logger.error(
                "Question data that failed:",
                JSON.stringify(questionData, null, 2)
            );
            throw error;
        }
    }

    async deleteQuestion(
        questionId: string,
        userId: string,
        userRole?: string
    ): Promise<void> {
        try {
            const question = await this.questionModel.findById(questionId);
            if (!question) {
                throw new NotFoundException("Question not found");
            }

            // Allow deletion if user is admin or staff, or if they created the question
            const isCreator =
                question.createdBy &&
                question.createdBy.equals(new Types.ObjectId(userId));
            const isPrivileged = userRole === "admin" || userRole === "staff";

            if (!isCreator && !isPrivileged) {
                throw new BadRequestException(
                    "You do not have permission to delete this question"
                );
            }

            await this.questionModel.findByIdAndDelete(questionId);
            this.logger.log(`Deleted question ${questionId}`);

            // Check if exam status should be updated after question deletion
            if (question.examId) {
                await this.checkAndUpdateExamStatus(question.examId.toString());
            }
        } catch (error) {
            this.logger.error("Error deleting question:", error.message);
            throw error;
        }
    }

    async processBulkImport(data: any): Promise<any> {
        const { examId, uploadedBy, filename, fileBuffer, format } = data;
        const importResults = {
            filename,
            totalRows: 0,
            successCount: 0,
            errorCount: 0,
            errors: [] as any[],
        };

        try {
            let questionsData = [];

            switch (format.toLowerCase()) {
                case "docx":
                    questionsData = await this.processDocxFile(fileBuffer);
                    break;
                case "excel":
                    questionsData = await this.processExcelFile(fileBuffer);
                    break;
                case "csv":
                    questionsData = await this.processCsvFile(fileBuffer);
                    break;
                case "pdf":
                    questionsData = await this.processPdfFile(fileBuffer);
                    break;
                default:
                    throw new Error(`Unsupported file format: ${format}`);
            }

            importResults.totalRows = questionsData.length;

            for (const [index, questionData] of questionsData.entries()) {
                try {
                    const validationResult = this.validateQuestionData(
                        questionData,
                        index + 1
                    );
                    if (!validationResult.isValid) {
                        importResults.errors.push({
                            row: index + 1,
                            errors: validationResult.errors,
                        });
                        importResults.errorCount++;
                        continue;
                    }

                    await this.createQuestion(examId, questionData, uploadedBy);
                    importResults.successCount++;
                } catch (error) {
                    importResults.errors.push({
                        row: index + 1,
                        errors: [error.message],
                    });
                    importResults.errorCount++;
                }
            }
        } catch (error) {
            this.logger.error("Error processing bulk import:", error);
            throw error;
        }

        return importResults;
    }

    async parseBulkImportPreview(data: any): Promise<any> {
        const { filename, fileBuffer, format } = data;

        try {
            let questionsData = [];

            switch (format.toLowerCase()) {
                case "docx":
                    questionsData = await this.processDocxFile(fileBuffer);
                    break;
                case "excel":
                    questionsData = await this.processExcelFile(fileBuffer);
                    break;
                case "csv":
                    questionsData = await this.processCsvFile(fileBuffer);
                    break;
                case "pdf":
                    questionsData = await this.processPdfFile(fileBuffer);
                    break;
                default:
                    throw new Error(`Unsupported file format: ${format}`);
            }

            // Validate questions and add validation results
            const previewData = questionsData.map((questionData, index) => {
                const validationResult = this.validateQuestionData(
                    questionData,
                    index + 1
                );
                return {
                    ...questionData,
                    rowNumber: index + 1,
                    isValid: validationResult.isValid,
                    validationErrors: validationResult.errors,
                };
            });

            const validCount = previewData.filter((q) => q.isValid).length;
            const invalidCount = previewData.length - validCount;

            return {
                filename,
                totalQuestions: previewData.length,
                validQuestions: validCount,
                invalidQuestions: invalidCount,
                questions: previewData,
            };
        } catch (error) {
            this.logger.error("Error parsing bulk import preview:", error);
            throw error;
        }
    }

    async saveBulkImportQuestions(data: any): Promise<any> {
        const { examId, uploadedBy, questions } = data;

        // Validate exam exists and check question limits
        const exam = await this.examModel.findById(examId);
        if (!exam) {
            throw new NotFoundException("Exam not found");
        }

        const currentQuestionCount = await this.questionModel.countDocuments({
            examId: new Types.ObjectId(examId),
        });
        const validQuestionsToImport = questions.filter((q) => q.isValid).length;
        const totalAfterImport = currentQuestionCount + validQuestionsToImport;

        if (totalAfterImport > exam.totalQuestions) {
            const availableSlots = exam.totalQuestions - currentQuestionCount;
            throw new BadRequestException(
                `Cannot import ${validQuestionsToImport} questions. Exam already has ${currentQuestionCount} questions and can only accommodate ${availableSlots} more (total limit: ${exam.totalQuestions}).`
            );
        }

        this.logger.log(`Starting bulk import save with:`, {
            examId,
            uploadedBy,
            questionsCount: questions.length,
            validQuestions: validQuestionsToImport,
            currentCount: currentQuestionCount,
            totalLimit: exam.totalQuestions,
        });

        const importResults = {
            totalRows: questions.length,
            successCount: 0,
            errorCount: 0,
            errors: [] as any[],
        };

        try {
            for (let i = 0; i < questions.length; i++) {
                const questionData = questions[i];
                this.logger.log(`Processing question ${i + 1}/${questions.length}:`, {
                    isValid: questionData.isValid,
                    questionText: questionData.questionText?.substring(0, 50) + "...",
                    hasOptions: !!questionData.options,
                    optionsCount: questionData.options
                        ? Object.keys(questionData.options).length
                        : 0,
                    correctAnswer: questionData.correctAnswer,
                });

                try {
                    // Only process valid questions
                    if (!questionData.isValid) {
                        this.logger.log(
                            `Skipping invalid question ${i + 1}:`,
                            questionData.validationErrors
                        );
                        importResults.errors.push({
                            row: questionData.rowNumber || i + 1,
                            errors: questionData.validationErrors,
                        });
                        importResults.errorCount++;
                        continue;
                    }

                    const createdQuestion = await this.createQuestion(
                        examId,
                        questionData,
                        uploadedBy
                    );
                    this.logger.log(
                        `Successfully created question ${i + 1}, ID: ${createdQuestion._id}`
                    );
                    importResults.successCount++;
                } catch (error) {
                    this.logger.error(
                        `Failed to create question ${i + 1}:`,
                        error.message
                    );
                    importResults.errors.push({
                        row: questionData.rowNumber || i + 1,
                        errors: [error.message],
                    });
                    importResults.errorCount++;
                }
            }
        } catch (error) {
            this.logger.error("Error saving bulk import questions:", error);
            throw error;
        }

        this.logger.log(`Bulk import completed:`, importResults);

        // Check if exam status should be updated after bulk import
        if (importResults.successCount > 0) {
            await this.checkAndUpdateExamStatus(examId);
        }

        return importResults;
    }

    private async processDocxFile(fileBuffer: Buffer): Promise<any[]> {
        try {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            const text = result.value;

            // Split into questions using numbered patterns
            const questionBlocks = text.split(/(?=\n\s*\d+\.\s)/);
            const questions = [];

            for (const block of questionBlocks) {
                if (block.trim() && /^\s*\d+\./.test(block.trim())) {
                    const parsedQuestion = this.parseDocxQuestion(block.trim());
                    if (parsedQuestion.questionText) {
                        questions.push(parsedQuestion);
                    }
                }
            }

            return questions;
        } catch (error) {
            this.logger.error("Error processing DOCX file:", error);
            throw error;
        }
    }

    private parseDocxQuestion(text: string): any {
        this.logger.log(`Parsing DOCX question: ${text.substring(0, 100)}...`);

        const lines = text
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l);
        let questionText = "";
        const options = {};
        let correctAnswer = "";
        let marks = 1;

        // Extract question number and text from first line
        const firstLine = lines[0];
        const questionMatch = firstLine.match(/^\d+\.\s*(.+)$/);
        if (questionMatch) {
            questionText = questionMatch[1].trim();
        }

        this.logger.log(`Question text extracted: "${questionText}"`);

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];

            // Match option patterns: a) text, b) text, etc.
            const optionMatch = line.match(/^([a-e])\)\s*(.+)$/i);
            if (optionMatch) {
                const optionLetter = optionMatch[1].toLowerCase();
                const optionText = optionMatch[2].trim();
                options[optionLetter] = optionText;
                this.logger.log(`Option found: ${optionLetter}) ${optionText}`);
                continue;
            }

            // Match answer patterns: "Answer: b" or "Marks: 1"
            const answerMatch = line.match(/^Answer:\s*([a-e])\s*$/i);
            if (answerMatch) {
                correctAnswer = answerMatch[1].toLowerCase();
                this.logger.log(`Answer found: ${correctAnswer}`);
                continue;
            }

            const marksMatch = line.match(/^Marks?:\s*(\d+)\s*$/i);
            if (marksMatch) {
                marks = parseInt(marksMatch[1]);
                continue;
            }

            this.logger.log(`Unmatched line: "${line}"`);
        }

        const result = {
            questionText,
            options,
            correctAnswer,
            type: "multiple-choice",
            difficulty: "medium",
            mark: marks,
        };

        this.logger.log(`Parsed result:`, JSON.stringify(result, null, 2));
        return result;
    }

    private async processExcelFile(fileBuffer: Buffer): Promise<any[]> {
        try {
            const workbook = XLSX.read(fileBuffer);
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);
            return data.map((row) => ({
                questionText: row["Question"],
                options: {
                    a: row["Option A"],
                    b: row["Option B"],
                    c: row["Option C"],
                    d: row["Option D"],
                },
                correctAnswer: (row["Correct Answer"] || "").toLowerCase(),
                mark: row["Mark"] || 1,
                difficulty: row["Difficulty"] || "medium",
                type: row["Type"] || "multiple-choice",
            }));
        } catch (error) {
            this.logger.error("Error processing Excel file:", error);
            throw error;
        }
    }

    private async processCsvFile(fileBuffer: Buffer): Promise<any[]> {
        try {
            return new Promise((resolve, reject) => {
                parse(
                    fileBuffer,
                    {
                        columns: true,
                        skip_empty_lines: true,
                    },
                    (err, records) => {
                        if (err) reject(err);
                        else
                            resolve(
                                records.map((row) => ({
                                    questionText: row["Question"],
                                    options: {
                                        a: row["Option A"],
                                        b: row["Option B"],
                                        c: row["Option C"],
                                        d: row["Option D"],
                                    },
                                    correctAnswer: (row["Correct Answer"] || "").toLowerCase(),
                                    mark: row["Mark"] || 1,
                                    difficulty: row["Difficulty"] || "medium",
                                    type: row["Type"] || "multiple-choice",
                                }))
                            );
                    }
                );
            });
        } catch (error) {
            this.logger.error("Error processing CSV file:", error);
            throw error;
        }
    }

    private async processPdfFile(fileBuffer: Buffer): Promise<any[]> {
        try {
            const data = await pdfParse(fileBuffer);
            const text = data.text;

            // Split into questions using numbered patterns, being more careful about whitespace
            const questionBlocks = text.split(/(?=\n\s*\d+\.\s)/);
            const questions = [];

            for (const block of questionBlocks) {
                if (block.trim() && /^\s*\d+\./.test(block.trim())) {
                    const parsedQuestion = this.parsePdfQuestion(block.trim());
                    if (parsedQuestion.questionText) {
                        questions.push(parsedQuestion);
                    }
                }
            }

            return questions;
        } catch (error) {
            this.logger.error("Error processing PDF file:", error);
            throw error;
        }
    }

    private parsePdfQuestion(text: string): any {
        this.logger.log(`Parsing PDF question: ${text.substring(0, 100)}...`);

        const lines = text
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l);
        let questionText = "";
        const options = {};
        let correctAnswer = "";
        let marks = 1;

        // Extract question number and text from first line
        const firstLine = lines[0];
        const questionMatch = firstLine.match(/^\d+\.\s*(.+)$/);
        if (questionMatch) {
            questionText = questionMatch[1].trim();
        }

        this.logger.log(`Question text extracted: "${questionText}"`);

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];

            // Match option patterns: a) text, b) text, etc. (both upper and lower case)
            const optionMatch = line.match(/^([a-e])\)\s*(.+)$/i);
            if (optionMatch) {
                const optionLetter = optionMatch[1].toLowerCase();
                const optionText = optionMatch[2].trim();
                options[optionLetter] = optionText;
                this.logger.log(`Option found: ${optionLetter}) ${optionText}`);
                continue;
            }

            // Match answer patterns: "Answer: b" or "Marks: 1"
            const answerMatch = line.match(/^Answer:\s*([a-e])\s*$/i);
            if (answerMatch) {
                correctAnswer = answerMatch[1].toLowerCase();
                this.logger.log(`Answer found: ${correctAnswer}`);
                continue;
            }

            const marksMatch = line.match(/^Marks?:\s*(\d+)\s*$/i);
            if (marksMatch) {
                marks = parseInt(marksMatch[1]);
                continue;
            }

            this.logger.log(`Unmatched line: "${line}"`);
        }

        const result = {
            questionText,
            options,
            correctAnswer,
            type: "multiple-choice",
            difficulty: "medium",
            mark: marks,
        };

        this.logger.log(`Parsed result:`, JSON.stringify(result, null, 2));
        return result;
    }

    private validateQuestionData(
        questionData: any,
        rowNumber: number
    ): { isValid: boolean; errors: string[] } {
        const errors = [];

        if (!questionData.questionText) {
            errors.push(`Row ${rowNumber}: Question text is required`);
        }

        if (questionData.type === "multiple-choice") {
            if (
                !questionData.options ||
                Object.keys(questionData.options).length < 2
            ) {
                errors.push(
                    `Row ${rowNumber}: Multiple choice questions require at least 2 options`
                );
            }
            if (!questionData.correctAnswer) {
                errors.push(
                    `Row ${rowNumber}: Correct answer is required for multiple choice questions`
                );
            }
        }

        if (
            questionData.mark &&
            (isNaN(questionData.mark) || questionData.mark <= 0)
        ) {
            errors.push(`Row ${rowNumber}: Mark must be a positive number`);
        }

        if (
            questionData.order &&
            (isNaN(questionData.order) || questionData.order < 0)
        ) {
            errors.push(`Row ${rowNumber}: Order must be a non-negative number`);
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    async getAvailableExamsForUser(
        userId: string,
        userRole: string,
        programId?: string,
        academicSession?: string
    ): Promise<any[]> {
        try {
            this.logger.log(
                `Getting available exams for user: ${userId}, role: ${userRole}, programId: ${programId}`
            );

            const now = new Date();
            const filter: any = {
                isActive: true,
                status: { $in: ["scheduled", "in-progress", "completed"] },
            };

            this.logger.log(`Initial exam filter:`, filter);

            // Get user's program if needed and user is applicant/student
            let userProgramId = programId;
            if (
                (userRole === "student" || userRole === "applicant") &&
                userId &&
                !userProgramId
            ) {
                try {
                    const application = await this.getUserApplication(userId);

                    if (application && application.programId) {
                        userProgramId = application.programId.toString();
                        this.logger.log(
                            `Found user's programId from application: ${userProgramId}`
                        );

                        if (userRole === 'applicant') {
                            const flowConfig = await this.sessionControlsService.getAdmissionFlowConfig(
                                application.entryAcademicSession,
                                application,
                            );

                            if (!flowConfig.entranceExamEnabled) {
                                this.logger.log(
                                    `Entrance exam disabled for applicant ${userId}; returning no available exams`,
                                );
                                return [];
                            }
                        }
                    }
                } catch (appError) {
                    this.logger.warn(
                        "Could not find application for user:",
                        appError.message
                    );
                }
            }

            // Apply targeting rules based on user role and context
            if (userRole === "student" || userRole === "applicant") {
                const targetType = userRole + "s"; // 'applicants' or 'students'

                const orConditions: any[] = [
                    // For "all applicants/students" - target.type without any filter or with empty filter
                    {
                        "target.type": targetType,
                        $or: [
                            { "target.filter": { $exists: false } },
                            { "target.filter": null },
                            { "target.filter": {} },
                            { "target.filter.programs": { $exists: false } },
                            { "target.filter.programs": null },
                            { "target.filter.programs": [] },
                        ],
                    },
                ];

                // If user has a program, also check for program-specific exams
                if (userProgramId) {
                    orConditions.push(
                        // For specific programs - programs array contains the programId
                        {
                            "target.type": targetType,
                            "target.filter.programs": new Types.ObjectId(userProgramId),
                        } as any,
                        // Legacy format support - single programId
                        {
                            "target.type": targetType,
                            "target.filter.programId": new Types.ObjectId(userProgramId),
                        } as any
                    );
                }

                filter.$or = orConditions;
            } else if (userRole === "staff") {
                filter["target.type"] = { $in: ["staff", "custom"] };
            }

            this.logger.log(
                `Applied targeting filter for ${userRole}:`,
                JSON.stringify(filter, null, 2)
            );

            const exams = await this.examModel
                .find(filter)
                .populate("academicSession")
                .populate({
                    path: "target.filter.programId",
                    model: "Program",
                })
                .sort({ examTimestamp: 1 })
                .lean();

            this.logger.log(`Found ${exams.length} exams matching filter`);

            // Get ALL user's attempts for these exams (including completed ones)
            const examIds = exams.map((exam) => exam._id);
            const userAttempts = await this.attemptModel
                .find({
                    examId: { $in: examIds },
                    userId: new Types.ObjectId(userId),
                })
                .sort({ createdAt: 1 }) // Oldest first for attempt counting
                .lean();

            // Group attempts by exam for processing
            const attemptsByExam = userAttempts.reduce((acc, attempt) => {
                const examId = attempt.examId.toString();
                if (!acc[examId]) acc[examId] = [];
                acc[examId].push(attempt);
                return acc;
            }, {});

            // Enhanced exam processing with server-side flags
            const enhancedExams = exams
                .map((exam) => {
                    const examStart = new Date(exam.examTimestamp);
                    const examEnd = new Date(
                        examStart.getTime() + exam.duration * 60 * 1000
                    );
                    const attempts = attemptsByExam[exam._id.toString()] || [];

                    // Count terminal attempts
                    const terminalAttempts = attempts.filter((a) =>
                        ["submitted", "auto-submitted", "graded"].includes(a.status)
                    );
                    const inProgressAttempt = attempts.find(
                        (a) => a.status === "in-progress"
                    );

                    // Calculate remaining attempts
                    const remainingAttempts = Math.max(
                        0,
                        exam.attemptLimit - terminalAttempts.length
                    );

                    // Determine flags based on requirements
                    const isWithinWindow = now >= examStart && now <= examEnd;
                    const isStartTimeReached = now >= examStart;
                    const hasReachedAttemptLimit = remainingAttempts === 0;

                    // isStartable: can create new attempt
                    const isStartable =
                        isStartTimeReached &&
                        isWithinWindow &&
                        !inProgressAttempt &&
                        !hasReachedAttemptLimit &&
                        exam.status !== "completed";

                    // isResumable: can continue existing attempt
                    const isResumable =
                        inProgressAttempt &&
                        exam.allowResume &&
                        isWithinWindow &&
                        exam.status !== "completed";

                    // Determine display category
                    let category = "upcoming";
                    if (inProgressAttempt) {
                        category = "in-progress";
                    } else if (terminalAttempts.length > 0) {
                        category = "completed";
                    } else if (isStartable) {
                        category = "available";
                    } else if (isStartTimeReached && !isWithinWindow) {
                        // Exam window has passed and user has no attempts
                        category = "missed";
                    } else if (hasReachedAttemptLimit) {
                        category = "completed"; // All attempts used
                    }

                    return {
                        ...exam,
                        id: exam._id, // Frontend compatibility
                        userAttempt:
                            inProgressAttempt ||
                            terminalAttempts[terminalAttempts.length - 1] ||
                            null,
                        userAttempts: attempts,
                        attemptCount: attempts.length,
                        terminalAttemptCount: terminalAttempts.length,
                        remainingAttempts,

                        // Server-computed flags
                        isStartable,
                        isResumable,
                        isWithinWindow,
                        isStartTimeReached,
                        hasReachedAttemptLimit,
                        category,

                        // Time calculations for frontend display
                        examStart: examStart.toISOString(),
                        examEnd: examEnd.toISOString(),
                        currentTime: now.toISOString(),
                    };
                })
                .filter((exam) => {
                    // Only return exams that are relevant for dashboard display
                    // Include all categories that should appear on dashboard
                    return (
                        exam.isStartTimeReached ||
                        exam.category === "upcoming" ||
                        exam.category === "completed" ||
                        exam.category === "in-progress"
                    );
                });

            this.logger.log(
                `Processed ${enhancedExams.length} exams with server flags for user ${userId}`
            );

            return enhancedExams;
        } catch (error) {
            this.logger.error("Error getting available exams:", error.message);
            throw error;
        }
    }

    async getExamDetails(examId: string, userId: string): Promise<ExamDocument> {
        try {
            const exam = await this.examModel
                .findById(examId)
                .populate("academicSession")
                .populate("createdBy", "firstName lastName email");

            if (!exam) {
                throw new NotFoundException("Exam not found");
            }

            // Check if user has access to this exam
            // TODO: Implement proper access control based on target rules

            return exam;
        } catch (error) {
            this.logger.error(
                `Error getting exam details for ${examId}:`,
                error.message
            );
            throw error;
        }
    }

    async getExamQuestions(
        examId: string,
        attemptId: string,
        userId: string
    ): Promise<any[]> {
        try {
            // Validate input parameters
            if (!attemptId || attemptId === "undefined" || attemptId === "null") {
                throw new BadRequestException("Valid attempt ID is required");
            }

            if (!userId || userId === "undefined" || userId === "null") {
                throw new BadRequestException("Valid user ID is required");
            }

            if (!examId || examId === "undefined" || examId === "null") {
                throw new BadRequestException("Valid exam ID is required");
            }

            // Validate ObjectId format
            if (!Types.ObjectId.isValid(attemptId)) {
                throw new BadRequestException("Invalid attempt ID format");
            }

            if (!Types.ObjectId.isValid(userId)) {
                throw new BadRequestException("Invalid user ID format");
            }

            if (!Types.ObjectId.isValid(examId)) {
                throw new BadRequestException("Invalid exam ID format");
            }

            // Verify the attempt belongs to the user
            const attempt = await this.attemptModel.findOne({
                _id: new Types.ObjectId(attemptId),
                examId: new Types.ObjectId(examId),
                userId: new Types.ObjectId(userId),
            });

            if (!attempt) {
                throw new BadRequestException("Invalid attempt or access denied");
            }

            // Get questions without answers for security
            const questions = await this.questionModel
                .find({
                    examId: new Types.ObjectId(examId),
                    status: "active",
                })
                .select("-answer") // Exclude answer field
                .sort({ order: 1 })
                .lean();

            // TODO: Implement question randomization if enabled

            return questions;
        } catch (error) {
            this.logger.error("Error getting exam questions:", error.message);
            throw error;
        }
    }

    async startExam(
        examId: string,
        userId: string,
        password: string,
        clientMeta: any
    ): Promise<{ attemptId: string; isNewAttempt: boolean; exam: any }> {
        try {
            this.logger.log(`Starting exam ${examId} for user ${userId}`);

            const now = new Date();
            const application = await this.getUserApplication(userId);

            if (application) {
                const flowConfig = await this.sessionControlsService.getAdmissionFlowConfig(
                    application.entryAcademicSession,
                    application,
                );

                if (!flowConfig.entranceExamEnabled) {
                    throw new BadRequestException('Entrance examination is disabled for this academic session');
                }
            }

            // Verify exam exists and is available - atomic operation
            const exam = await this.examModel.findById(examId);
            if (!exam || !exam.isActive) {
                throw new NotFoundException("Exam not found or not active");
            }

            // Calculate time windows
            const examStart = new Date(exam.examTimestamp);
            const examEnd = new Date(examStart.getTime() + exam.duration * 60 * 1000);

            // Comprehensive exam status validation
            if (!["scheduled", "in-progress"].includes(exam.status)) {
                throw new BadRequestException(
                    `Exam is not available for taking (status: ${exam.status})`
                );
            }

            // Time window validation
            if (now < examStart) {
                throw new BadRequestException(
                    `Exam has not started yet. Start time: ${examStart.toISOString()}`
                );
            }

            if (now > examEnd) {
                throw new BadRequestException(
                    `Exam time has expired. End time: ${examEnd.toISOString()}`
                );
            }

            // Verify password first (before checking attempts)
            const validPassword = await this.passwordModel.findOne({
                examId: new Types.ObjectId(examId),
                isActive: true,
                expiresAt: { $gt: now },
            });

            if (!validPassword) {
                throw new BadRequestException("No valid password found for this exam");
            }

            const isPasswordValid = await bcrypt.compare(
                password,
                validPassword.hashedPassword
            );
            if (!isPasswordValid) {
                throw new BadRequestException("Invalid exam password");
            }

            // Get all user attempts for this exam
            const userAttempts = await this.attemptModel
                .find({
                    examId: new Types.ObjectId(examId),
                    userId: new Types.ObjectId(userId),
                })
                .sort({ createdAt: 1 });

            // Check for existing in-progress attempt
            const inProgressAttempt = userAttempts.find(
                (a) => a.status === "in-progress"
            );

            if (inProgressAttempt) {
                // Resume existing attempt if allowed
                if (exam.allowResume) {
                    // Update password usage for resume
                    await this.passwordModel.findByIdAndUpdate(validPassword._id, {
                        $inc: { usageCount: 1 },
                        $addToSet: { usedBy: new Types.ObjectId(userId) },
                    });

                    this.logger.log(
                        `Resuming exam attempt ${inProgressAttempt._id} for user ${userId}`
                    );
                    return {
                        attemptId: inProgressAttempt._id.toString(),
                        isNewAttempt: false,
                        exam: {
                            id: exam._id,
                            title: exam.title,
                            duration: exam.duration,
                            totalQuestions: exam.totalQuestions,
                            allowResume: exam.allowResume,
                            securitySettings: exam.securitySettings,
                            examStart: examStart.toISOString(),
                            examEnd: examEnd.toISOString(),
                        },
                    };
                } else {
                    throw new BadRequestException(
                        "You have an incomplete attempt and resuming is not allowed. Please contact administrator."
                    );
                }
            }

            // Count terminal attempts (submitted, auto-submitted, graded)
            const terminalAttempts = userAttempts.filter((a) =>
                ["submitted", "auto-submitted", "graded"].includes(a.status)
            );

            // Check attempt limit
            if (terminalAttempts.length >= exam.attemptLimit) {
                throw new BadRequestException(
                    `Maximum attempt limit reached (${exam.attemptLimit} attempts allowed)`
                );
            }

            // Create new attempt atomically with validation
            const attemptData = {
                examId: new Types.ObjectId(examId),
                userId: new Types.ObjectId(userId),
                passwordUsed: validPassword._id,
                startedAt: now,
                status: "in-progress",
                clientMeta,
                answers: [],
            };

            // Create attempt atomically (without transactions for non-replica set MongoDB)
            // Double-check no new in-progress attempt was created by concurrent request
            const concurrentCheck = await this.attemptModel.findOne({
                examId: new Types.ObjectId(examId),
                userId: new Types.ObjectId(userId),
                status: "in-progress",
            });

            if (concurrentCheck) {
                throw new BadRequestException(
                    "An attempt was already started. Please refresh the page."
                );
            }

            // Create the attempt
            const newAttempt = new this.attemptModel(attemptData);
            await newAttempt.save();

            // Update password usage
            await this.passwordModel.findByIdAndUpdate(validPassword._id, {
                $inc: { usageCount: 1 },
                $addToSet: { usedBy: new Types.ObjectId(userId) },
            });

            this.logger.log(
                `New exam attempt created successfully. Attempt ID: ${newAttempt._id}`
            );

            return {
                attemptId: newAttempt._id.toString(),
                isNewAttempt: true,
                exam: {
                    id: exam._id,
                    title: exam.title,
                    duration: exam.duration,
                    totalQuestions: exam.totalQuestions,
                    allowResume: exam.allowResume,
                    securitySettings: exam.securitySettings,
                    examStart: examStart.toISOString(),
                    examEnd: examEnd.toISOString(),
                    remainingAttempts: exam.attemptLimit - terminalAttempts.length - 1, // -1 for current attempt
                },
            };
        } catch (error) {
            this.logger.error(
                `Error starting exam ${examId} for user ${userId}:`,
                error.message
            );

            // Provide specific error messages for better UX
            if (
                error.message.includes("expired") ||
                error.message.includes("not started")
            ) {
                throw new BadRequestException(
                    `${error.message}. Please refresh the page to see updated exam status.`
                );
            }

            throw error;
        }
    }

    async saveAnswers(
        examId: string,
        attemptId: string,
        userId: string,
        answers: any[],
        timestamp: Date
    ): Promise<void> {
        try {
            // Verify attempt ownership
            const attempt = await this.attemptModel.findOne({
                _id: attemptId,
                examId: new Types.ObjectId(examId),
                userId: new Types.ObjectId(userId),
                status: "in-progress",
            });

            if (!attempt) {
                throw new BadRequestException(
                    "Invalid attempt or attempt not in progress"
                );
            }

            // Update answers
            await this.attemptModel.findByIdAndUpdate(attemptId, {
                answers,
                autoSavedAt: timestamp,
                lastHeartbeat: timestamp,
            });

            this.logger.log(`Answers saved for attempt ${attemptId}`);
        } catch (error) {
            this.logger.error(
                `Error saving answers for attempt ${attemptId}:`,
                error.message
            );
            throw error;
        }
    }

    async submitExam(
        examId: string,
        attemptId: string,
        userId: string,
        finalAnswers: any[],
        securityViolations: any[],
        submittedAt: Date,
        isAutoSubmit: boolean = false
    ): Promise<{ resultId: string }> {
        try {
            const statusToSet = isAutoSubmit ? "auto-submitted" : "submitted";
            this.logger.log(
                `${isAutoSubmit ? "Auto-submitting" : "Submitting"
                } exam for attempt ${attemptId}`
            );

            // Verify attempt ownership
            const attempt = await this.attemptModel.findOne({
                _id: attemptId,
                examId: new Types.ObjectId(examId),
                userId: new Types.ObjectId(userId),
                status: "in-progress",
            });

            if (!attempt) {
                throw new BadRequestException(
                    "Invalid attempt or attempt already submitted"
                );
            }

            // Get exam details to check grading type
            const exam = await this.examModel.findById(examId);
            if (!exam) {
                throw new BadRequestException("Exam not found");
            }

            // Update attempt with final submission data
            await this.attemptModel.findByIdAndUpdate(attemptId, {
                answers: finalAnswers,
                submittedAt,
                status: statusToSet,
                securityViolations,
                tabSwitchCount: securityViolations.filter(
                    (v) => v.type === "tab_switch"
                ).length,
                blurCount: securityViolations.filter((v) => v.type === "window_blur")
                    .length,
                rightClickCount: securityViolations.filter(
                    (v) => v.type === "right_click"
                ).length,
                autoSubmitted: isAutoSubmit,
            });

            this.logger.log(
                `Exam attempt ${attemptId} ${isAutoSubmit ? "auto-submitted" : "submitted"
                } successfully`
            );

            let resultId: string = null;

            // Don't create ExamResult immediately - wait until grading is complete
            // For auto grading: result will be created during grading process
            // For manual grading: result will be created when staff grades the exam
            this.logger.log(`ExamResult will be created after grading completes (${exam.gradingMode} mode)`);

            // Handle grading based on exam's grading mode
            this.logger.log(`Exam submitted successfully. Grading mode: ${exam.gradingMode}`);

            // Process post-submission tasks asynchronously (don't block response)
            setImmediate(async () => {
                try {
                    await this.processPostSubmissionTasks(
                        attemptId,
                        examId,
                        userId,
                        exam,
                        submittedAt,
                        isAutoSubmit
                    );
                } catch (backgroundError) {
                    this.logger.error(
                        `Error in background post-submission tasks for attempt ${attemptId}:`,
                        backgroundError.message
                    );
                    // This error should not affect the submission response
                }
            });

            return { resultId: resultId };
        } catch (error) {
            this.logger.error(
                `Error submitting exam for attempt ${attemptId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Handle post-submission tasks asynchronously (email and grading)
     * This ensures that submission returns immediately while background tasks process
     */
    private async processPostSubmissionTasks(
        attemptId: string,
        examId: string,
        userId: string,
        exam: any,
        submittedAt: Date,
        isAutoSubmitted: boolean = false
    ): Promise<void> {
        this.logger.log(
            `Processing post-submission tasks for attempt ${attemptId}`
        );

        // Send exam completion email (non-blocking)
        this.sendCompletionEmailAsync(userId, exam, submittedAt, isAutoSubmitted);

        // Handle grading based on exam's grading mode
        if (exam.gradingMode === "auto") {
            // Queue automatic grading (non-blocking)
            this.queueGradingAsync(attemptId, examId, userId);
        } else {
            // Manual grading - will be done by staff later
            this.logger.log(
                `Exam ${examId} requires ${exam.gradingMode} grading - awaiting staff action`
            );
        }
    }

    /**
     * Send completion email asynchronously without blocking
     */
    private async sendCompletionEmailAsync(
        userId: string,
        exam: any,
        submittedAt: Date,
        isAutoSubmitted: boolean = false
    ): Promise<void> {
        try {
            const user = await this.userModel.findById(userId);

            if (user) {
                // Ensure submittedAt is a Date object
                const submissionDate =
                    submittedAt instanceof Date ? submittedAt : new Date(submittedAt);

                // Send completion email
                await this.emailService.sendExamCompletionEmail(
                    user.email,
                    user.firstName || "Student",
                    exam.title,
                    submissionDate,
                    undefined, // score - will be available after grading
                    undefined, // totalMarks - will be available after grading
                    isAutoSubmitted
                );
                this.logger.log(
                    `${isAutoSubmitted ? "Auto-submission" : "Completion"
                    } email sent successfully to ${user.email}`
                );
            } else {
                this.logger.warn(`User ${userId} not found for email notification`);
            }
        } catch (emailError) {
            this.logger.error(
                `Error sending completion email for user ${userId}:`,
                emailError.message
            );
            // Don't fail - this is a background task
        }
    }

    /**
     * Queue grading job asynchronously without blocking
     */
    private async queueGradingAsync(
        attemptId: string,
        examId: string,
        userId: string
    ): Promise<void> {
        try {
            const job = await this.queueService.queueGradingJob({
                attemptId: attemptId,
                examId: examId,
                userId: userId,
                priority: 1,
            });

            if (job) {
                this.logger.log(
                    `Automatic grading queued successfully for attempt ${attemptId}`
                );
            } else {
                this.logger.warn(
                    `Grading queue unavailable for attempt ${attemptId} - falling back to synchronous grading`
                );
                // Fallback to synchronous grading
                await this.gradingService.gradeExam(attemptId, userId);
                this.logger.log(
                    `Fallback synchronous grading completed for attempt ${attemptId}`
                );
            }
        } catch (queueError) {
            this.logger.error(
                `Failed to queue automatic grading for attempt ${attemptId}:`,
                queueError.message
            );
            this.logger.log(
                `Attempting fallback synchronous grading for attempt ${attemptId}`
            );

            try {
                // Fallback to synchronous grading
                await this.gradingService.gradeExam(attemptId, userId);
                this.logger.log(
                    `Fallback synchronous grading completed for attempt ${attemptId}`
                );
            } catch (gradingError) {
                this.logger.error(
                    `Both queue and synchronous grading failed for attempt ${attemptId}:`,
                    gradingError.message
                );
                // Could implement additional fallback logic here (e.g., notification to admin)
            }
        }
    }

    async recordHeartbeat(
        examId: string,
        attemptId: string,
        userId: string,
        heartbeatData: any
    ): Promise<void> {
        try {
            await this.attemptModel.findOneAndUpdate(
                {
                    _id: attemptId,
                    examId: new Types.ObjectId(examId),
                    userId: new Types.ObjectId(userId),
                    status: "in-progress",
                },
                {
                    lastHeartbeat: heartbeatData.timestamp,
                    clientMeta: heartbeatData,
                }
            );
        } catch (error) {
            this.logger.error("Error recording heartbeat:", error.message);
        }
    }

    async recordSecurityViolation(
        examId: string,
        attemptId: string,
        userId: string,
        violation: any
    ): Promise<void> {
        try {
            await this.attemptModel.findOneAndUpdate(
                {
                    _id: attemptId,
                    examId: new Types.ObjectId(examId),
                    userId: new Types.ObjectId(userId),
                    status: "in-progress",
                },
                {
                    $push: { securityViolations: violation },
                }
            );
        } catch (error) {
            this.logger.error("Error recording security violation:", error.message);
        }
    }

    /**
     * Get attempt details including answers and timing information
     */
    async getAttemptDetails(
        examId: string,
        attemptId: string,
        userId: string
    ): Promise<any> {
        try {
            // Validate input parameters
            if (!attemptId || attemptId === "undefined" || attemptId === "null") {
                throw new BadRequestException("Valid attempt ID is required");
            }

            if (!userId || userId === "undefined" || userId === "null") {
                throw new BadRequestException("Valid user ID is required");
            }

            if (!examId || examId === "undefined" || examId === "null") {
                throw new BadRequestException("Valid exam ID is required");
            }

            // Validate ObjectId format
            if (!Types.ObjectId.isValid(attemptId)) {
                throw new BadRequestException("Invalid attempt ID format");
            }

            if (!Types.ObjectId.isValid(userId)) {
                throw new BadRequestException("Invalid user ID format");
            }

            if (!Types.ObjectId.isValid(examId)) {
                throw new BadRequestException("Invalid exam ID format");
            }

            // Get the exam attempt with full details
            const attempt = await this.attemptModel.findOne({
                _id: new Types.ObjectId(attemptId),
                examId: new Types.ObjectId(examId),
                userId: new Types.ObjectId(userId),
            });

            if (!attempt) {
                throw new BadRequestException("Attempt not found or access denied");
            }

            // Get the exam details for duration and timing calculations
            const exam = await this.examModel.findById(examId);
            if (!exam) {
                throw new BadRequestException("Exam not found");
            }

            // Calculate timing information based on exam scheduled start time
            const examScheduledStart = exam.examTimestamp; // Exam's official start time
            const duration = exam.duration; // in minutes
            const durationInSeconds = duration * 60;
            const calculatedEndTime = new Date(
                examScheduledStart.getTime() + durationInSeconds * 1000
            );
            const now = new Date();
            const timeElapsed = Math.floor(
                (now.getTime() - examScheduledStart.getTime()) / 1000
            );
            const timeRemaining = Math.max(0, durationInSeconds - timeElapsed);

            return {
                _id: attempt._id,
                examId: attempt.examId,
                userId: attempt.userId,
                status: attempt.status,
                startedAt: attempt.startedAt,
                submittedAt: attempt.submittedAt,
                answers: attempt.answers || [],
                securityViolations: attempt.securityViolations || [],
                tabSwitchCount: attempt.tabSwitchCount || 0,
                blurCount: attempt.blurCount || 0,
                rightClickCount: attempt.rightClickCount || 0,
                timeSpent: attempt.timeSpent,
                timing: {
                    duration: duration, // original duration in minutes
                    durationInSeconds,
                    examScheduledStart, // Exam's official start time
                    calculatedEndTime,
                    timeElapsed,
                    timeRemaining,
                    isTimeUp: timeRemaining <= 0,
                },
            };
        } catch (error) {
            this.logger.error("Error getting attempt details:", error.message);
            throw error;
        }
    }

    /**
     * Get all completed attempts for an exam that can be graded or regraded
     */
    async getCompletedAttemptsForGrading(
        examId: string,
        includeAlreadyGraded: boolean = false
    ): Promise<ExamAttemptDocument[]> {
        try {
            this.logger.log(
                `Looking for completed attempts for exam: ${examId}, includeAlreadyGraded: ${includeAlreadyGraded}`
            );

            // Find all attempts that are completed (submitted or auto-submitted)
            const attempts = await this.attemptModel
                .find({
                    examId: new Types.ObjectId(examId),
                    status: { $in: ["submitted", "auto-submitted"] },
                    isValid: true,
                })
                .lean();

            this.logger.log(
                `Found ${attempts.length} completed attempts for exam ${examId}`
            );

            if (includeAlreadyGraded) {
                // For regrading, return all completed attempts regardless of existing results
                this.logger.log(
                    `Returning all ${attempts.length} attempts for regrading`
                );
                return attempts as unknown as ExamAttemptDocument[];
            }

            // For initial grading, filter out attempts that already have results
            const attemptsWithoutResults = [];
            for (const attempt of attempts) {
                const existingResult = await this.resultModel
                    .findOne({
                        attemptId: attempt._id,
                    })
                    .lean();

                if (!existingResult) {
                    attemptsWithoutResults.push(attempt);
                    this.logger.debug(`Attempt ${attempt._id} needs grading`);
                } else {
                    this.logger.debug(
                        `Attempt ${attempt._id} already has result ${existingResult._id}`
                    );
                }
            }

            this.logger.log(
                `${attemptsWithoutResults.length} attempts need grading for exam ${examId}`
            );
            return attemptsWithoutResults as unknown as ExamAttemptDocument[];
        } catch (error) {
            this.logger.error(
                `Error getting completed attempts for exam ${examId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Get all completed attempts for an exam that can be graded (backward compatibility)
     */
    async getCompletedAttempts(examId: string): Promise<ExamAttemptDocument[]> {
        return this.getCompletedAttemptsForGrading(examId, false);
    }

    /**
     * Get grading status information for an exam to determine available actions
     */
    async getExamGradingStatus(examId: string): Promise<{
        gradingMode: "auto" | "manual";
        status: string;
        totalAttempts: number;
        completedAttempts: number;
        gradedAttempts: number;
        canGrade: boolean;
        canRegrade: boolean;
        recommendedAction: "grade-all" | "regrade-all" | "none";
    }> {
        try {
            // Get exam details
            const exam = await this.examModel.findById(examId).lean();
            if (!exam) {
                throw new NotFoundException("Exam not found");
            }

            // Get all attempts for this exam
            const allAttempts = await this.attemptModel
                .find({
                    examId: new Types.ObjectId(examId),
                })
                .lean();

            // Get completed attempts
            const completedAttempts = allAttempts.filter(
                (attempt) =>
                    ["submitted", "auto-submitted"].includes(attempt.status) &&
                    attempt.isValid
            );

            // Get graded attempts (those with results)
            const gradedAttempts = [];
            for (const attempt of completedAttempts) {
                const result = await this.resultModel
                    .findOne({
                        attemptId: attempt._id,
                    })
                    .lean();
                if (result) {
                    gradedAttempts.push(attempt);
                }
            }

            // Determine recommended action
            let recommendedAction: "grade-all" | "regrade-all" | "none" = "none";
            let canGrade = false;
            let canRegrade = false;

            if (exam.status === "completed" && completedAttempts.length > 0) {
                if (exam.gradingMode === "auto" && gradedAttempts.length > 0) {
                    // Auto mode with existing results = show regrade button
                    recommendedAction = "regrade-all";
                    canRegrade = true;
                } else if (
                    exam.gradingMode === "manual" &&
                    gradedAttempts.length < completedAttempts.length
                ) {
                    // Manual mode with ungraded attempts = show grade button
                    recommendedAction = "grade-all";
                    canGrade = true;
                } else if (
                    exam.gradingMode === "manual" &&
                    gradedAttempts.length === completedAttempts.length
                ) {
                    // Manual mode with all attempts graded = show regrade button
                    recommendedAction = "regrade-all";
                    canRegrade = true;
                }
            }

            return {
                gradingMode: exam.gradingMode,
                status: exam.status,
                totalAttempts: allAttempts.length,
                completedAttempts: completedAttempts.length,
                gradedAttempts: gradedAttempts.length,
                canGrade,
                canRegrade,
                recommendedAction,
            };
        } catch (error) {
            this.logger.error(
                `Error getting exam grading status for ${examId}:`,
                error.message
            );
            throw error;
        }
    }

    async getExamResults(
        examId: string,
        userId: string,
        userRole: string,
        filters?: any
    ): Promise<any> {
        try {
            if (userRole === "student" || userRole === "applicant") {
                // Get exam information first
                const exam = await this.examModel.findById(examId).lean();
                if (!exam) {
                    throw new NotFoundException("Exam not found");
                }

                // Look for user's result
                const result = await this.resultModel
                    .findOne({
                        examId: new Types.ObjectId(examId),
                        userId: new Types.ObjectId(userId),
                    })
                    .lean();

                this.logger.log(`Found result for student ${userId} in exam ${examId}:`, {
                    hasResult: !!result,
                    released: result?.released,
                    status: result?.status,
                    percentage: result?.percentage
                });

                // If result exists but not released, return limited info
                if (result && !result.released) {
                    this.logger.log(`Result not released for student ${userId} in exam ${examId}`);
                    return {
                        exam,
                        result: null, // Don't expose unreleased results
                        attempt: null,
                        hasResult: false, // Hide result availability
                        hasAttempt: false,
                        released: false
                    };
                }

                // Filter sensitive data from result for students (remove questionResults with correct answers)
                let filteredResult = null;
                if (result && result.released) {
                    filteredResult = {
                        _id: result._id,
                        examId: result.examId,
                        userId: result.userId,
                        status: result.status,
                        totalScore: result.totalScore,
                        maxScore: result.maxScore,
                        percentage: result.percentage,
                        totalQuestions: result.totalQuestions,
                        questionsAttempted: result.questionsAttempted,
                        correctAnswers: result.correctAnswers,
                        partialCorrectAnswers: result.partialCorrectAnswers,
                        gradingType: result.gradingType,
                        gradedAt: result.gradedAt,
                        released: result.released,
                        overallFeedback: result.overallFeedback,
                        // Explicitly exclude questionResults to prevent exposing correct answers
                        // questionResults: result.questionResults - NEVER expose this to students
                    };
                }

                // If no result exists, check if user has a completed attempt
                let attemptInfo = null;
                if (!result) {
                    const attempt = await this.attemptModel
                        .findOne({
                            examId: new Types.ObjectId(examId),
                            userId: new Types.ObjectId(userId),
                            status: { $in: ["submitted", "auto-submitted", "graded"] },
                        })
                        .sort({ submittedAt: -1 }) // Get most recent attempt
                        .lean();

                    if (attempt) {
                        attemptInfo = {
                            _id: attempt._id,
                            status: attempt.status,
                            startedAt: attempt.startedAt,
                            submittedAt: attempt.submittedAt,
                            totalQuestions: attempt.answers?.length || 0,
                            questionsAttempted:
                                attempt.answers?.filter((a) => a.selected).length || 0,
                            // Exclude actual answers from attempt info for security
                        };
                    }
                }

                return {
                    exam,
                    result: filteredResult,
                    attempt: attemptInfo,
                    hasResult: !!filteredResult,
                    hasAttempt: !!attemptInfo,
                    released: result?.released || false
                };
            } else {
                // Staff/Admin view - return all results with statistics
                const exam = await this.examModel.findById(examId).lean();
                if (!exam) {
                    throw new NotFoundException("Exam not found");
                }

                this.logger.log(`Getting results for exam: ${examId}`);

                // Get all results for this exam with attempt data
                const results = await this.resultModel
                    .find({ examId: new Types.ObjectId(examId) })
                    .populate('userId', 'firstName lastName email')
                    .populate('attemptId', 'submittedAt startedAt')
                    .sort({ gradedAt: -1 })
                    .lean();

                this.logger.log(`Found ${results.length} results for exam ${examId}`);

                // Calculate statistics
                const totalStudents = results.length;
                const gradedResults = results; // All results are graded once they exist
                const averageScore = gradedResults.length > 0
                    ? Math.round(gradedResults.reduce((sum, r) => sum + r.percentage, 0) / gradedResults.length)
                    : 0;
                const passedResults = gradedResults.filter(r => r.status === 'pass');
                const passRate = gradedResults.length > 0
                    ? Math.round((passedResults.length / gradedResults.length) * 100)
                    : 0;
                const highestScore = gradedResults.length > 0
                    ? Math.max(...gradedResults.map(r => r.percentage))
                    : 0;

                const statistics = {
                    totalStudents,
                    averageScore,
                    passRate,
                    highestScore
                };

                this.logger.log(`Statistics calculated:`, statistics);

                return {
                    exam,
                    results,
                    statistics
                };
            }
        } catch (error) {
            this.logger.error("Error getting exam results:", error.message);
            throw error;
        }
    }

    async getUserExamHistory(userId: string): Promise<any[]> {
        try {
            const attempts = await this.attemptModel
                .find({ userId: new Types.ObjectId(userId) })
                .populate({
                    path: "examId",
                    populate: {
                        path: "academicSession",
                    },
                })
                .sort({ createdAt: -1 })
                .lean();

            return attempts;
        } catch (error) {
            this.logger.error("Error getting user exam history:", error.message);
            throw error;
        }
    }

    // Admin methods (TODO: Add proper implementation)
    async getAllExams(options: {
        page: number;
        limit: number;
        search?: string;
        status?: string;
        type?: string;
        sortBy?: string;
        sortOrder?: string;
    }): Promise<{
        exams: ExamDocument[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        try {
            const {
                page,
                limit,
                search,
                status,
                type,
                sortBy = "createdAt",
                sortOrder = "desc",
            } = options;

            // Build filter query
            const filter: any = { isActive: true };

            if (search) {
                filter.$or = [
                    { title: { $regex: search, $options: "i" } },
                    { description: { $regex: search, $options: "i" } },
                ];
            }

            if (status) {
                filter.status = status;
            }

            if (type) {
                filter.type = type;
            }

            // Calculate pagination
            const skip = (page - 1) * limit;

            // Build sort object
            const sort: any = {};
            sort[sortBy] = sortOrder === "desc" ? -1 : 1;

            // Execute query
            const [exams, total] = await Promise.all([
                this.examModel
                    .find(filter)
                    .populate("academicSession", "sessionYear startDate endDate status")
                    .populate("createdBy", "firstName lastName email")
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                this.examModel.countDocuments(filter),
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                exams: exams as unknown as ExamDocument[],
                total,
                page,
                limit,
                totalPages,
            };
        } catch (error) {
            this.logger.error("Error getting all exams:", error.message);
            throw error;
        }
    }

    async createExam(
        createExamDto: any,
        createdBy: string
    ): Promise<ExamDocument> {
        try {
            this.logger.log(
                "Received exam data:",
                JSON.stringify(createExamDto, null, 2)
            );

            // Debug specific number fields
            this.logger.log("Raw number values:", {
                totalQuestions: {
                    value: createExamDto.totalQuestions,
                    type: typeof createExamDto.totalQuestions,
                },
                totalMark: {
                    value: createExamDto.totalMark,
                    type: typeof createExamDto.totalMark,
                },
                cutOffMark: {
                    value: createExamDto.cutOffMark,
                    type: typeof createExamDto.cutOffMark,
                },
                duration: {
                    value: createExamDto.duration,
                    type: typeof createExamDto.duration,
                },
                attemptLimit: {
                    value: createExamDto.attemptLimit,
                    type: typeof createExamDto.attemptLimit,
                },
            });

            // Process and validate the data
            const processedData = {
                ...createExamDto,
                // Ensure academicSession is ObjectId
                academicSession: new Types.ObjectId(createExamDto.academicSession),
                // Ensure examTimestamp is Date
                examTimestamp: new Date(createExamDto.examTimestamp),
                // Ensure numbers are properly converted
                duration: Number(createExamDto.duration),
                totalQuestions: Number(createExamDto.totalQuestions),
                attemptLimit: Number(createExamDto.attemptLimit),
                totalMark: Number(createExamDto.totalMark),
                cutOffMark: Number(createExamDto.cutOffMark),
                // Handle target filter - convert programs array to ObjectIds
                target: {
                    ...createExamDto.target,
                    filter: {
                        ...createExamDto.target?.filter,
                        // Convert programs array to ObjectIds if provided
                        ...(createExamDto.target?.filter?.programs && {
                            programs: createExamDto.target.filter.programs.map(
                                (id) => new Types.ObjectId(id)
                            ),
                        }),
                        // Convert departments array to ObjectIds if provided
                        ...(createExamDto.target?.filter?.departments && {
                            departments: createExamDto.target.filter.departments.map(
                                (id) => new Types.ObjectId(id)
                            ),
                        }),
                        // Convert courses array to ObjectIds if provided
                        ...(createExamDto.target?.filter?.courses && {
                            courses: createExamDto.target.filter.courses.map(
                                (id) => new Types.ObjectId(id)
                            ),
                        }),
                    },
                },
                createdBy: new Types.ObjectId(createdBy),
            };

            this.logger.log(
                "Processed exam data:",
                JSON.stringify(processedData, null, 2)
            );

            // Debug converted number values
            this.logger.log("Converted number values:", {
                totalQuestions: processedData.totalQuestions,
                totalMark: processedData.totalMark,
                cutOffMark: processedData.cutOffMark,
                duration: processedData.duration,
                attemptLimit: processedData.attemptLimit,
            });

            const exam = new this.examModel(processedData);
            const savedExam = await exam.save();

            this.logger.log("Saved exam number values:", {
                totalQuestions: savedExam.totalQuestions,
                totalMark: savedExam.totalMark,
                cutOffMark: savedExam.cutOffMark,
                duration: savedExam.duration,
                attemptLimit: savedExam.attemptLimit,
            });

            return savedExam;
        } catch (error) {
            this.logger.error("Error creating exam:", error.message);
            throw error;
        }
    }

    async updateExam(
        examId: string,
        updateExamDto: any,
        updatedBy: string
    ): Promise<ExamDocument> {
        try {
            // Process and validate the data similar to create
            const processedData = {
                ...updateExamDto,
                // Ensure academicSession is ObjectId if provided
                ...(updateExamDto.academicSession && {
                    academicSession: new Types.ObjectId(updateExamDto.academicSession),
                }),
                // Ensure examTimestamp is Date if provided
                ...(updateExamDto.examTimestamp && {
                    examTimestamp: new Date(updateExamDto.examTimestamp),
                }),
                // Ensure numbers are properly converted if provided
                ...(updateExamDto.duration !== undefined && {
                    duration: Number(updateExamDto.duration),
                }),
                ...(updateExamDto.totalQuestions !== undefined && {
                    totalQuestions: Number(updateExamDto.totalQuestions),
                }),
                ...(updateExamDto.attemptLimit !== undefined && {
                    attemptLimit: Number(updateExamDto.attemptLimit),
                }),
                ...(updateExamDto.totalMark !== undefined && {
                    totalMark: Number(updateExamDto.totalMark),
                }),
                ...(updateExamDto.cutOffMark !== undefined && {
                    cutOffMark: Number(updateExamDto.cutOffMark),
                }),
                // Handle target filter if provided
                ...(updateExamDto.target && {
                    target: {
                        ...updateExamDto.target,
                        filter: {
                            ...updateExamDto.target?.filter,
                            // Convert programs array to ObjectIds if provided
                            ...(updateExamDto.target?.filter?.programs && {
                                programs: updateExamDto.target.filter.programs.map(
                                    (id) => new Types.ObjectId(id)
                                ),
                            }),
                            // Convert departments array to ObjectIds if provided
                            ...(updateExamDto.target?.filter?.departments && {
                                departments: updateExamDto.target.filter.departments.map(
                                    (id) => new Types.ObjectId(id)
                                ),
                            }),
                            // Convert courses array to ObjectIds if provided
                            ...(updateExamDto.target?.filter?.courses && {
                                courses: updateExamDto.target.filter.courses.map(
                                    (id) => new Types.ObjectId(id)
                                ),
                            }),
                        },
                    },
                }),
                updatedBy: new Types.ObjectId(updatedBy),
            };

            // Get the original exam to check for status changes
            const originalExam = await this.examModel.findById(examId);

            const exam = await this.examModel.findByIdAndUpdate(
                examId,
                processedData,
                { new: true }
            );

            if (!exam) {
                throw new NotFoundException("Exam not found");
            }

            // Check if status changed to 'scheduled' and send notification emails + schedule reminders
            if (
                originalExam &&
                originalExam.status !== "scheduled" &&
                exam.status === "scheduled"
            ) {
                this.sendExamScheduledNotifications(examId).catch((error) => {
                    this.logger.error(
                        "Failed to send exam scheduled notifications:",
                        error.message
                    );
                    // Don't fail the update if email sending fails
                });

                // Schedule reminder jobs for this exam
                this.scheduleExamReminders(examId).catch((error) => {
                    this.logger.error(
                        "Failed to schedule exam reminders:",
                        error.message
                    );
                    // Don't fail the update if reminder scheduling fails
                });
            }

            return exam;
        } catch (error) {
            this.logger.error(`Error updating exam ${examId}:`, error.message);
            throw error;
        }
    }

    async deleteExam(examId: string, deletedBy: string): Promise<void> {
        try {
            const exam = await this.examModel.findByIdAndUpdate(examId, {
                isActive: false,
                updatedBy: new Types.ObjectId(deletedBy),
            });

            if (!exam) {
                throw new NotFoundException("Exam not found");
            }
        } catch (error) {
            this.logger.error(`Error deleting exam ${examId}:`, error.message);
            throw error;
        }
    }

    /**
     * Check if the exam has enough questions and update status to 'scheduled' if needed
     * Uses consistent status transition logic
     */
    async checkAndUpdateExamStatus(examId: string): Promise<void> {
        try {
            const exam = await this.examModel.findById(examId);
            if (!exam) {
                this.logger.warn(`Exam ${examId} not found for status check`);
                return;
            }

            // Count current questions for this exam
            const questionCount = await this.questionModel.countDocuments({
                examId: new Types.ObjectId(examId),
                status: "active",
            });

            this.logger.log(
                `Exam ${examId} status check: ${questionCount}/${exam.totalQuestions} questions, current status: ${exam.status}`
            );

            const now = new Date();
            const examStart = new Date(exam.examTimestamp);
            const examEnd = new Date(examStart.getTime() + exam.duration * 60 * 1000);

            let newStatus = exam.status;

            // Draft <-> Scheduled transitions based on question count
            if (exam.status === "draft" && questionCount >= exam.totalQuestions) {
                newStatus = "scheduled";
                this.logger.log(
                    `Exam ${examId} moving from draft to scheduled - has ${questionCount}/${exam.totalQuestions} questions`
                );
            } else if (
                exam.status === "scheduled" &&
                questionCount < exam.totalQuestions
            ) {
                newStatus = "draft";
                this.logger.log(
                    `Exam ${examId} moving from scheduled to draft - only has ${questionCount}/${exam.totalQuestions} questions`
                );
            }

            // Time-based transitions (only for scheduled/in-progress exams with enough questions)
            if (questionCount >= exam.totalQuestions) {
                if (exam.status === "scheduled") {
                    if (now >= examStart && now <= examEnd) {
                        newStatus = "in-progress";
                        this.logger.log(
                            `Exam ${examId} moving from scheduled to in-progress - exam window started`
                        );
                    } else if (now > examEnd) {
                        newStatus = "completed";
                        this.logger.log(
                            `Exam ${examId} moving from scheduled to completed - exam window ended`
                        );
                    }
                } else if (exam.status === "in-progress" && now > examEnd) {
                    newStatus = "completed";
                    this.logger.log(
                        `Exam ${examId} moving from in-progress to completed - exam time ended`
                    );
                }
            }

            // Update status if it changed
            if (newStatus !== exam.status) {
                await this.examModel.findByIdAndUpdate(examId, {
                    status: newStatus,
                    updatedAt: now,
                });
                this.logger.log(
                    `Exam ${examId} status updated from ${exam.status} to ${newStatus}`
                );

                // Generate password when exam becomes scheduled
                if (newStatus === "scheduled") {
                    const generatedPassword = await this.generateExamPassword(
                        examId,
                        exam.createdBy.toString()
                    );

                    // Send scheduled exam email with password to target audience
                    if (
                        generatedPassword &&
                        generatedPassword !== "Password already exists"
                    ) {
                        try {
                            const targetUsers = await this.getTargetAudienceUsers(examId);
                            if (targetUsers.length > 0) {
                                // Send password email to each user
                                const emailPromises = targetUsers.map((user) =>
                                    this.emailService.sendExamPasswordEmail(
                                        user.email,
                                        user.firstName,
                                        exam.title,
                                        generatedPassword,
                                        exam.examTimestamp,
                                        false // isRegenerated = false for auto-generated
                                    )
                                );

                                await Promise.allSettled(emailPromises);
                                this.logger.log(
                                    `Exam password emails sent to ${targetUsers.length} users for exam ${examId}`
                                );
                            } else {
                                this.logger.warn(
                                    `No target audience found for exam ${examId}, skipping email notification`
                                );
                            }
                        } catch (emailError) {
                            this.logger.error(
                                `Failed to send exam password emails for ${examId}:`,
                                emailError.message
                            );
                            // Don't fail the exam scheduling because of email error
                        }
                    }
                }
            }
        } catch (error) {
            this.logger.error(
                `Error checking/updating exam status for ${examId}:`,
                error.message
            );
            // Don't throw here as this is a background process
        }
    }

    /**
     * Generate a 6-character alphanumeric password for an exam
     */
    private generateRandomPassword(length: number = 6): string {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Generate and save exam password when exam becomes scheduled
     */
    async generateExamPassword(
        examId: string,
        createdBy: string
    ): Promise<string> {
        try {
            const exam = await this.examModel.findById(examId);
            if (!exam) {
                throw new Error("Exam not found");
            }

            // Check if password already exists for this exam
            const existingPassword = await this.passwordModel.findOne({
                examId: new Types.ObjectId(examId),
                isActive: true,
            });

            if (existingPassword) {
                this.logger.log(`Exam ${examId} already has an active password`);
                return "Password already exists";
            }

            // Generate a random 6-character password
            const plainPassword = this.generateRandomPassword(6);
            const hashedPassword = await bcrypt.hash(plainPassword, 10);

            // Calculate expiry time (exactly at exam end time)
            const examStartTime = new Date(exam.examTimestamp);
            const expiryTime = new Date(
                examStartTime.getTime() + exam.duration * 60 * 1000
            );

            // Create password document
            const passwordDoc = new this.passwordModel({
                examId: new Types.ObjectId(examId),
                hashedPassword: hashedPassword,
                label: `Auto-generated for ${exam.title}`,
                usageCount: 0,
                usageLimit: null, // No limit
                expiresAt: expiryTime,
                isActive: true,
                createdBy: new Types.ObjectId(createdBy),
                usedBy: [],
            });

            await passwordDoc.save();

            this.logger.log(
                `Generated password for exam ${examId}: ${plainPassword} (expires: ${expiryTime})`
            );

            // Return the plain password for logging/notification purposes
            return plainPassword;
        } catch (error) {
            this.logger.error(
                `Error generating password for exam ${examId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Get exam passwords for staff/admin (for display purposes)
     */
    async getExamPasswords(examId: string): Promise<any[]> {
        try {
            const passwords = await this.passwordModel
                .find({
                    examId: new Types.ObjectId(examId),
                    isActive: true,
                })
                .populate("createdBy", "firstName lastName email")
                .sort({ createdAt: -1 })
                .lean();

            return passwords.map((password) => ({
                id: password._id,
                label: password.label,
                usageCount: password.usageCount,
                usageLimit: password.usageLimit,
                expiresAt: password.expiresAt,
                createdAt: (password as any).createdAt,
                createdBy: password.createdBy,
            }));
        } catch (error) {
            this.logger.error(
                `Error getting exam passwords for ${examId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Get exam history for a user (completed, graded, missed exams with their attempts)
     */
    async getExamHistoryForUser(
        userId: string,
        userRole: string,
        programId?: string,
        academicSession?: string
    ): Promise<any[]> {
        try {
            this.logger.log(
                `Getting exam history for user: ${userId}, role: ${userRole}`
            );

            // Get user's program if needed
            let userProgramId = programId;
            if (
                (userRole === "student" || userRole === "applicant") &&
                userId &&
                !userProgramId
            ) {
                try {
                    const application = await this.applicationModel
                        .findOne({ userId: new Types.ObjectId(userId) })
                        .select("programId")
                        .exec();

                    if (application && application.programId) {
                        userProgramId = application.programId.toString();
                    }
                } catch (appError) {
                    this.logger.warn(
                        "Could not find application for user:",
                        appError.message
                    );
                }
            }

            // Find all user attempts first
            const userAttempts = await this.attemptModel
                .find({
                    userId: new Types.ObjectId(userId),
                    status: { $in: ["submitted", "auto-submitted", "graded"] },
                })
                .populate("examId")
                .sort({ submittedAt: -1 })
                .lean();

            // Get exam IDs from attempts
            const attemptExamIds = userAttempts
                .filter((attempt) => attempt.examId)
                .map((attempt) => attempt.examId._id);

            // Also find completed/graded exams that user might have missed (no attempts)
            const filter: any = {
                isActive: true,
                status: { $in: ["completed", "graded"] },
                _id: { $nin: attemptExamIds }, // Exclude exams already in attempts
            };

            // Apply targeting rules
            if (userRole === "student" || userRole === "applicant") {
                const targetType = userRole + "s";
                const orConditions: any[] = [
                    {
                        "target.type": targetType,
                        $or: [
                            { "target.filter": { $exists: false } },
                            { "target.filter": null },
                            { "target.filter": {} },
                            { "target.filter.programs": { $exists: false } },
                            { "target.filter.programs": null },
                            { "target.filter.programs": [] },
                        ],
                    },
                ];

                if (userProgramId) {
                    orConditions.push(
                        {
                            "target.type": targetType,
                            "target.filter.programs": new Types.ObjectId(userProgramId),
                        } as any,
                        {
                            "target.type": targetType,
                            "target.filter.programId": new Types.ObjectId(userProgramId),
                        } as any
                    );
                }

                filter.$or = orConditions;
            } else if (userRole === "staff") {
                filter["target.type"] = { $in: ["staff", "custom"] };
            }

            const missedExams = await this.examModel
                .find(filter)
                .populate("academicSession")
                .sort({ examTimestamp: -1 })
                .lean();

            // Get results for completed attempts
            const attemptIds = userAttempts.map((a) => a._id);
            const results = await this.resultModel
                .find({
                    attemptId: { $in: attemptIds },
                })
                .lean();

            const resultsByAttempt = results.reduce((acc, result) => {
                acc[result.attemptId.toString()] = result;
                return acc;
            }, {});

            // Process completed exams (with attempts)
            const completedExams = userAttempts
                .filter(
                    (attempt) => attempt.examId && typeof attempt.examId === "object"
                )
                .map((attempt) => {
                    const exam = attempt.examId as any; // Type assertion for populated exam
                    const result = resultsByAttempt[attempt._id.toString()];

                    return {
                        ...exam,
                        id: exam._id,
                        userAttempt: attempt,
                        result,
                        category: "completed",
                        hasResult: !!result,
                        examStart: exam.examTimestamp,
                        examEnd: new Date(
                            new Date(exam.examTimestamp).getTime() + exam.duration * 60 * 1000
                        ).toISOString(),
                    };
                });

            // Process missed exams (no attempts)
            const missedExamsList = missedExams.map((exam) => ({
                ...exam,
                id: exam._id,
                userAttempt: null,
                result: null,
                category: "missed",
                hasResult: false,
                examStart: exam.examTimestamp,
                examEnd: new Date(
                    new Date(exam.examTimestamp).getTime() + exam.duration * 60 * 1000
                ).toISOString(),
            }));

            // Combine and sort by exam timestamp (most recent first)
            const allHistory = [...completedExams, ...missedExamsList].sort(
                (a, b) =>
                    new Date(b.examStart).getTime() - new Date(a.examStart).getTime()
            );

            this.logger.log(
                `Found ${completedExams.length} completed and ${missedExamsList.length} missed exams for user ${userId}`
            );

            return allHistory;
        } catch (error) {
            this.logger.error("Error getting exam history:", error.message);
            throw error;
        }
    }

    /**
     * Get available exams for a user based on current time and exam status
     */
    async getAvailableExamsForCurrentTime(
        userId: string,
        userRole: string,
        programId?: string,
        academicSession?: string
    ): Promise<any[]> {
        try {
            const now = new Date();

            // First, update any exams that should transition based on time
            await this.updateExamStatusesByTime();

            // Then get available exams
            return await this.getAvailableExamsForUser(
                userId,
                userRole,
                programId,
                academicSession
            );
        } catch (error) {
            this.logger.error(
                "Error getting available exams for current time:",
                error.message
            );
            throw error;
        }
    }

    /**
     * Update exam statuses based on current time - run this periodically
     * Centralized status transition logic: scheduled -> in-progress -> completed
     */
    async updateExamStatusesByTime(): Promise<void> {
        try {
            const now = new Date();
            let transitionsCount = 0;

            this.logger.log("Starting exam status updates by time...");

            // Find all active exams that might need status updates
            const candidateExams = await this.examModel.find({
                status: { $in: ["scheduled", "in-progress"] },
                isActive: true,
            });

            for (const exam of candidateExams) {
                const examStart = new Date(exam.examTimestamp);
                const examEnd = new Date(
                    examStart.getTime() + exam.duration * 60 * 1000
                );
                let newStatus = exam.status;

                // Determine correct status based on time windows
                if (exam.status === "scheduled") {
                    if (now >= examStart && now <= examEnd) {
                        // Within exam window - should be in-progress
                        newStatus = "in-progress";
                        this.logger.log(
                            `Exam ${exam._id} (${exam.title}) scheduled -> in-progress (window started)`
                        );
                    } else if (now > examEnd) {
                        // Past exam window - completed (missed if no attempts exist)
                        newStatus = "completed";
                        this.logger.log(
                            `Exam ${exam._id} (${exam.title}) scheduled -> completed (window passed)`
                        );
                    }
                    // If now < examStart, stays scheduled
                } else if (exam.status === "in-progress") {
                    if (now > examEnd) {
                        // Exam time ended - should be completed
                        newStatus = "completed";
                        this.logger.log(
                            `Exam ${exam._id} (${exam.title}) in-progress -> completed (time ended)`
                        );
                    }
                    // If still within window, stays in-progress
                }

                // Update status if changed
                if (newStatus !== exam.status) {
                    await this.examModel.findByIdAndUpdate(exam._id, {
                        status: newStatus,
                        updatedAt: now,
                    });
                    transitionsCount++;
                    this.logger.log(
                        `Updated exam ${exam._id} status: ${exam.status} -> ${newStatus}`
                    );
                }
            }

            // Auto-submit expired exam attempts
            await this.autoSubmitExpiredAttempts();

            this.logger.log(
                `Exam status update completed: ${transitionsCount} transitions made`
            );
        } catch (error) {
            this.logger.error("Error updating exam statuses by time:", error.message);
            throw error;
        }
    }

    /**
     * Regenerate password for an exam (only allowed for draft, scheduled, or in-progress exams)
     */
    async regenerateExamPassword(
        examId: string,
        userId: string,
        sendEmails: boolean = true
    ): Promise<{ success: boolean; password?: string; message?: string }> {
        try {
            const exam = await this.examModel.findById(examId);
            if (!exam) {
                throw new NotFoundException("Exam not found");
            }

            // Check if exam status allows password regeneration
            const allowedStatuses = ["draft", "scheduled", "in-progress"];
            if (!allowedStatuses.includes(exam.status)) {
                return {
                    success: false,
                    message: `Password regeneration is not allowed for exams with status: ${exam.status}. Only draft, scheduled, or in-progress exams can have their passwords regenerated.`,
                };
            }

            // Find existing password document for this exam
            const existingPassword = await this.passwordModel.findOne({
                examId: new Types.ObjectId(examId),
            });

            // Generate a new password
            const plainPassword = this.generateRandomPassword(6);
            const hashedPassword = await bcrypt.hash(plainPassword, 10);

            // Calculate expiry time (exactly at exam end time)
            const examStartTime = new Date(exam.examTimestamp);
            const expiryTime = new Date(
                examStartTime.getTime() + exam.duration * 60 * 1000
            );

            if (existingPassword) {
                // Update existing password document
                await this.passwordModel.findByIdAndUpdate(existingPassword._id, {
                    hashedPassword: hashedPassword,
                    label: `Regenerated for ${exam.title}`,
                    usageCount: 0,
                    expiresAt: expiryTime,
                    isActive: true,
                    usedBy: [],
                    updatedAt: new Date(),
                });
                this.logger.log(
                    `Updated existing password document ${existingPassword._id} for exam ${examId}`
                );
            } else {
                // Create new password document if none exists
                const passwordDoc = new this.passwordModel({
                    examId: new Types.ObjectId(examId),
                    hashedPassword: hashedPassword,
                    label: `Regenerated for ${exam.title}`,
                    usageCount: 0,
                    usageLimit: null,
                    expiresAt: expiryTime,
                    isActive: true,
                    createdBy: new Types.ObjectId(userId),
                    usedBy: [],
                });
                await passwordDoc.save();
                this.logger.log(`Created new password document for exam ${examId}`);
            }

            this.logger.log(
                `Password regenerated for exam ${examId} by user ${userId}`
            );

            // Send emails to target users with the new password (only if sendEmails is true)
            if (sendEmails) {
                try {
                    const targetUsers = await this.getTargetAudienceUsers(examId);
                    if (targetUsers && targetUsers.length > 0) {
                        const emailPromises = targetUsers.map((user) =>
                            this.emailService
                                .sendExamPasswordEmail(
                                    user.email,
                                    user.firstName || user.email,
                                    exam.title,
                                    plainPassword,
                                    new Date(exam.examTimestamp),
                                    true // isRegenerated = true for manual regeneration
                                )
                                .catch((emailError) => {
                                    this.logger.error(
                                        `Failed to send regenerated password email to ${user.email}:`,
                                        emailError.message
                                    );
                                    return null; // Don't fail the entire operation for individual email failures
                                })
                        );

                        await Promise.allSettled(emailPromises);
                        this.logger.log(
                            `Regenerated password emails sent to ${targetUsers.length} users for exam ${examId}`
                        );
                    } else {
                        this.logger.warn(
                            `No target audience found for exam ${examId}, skipping email notification`
                        );
                    }
                } catch (emailError) {
                    this.logger.error(
                        `Failed to send regenerated password emails for exam ${examId}:`,
                        emailError.message
                    );
                    // Don't fail the password regeneration because of email errors
                }
            } else {
                this.logger.log(
                    `Email sending skipped for password regeneration of exam ${examId} (sendEmails=false)`
                );
            }

            return {
                success: true,
                password: plainPassword,
                message: "Password regenerated successfully",
            };
        } catch (error) {
            this.logger.error(
                `Error regenerating password for exam ${examId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Get target audience emails for an exam based on target configuration
     */
    async getTargetAudienceEmails(examId: string): Promise<string[]> {
        try {
            const exam = await this.examModel
                .findById(examId)
                .populate("academicSession");
            if (!exam) {
                throw new NotFoundException("Exam not found");
            }

            let emails: string[] = [];
            const { target } = exam;

            // Ensure target.filter exists
            if (!target.filter) {
                this.logger.warn(
                    `Exam ${examId} has no target.filter defined, using default empty filter`
                );
                target.filter = {};
            }

            // Use injected user model

            switch (target.type) {
                case "applicants":
                    // Get applicants based on program filters
                    const applicantQuery: any = { role: "applicant", isActive: true };

                    if (target.filter.programs && target.filter.programs.length > 0) {
                        // Get applications for specific programs
                        const applications = await this.applicationModel
                            .find({ programId: { $in: target.filter.programs } })
                            .populate("userId", "email")
                            .select("userId");

                        emails = applications
                            .filter((app) => app.userId && (app.userId as any).email)
                            .map((app) => (app.userId as any).email);
                    } else {
                        // Get all applicants
                        const applicants = await this.userModel
                            .find(applicantQuery)
                            .select("email");
                        emails = applicants.map((user) => user.email);
                    }
                    break;

                case "students":
                    // Get students based on program and department filters
                    const studentQuery: any = { role: "student", isActive: true };

                    if (target.filter.programs && target.filter.programs.length > 0) {
                        studentQuery.programId = { $in: target.filter.programs };
                    }
                    if (
                        target.filter.departments &&
                        target.filter.departments.length > 0
                    ) {
                        studentQuery.departmentId = { $in: target.filter.departments };
                    }

                    const students = await this.userModel
                        .find(studentQuery)
                        .select("email");
                    emails = students.map((user) => user.email);
                    break;

                case "staff":
                    // Get staff based on department and role filters
                    const staffQuery: any = {
                        role: { $in: ["admin", "staff", "instructor"] },
                        isActive: true,
                    };

                    if (
                        target.filter.departments &&
                        target.filter.departments.length > 0
                    ) {
                        staffQuery.departmentId = { $in: target.filter.departments };
                    }
                    if (target.filter.roles && target.filter.roles.length > 0) {
                        staffQuery.role = { $in: target.filter.roles };
                    }

                    const staff = await this.userModel.find(staffQuery).select("email");
                    emails = staff.map((user) => user.email);
                    break;

                case "custom":
                    // For custom targeting, combine all filters
                    const customQuery: any = { isActive: true };
                    const orConditions: any[] = [];

                    if (target.filter.programs && target.filter.programs.length > 0) {
                        orConditions.push({
                            role: "student",
                            programId: { $in: target.filter.programs },
                        });
                        // Also include applicants for these programs
                        const applications = await this.applicationModel
                            .find({ programId: { $in: target.filter.programs } })
                            .populate("userId", "email")
                            .select("userId");
                        emails.push(
                            ...applications
                                .filter((app) => app.userId && (app.userId as any).email)
                                .map((app) => (app.userId as any).email)
                        );
                    }

                    if (
                        target.filter.departments &&
                        target.filter.departments.length > 0
                    ) {
                        orConditions.push({
                            departmentId: { $in: target.filter.departments },
                        });
                    }

                    if (target.filter.roles && target.filter.roles.length > 0) {
                        orConditions.push({ role: { $in: target.filter.roles } });
                    }

                    if (orConditions.length > 0) {
                        customQuery.$or = orConditions;
                        const users = await this.userModel
                            .find(customQuery)
                            .select("email");
                        emails.push(...users.map((user) => user.email));
                    }
                    break;

                default:
                    this.logger.warn(`Unknown target type: ${target.type}`);
                    break;
            }

            // Remove duplicates and filter out invalid emails
            emails = [...new Set(emails)].filter(
                (email) => email && email.includes("@")
            );

            this.logger.log(
                `Found ${emails.length} email addresses for exam ${examId} target audience`
            );
            return emails;
        } catch (error) {
            this.logger.error(
                `Error getting target audience emails for exam ${examId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Get target audience users with email and firstName for password emails
     */
    async getTargetAudienceUsers(
        examId: string
    ): Promise<{ email: string; firstName: string }[]> {
        try {
            const exam = await this.examModel
                .findById(examId)
                .populate("academicSession");
            if (!exam) {
                throw new NotFoundException("Exam not found");
            }

            let users: { email: string; firstName: string }[] = [];
            const { target } = exam;

            // Ensure target.filter exists
            if (!target.filter) {
                this.logger.warn(
                    `Exam ${examId} has no target.filter defined, using default empty filter`
                );
                target.filter = {};
            }

            switch (target.type) {
                case "applicants":
                    const applicantQuery: any = { role: "applicant", isActive: true };

                    if (target.filter.programs && target.filter.programs.length > 0) {
                        const applications = await this.applicationModel
                            .find({ programId: { $in: target.filter.programs } })
                            .populate("userId", "email firstName")
                            .select("userId");

                        users = applications
                            .filter((app) => app.userId && (app.userId as any).email)
                            .map((app) => ({
                                email: (app.userId as any).email,
                                firstName: (app.userId as any).firstName || "User",
                            }));
                    } else {
                        const applicants = await this.userModel
                            .find(applicantQuery)
                            .select("email firstName");
                        users = applicants.map((user) => ({
                            email: user.email,
                            firstName: user.firstName || "User",
                        }));
                    }
                    break;

                case "students":
                    const studentQuery: any = { role: "student", isActive: true };

                    if (target.filter.programs && target.filter.programs.length > 0) {
                        studentQuery.programId = { $in: target.filter.programs };
                    }
                    if (
                        target.filter.departments &&
                        target.filter.departments.length > 0
                    ) {
                        studentQuery.departmentId = { $in: target.filter.departments };
                    }

                    const students = await this.userModel
                        .find(studentQuery)
                        .select("email firstName");
                    users = students.map((user) => ({
                        email: user.email,
                        firstName: user.firstName || "User",
                    }));
                    break;

                case "staff":
                    const staffQuery: any = {
                        role: { $in: ["admin", "staff", "instructor"] },
                        isActive: true,
                    };

                    if (
                        target.filter.departments &&
                        target.filter.departments.length > 0
                    ) {
                        staffQuery.departmentId = { $in: target.filter.departments };
                    }
                    if (target.filter.roles && target.filter.roles.length > 0) {
                        staffQuery.role = { $in: target.filter.roles };
                    }

                    const staff = await this.userModel
                        .find(staffQuery)
                        .select("email firstName");
                    users = staff.map((user) => ({
                        email: user.email,
                        firstName: user.firstName || "User",
                    }));
                    break;

                case "custom":
                    const customQuery: any = { isActive: true };
                    const orConditions: any[] = [];

                    if (target.filter.programs && target.filter.programs.length > 0) {
                        orConditions.push({ programId: { $in: target.filter.programs } });

                        const applications = await this.applicationModel
                            .find({ programId: { $in: target.filter.programs } })
                            .populate("userId", "email firstName")
                            .select("userId");
                        users.push(
                            ...applications
                                .filter((app) => app.userId && (app.userId as any).email)
                                .map((app) => ({
                                    email: (app.userId as any).email,
                                    firstName: (app.userId as any).firstName || "User",
                                }))
                        );
                    }

                    if (
                        target.filter.departments &&
                        target.filter.departments.length > 0
                    ) {
                        orConditions.push({
                            departmentId: { $in: target.filter.departments },
                        });
                    }

                    if (target.filter.roles && target.filter.roles.length > 0) {
                        orConditions.push({ role: { $in: target.filter.roles } });
                    }

                    if (orConditions.length > 0) {
                        customQuery.$or = orConditions;
                        const customUsers = await this.userModel
                            .find(customQuery)
                            .select("email firstName");
                        users.push(
                            ...customUsers.map((user) => ({
                                email: user.email,
                                firstName: user.firstName || "User",
                            }))
                        );
                    }
                    break;

                default:
                    this.logger.warn(
                        `Unknown target type: ${target.type} for exam ${examId}`
                    );
                    break;
            }

            // Remove duplicates based on email
            const uniqueUsers = users.reduce((acc, user) => {
                if (
                    user.email &&
                    user.email.includes("@") &&
                    !acc.some((u) => u.email === user.email)
                ) {
                    acc.push(user);
                }
                return acc;
            }, [] as { email: string; firstName: string }[]);

            this.logger.log(
                `Found ${uniqueUsers.length} users for exam ${examId} password emails`
            );
            return uniqueUsers;
        } catch (error) {
            this.logger.error(
                `Error getting target audience users for exam ${examId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Send scheduled exam notifications to target audience
     */
    private async sendExamScheduledNotifications(examId: string): Promise<void> {
        try {
            const exam = await this.examModel
                .findById(examId)
                .populate("academicSession");
            if (!exam) {
                throw new NotFoundException("Exam not found");
            }

            const emails = await this.getTargetAudienceEmails(examId);

            if (emails.length > 0) {
                // Send emails in background using bulk email service
                this.emailService
                    .sendBulkEmails(
                        emails,
                        this.emailService.sendExamScheduledEmail,
                        "Student", // This will be replaced per user in bulk send - we need to enhance this
                        exam.title,
                        exam.examTimestamp,
                        exam.duration,
                        exam.target.type
                    )
                    .catch((error) => {
                        this.logger.error(
                            "Failed to send exam scheduled emails:",
                            error.message
                        );
                    });

                this.logger.log(
                    `Initiated exam scheduled notifications for ${emails.length} recipients`
                );
            }
        } catch (error) {
            this.logger.error(
                `Error sending exam scheduled notifications for exam ${examId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Schedule reminder jobs for an exam
     */
    private async scheduleExamReminders(examId: string): Promise<void> {
        try {
            await this.queueService.queueExamSchedulingJob(examId);
            this.logger.log(`Queued reminder scheduling job for exam ${examId}`);
        } catch (error) {
            this.logger.error(
                `Error scheduling reminders for exam ${examId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Auto-submit exam attempts that have expired
     */
    private async autoSubmitExpiredAttempts(): Promise<void> {
        try {
            const now = new Date();
            this.logger.log(`Checking for expired attempts at ${now.toISOString()}`);

            // Find all in-progress attempts where the exam time has ended
            const expiredAttempts = await this.attemptModel.aggregate([
                {
                    $lookup: {
                        from: "exams",
                        localField: "examId",
                        foreignField: "_id",
                        as: "exam",
                    },
                },
                {
                    $unwind: "$exam",
                },
                {
                    $addFields: {
                        examEndTime: {
                            $add: [
                                "$exam.examTimestamp",
                                { $multiply: ["$exam.duration", 60 * 1000] },
                            ],
                        },
                    },
                },
                {
                    $match: {
                        status: "in-progress",
                        $expr: {
                            $lt: ["$examEndTime", now],
                        },
                    },
                },
            ]);

            this.logger.log(`Found ${expiredAttempts.length} expired attempts to auto-submit`);

            for (const attempt of expiredAttempts) {
                try {
                    const examStartTime = new Date(attempt.exam.examTimestamp);
                    const examEndTime = new Date(attempt.examEndTime);
                    const userStartTime = new Date(attempt.startedAt);

                    this.logger.log(`Auto-submitting attempt ${attempt._id}:`, {
                        examScheduledStart: examStartTime.toISOString(),
                        examScheduledEnd: examEndTime.toISOString(),
                        userStartedAt: userStartTime.toISOString(),
                        currentTime: now.toISOString(),
                        durationMinutes: attempt.exam.duration,
                        examTitle: attempt.exam.title
                    });

                    // Auto-submit the attempt
                    await this.attemptModel.findByIdAndUpdate(attempt._id, {
                        status: "auto-submitted",
                        submittedAt: now,
                        autoSubmitted: true,
                    });

                    // Don't create result here - let the grading service handle it
                    // This ensures consistent result creation logic between manual and auto submissions

                    // Get exam details for grading
                    const exam = await this.examModel.findById(attempt.examId);
                    if (!exam) {
                        this.logger.error(`Exam not found for auto-submitted attempt ${attempt._id}`);
                        continue;
                    }

                    // Handle grading based on exam's grading mode
                    if (exam.gradingMode === "auto") {
                        // Queue automatic grading immediately
                        this.logger.log(`Queueing automatic grading for auto-submitted attempt ${attempt._id}`);
                        await this.queueGradingAsync(attempt._id.toString(), attempt.examId.toString(), attempt.userId.toString());
                    } else {
                        this.logger.log(`Auto-submitted attempt ${attempt._id} requires ${exam.gradingMode} grading - awaiting staff action`);
                    }

                    // Send completion email for auto-submitted attempt
                    try {
                        const user = await this.userModel.findById(attempt.userId);
                        if (user && attempt.exam) {
                            this.emailService
                                .sendExamCompletionEmail(
                                    user.email,
                                    user.firstName || "Student",
                                    attempt.exam.title,
                                    now,
                                    undefined, // score - will be available after grading
                                    undefined, // totalMarks - will be available after grading
                                    true // isAutoSubmitted
                                )
                                .catch((error) => {
                                    this.logger.error(
                                        "Failed to send auto-submission completion email:",
                                        error.message
                                    );
                                });
                        }
                    } catch (emailError) {
                        this.logger.error(
                            "Error sending auto-submission completion email:",
                            emailError.message
                        );
                    }

                    this.logger.log(
                        `Successfully auto-submitted expired attempt ${attempt._id} for exam ${attempt.examId}`
                    );
                } catch (attemptError) {
                    this.logger.error(
                        `Error auto-submitting attempt ${attempt._id}:`,
                        attemptError.message
                    );
                }
            }

            if (expiredAttempts.length > 0) {
                this.logger.log(
                    `Auto-submitted ${expiredAttempts.length} expired exam attempts`
                );
            }
        } catch (error) {
            this.logger.error(
                "Error auto-submitting expired attempts:",
                error.message
            );
        }
    }

    /**
     * Send scheduled exam reminder emails manually (for staff portal)
     */
    async sendScheduledExamNotification(
        examId: string,
        requestingUserId: string
    ): Promise<{
        emailsSent: number;
        recipientCount: number;
        errors?: string[];
    }> {
        try {
            const exam = await this.examModel.findById(examId);
            if (!exam) {
                throw new Error("Exam not found");
            }

            // Only send reminders for scheduled exams
            if (exam.status !== "scheduled") {
                throw new Error(
                    `Cannot send exam reminders for exam with status: ${exam.status}`
                );
            }

            // Get target audience users using the existing method
            const targetUsers = await this.getTargetAudienceUsers(examId);

            if (!targetUsers || targetUsers.length === 0) {
                return {
                    emailsSent: 0,
                    recipientCount: 0,
                    errors: ["No target users found for the specified audience"],
                };
            }

            this.logger.log(
                `Manually sending exam reminder emails for ${exam.title} to ${targetUsers.length} users`
            );

            // Send reminder emails to all target users (no password included)
            const emailPromises = targetUsers.map((user) =>
                this.emailService
                    .sendExamScheduledEmail(
                        user.email,
                        user.firstName || user.email,
                        exam.title,
                        new Date(exam.examTimestamp),
                        exam.duration,
                        exam.target.type
                    )
                    .catch((error) => {
                        this.logger.error(
                            `Failed to send reminder email to ${user.email}:`,
                            error.message
                        );
                        return {
                            error: `Failed to send to ${user.email}: ${error.message}`,
                        };
                    })
            );

            const results = await Promise.allSettled(emailPromises);
            const errors: string[] = [];
            let emailsSent = 0;

            results.forEach((result, index) => {
                if (result.status === "fulfilled") {
                    if (result.value && result.value.error) {
                        errors.push(result.value.error);
                    } else {
                        emailsSent++;
                    }
                } else {
                    errors.push(
                        `Failed to send to ${targetUsers[index].email}: ${result.reason}`
                    );
                }
            });

            this.logger.log(
                `Exam reminder emails sent: ${emailsSent}/${targetUsers.length} emails sent successfully`
            );

            return {
                emailsSent,
                recipientCount: targetUsers.length,
                errors: errors.length > 0 ? errors : undefined,
            };
        } catch (error) {
            this.logger.error(
                `Error in sendScheduledExamNotification for exam ${examId}:`,
                error.message
            );
            throw error;
        }
    }

    /**
     * Get detailed exam result information for PDF generation
     */
    async getExamResultDetails(resultId: string, userId: string, userRole: string): Promise<any> {
        try {
            this.logger.log(`Getting exam result details for resultId: ${resultId}, userId: ${userId}, role: ${userRole}`);

            // Get the exam result with populated data
            const result = await this.resultModel
                .findById(resultId)
                .populate('userId', 'firstName lastName email')
                .populate('examId', 'title description duration')
                .populate('attemptId', 'submittedAt startedAt')
                .lean();

            if (!result) {
                throw new NotFoundException('Exam result not found');
            }

            // Check permissions - staff/admin can view any result, students can only view their own
            if (userRole === 'student' || userRole === 'applicant') {
                if (result.userId._id.toString() !== userId) {
                    throw new ForbiddenException('Access denied to this exam result');
                }
            }

            // Return the populated result with necessary data
            return {
                _id: result._id,
                user: result.userId,
                exam: result.examId,
                attempt: result.attemptId,
                score: result.correctAnswers, // Use correctAnswers as score for display
                totalScore: result.totalScore,
                totalQuestions: result.totalQuestions,
                percentage: result.percentage,
                status: result.status,
                gradedAt: result.gradedAt,
                createdAt: (result as any).createdAt,
                updatedAt: (result as any).updatedAt
            };
        } catch (error) {
            this.logger.error(`Error getting exam result details for ${resultId}:`, error.message);
            throw error;
        }
    }
}

import { Controller, Post, Delete, UseGuards, Request, Param, Body, UseInterceptors, UploadedFile, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ExamService } from '../services/exam.service';
import { Logger } from '@nestjs/common';

@ApiTags('questions')
@Controller('questions')
@UseGuards(AuthGuard('jwt'), ThrottlerGuard, RolesGuard)
export class QuestionController {
    private readonly logger = new Logger(QuestionController.name);

    constructor(
        private examService: ExamService,
    ) { }

    @Delete(':questionId')
    @Roles('staff', 'admin')
    @ApiOperation({ summary: 'Delete a question' })
    @ApiResponse({ status: 200, description: 'Question deleted successfully' })
    async deleteQuestion(
        @Param('questionId') questionId: string,
        @Request() req
    ): Promise<any> {
        try {
            const { userId, role } = req.user;
            await this.examService.deleteQuestion(questionId, userId, role);

            return {
                success: true,
                message: 'Question deleted successfully'
            };
        } catch (error) {
            this.logger.error(`Error deleting question ${questionId}:`, error.message);
            throw new HttpException(
                error.message || 'Failed to delete question',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('bulk-import')
    @Roles('staff', 'admin')
    @UseInterceptors(
        FileInterceptor('file', {
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB limit
            },
        })
    )
    @ApiOperation({ summary: 'Import questions from file' })
    @ApiResponse({ status: 200, description: 'Questions imported successfully' })
    async bulkImportQuestions(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: any,
        @Request() req
    ): Promise<any> {
        try {
            if (!file) {
                throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
            }

            const { examId, format } = body;
            const { userId } = req.user;

            // Map MIME type to format if not provided
            const mimeToFormat = {
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
                'text/csv': 'csv',
                'application/pdf': 'pdf'
            };

            const actualFormat = format || mimeToFormat[file.mimetype];

            if (!actualFormat) {
                throw new HttpException('Invalid file format', HttpStatus.BAD_REQUEST);
            }

            // Process synchronously instead of using queue
            const importResult = await this.examService.processBulkImport({
                examId,
                uploadedBy: userId,
                format: actualFormat,
                filename: file.originalname,
                fileBuffer: file.buffer
            });

            return {
                success: true,
                message: 'Questions imported successfully',
                result: importResult
            };
        } catch (error) {
            this.logger.error('Error processing bulk import:', error.message);
            throw new HttpException(
                error.message || 'Failed to import questions',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('bulk-import-preview')
    @Roles('staff', 'admin')
    @UseInterceptors(
        FileInterceptor('file', {
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB limit
            },
        })
    )
    @ApiOperation({ summary: 'Preview questions from file before importing' })
    @ApiResponse({ status: 200, description: 'Questions preview generated successfully' })
    async bulkImportPreview(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: any,
        @Request() req
    ): Promise<any> {
        try {
            if (!file) {
                throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
            }

            const { format } = body;

            // Map MIME type to format if not provided
            const mimeToFormat = {
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
                'text/csv': 'csv',
                'application/pdf': 'pdf'
            };

            const actualFormat = format || mimeToFormat[file.mimetype];

            if (!actualFormat) {
                throw new HttpException('Invalid file format', HttpStatus.BAD_REQUEST);
            }

            // Parse file for preview
            const previewResult = await this.examService.parseBulkImportPreview({
                format: actualFormat,
                filename: file.originalname,
                fileBuffer: file.buffer
            });

            return {
                success: true,
                message: 'Questions preview generated successfully',
                preview: previewResult
            };
        } catch (error) {
            this.logger.error('Error generating bulk import preview:', error.message);
            throw new HttpException(
                error.message || 'Failed to generate preview',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('bulk-import-save')
    @Roles('staff', 'admin')
    @ApiOperation({ summary: 'Save previewed questions to database' })
    @ApiResponse({ status: 200, description: 'Questions saved successfully' })
    async saveBulkImportQuestions(
        @Body() body: any,
        @Request() req
    ): Promise<any> {
        try {
            const { examId, questions } = body;
            const { userId } = req.user;

            if (!examId || !questions || !Array.isArray(questions)) {
                throw new HttpException('Invalid request data', HttpStatus.BAD_REQUEST);
            }

            // Save the questions
            const saveResult = await this.examService.saveBulkImportQuestions({
                examId,
                uploadedBy: userId,
                questions
            });

            return {
                success: true,
                message: 'Questions saved successfully',
                result: saveResult
            };
        } catch (error) {
            this.logger.error('Error saving bulk import questions:', error.message);
            throw new HttpException(
                error.message || 'Failed to save questions',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
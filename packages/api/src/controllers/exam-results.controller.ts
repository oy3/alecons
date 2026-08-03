import {
    Controller,
    Get,
    Param,
    UseGuards,
    Request,
    HttpException,
    HttpStatus,
    Res,
    Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ExamService } from '../services/exam.service';
import { Response } from 'express';
import * as puppeteer from 'puppeteer';

@ApiTags('Exam Results')
@Controller('exam-results')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExamResultsController {
    private readonly logger = new Logger(ExamResultsController.name);

    constructor(private readonly examService: ExamService) { }

    @Get(':resultId/download-pdf')
    @Roles('admin', 'staff')
    @ApiOperation({ summary: 'Download exam result as PDF (Admin/Staff only)' })
    @ApiResponse({ status: 200, description: 'PDF generated successfully' })
    async downloadResultPDF(
        @Param('resultId') resultId: string,
        @Request() req: any,
        @Res() res: Response
    ): Promise<void> {
        try {
            this.logger.log(`Generating PDF for exam result: ${resultId}`);

            // Get the exam result details
            const result = await this.examService.getExamResultDetails(resultId, req.user.id, req.user.role);

            if (!result) {
                throw new HttpException('Exam result not found', HttpStatus.NOT_FOUND);
            }

            // Generate HTML content for the PDF
            const htmlContent = this.generateResultHTML(result);

            // Generate PDF using Puppeteer
            let browser;
            try {
                this.logger.log('Launching Puppeteer browser...');
                browser = await puppeteer.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });

                const page = await browser.newPage();
                await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

                this.logger.log('Generating PDF...');
                const buffer = await page.pdf({
                    format: 'A4',
                    margin: {
                        top: '0.5in',
                        right: '0.5in',
                        bottom: '0.5in',
                        left: '0.5in'
                    },
                    printBackground: true
                });

                this.logger.log(`PDF generated successfully. Buffer size: ${buffer.length} bytes`);

                // Set response headers
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="exam-result-${resultId}.pdf"`);
                res.setHeader('Content-Length', buffer.length);

                // Send the PDF
                res.send(buffer);

            } finally {
                if (browser) {
                    await browser.close();
                }
            }

        } catch (error) {
            this.logger.error(`Error downloading PDF for result ${resultId}:`, error.message);
            if (!res.headersSent) {
                res.status(error.status || HttpStatus.INTERNAL_SERVER_ERROR).json({
                    message: error.message || 'Failed to download exam result PDF'
                });
            }
        }
    }

    private generateResultHTML(result: any): string {
        const studentName = result.user ?
            `${result.user.firstName || ''} ${result.user.lastName || ''}`.trim() ||
            result.user.email || 'Unknown Student' : 'Unknown Student';

        const examTitle = result.exam?.title || 'Unknown Exam';
        const score = result.score ?? result.totalScore ?? 0;
        const maxScore = result.maxScore ?? result.totalQuestions ?? 0;
        const percentage = result.percentage || 0;
        const status = result.status || 'Unknown';
        const gradedAt = result.gradedAt ? new Date(result.gradedAt).toLocaleString() : 'Not available';
        const submittedAt = result.attempt?.submittedAt ? new Date(result.attempt.submittedAt).toLocaleString() : 'Not available';

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Exam Result - ${studentName}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #ffffff;
                    line-height: 1.6;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #007bff;
                    padding-bottom: 20px;
                }
                .logo {
                    font-size: 24px;
                    font-weight: bold;
                    color: #007bff;
                    margin-bottom: 5px;
                }
                .subtitle {
                    color: #666;
                    font-size: 14px;
                }
                .result-container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: #f8f9fa;
                    padding: 30px;
                    border-radius: 8px;
                    border: 1px solid #dee2e6;
                }
                .result-title {
                    font-size: 20px;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 25px;
                    color: #333;
                }
                .info-row {
                    margin-bottom: 12px;
                    padding: 8px 0;
                    border-bottom: 1px solid #e9ecef;
                }
                .info-label {
                    font-weight: bold;
                    color: #495057;
                    display: inline-block;
                    width: 150px;
                }
                .info-value {
                    color: #212529;
                }
                .score-section {
                    background: #ffffff;
                    padding: 20px;
                    border-radius: 6px;
                    margin: 20px 0;
                    text-align: center;
                    border: 2px solid ${status === 'pass' ? '#28a745' : '#dc3545'};
                }
                .score-display {
                    font-size: 36px;
                    font-weight: bold;
                    color: ${status === 'pass' ? '#28a745' : '#dc3545'};
                    margin-bottom: 10px;
                }
                .status-badge {
                    display: inline-block;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-weight: bold;
                    text-transform: uppercase;
                    background-color: ${status === 'pass' ? '#28a745' : '#dc3545'};
                    color: white;
                    font-size: 14px;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #6c757d;
                    border-top: 1px solid #dee2e6;
                    padding-top: 15px;
                }
                .generated-at {
                    margin-top: 10px;
                    font-style: italic;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo">ALECONS - Exam Result</div>
                <div class="subtitle">Official Exam Result Certificate</div>
            </div>

            <div class="result-container">
                <div class="result-title">Examination Result</div>

                <div class="info-row">
                    <span class="info-label">Student Name:</span>
                    <span class="info-value">${studentName}</span>
                </div>

                <div class="info-row">
                    <span class="info-label">Exam Title:</span>
                    <span class="info-value">${examTitle}</span>
                </div>

                <div class="info-row">
                    <span class="info-label">Submitted At:</span>
                    <span class="info-value">${submittedAt}</span>
                </div>

                <div class="info-row">
                    <span class="info-label">Graded At:</span>
                    <span class="info-value">${gradedAt}</span>
                </div>

                <div class="score-section">
                    <div class="score-display">${score}/${maxScore}</div>
                    <div style="font-size: 18px; margin-bottom: 15px;">${percentage}%</div>
                    <div class="status-badge">${status}</div>
                </div>

            </div>

            <div class="footer">
                <div>This is an official exam result generated by ALECONS Examination System</div>
                <div class="generated-at">Generated on: ${new Date().toLocaleString()}</div>
            </div>
        </body>
        </html>
        `;
    }
}
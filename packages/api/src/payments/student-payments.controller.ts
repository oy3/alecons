import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, HttpException, HttpStatus, Logger, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';

@ApiTags('Student Portal Payments')
@Controller('student/payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StudentPaymentsController {
    private readonly logger = new Logger(StudentPaymentsController.name);

    constructor(private readonly paymentsService: PaymentsService) { }

    @Get('summary')
    @ApiOperation({ summary: 'Get student payment summary with academic session filter' })
    @ApiResponse({ status: 200, description: 'Payment summary retrieved successfully' })
    async getStudentPaymentsSummary(
        @Request() req,
        @Query('academicSessionId') academicSessionId?: string
    ) {
        try {
            const userId = req.user._id.toString();
            this.logger.log(`Getting payment summary for student ${userId} with academic session: ${academicSessionId}`);

            const summary = await this.paymentsService.getStudentPaymentsSummaryWithSession(
                userId,
                academicSessionId
            );

            return {
                success: true,
                data: summary
            };
        } catch (error) {
            this.logger.error('Error getting student payments summary:', error);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to fetch payment summary',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('history')
    @ApiOperation({ summary: 'Get student payment history by academic session' })
    @ApiResponse({ status: 200, description: 'Payment history retrieved successfully' })
    async getPaymentHistory(
        @Request() req,
        @Query('academicSessionId') academicSessionId?: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10
    ) {
        try {
            const userId = req.user._id.toString();
            this.logger.log(`Getting payment history for student ${userId}, session: ${academicSessionId}`);

            const history = await this.paymentsService.getStudentPaymentHistory(
                userId,
                academicSessionId,
                { page: Number(page), limit: Number(limit) }
            );

            return {
                success: true,
                data: history
            };
        } catch (error) {
            this.logger.error('Error getting payment history:', error);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to fetch payment history',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('initialize')
    @ApiOperation({ summary: 'Initialize payment for student with academic session' })
    @ApiResponse({ status: 200, description: 'Payment initialized successfully' })
    async initializePayment(
        @Request() req,
        @Body() body: {
            paymentId: string;
            email: string;
            academicSessionId?: string;
        }
    ) {
        try {
            const userId = req.user._id.toString();
            this.logger.log(`Initializing payment for student ${userId}:`, body);

            const result = await this.paymentsService.initializeStudentPayment(
                userId,
                body.paymentId,
                body.email,
                body.academicSessionId
            );

            return {
                success: true,
                data: result
            };
        } catch (error) {
            this.logger.error('Error initializing payment:', error);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to initialize payment',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post('manual-transfer/submit')
    @UseInterceptors(FileInterceptor('file'))
    @ApiOperation({ summary: 'Submit manual transfer receipt for student payment' })
    async submitManualTransfer(
        @Request() req,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: {
            paymentId: string;
            academicSessionId?: string;
        },
    ) {
        try {
            const userId = req.user._id.toString();
            const result = await this.paymentsService.submitManualTransferPayment(
                userId,
                body.paymentId,
                file,
                {
                    context: 'student-portal',
                    academicSessionId: body.academicSessionId,
                },
            );

            return {
                success: true,
                data: result,
                message: 'Manual transfer receipt submitted successfully',
            };
        } catch (error) {
            this.logger.error('Error submitting manual transfer payment:', error);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to submit manual transfer receipt',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('verify/:reference')
    @ApiOperation({ summary: 'Verify student payment' })
    @ApiResponse({ status: 200, description: 'Payment verified successfully' })
    async verifyPayment(@Param('reference') reference: string) {
        try {
            this.logger.log(`Verifying student payment with reference: ${reference}`);

            const result = await this.paymentsService.verifyPayment(reference);

            return {
                success: true,
                data: result
            };
        } catch (error) {
            this.logger.error('Error verifying payment:', error);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to verify payment',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('available')
    @ApiOperation({ summary: 'Get available payments for student by academic session' })
    @ApiResponse({ status: 200, description: 'Available payments retrieved successfully' })
    async getAvailablePayments(
        @Request() req,
        @Query('academicSessionId') academicSessionId?: string
    ) {
        try {
            const userId = req.user._id.toString();
            this.logger.log(`Getting available payments for student ${userId}, session: ${academicSessionId}`);

            const payments = await this.paymentsService.getAvailableStudentPayments(
                userId,
                academicSessionId
            );

            return {
                success: true,
                data: payments
            };
        } catch (error) {
            this.logger.error('Error getting available payments:', error);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to fetch available payments',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
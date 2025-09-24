import { Controller, Get, Post, Body, Param, Request, UseGuards, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(private readonly paymentsService: PaymentsService) { }

    @Get('summary')
    async getStudentPaymentsSummary(@Request() req) {
        try {
            const userId = req.user._id.toString(); // User ID from authenticated user
            const summary = await this.paymentsService.getStudentPaymentsSummary(userId);

            return {
                success: true,
                data: summary
            };
        } catch (error) {
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

    @Post('initialize')
    async initializePayment(
        @Request() req,
        @Body() body: { paymentId: string; email: string }
    ) {
        try {
            this.logger.log('Initialize payment request:', {
                userId: req.user?._id,
                body: body,
                user: req.user
            });

            const userId = req.user._id.toString();
            const result = await this.paymentsService.initializePayment(
                userId,
                body.paymentId,
                body.email
            );

            return {
                success: true,
                data: result
            };
        } catch (error) {
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

    @Post('verify/:reference')
    async verifyPayment(@Param('reference') reference: string) {
        try {
            const result = await this.paymentsService.verifyPayment(reference);

            return {
                success: true,
                data: result
            };
        } catch (error) {
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
}

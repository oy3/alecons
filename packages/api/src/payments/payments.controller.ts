import { Controller, Get, Post, Body, Param, Request, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Get('summary')
    async getStudentPaymentsSummary(@Request() req) {
        try {
            const userId = req.user.sub; // User ID from JWT token
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
        @Body() body: { paymentId: string; amount: number }
    ) {
        try {
            const userId = req.user.sub;
            const result = await this.paymentsService.initializePayment(
                userId,
                body.paymentId,
                body.amount
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

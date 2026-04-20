import { Controller, Get, Post, Body, Param, Request, UseGuards, HttpException, HttpStatus, Logger, Put, Delete, Query, Patch, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentDestinationChannelType, PaymentDestinationProviderType } from '../schemas/payment-destination-account.schema';
import { PaymentAudience } from '../schemas/payment.schema';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(private readonly paymentsService: PaymentsService) { }

    @Get('summary')
    async getStudentPaymentsSummary(@Request() req, @Query('context') context?: 'application-portal' | 'student-portal') {
        try {
            const userId = req.user._id.toString(); // User ID from authenticated user
            const paymentContext = context || 'application-portal'; // Default to application portal
            const summary = await this.paymentsService.getStudentPaymentsSummary(userId, paymentContext);

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

    @Post('manual-transfer/submit')
    @UseInterceptors(FileInterceptor('file'))
    async submitManualTransfer(
        @Request() req,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { paymentId: string },
    ) {
        try {
            const userId = req.user._id.toString();
            const result = await this.paymentsService.submitManualTransferPayment(
                userId,
                body.paymentId,
                file,
                { context: 'application-portal' },
            );

            return {
                success: true,
                data: result,
                message: 'Manual transfer receipt submitted successfully',
            };
        } catch (error) {
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
    @ApiOperation({ summary: 'Verify application portal payment' })
    @ApiResponse({ status: 200, description: 'Payment verified successfully' })
    async verifyPayment(@Param('reference') reference: string) {
        try {
            this.logger.log(`Verifying payment with reference: ${reference}`);

            const result = await this.paymentsService.verifyPayment(reference);

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error('Error verifying payment:', error);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to verify payment',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

// DTOs for payment management
export interface CreatePaymentDto {
    name: string;
    description?: string;
    amount: number;
    category?: string;
    isActive?: boolean;
    paymentCode: string; // Now required since it's manually input
    targetAudience?: PaymentAudience[];
    paystackDestinationAccountId?: string;
    manualTransferDestinationAccountId?: string;
}

export interface UpdatePaymentDto {
    name?: string;
    description?: string;
    amount?: number;
    category?: string;
    isActive?: boolean;
    paymentCode?: string;
    targetAudience?: PaymentAudience[];
    paystackDestinationAccountId?: string | null;
    manualTransferDestinationAccountId?: string | null;
}

export interface CreateDestinationAccountDto {
    title: string;
    code: string;
    channelType: PaymentDestinationChannelType;
    providerType: PaymentDestinationProviderType;
    isDefault?: boolean;
    active?: boolean;
    accountName?: string;
    bankName?: string;
    accountNumber?: string;
    currency?: string;
    paystackSubaccountCode?: string;
    paystackChargeBearer?: string;
    transactionCharge?: number;
    note?: string;
}

export interface UpdateDestinationAccountDto extends Partial<CreateDestinationAccountDto> { }

export interface ManualPaymentReviewDto {
    remarks?: string;
}

// Staff Payment Management Controller
@ApiTags('Staff Payment Management')
@Controller('staff/payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StaffPaymentsController {
    private readonly logger = new Logger(StaffPaymentsController.name);

    constructor(private readonly paymentsService: PaymentsService) { }

    @Get()
    @ApiOperation({ summary: 'Get all payments with filters and pagination' })
    @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
    async getPayments(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('search') search?: string,
        @Query('active') active?: boolean,
        @Query('sortBy') sortBy: string = 'createdAt',
        @Query('sortOrder') sortOrder: string = 'desc'
    ) {
        try {
            this.logger.log('Getting payments with filters:', {
                page,
                limit,
                search,
                active,
                sortBy,
                sortOrder
            });

            const result = await this.paymentsService.getPaymentsForManagement({
                page: Number(page),
                limit: Number(limit),
                search,
                active: active !== undefined ? Boolean(active) : undefined,
                sortBy,
                sortOrder
            });

            return {
                success: true,
                data: result
            };
        } catch (error) {
            this.logger.error('Error getting payments:', error);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to fetch payments',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('destination-accounts')
    @ApiOperation({ summary: 'Get all payment destination accounts' })
    async getDestinationAccounts() {
        try {
            const accounts = await this.paymentsService.getDestinationAccounts();
            return {
                success: true,
                data: accounts,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to fetch destination accounts',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('destination-accounts')
    @ApiOperation({ summary: 'Create payment destination account' })
    async createDestinationAccount(@Body() createDto: CreateDestinationAccountDto) {
        try {
            const account = await this.paymentsService.createDestinationAccount(createDto);
            return {
                success: true,
                message: 'Destination account created successfully',
                data: account,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to create destination account',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Put('destination-accounts/:id')
    @ApiOperation({ summary: 'Update payment destination account' })
    async updateDestinationAccount(
        @Param('id') id: string,
        @Body() updateDto: UpdateDestinationAccountDto,
    ) {
        try {
            const account = await this.paymentsService.updateDestinationAccount(id, updateDto);
            return {
                success: true,
                message: 'Destination account updated successfully',
                data: account,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to update destination account',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Delete('destination-accounts/:id')
    @ApiOperation({ summary: 'Delete payment destination account' })
    async deleteDestinationAccount(@Param('id') id: string) {
        try {
            const deleted = await this.paymentsService.deleteDestinationAccount(id);
            if (!deleted) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Destination account not found',
                    },
                    HttpStatus.NOT_FOUND,
                );
            }

            return {
                success: true,
                message: 'Destination account deleted successfully',
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to delete destination account',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post()
    @ApiOperation({ summary: 'Create new payment' })
    @ApiResponse({ status: 201, description: 'Payment created successfully' })
    async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
        try {
            this.logger.log('Creating payment:', createPaymentDto);

            const payment = await this.paymentsService.createPayment(createPaymentDto);

            return {
                success: true,
                message: 'Payment created successfully',
                data: payment
            };
        } catch (error) {
            this.logger.error('Error creating payment:', error);

            if (error.code === 11000) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'A payment with this name already exists'
                    },
                    HttpStatus.CONFLICT
                );
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to create payment',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update payment' })
    @ApiResponse({ status: 200, description: 'Payment updated successfully' })
    async updatePayment(
        @Param('id') id: string,
        @Body() updatePaymentDto: UpdatePaymentDto
    ) {
        try {
            this.logger.log('Updating payment:', { id, ...updatePaymentDto });

            const payment = await this.paymentsService.updatePayment(id, updatePaymentDto);

            if (!payment) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Payment not found'
                    },
                    HttpStatus.NOT_FOUND
                );
            }

            return {
                success: true,
                message: 'Payment updated successfully',
                data: payment
            };
        } catch (error) {
            this.logger.error('Error updating payment:', error);

            if (error instanceof HttpException) {
                throw error;
            }

            if (error.code === 11000) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'A payment with this name already exists'
                    },
                    HttpStatus.CONFLICT
                );
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to update payment',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/toggle-status')
    @ApiOperation({ summary: 'Toggle payment active status' })
    @ApiResponse({ status: 200, description: 'Payment status toggled successfully' })
    async togglePaymentStatus(@Param('id') id: string) {
        try {
            this.logger.log('Toggling payment status:', id);

            const payment = await this.paymentsService.togglePaymentStatus(id);

            if (!payment) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Payment not found'
                    },
                    HttpStatus.NOT_FOUND
                );
            }

            return {
                success: true,
                message: `Payment ${payment.isActive ? 'activated' : 'deactivated'} successfully`,
                data: payment
            };
        } catch (error) {
            this.logger.error('Error toggling payment status:', error);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to toggle payment status',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete payment' })
    @ApiResponse({ status: 200, description: 'Payment deleted successfully' })
    async deletePayment(@Param('id') id: string) {
        try {
            this.logger.log('Deleting payment:', id);

            const result = await this.paymentsService.deletePayment(id);

            if (!result) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Payment not found'
                    },
                    HttpStatus.NOT_FOUND
                );
            }

            return {
                success: true,
                message: 'Payment deleted successfully'
            };
        } catch (error) {
            this.logger.error('Error deleting payment:', error);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to delete payment',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('student-payments/stats')
    @ApiOperation({ summary: 'Get student payments statistics for dashboard' })
    @ApiResponse({ status: 200, description: 'Student payments statistics retrieved successfully' })
    async getStudentPaymentsStats(
        @Query('academicSessionId') academicSessionId?: string,
        @Query('status') status?: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 1000
    ) {
        try {
            this.logger.log('Getting student payments stats with filters:', {
                academicSessionId,
                status,
                page,
                limit
            });

            const result = await this.paymentsService.getStudentPaymentsStats({
                academicSessionId,
                status: status as any,
                page: Number(page),
                limit: Number(limit)
            });

            return {
                success: true,
                data: result
            };
        } catch (error) {
            this.logger.error('Error getting student payments stats:', error);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to fetch student payments statistics',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('student-payments')
    @ApiOperation({ summary: 'Get student payment records for staff management' })
    @ApiResponse({ status: 200, description: 'Student payment records retrieved successfully' })
    async getStudentPayments(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('search') search?: string,
        @Query('date') date?: string,
        @Query('status') status?: string,
        @Query('paymentId') paymentId?: string,
        @Query('method') method?: string,
        @Query('programId') programId?: string,
        @Query('academicSessionId') academicSessionId?: string,
        @Query('sortBy') sortBy: string = 'paidAt',
        @Query('sortOrder') sortOrder: string = 'desc',
    ) {
        try {
            this.logger.log('Getting student payment records with filters:', {
                page,
                limit,
                search,
                date,
                status,
                paymentId,
                method,
                programId,
                academicSessionId,
                sortBy,
                sortOrder,
            });

            const result = await this.paymentsService.getStudentPaymentsForManagement({
                page: Number(page),
                limit: Number(limit),
                search,
                date,
                status: status as any,
                paymentId,
                method: method as any,
                programId,
                academicSessionId,
                sortBy,
                sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
            });

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error('Error getting student payment records:', error);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to fetch student payment records',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get payment by ID' })
    @ApiResponse({ status: 200, description: 'Payment retrieved successfully' })
    async getPayment(@Param('id') id: string) {
        try {
            this.logger.log('Getting payment by ID:', id);

            const payment = await this.paymentsService.getPaymentById(id);

            if (!payment) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Payment not found'
                    },
                    HttpStatus.NOT_FOUND
                );
            }

            return {
                success: true,
                data: payment
            };
        } catch (error) {
            this.logger.error('Error getting payment:', error);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to fetch payment',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch('student-payments/:id/verify-manual')
    @ApiOperation({ summary: 'Verify pending manual transfer payment' })
    async verifyManualTransferPayment(
        @Param('id') id: string,
        @Request() req,
        @Body() body: ManualPaymentReviewDto,
    ) {
        try {
            const result = await this.paymentsService.verifyManualTransferPayment(
                id,
                req.user.userId || req.user._id?.toString(),
                body?.remarks,
            );

            return {
                success: true,
                data: result,
                message: 'Manual transfer payment verified successfully',
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to verify manual transfer payment',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Patch('student-payments/:id/reject-manual')
    @ApiOperation({ summary: 'Reject pending manual transfer payment' })
    async rejectManualTransferPayment(
        @Param('id') id: string,
        @Request() req,
        @Body() body: ManualPaymentReviewDto,
    ) {
        try {
            const result = await this.paymentsService.rejectManualTransferPayment(
                id,
                req.user.userId || req.user._id?.toString(),
                body?.remarks,
            );

            return {
                success: true,
                data: result,
                message: 'Manual transfer payment rejected successfully',
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to reject manual transfer payment',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

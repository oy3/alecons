import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Request,
    Req,
    Headers,
    HttpCode,
    UseGuards,
    HttpException,
    HttpStatus,
    Logger,
    Put,
    Delete,
    Query,
    Patch,
    UploadedFile,
    UseInterceptors,
    Res,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { PaymentsService } from "./payments.service";
import { PaymentRemittanceService } from "./payment-remittance.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from "@nestjs/swagger";
import {
    PaymentDestinationChannelType,
    PaymentDestinationProviderType,
} from "../schemas/payment-destination-account.schema";
import { PaymentAudience } from "../schemas/payment.schema";
import { Response } from "express";

@Controller("payments")
@UseGuards(JwtAuthGuard)
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(private readonly paymentsService: PaymentsService) { }

    @Get("summary")
    async getStudentPaymentsSummary(
        @Request() req,
        @Query("context") context?: "application-portal" | "student-portal",
    ) {
        try {
            const userId = req.user._id.toString(); // User ID from authenticated user
            const paymentContext = context || "application-portal"; // Default to application portal
            const summary = await this.paymentsService.getStudentPaymentsSummary(
                userId,
                paymentContext,
            );

            return {
                success: true,
                data: summary,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to fetch payment summary",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post("initialize")
    async initializePayment(
        @Request() req,
        @Body() body: { paymentId: string; email: string },
    ) {
        try {
            this.logger.log("Initialize payment request:", {
                userId: req.user?._id,
                body: body,
                user: req.user,
            });

            const userId = req.user._id.toString();
            const result = await this.paymentsService.initializePayment(
                userId,
                body.paymentId,
                body.email,
            );

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to initialize payment",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post("manual-transfer/submit")
    @UseInterceptors(FileInterceptor("file"))
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
                { context: "application-portal" },
            );

            return {
                success: true,
                data: result,
                message: "Manual transfer receipt submitted successfully",
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to submit manual transfer receipt",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post("verify/:reference")
    @ApiOperation({ summary: "Verify application portal payment" })
    @ApiResponse({ status: 200, description: "Payment verified successfully" })
    async verifyPayment(@Param("reference") reference: string) {
        try {
            this.logger.log(`Verifying payment with reference: ${reference}`);

            const result = await this.paymentsService.verifyPayment(reference);

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error("Error verifying payment:", error);
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to verify payment",
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

@ApiTags("Paystack Webhooks")
@Controller("payments")
export class PaystackWebhookController {
    private readonly logger = new Logger(PaystackWebhookController.name);

    constructor(private readonly paymentsService: PaymentsService) { }

    @Post("webhook/paystack")
    @HttpCode(200)
    async handlePaystackWebhook(
        @Req() req: any,
        @Headers("x-paystack-signature") signature?: string,
    ) {
        try {
            const result = await this.paymentsService.processPaystackWebhook(
                signature,
                req?.rawBody,
                req?.body,
            );

            return {
                status: true,
                data: result,
            };
        } catch (error) {
            this.logger.error("Paystack webhook processing failed:", error?.message || error);
            throw new HttpException(
                {
                    status: false,
                    message: "Paystack webhook processing failed",
                    error: error.message,
                },
                HttpStatus.BAD_REQUEST,
            );
        }
    }
}

// Staff Payment Management Controller
@ApiTags("Staff Payment Management")
@Controller("staff/payments")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StaffPaymentsController {
    private readonly logger = new Logger(StaffPaymentsController.name);

    constructor(
        private readonly paymentsService: PaymentsService,
        private readonly paymentRemittanceService: PaymentRemittanceService,
    ) { }

    @Get()
    @ApiOperation({ summary: "Get all payments with filters and pagination" })
    @ApiResponse({ status: 200, description: "Payments retrieved successfully" })
    async getPayments(
        @Query("page") page: number = 1,
        @Query("limit") limit: number = 10,
        @Query("search") search?: string,
        @Query("active") active?: boolean,
        @Query("sortBy") sortBy: string = "createdAt",
        @Query("sortOrder") sortOrder: string = "desc",
    ) {
        try {
            this.logger.log("Getting payments with filters:", {
                page,
                limit,
                search,
                active,
                sortBy,
                sortOrder,
            });

            const result = await this.paymentsService.getPaymentsForManagement({
                page: Number(page),
                limit: Number(limit),
                search,
                active: active !== undefined ? Boolean(active) : undefined,
                sortBy,
                sortOrder,
            });

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error("Error getting payments:", error);
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to fetch payments",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get("destination-accounts")
    @ApiOperation({ summary: "Get all payment destination accounts" })
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
                    message: "Failed to fetch destination accounts",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post("destination-accounts")
    @ApiOperation({ summary: "Create payment destination account" })
    async createDestinationAccount(
        @Body() createDto: CreateDestinationAccountDto,
    ) {
        try {
            const account =
                await this.paymentsService.createDestinationAccount(createDto);
            return {
                success: true,
                message: "Destination account created successfully",
                data: account,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to create destination account",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Put("destination-accounts/:id")
    @ApiOperation({ summary: "Update payment destination account" })
    async updateDestinationAccount(
        @Param("id") id: string,
        @Body() updateDto: UpdateDestinationAccountDto,
    ) {
        try {
            const account = await this.paymentsService.updateDestinationAccount(
                id,
                updateDto,
            );
            return {
                success: true,
                message: "Destination account updated successfully",
                data: account,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to update destination account",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Delete("destination-accounts/:id")
    @ApiOperation({ summary: "Delete payment destination account" })
    async deleteDestinationAccount(@Param("id") id: string) {
        try {
            const deleted = await this.paymentsService.deleteDestinationAccount(id);
            if (!deleted) {
                throw new HttpException(
                    {
                        success: false,
                        message: "Destination account not found",
                    },
                    HttpStatus.NOT_FOUND,
                );
            }

            return {
                success: true,
                message: "Destination account deleted successfully",
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: "Failed to delete destination account",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post()
    @ApiOperation({ summary: "Create new payment" })
    @ApiResponse({ status: 201, description: "Payment created successfully" })
    async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
        try {
            this.logger.log("Creating payment:", createPaymentDto);

            const payment =
                await this.paymentsService.createPayment(createPaymentDto);

            return {
                success: true,
                message: "Payment created successfully",
                data: payment,
            };
        } catch (error) {
            this.logger.error("Error creating payment:", error);

            if (error.code === 11000) {
                throw new HttpException(
                    {
                        success: false,
                        message: "A payment with this name already exists",
                    },
                    HttpStatus.CONFLICT,
                );
            }

            throw new HttpException(
                {
                    success: false,
                    message: "Failed to create payment",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Put(":id")
    @ApiOperation({ summary: "Update payment" })
    @ApiResponse({ status: 200, description: "Payment updated successfully" })
    async updatePayment(
        @Param("id") id: string,
        @Body() updatePaymentDto: UpdatePaymentDto,
    ) {
        try {
            this.logger.log("Updating payment:", { id, ...updatePaymentDto });

            const payment = await this.paymentsService.updatePayment(
                id,
                updatePaymentDto,
            );

            if (!payment) {
                throw new HttpException(
                    {
                        success: false,
                        message: "Payment not found",
                    },
                    HttpStatus.NOT_FOUND,
                );
            }

            return {
                success: true,
                message: "Payment updated successfully",
                data: payment,
            };
        } catch (error) {
            this.logger.error("Error updating payment:", error);

            if (error instanceof HttpException) {
                throw error;
            }

            if (error.code === 11000) {
                throw new HttpException(
                    {
                        success: false,
                        message: "A payment with this name already exists",
                    },
                    HttpStatus.CONFLICT,
                );
            }

            throw new HttpException(
                {
                    success: false,
                    message: "Failed to update payment",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Patch(":id/toggle-status")
    @ApiOperation({ summary: "Toggle payment active status" })
    @ApiResponse({
        status: 200,
        description: "Payment status toggled successfully",
    })
    async togglePaymentStatus(@Param("id") id: string) {
        try {
            this.logger.log("Toggling payment status:", id);

            const payment = await this.paymentsService.togglePaymentStatus(id);

            if (!payment) {
                throw new HttpException(
                    {
                        success: false,
                        message: "Payment not found",
                    },
                    HttpStatus.NOT_FOUND,
                );
            }

            return {
                success: true,
                message: `Payment ${payment.isActive ? "activated" : "deactivated"} successfully`,
                data: payment,
            };
        } catch (error) {
            this.logger.error("Error toggling payment status:", error);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: "Failed to toggle payment status",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Delete(":id")
    @ApiOperation({ summary: "Delete payment" })
    @ApiResponse({ status: 200, description: "Payment deleted successfully" })
    async deletePayment(@Param("id") id: string) {
        try {
            this.logger.log("Deleting payment:", id);

            const result = await this.paymentsService.deletePayment(id);

            if (!result) {
                throw new HttpException(
                    {
                        success: false,
                        message: "Payment not found",
                    },
                    HttpStatus.NOT_FOUND,
                );
            }

            return {
                success: true,
                message: "Payment deleted successfully",
            };
        } catch (error) {
            this.logger.error("Error deleting payment:", error);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: "Failed to delete payment",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get("student-payments/stats")
    @ApiOperation({ summary: "Get student payments statistics for dashboard" })
    @ApiResponse({
        status: 200,
        description: "Student payments statistics retrieved successfully",
    })
    async getStudentPaymentsStats(
        @Query("academicSessionId") academicSessionId?: string,
    ) {
        try {
            this.logger.log("Getting student payments stats with filters:", {
                academicSessionId,
            });

            const result = await this.paymentsService.getStudentPaymentsStats({
                academicSessionId,
            });

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error("Error getting student payments stats:", error);
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to fetch student payments statistics",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post("remittance/sync")
    @ApiOperation({ summary: "Sync Paystack remittance state for successful student payments" })
    @ApiResponse({
        status: 200,
        description: "Remittance sync completed successfully",
    })
    async syncStudentPaymentRemittance(
        @Body() body: { academicSessionId?: string } = {},
    ) {
        try {
            this.logger.log("Syncing student payment remittance records", body);

            const result = await this.paymentRemittanceService.syncPaystackRemittance({
                academicSessionId: body.academicSessionId,
            });

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error("Error syncing student payment remittance records:", error);
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to sync remittance records",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get("remittance-records")
    @ApiOperation({ summary: "Get remittance records for successful Paystack student payments" })
    @ApiResponse({
        status: 200,
        description: "Remittance records retrieved successfully",
    })
    async getStudentPaymentRemittanceRecords(
        @Query("tab") tab?: "unremitted" | "remitted",
        @Query("academicSessionId") academicSessionId?: string,
        @Query("search") search?: string,
        @Query("dateFrom") dateFrom?: string,
        @Query("dateTo") dateTo?: string,
        @Query("page") page: number = 1,
        @Query("limit") limit: number = 10,
        @Query("sortBy") sortBy: string = "remittanceDate",
        @Query("sortOrder") sortOrder: string = "desc",
    ) {
        try {
            const result = await this.paymentRemittanceService.getRemittanceRecords({
                tab,
                academicSessionId,
                search,
                dateFrom,
                dateTo,
                page: Number(page),
                limit: Number(limit),
                sortBy,
                sortOrder: sortOrder === "asc" ? "asc" : "desc",
            });

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error("Error getting student payment remittance records:", error);
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to fetch remittance records",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get("student-payments")
    @ApiOperation({ summary: "Get student payment records for staff management" })
    @ApiResponse({
        status: 200,
        description: "Student payment records retrieved successfully",
    })
    async getStudentPayments(
        @Query("page") page: number = 1,
        @Query("limit") limit: number = 10,
        @Query("search") search?: string,
        @Query("dateFrom") dateFrom?: string,
        @Query("dateTo") dateTo?: string,
        @Query("status") status?: string,
        @Query("paymentId") paymentId?: string,
        @Query("method") method?: string,
        @Query("programId") programId?: string,
        @Query("academicSessionId") academicSessionId?: string,
        @Query("sortBy") sortBy: string = "paidAt",
        @Query("sortOrder") sortOrder: string = "desc",
    ) {
        try {
            this.logger.log("Getting student payment records with filters:", {
                page,
                limit,
                search,
                dateFrom,
                dateTo,
                status,
                paymentId,
                method,
                programId,
                academicSessionId,
                sortBy,
                sortOrder,
            });

            const result = await this.paymentsService.getStudentPaymentsForManagement(
                {
                    page: Number(page),
                    limit: Number(limit),
                    search,
                    dateFrom,
                    dateTo,
                    status: status as any,
                    paymentId,
                    method: method as any,
                    programId,
                    academicSessionId,
                    sortBy,
                    sortOrder: sortOrder === "asc" ? "asc" : "desc",
                },
            );

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error("Error getting student payment records:", error);
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to fetch student payment records",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get("student-payments/export-pdf")
    @ApiOperation({
        summary: "Export student payment records as PDF for staff management",
    })
    @ApiResponse({
        status: 200,
        description: "Student payment records PDF generated successfully",
    })
    async exportStudentPaymentsPdf(
        @Res() res: Response,
        @Query("search") search?: string,
        @Query("dateFrom") dateFrom?: string,
        @Query("dateTo") dateTo?: string,
        @Query("status") status?: string,
        @Query("paymentId") paymentId?: string,
        @Query("method") method?: string,
        @Query("programId") programId?: string,
        @Query("academicSessionId") academicSessionId?: string,
        @Query("sortBy") sortBy: string = "paidAt",
        @Query("sortOrder") sortOrder: string = "desc",
    ): Promise<void> {
        try {
            const resolvedSortOrder: "asc" | "desc" =
                sortOrder === "asc" ? "asc" : "desc";
            const exportFilters = {
                search,
                dateFrom,
                dateTo,
                status: status as any,
                paymentId,
                method: method as any,
                programId,
                academicSessionId,
                sortBy,
                sortOrder: resolvedSortOrder,
            };

            this.logger.log(
                "Exporting student payment records PDF with filters:",
                exportFilters,
            );

            const previewResult =
                await this.paymentsService.getStudentPaymentsForManagement({
                    ...exportFilters,
                    page: 1,
                    limit: 1,
                });

            const totalItems = previewResult?.pagination?.totalItems || 0;

            if (!totalItems) {
                throw new HttpException(
                    {
                        success: false,
                        message: "No student payment records match the selected filters",
                    },
                    HttpStatus.NOT_FOUND,
                );
            }

            const exportResult =
                await this.paymentsService.getStudentPaymentsForManagement({
                    ...exportFilters,
                    page: 1,
                    limit: totalItems,
                });

            const payments = exportResult?.payments || [];
            const htmlContent = this.generateStudentPaymentsExportHtml(
                payments,
                exportFilters,
            );

            let browser;

            try {
                this.logger.log(
                    "Launching Puppeteer browser for student payments PDF export...",
                );
                const { launchPuppeteerBrowser } =
                    await import("../utils/puppeteer-launch.util");
                browser = await launchPuppeteerBrowser();

                const page = await browser.newPage();
                await page.setContent(htmlContent, { waitUntil: "networkidle0" });

                const pdfBytes = await page.pdf({
                    format: "A4",
                    landscape: true,
                    margin: {
                        top: "0.45in",
                        right: "0.45in",
                        bottom: "0.45in",
                        left: "0.45in",
                    },
                    printBackground: true,
                });

                const pdfBuffer = Buffer.from(pdfBytes);
                const fileName = this.buildStudentPaymentsExportFileName();

                res.setHeader("Content-Type", "application/pdf");
                res.setHeader(
                    "Content-Disposition",
                    `attachment; filename="${fileName}"`,
                );
                res.setHeader("Content-Length", pdfBuffer.length.toString());
                res.send(pdfBuffer);
            } finally {
                if (browser) {
                    await browser.close();
                }
            }
        } catch (error) {
            this.logger.error(
                "Error exporting student payment records PDF:",
                error.message,
            );

            if (!res.headersSent) {
                const statusCode =
                    error instanceof HttpException
                        ? error.getStatus()
                        : HttpStatus.INTERNAL_SERVER_ERROR;
                const responseBody =
                    error instanceof HttpException
                        ? error.getResponse()
                        : {
                            success: false,
                            message: "Failed to export student payment records PDF",
                            error: error.message,
                        };

                res.status(statusCode).json(responseBody);
            }
        }
    }

    @Get(":id")
    @ApiOperation({ summary: "Get payment by ID" })
    @ApiResponse({ status: 200, description: "Payment retrieved successfully" })
    async getPayment(@Param("id") id: string) {
        try {
            this.logger.log("Getting payment by ID:", id);

            const payment = await this.paymentsService.getPaymentById(id);

            if (!payment) {
                throw new HttpException(
                    {
                        success: false,
                        message: "Payment not found",
                    },
                    HttpStatus.NOT_FOUND,
                );
            }

            return {
                success: true,
                data: payment,
            };
        } catch (error) {
            this.logger.error("Error getting payment:", error);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: "Failed to fetch payment",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Patch("student-payments/:id/verify-manual")
    @ApiOperation({ summary: "Verify pending manual transfer payment" })
    async verifyManualTransferPayment(
        @Param("id") id: string,
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
                message: "Manual transfer payment verified successfully",
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to verify manual transfer payment",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Patch("student-payments/:id/reject-manual")
    @ApiOperation({ summary: "Reject pending manual transfer payment" })
    async rejectManualTransferPayment(
        @Param("id") id: string,
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
                message: "Manual transfer payment rejected successfully",
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to reject manual transfer payment",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Patch("student-payments/:id/reconcile")
    @ApiOperation({ summary: "Reconcile a Paystack payment record against Paystack verify API" })
    async reconcileStudentPayment(@Param("id") id: string) {
        try {
            const result = await this.paymentsService.reconcileStudentPaymentById(id);

            return {
                success: true,
                data: result,
                message: "Payment reconciled successfully",
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to reconcile payment",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post("student-payments/reconcile-pending")
    @ApiOperation({ summary: "Reconcile stale pending Paystack records" })
    async reconcilePendingPaystackPayments(
        @Body()
        body: {
            olderThanMinutes?: number;
            batchSize?: number;
            hardTimeoutHours?: number;
        } = {},
    ) {
        try {
            const result = await this.paymentsService.reconcilePendingPaystackPayments({
                olderThanMinutes: body.olderThanMinutes,
                batchSize: body.batchSize,
                hardTimeoutHours: body.hardTimeoutHours,
            });

            return {
                success: true,
                data: result,
                message: "Pending Paystack reconciliation completed",
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to reconcile pending Paystack payments",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private buildStudentPaymentsExportFileName() {
        const dateStamp = new Date().toISOString().slice(0, 10);
        return `student-payments-${dateStamp}.pdf`;
    }

    private generateStudentPaymentsExportHtml(
        payments: any[],
        filters: {
            search?: string;
            dateFrom?: string;
            dateTo?: string;
            status?: string;
            paymentId?: string;
            method?: string;
            programId?: string;
            academicSessionId?: string;
        },
    ): string {
        const generatedAt = new Date().toLocaleString();
        const firstPayment = payments[0] || {};
        const filterSummary = [
            { label: "Search", value: filters.search?.trim() || "All Records" },
            {
                label: "Status",
                value: filters.status
                    ? this.formatStudentPaymentsExportLabel(filters.status)
                    : "All Statuses",
            },
            {
                label: "Method",
                value: filters.method
                    ? this.formatStudentPaymentsExportLabel(filters.method)
                    : "All Methods",
            },
            {
                label: "Payment Type",
                value: filters.paymentId
                    ? this.safeStudentPaymentsExportDisplay(firstPayment.paymentName)
                    : "All Payments",
            },
            {
                label: "Program",
                value: filters.programId
                    ? this.getStudentPaymentsExportProgramDisplay(firstPayment)
                    : "All Programs",
            },
            {
                label: "Academic Session",
                value: filters.academicSessionId
                    ? this.safeStudentPaymentsExportDisplay(
                        firstPayment.academicSessionLabel,
                    )
                    : "All Academic Sessions",
            },
            { label: "Date Range", value: this.getStudentPaymentsExportDateRangeLabel(filters) },
            { label: "Records", value: String(payments.length) },
        ];

        const filterSummaryHtml = filterSummary
            .map(
                (item) => `
                <div class="filter-item">
                    <span class="filter-label">${this.escapeStudentPaymentsExportHtml(item.label)}</span>
                    <span class="filter-value">${this.escapeStudentPaymentsExportHtml(item.value)}</span>
                </div>
            `,
            )
            .join("");

        const tableRowsHtml = payments
            .map((payment, index) => {
                const notes = [
                    `Remarks: ${this.safeStudentPaymentsExportDisplay(payment.remarks)}`,
                    `Verification: ${this.safeStudentPaymentsExportDisplay(payment.verificationRemarks)}`,
                ].join(" | ");

                return `
                    <tr>
          <td class="index-cell nowrap">${index + 1}</td>
                        <td>${this.escapeStudentPaymentsExportHtml(this.safeStudentPaymentsExportDisplay(payment.userName || "Unknown User"))}
                        </td>
            <td class="nowrap">${this.escapeStudentPaymentsExportHtml(this.getStudentPaymentsExportIdentifierValue(payment))}
                        </td>
                        <td>          ${this.escapeStudentPaymentsExportHtml(this.safeStudentPaymentsExportDisplay(payment.email))}</td>
                        <td>${this.escapeStudentPaymentsExportHtml(this.getStudentPaymentsExportProgramDisplay(payment))}</td>
            <td class="nowrap">${this.escapeStudentPaymentsExportHtml(this.safeStudentPaymentsExportDisplay(payment.academicSessionLabel))}</td>
                        <td>
                            <div class="primary">${this.escapeStudentPaymentsExportHtml(this.safeStudentPaymentsExportDisplay(payment.paymentName))}</div>
                            <div class="secondary">${this.escapeStudentPaymentsExportHtml(this.getStudentPaymentsExportReferenceDisplay(payment.reference))}</div>
                        </td>
                        <td class="nowrap">${this.escapeStudentPaymentsExportHtml(this.formatStudentPaymentsExportCurrency(payment.amount))}</td>
                            <td> 
                            <div class="primary">${this.escapeStudentPaymentsExportHtml(this.formatStudentPaymentsExportLabel(payment.method))}</div>
  <div class="secondary">Channel: ${this.safeStudentPaymentsExportDisplay(this.formatStudentPaymentsExportLabel(payment.channel))}</div>
                                          </td>
                        <td class="nowrap">${this.escapeStudentPaymentsExportHtml(this.formatStudentPaymentsExportLabel(payment.status))}</td>
                        <td>${this.escapeStudentPaymentsExportHtml(this.formatStudentPaymentsExportDateTime(payment.paidAt || payment.effectivePaidAt || payment.createdAt))}</td>
                        <td> ${this.escapeStudentPaymentsExportHtml(this.safeStudentPaymentsExportDisplay(payment.remarks))}</td>
                    </tr>
                `;
            })
            .join("");

        return `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <title>Student Payments Export</title>
                    <style>
                        @page {
                            size: A4 landscape;
                            margin: 12mm;
                        }
                        body {
                            font-family: Arial, sans-serif;
                            color: #0f172a;
                            margin: 0;
                            font-size: 11px;
                        }
                        h1 {
                            margin: 0 0 6px;
                            font-size: 24px;
                            color: #0f172a;
                        }
                        .subtitle {
                            color: #475569;
                            margin-bottom: 16px;
                            font-size: 12px;
                        }
                        .meta {
                            display: grid;
                            grid-template-columns: repeat(4, minmax(0, 1fr));
                            gap: 8px;
                            margin-bottom: 18px;
                        }
                        .filter-item {
                            border: 1px solid #cbd5e1;
                            border-radius: 8px;
                            padding: 8px 10px;
                            background: #f8fafc;
                        }
                        .filter-label {
                            display: block;
                            margin-bottom: 4px;
                            font-size: 9px;
                            font-weight: 700;
                            color: #64748b;
                            text-transform: uppercase;
                            letter-spacing: 0.4px;
                        }
                        .filter-value {
                            display: block;
                            font-size: 11px;
                            font-weight: 600;
                            color: #0f172a;
                        }
                        .col-index {
                          width: 4%;
                        }
                        .col-id {
                          width: 9%;
                        }
                        .col-session {
                          width: 8%;
                        }
                        .col-amount {
                          width: 8%;
                        }
                        .col-method {
                          width: 8%;
                        }
                        .col-status {
                          width: 7%;
                        }
                        .col-date {
                          width: 10%;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            table-layout: fixed;
                        }
                        th,
                        td {
                            border: 1px solid #cbd5e1;
                            padding: 8px;
                            vertical-align: top;
                            text-align: left;
                            word-break: break-word;
                        }
                        th {
                            background: #e2e8f0;
                            font-size: 9px;
                            text-transform: uppercase;
                            letter-spacing: 0.4px;
                        }
                        .primary {
                            font-weight: 700;
                            color: #0f172a;
                        }
                        .secondary {
                            color: #64748b;
                            font-size: 10px;
                            margin-top: 2px;
                        }
                        .nowrap {
                            white-space: nowrap;
                        }
                        .index-cell {
                          text-align: center;
                        }
                    </style>
                </head>
                <body>
                    <h1>Student Payments Export</h1>
                    <div class="subtitle">Generated ${this.escapeStudentPaymentsExportHtml(generatedAt)} • ${this.escapeStudentPaymentsExportHtml(String(payments.length))} filtered payment record(s)</div>
                    <div class="meta">${filterSummaryHtml}</div>
                    <table>
                        <colgroup>
                          <col class="col-index" />
                          <col />
                          <col class="col-id" />
                          <col />
                          <col />
                          <col class="col-session" />
                          <col />
                          <col class="col-amount" />
                          <col class="col-method" />
                          <col class="col-status" />
                          <col class="col-date" />
                          <col />
                        </colgroup>
                        <thead>
                            <tr>
                          <th class="index-cell nowrap">#</th>
                                <th>User</th>
                                <th>ID</th>
                                <th>Contact</th>
                                <th>Program</th>
                                <th>Session</th>
                                <th>Payment</th>
                                <th>Amount</th>
                                <th>Method</th>
                                <th>Status</th>
                                <th>Date Paid</th>
                                <th>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                </body>
            </html>
        `;
    }

    private getStudentPaymentsExportProgramDisplay(payment: any) {
        const parts = [
            payment?.programTypeLabel,
            payment?.programModeLabel,
            payment?.programName,
        ].filter((value) => value && value !== "N/A");

        return parts.length ? parts.join(" ") : "N/A";
    }

    private getStudentPaymentsExportIdentifierValue(payment: any) {
        return payment?.matriculationNumber || payment?.applicationNumber || "N/A";
    }

    private getStudentPaymentsExportReferenceDisplay(reference: any) {
        return reference || "N/A";
    }

    private getStudentPaymentsExportDateRangeLabel(filters: {
        dateFrom?: string;
        dateTo?: string;
    }) {
        if (filters.dateFrom && filters.dateTo) {
            return `${filters.dateFrom} to ${filters.dateTo}`;
        }

        if (filters.dateFrom) {
            return `From ${filters.dateFrom}`;
        }

        if (filters.dateTo) {
            return `Up to ${filters.dateTo}`;
        }

        return "All Dates";
    }

    private formatStudentPaymentsExportCurrency(amount: any) {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            minimumFractionDigits: 2,
        }).format(Number(amount || 0));
    }

    private formatStudentPaymentsExportDateTime(value: any) {
        if (!value) {
            return "N/A";
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
    }

    private formatStudentPaymentsExportLabel(value: any) {
        if (!value) {
            return "N/A";
        }

        return String(value)
            .replace(/_/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    private safeStudentPaymentsExportDisplay(value: any) {
        const normalized =
            value === null || value === undefined ? "" : String(value).trim();
        return normalized || "N/A";
    }

    private escapeStudentPaymentsExportHtml(value: any) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
}

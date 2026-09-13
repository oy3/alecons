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
    async getPaymentTransactionsSummary(
        @Request() req,
        @Query("context") context?: "application-portal" | "student-portal",
        @Query("applicationId") applicationId?: string,
    ) {
        try {
            const userId = req.user._id.toString(); // User ID from authenticated user
            const paymentContext = context || "application-portal"; // Default to application portal
            if (paymentContext === "application-portal" && !applicationId) {
                throw new HttpException("Application ID is required", HttpStatus.BAD_REQUEST);
            }
            const summary = await this.paymentsService.getPaymentTransactionsSummary(
                userId,
                paymentContext,
                applicationId,
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
        @Body() body: { paymentId: string; email: string; applicationId?: string },
    ) {
        try {
            this.logger.log("Initialize payment request:", {
                userId: req.user?._id,
                body: body,
                user: req.user,
            });

            const userId = req.user._id.toString();
            if (!body.applicationId) {
                throw new HttpException("Application ID is required", HttpStatus.BAD_REQUEST);
            }
            const result = await this.paymentsService.initializePayment(
                userId,
                body.paymentId,
                body.email,
                body.applicationId,
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
        @Body() body: { paymentId: string; applicationId?: string },
    ) {
        try {
            const userId = req.user._id.toString();
            if (!body.applicationId) {
                throw new HttpException("Application ID is required", HttpStatus.BAD_REQUEST);
            }
            const result = await this.paymentsService.submitManualTransferPayment(
                userId,
                body.paymentId,
                file,
                { context: "application-portal", applicationId: body.applicationId },
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

    @Get("payment-transactions/stats")
    @ApiOperation({ summary: "Get payment transactions statistics for dashboard" })
    @ApiResponse({
        status: 200,
        description: "Payment transaction statistics retrieved successfully",
    })
    async getPaymentTransactionsStats(
        @Query("academicSessionId") academicSessionId?: string,
    ) {
        try {
            this.logger.log("Getting payment transactions stats with filters:", {
                academicSessionId,
            });

            const result = await this.paymentsService.getPaymentTransactionsStats({
                academicSessionId,
            });

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error("Error getting payment transactions stats:", error);
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to fetch payment transactions statistics",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post("remittance/sync")
    @ApiOperation({ summary: "Sync Paystack remittance state for successful payment transactions" })
    @ApiResponse({
        status: 200,
        description: "Remittance sync completed successfully",
    })
    async syncPaymentTransactionRemittance(
        @Body() body: { academicSessionId?: string } = {},
    ) {
        try {
            this.logger.log("Syncing payment transaction remittance records", body);

            const result = await this.paymentRemittanceService.syncPaystackRemittance({
                academicSessionId: body.academicSessionId,
            });

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error("Error syncing payment transaction remittance records:", error);
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
    @ApiOperation({ summary: "Get remittance records for successful Paystack payment transactions" })
    @ApiResponse({
        status: 200,
        description: "Remittance records retrieved successfully",
    })
    async getPaymentTransactionRemittanceRecords(
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
            this.logger.error("Error getting payment transaction remittance records:", error);
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

    @Get("payment-transactions")
    @ApiOperation({ summary: "Get payment transactions for staff management" })
    @ApiResponse({
        status: 200,
        description: "Payment transactions retrieved successfully",
    })
    async getPaymentTransactions(
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
            this.logger.log("Getting payment transactions with filters:", {
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

            const result = await this.paymentsService.getPaymentTransactionsForManagement(
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
            this.logger.error("Error getting payment transactions:", error);
            throw new HttpException(
                {
                    success: false,
                    message: "Failed to fetch payment transactions",
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get("payment-transactions/:id/receipt")
    async getPaymentReceipt(@Request() req, @Param("id") id: string, @Res() res: Response) {
        const receipt = await this.paymentsService.getPaymentReceipt(id, req.user._id.toString(), req.user.role);
        res.setHeader("Content-Type", receipt.contentType);
        res.setHeader("Content-Disposition", `inline; filename="${receipt.filename.replace(/[\r\n"]/g, '')}"`);
        res.setHeader("Cache-Control", "private, no-store");
        return res.send(receipt.buffer);
    }

    @Get("payment-transactions/export-pdf")
    @ApiOperation({
        summary: "Export student payment records as PDF for staff management",
    })
    @ApiResponse({
        status: 200,
        description: "Student payment records PDF generated successfully",
    })
    async exportPaymentTransactionsPdf(
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
                await this.paymentsService.getPaymentTransactionsForManagement({
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
                await this.paymentsService.getPaymentTransactionsForManagement({
                    ...exportFilters,
                    page: 1,
                    limit: totalItems,
                });

            const payments = exportResult?.payments || [];
            const htmlContent = this.generatePaymentTransactionsExportHtml(
                payments,
                exportFilters,
            );

            let browser;

            try {
                this.logger.log(
                    "Launching Puppeteer browser for payment transactions PDF export...",
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
                const fileName = this.buildPaymentTransactionsExportFileName();

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

    @Patch("payment-transactions/:id/verify-manual")
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

    @Patch("payment-transactions/:id/reject-manual")
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

    @Patch("payment-transactions/:id/reconcile")
    @ApiOperation({ summary: "Reconcile a Paystack payment record against Paystack verify API" })
    async reconcilePaymentTransaction(@Param("id") id: string) {
        try {
            const result = await this.paymentsService.reconcilePaymentTransactionById(id);

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

    @Post("payment-transactions/reconcile-pending")
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

    private buildPaymentTransactionsExportFileName() {
        const dateStamp = new Date().toISOString().slice(0, 10);
        return `payment-transactions-${dateStamp}.pdf`;
    }

    private generatePaymentTransactionsExportHtml(
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
                    ? this.formatPaymentTransactionsExportLabel(filters.status)
                    : "All Statuses",
            },
            {
                label: "Method",
                value: filters.method
                    ? this.formatPaymentTransactionsExportLabel(filters.method)
                    : "All Methods",
            },
            {
                label: "Payment Type",
                value: filters.paymentId
                    ? this.safePaymentTransactionsExportDisplay(firstPayment.paymentName)
                    : "All Payments",
            },
            {
                label: "Program",
                value: filters.programId
                    ? this.getPaymentTransactionsExportProgramDisplay(firstPayment)
                    : "All Programs",
            },
            {
                label: "Academic Session",
                value: filters.academicSessionId
                    ? this.safePaymentTransactionsExportDisplay(
                        firstPayment.academicSessionLabel,
                    )
                    : "All Academic Sessions",
            },
            { label: "Date Range", value: this.getPaymentTransactionsExportDateRangeLabel(filters) },
            { label: "Records", value: String(payments.length) },
        ];

        const filterSummaryHtml = filterSummary
            .map(
                (item) => `
                <div class="filter-item">
                    <span class="filter-label">${this.escapePaymentTransactionsExportHtml(item.label)}</span>
                    <span class="filter-value">${this.escapePaymentTransactionsExportHtml(item.value)}</span>
                </div>
            `,
            )
            .join("");

        const tableRowsHtml = payments
            .map((payment, index) => {
                const notes = [
                    `Remarks: ${this.safePaymentTransactionsExportDisplay(payment.remarks)}`,
                    `Verification: ${this.safePaymentTransactionsExportDisplay(payment.verificationRemarks)}`,
                ].join(" | ");

                return `
                    <tr>
          <td class="index-cell nowrap">${index + 1}</td>
                        <td>${this.escapePaymentTransactionsExportHtml(this.safePaymentTransactionsExportDisplay(payment.userName || "Unknown User"))}
                        </td>
            <td class="nowrap">${this.escapePaymentTransactionsExportHtml(this.getPaymentTransactionsExportIdentifierValue(payment))}
                        </td>
                        <td>          ${this.escapePaymentTransactionsExportHtml(this.safePaymentTransactionsExportDisplay(payment.email))}</td>
                        <td>${this.escapePaymentTransactionsExportHtml(this.getPaymentTransactionsExportProgramDisplay(payment))}</td>
            <td class="nowrap">${this.escapePaymentTransactionsExportHtml(this.safePaymentTransactionsExportDisplay(payment.academicSessionLabel))}</td>
                        <td>
                            <div class="primary">${this.escapePaymentTransactionsExportHtml(this.safePaymentTransactionsExportDisplay(payment.paymentName))}</div>
                            <div class="secondary">${this.escapePaymentTransactionsExportHtml(this.getPaymentTransactionsExportReferenceDisplay(payment.reference))}</div>
                        </td>
                        <td class="nowrap">${this.escapePaymentTransactionsExportHtml(this.formatPaymentTransactionsExportCurrency(payment.amount))}</td>
                            <td> 
                            <div class="primary">${this.escapePaymentTransactionsExportHtml(this.formatPaymentTransactionsExportLabel(payment.method))}</div>
  <div class="secondary">Channel: ${this.safePaymentTransactionsExportDisplay(this.formatPaymentTransactionsExportLabel(payment.channel))}</div>
                                          </td>
                        <td class="nowrap">${this.escapePaymentTransactionsExportHtml(this.formatPaymentTransactionsExportLabel(payment.status))}</td>
                        <td>${this.escapePaymentTransactionsExportHtml(this.formatPaymentTransactionsExportDateTime(payment.paidAt || payment.effectivePaidAt || payment.createdAt))}</td>
                        <td> ${this.escapePaymentTransactionsExportHtml(this.safePaymentTransactionsExportDisplay(payment.remarks))}</td>
                    </tr>
                `;
            })
            .join("");

        return `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <title>Payment Transactions Export</title>
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
                    <h1>Payment Transactions Export</h1>
                    <div class="subtitle">Generated ${this.escapePaymentTransactionsExportHtml(generatedAt)} • ${this.escapePaymentTransactionsExportHtml(String(payments.length))} filtered payment record(s)</div>
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

    private getPaymentTransactionsExportProgramDisplay(payment: any) {
        const parts = [
            payment?.programTypeLabel,
            payment?.programModeLabel,
            payment?.programName,
        ].filter((value) => value && value !== "N/A");

        return parts.length ? parts.join(" ") : "N/A";
    }

    private getPaymentTransactionsExportIdentifierValue(payment: any) {
        return payment?.matriculationNumber || payment?.applicationNumber || "N/A";
    }

    private getPaymentTransactionsExportReferenceDisplay(reference: any) {
        return reference || "N/A";
    }

    private getPaymentTransactionsExportDateRangeLabel(filters: {
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

    private formatPaymentTransactionsExportCurrency(amount: any) {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            minimumFractionDigits: 2,
        }).format(Number(amount || 0));
    }

    private formatPaymentTransactionsExportDateTime(value: any) {
        if (!value) {
            return "N/A";
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
    }

    private formatPaymentTransactionsExportLabel(value: any) {
        if (!value) {
            return "N/A";
        }

        return String(value)
            .replace(/_/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    private safePaymentTransactionsExportDisplay(value: any) {
        const normalized =
            value === null || value === undefined ? "" : String(value).trim();
        return normalized || "N/A";
    }

    private escapePaymentTransactionsExportHtml(value: any) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
}

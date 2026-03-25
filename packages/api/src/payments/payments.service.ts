import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument, PaymentAudience } from '../schemas/payment.schema';
import { StudentPayment, StudentPaymentDocument, PaymentStatus } from '../schemas/student-payment.schema';
import { Application, ApplicationDocument, ApplicationStatus } from '../schemas/application.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { TenancyAgreement, TenancyAgreementDocument } from '../schemas/tenancy-agreement.schema';
import { MatriculationService } from '../services/matriculation.service';
import { EmailService } from '../services/email.service';

export interface PaymentSummary {
    id: string;
    name: string;
    description?: string;
    amount: number;
    isPaid: boolean;
    paymentCode: string; // Added to identify payment type
    paidAt?: Date;
    reference?: string;
    status?: PaymentStatus;
    channel?: string;
    fee?: number;
}

export interface StudentPaymentsSummary {
    paidFees: PaymentSummary[];
    unpaidFees: PaymentSummary[];
    totalPaid: number;
    totalUnpaid: number;
}

export interface StaffLinkedPaymentRecord {
    id: string;
    amount: number;
    reference: string;
    paidAt?: Date;
    channel?: string;
    fee?: number;
    status: PaymentStatus;
    remarks?: string;
    createdAt?: Date;
    updatedAt?: Date;
    isApplicationLinked: boolean;
    isAcademicSessionLinked: boolean;
    payment: {
        id?: string;
        name: string;
        description?: string;
        amount?: number;
        paymentCode?: string;
    };
    academicSession?: {
        id?: string;
        sessionYear?: string;
    };
}

export interface StaffLinkedPaymentsSummary {
    payments: StaffLinkedPaymentRecord[];
    totalCount: number;
    totalPaid: number;
    successfulCount: number;
    pendingCount: number;
    failedCount: number;
    cancelledCount: number;
}

export interface PaystackInitializeResponse {
    authorization_url: string;
    access_code: string;
    reference: string;
}

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    private readonly paystackBaseUrl = 'https://api.paystack.co';

    constructor(
        @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
        @InjectModel(StudentPayment.name) private studentPaymentModel: Model<StudentPaymentDocument>,
        @InjectModel(Application.name) private applicationModel: Model<ApplicationDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
        @InjectModel(TenancyAgreement.name) private tenancyAgreementModel: Model<TenancyAgreementDocument>,
        private matriculationService: MatriculationService,
        private emailService: EmailService,
    ) { }

    async getStudentPaymentsSummary(userId: string, context: 'application-portal' | 'student-portal' = 'application-portal'): Promise<StudentPaymentsSummary> {
        const userObjectId = new Types.ObjectId(userId);

        // Get user to determine their role
        const user = await this.userModel.findById(userObjectId).lean();
        if (!user) {
            throw new Error('User not found');
        }

        // Map UserRole to PaymentAudience based on context
        let userAudiences: PaymentAudience[];
        switch (user.role) {
            case UserRole.APPLICANT:
                // Applicants always see applicant payments
                userAudiences = [PaymentAudience.APPLICANT];
                break;
            case UserRole.STUDENT:
                if (context === 'application-portal') {
                    // In application portal, students see only their historical applicant payments
                    userAudiences = [PaymentAudience.APPLICANT];
                } else {
                    // In student portal, students see student payments
                    userAudiences = [PaymentAudience.STUDENT];
                }
                break;
            case UserRole.STAFF:
                userAudiences = [PaymentAudience.ACADEMIC_STAFF];
                break;
            case UserRole.ADMIN:
                userAudiences = [PaymentAudience.ADMIN_STAFF];
                break;
            default:
                userAudiences = [PaymentAudience.APPLICANT];
        }

        console.log('Payment audience logic:', {
            userId,
            userRole: user.role,
            context,
            selectedAudiences: userAudiences
        });

        // Get all active payments that target this user's audiences
        const allPayments = await this.paymentModel.find({
            active: true,
            targetAudience: { $in: userAudiences }
        }).lean();

        // Get student's successful payments
        const studentPayments = await this.studentPaymentModel
            .find({
                userId: userObjectId,
                status: PaymentStatus.SUCCESSFUL
            })
            .populate('paymentId')
            .lean();

        // Create a map of paid payment IDs for quick lookup
        const paidPaymentIds = new Set(
            studentPayments.map(sp => sp.paymentId._id.toString())
        );

        // Separate paid and unpaid fees
        const paidFees: PaymentSummary[] = [];
        const unpaidFees: PaymentSummary[] = [];

        allPayments.forEach(payment => {
            const paymentId = payment._id.toString();
            const studentPayment = studentPayments.find(sp =>
                sp.paymentId._id.toString() === paymentId
            );

            if (paidPaymentIds.has(paymentId) && studentPayment) {
                paidFees.push({
                    id: paymentId,
                    name: payment.name,
                    description: payment.description,
                    amount: payment.amount,
                    isPaid: true,
                    paymentCode: payment.paymentCode,
                    paidAt: studentPayment.paidAt,
                    reference: studentPayment.reference,
                    status: studentPayment.status,
                    channel: studentPayment.channel,
                    fee: studentPayment.fee
                });
            } else {
                unpaidFees.push({
                    id: paymentId,
                    name: payment.name,
                    description: payment.description,
                    amount: payment.amount,
                    isPaid: false,
                    paymentCode: payment.paymentCode
                });
            }
        });

        const totalPaid = paidFees.reduce((sum, fee) => sum + fee.amount, 0);
        const totalUnpaid = unpaidFees.reduce((sum, fee) => sum + fee.amount, 0);

        return {
            paidFees,
            unpaidFees,
            totalPaid,
            totalUnpaid
        };
    }

    async initializePayment(userId: string, paymentId: string, email: string): Promise<PaystackInitializeResponse> {
        try {
            this.logger.log('initializePayment called with:', { userId, paymentId, email });

            // Ensure paymentId is a valid ObjectId
            if (!Types.ObjectId.isValid(paymentId)) {
                this.logger.log('Invalid ObjectId format:', paymentId);
                throw new Error('Invalid payment ID format');
            }

            // Get payment details
            const payment = await this.paymentModel.findById(new Types.ObjectId(paymentId));
            this.logger.log('Payment found:', payment);

            if (!payment) {
                this.logger.log('Payment not found for ID:', paymentId);
                throw new Error('Payment not found');
            }

            // Check if student has already made a successful payment for this charge
            const existingSuccessfulPayment = await this.studentPaymentModel.findOne({
                userId: new Types.ObjectId(userId),
                paymentId: new Types.ObjectId(paymentId),
                status: PaymentStatus.SUCCESSFUL
            });

            if (existingSuccessfulPayment) {
                throw new Error('Payment has already been completed successfully for this charge');
            }

            // Look for any existing payment attempt (pending or failed) - reuse it
            let existingAttempt = await this.studentPaymentModel.findOne({
                userId: new Types.ObjectId(userId),
                paymentId: new Types.ObjectId(paymentId),
                status: { $in: [PaymentStatus.PENDING, PaymentStatus.FAILED] }
            }).sort({ createdAt: -1 }); // Get the most recent attempt

            let reference: string;
            let paystackData: any;

            if (existingAttempt) {
                this.logger.log('Found existing payment attempt:', {
                    status: existingAttempt.status,
                    reference: existingAttempt.reference,
                    createdAt: existingAttempt.createdAt
                });

                reference = existingAttempt.reference;

                // Check the actual status with Paystack first
                try {
                    const verifyResponse = await fetch(`${this.paystackBaseUrl}/transaction/verify/${reference}`, {
                        headers: {
                            'Authorization': `Bearer ${this.paystackSecretKey}`,
                        }
                    });
                    const verifyData = await verifyResponse.json();

                    if (verifyData.status) {
                        if (verifyData.data.status === 'success') {
                            // Payment was successful, update our record
                            existingAttempt.status = PaymentStatus.SUCCESSFUL;
                            existingAttempt.remarks = 'Payment successful and verified';
                            existingAttempt.paidAt = new Date();
                            existingAttempt.channel = verifyData.data.channel;
                            existingAttempt.gatewayId = verifyData.data.id;
                            existingAttempt.authorizationCode = verifyData.data.authorization?.authorization_code;
                            await existingAttempt.save();

                            throw new Error('Payment has already been completed successfully');
                        } else if (verifyData.data.status === 'abandoned' || verifyData.data.status === 'failed') {
                            // Payment was abandoned/failed, mark as failed
                            existingAttempt.status = PaymentStatus.FAILED;
                            existingAttempt.remarks = `Payment ${verifyData.data.status}: ${verifyData.data.gateway_response || 'User abandoned payment'}`;
                            await existingAttempt.save();
                            this.logger.log('Payment was marked as failed based on Paystack status');
                        }
                        // For pending status, we'll continue to reuse
                    }
                } catch (verifyError) {
                    this.logger.error('Error verifying existing payment:', verifyError.message);
                    // Continue with the existing reference anyway
                }

                // If it's a failed attempt, update status to pending for retry
                if (existingAttempt.status === PaymentStatus.FAILED) {
                    existingAttempt.status = PaymentStatus.PENDING;
                    existingAttempt.retryCount = (existingAttempt.retryCount || 0) + 1;
                    existingAttempt.remarks = `Payment retry attempt x${existingAttempt.retryCount} - awaiting user action`;
                    await existingAttempt.save();
                    this.logger.log(`Updated failed payment attempt to pending for retry #${existingAttempt.retryCount}`);
                } else if (existingAttempt.status === PaymentStatus.PENDING) {
                    // Update remarks to show it's being retried
                    existingAttempt.retryCount = (existingAttempt.retryCount || 0) + 1;
                    existingAttempt.remarks = `Payment re-initialized with new reference x${existingAttempt.retryCount} - awaiting user action`;
                    await existingAttempt.save();
                    this.logger.log(`Updated pending payment attempt remarks for retry #${existingAttempt.retryCount}`);
                }

                // For existing attempts, we need to create a NEW Paystack transaction with a NEW reference
                // because Paystack references are unique and cannot be reused
                const newReference = `alc${Date.now()}`;
                this.logger.log('Creating new Paystack transaction with new reference:', newReference);

                paystackData = await this.createPaystackTransaction(payment, email, newReference, userId, paymentId);

                // Update the existing record with the new reference
                existingAttempt.reference = newReference;
                existingAttempt.status = PaymentStatus.PENDING;
                existingAttempt.remarks = `Payment re-initialized with new reference x${existingAttempt.retryCount || 1} - awaiting user action`;
                await existingAttempt.save();

                return {
                    authorization_url: paystackData.data.authorization_url,
                    access_code: paystackData.data.access_code,
                    reference: newReference
                };
            } else {
                // No existing attempt found, create new payment attempt
                reference = `alc${Date.now()}`;
                paystackData = await this.createPaystackTransaction(payment, email, reference, userId, paymentId);

                // Create new payment attempt record
                await this.studentPaymentModel.create({
                    userId: new Types.ObjectId(userId),
                    paymentId: new Types.ObjectId(paymentId),
                    amount: payment.amount,
                    reference,
                    status: PaymentStatus.PENDING,
                    remarks: 'Payment initialized - awaiting user action',
                    retryCount: 0
                });

                return {
                    authorization_url: paystackData.data.authorization_url,
                    access_code: paystackData.data.access_code,
                    reference
                };
            }
        } catch (error) {
            this.logger.error('Error in initializePayment:', error);
            throw error;
        }
    }

    private async createPaystackTransaction(payment: any, email: string, reference: string, userId: string, paymentId: string) {
        this.logger.log('Creating new Paystack transaction:', {
            paymentId,
            amount: payment.amount,
            amountInKobo: payment.amount * 100,
            email,
            reference
        });

        // Initialize Paystack transaction
        const response = await fetch(`${this.paystackBaseUrl}/transaction/initialize`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.paystackSecretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                amount: payment.amount * 100, // Convert from Naira to kobo (Paystack requires kobo)
                reference,
                metadata: {
                    userId,
                    paymentId,
                    paymentName: payment.name
                }
            })
        });

        const data = await response.json();

        this.logger.log('Paystack response:', data);

        if (!data.status) {
            throw new Error(data.message || 'Failed to initialize payment');
        }

        return data;
    }

    private async updatePaymentStatus(studentPayment: any, transactionData: any) {
        studentPayment.status = PaymentStatus.SUCCESSFUL;
        studentPayment.remarks = 'Payment successful and verified';
        studentPayment.paidAt = new Date();
        studentPayment.channel = transactionData.channel;
        studentPayment.gatewayId = transactionData.id;
        studentPayment.authorizationCode = transactionData.authorization?.authorization_code;
        await studentPayment.save();
    } async verifyPayment(reference: string): Promise<any> {
        // Verify with Paystack
        const response = await fetch(`${this.paystackBaseUrl}/transaction/verify/${reference}`, {
            headers: {
                'Authorization': `Bearer ${this.paystackSecretKey}`,
            }
        });

        const data = await response.json();

        if (!data.status) {
            throw new Error(data.message || 'Failed to verify payment');
        }

        const transaction = data.data;

        // Find the student payment record
        const studentPayment = await this.studentPaymentModel.findOne({ reference });
        if (!studentPayment) {
            throw new Error('Payment record not found');
        }

        // Update payment status based on Paystack response
        if (transaction.status === 'success') {
            studentPayment.status = PaymentStatus.SUCCESSFUL;
            studentPayment.remarks = 'Payment successful and verified';
            studentPayment.paidAt = new Date();
            studentPayment.channel = transaction.channel;
            studentPayment.fee = transaction.fees ? (transaction.fees / 100) : 0; // Convert from kobo to naira
            studentPayment.gatewayId = transaction.id;
            studentPayment.authorizationCode = transaction.authorization?.authorization_code;

            await studentPayment.save();

            // Update application stage after successful payment
            await this.updateApplicationStageAfterPayment(studentPayment.userId, studentPayment.paymentId);

        } else {
            studentPayment.status = PaymentStatus.FAILED;
            studentPayment.remarks = `Payment failed: ${transaction.gateway_response}`;
            await studentPayment.save();
        }

        return {
            status: transaction.status,
            reference: transaction.reference,
            amount: transaction.amount,
            channel: transaction.channel,
            paid_at: transaction.paid_at,
            gateway_response: transaction.gateway_response
        };
    }

    /**
     * Update application stage after successful payment
     */
    private async updateApplicationStageAfterPayment(userId: Types.ObjectId, paymentId: Types.ObjectId): Promise<void> {
        try {
            // Get payment details to determine what stage to advance to
            const payment = await this.paymentModel.findById(paymentId);
            if (!payment) {
                this.logger.log('Payment not found for stage progression');
                return;
            }

            // Get user's application
            const application = await this.applicationModel.findOne({ userId });
            if (!application) {
                this.logger.log('Application not found for user:', userId);
                return;
            }

            // Map payment codes to next stages
            // Based on the payment code, determine what stage to advance to
            const stageProgressions: { [key: string]: number } = {
                'formFee': 3,          // Form fee payment (stage 2) -> Application form (stage 3)
                'acceptanceFee': 8,      // Acceptance fee payment (stage 7) -> Sundry fees (stage 8)
                'sundryFee': 9,          // Sundry fee payment (stage 8) -> School fees (stage 9)
                'schoolFee': 10          // School fee payment (stage 9) -> Completed (stage 10)
            };

            const nextStage = stageProgressions[payment.paymentCode];

            if (nextStage && nextStage > application.currentStage) {
                application.currentStage = nextStage;
                await application.save();

                this.logger.log(`Advanced application stage to ${nextStage} after ${payment.paymentCode} payment for user ${userId}`);

                // If this is the final payment (school fee), trigger application completion
                if (payment.paymentCode === 'schoolFee' && nextStage === 10) {
                    await this.completeApplicationProcess(userId, application);
                }
            } else {
                this.logger.log(`No stage progression needed for payment ${payment.paymentCode}, current stage: ${application.currentStage}`);
            }

        } catch (error) {
            this.logger.error('Error updating application stage after payment:', error);
            // Don't throw error here to avoid affecting payment verification
        }
    }

    /**
     * Mark old pending payments as failed (can be called periodically)
     */
    async markAbandonedPaymentsAsFailed(): Promise<void> {
        const thirtyMinutesAgo = new Date(Date.now() - (30 * 60 * 1000));

        const result = await this.studentPaymentModel.updateMany(
            {
                status: PaymentStatus.PENDING,
                createdAt: { $lt: thirtyMinutesAgo }
            },
            {
                $set: {
                    status: PaymentStatus.FAILED,
                    remarks: 'Payment timed out - user did not complete payment within 30 minutes'
                }
            }
        );

        this.logger.log(`Marked ${result.modifiedCount} abandoned payments as failed`);
    }

    /**
     * Manually advance application stage (for admin use or application form completion)
     */
    async advanceApplicationStage(userId: string, targetStage: number): Promise<void> {
        try {
            const application = await this.applicationModel.findOne({
                userId: new Types.ObjectId(userId)
            });

            if (!application) {
                throw new Error('Application not found');
            }

            if (targetStage > application.currentStage) {
                application.currentStage = targetStage;
                await application.save();
                this.logger.log(`Manually advanced application stage to ${targetStage} for user ${userId}`);
            }
        } catch (error) {
            this.logger.error('Error advancing application stage:', error);
            throw error;
        }
    }

    /**
     * Complete application process by generating matriculation number and creating student record
     */
    private async completeApplicationProcess(userId: Types.ObjectId, application: any): Promise<void> {
        try {
            this.logger.log('Starting application completion process for user:', userId);

            // Get user details for email
            const user = await this.userModel.findById(userId);
            if (!user) {
                throw new Error('User not found for application completion');
            }

            // Fetch full application with populated fields
            const fullApplication = await this.applicationModel
                .findById(application._id)
                .populate(['userId', 'programId', 'entryAcademicSession'])
                .exec();

            if (!fullApplication) {
                throw new Error('Application not found');
            }

            // Generate proper matriculation number using the matriculation service
            // Extract just the ObjectId from the populated program document
            this.logger.log('fullApplication.programId type:', typeof fullApplication.programId);
            this.logger.log('fullApplication.programId value:', fullApplication.programId);
            this.logger.log('fullApplication.programId._id:', fullApplication.programId._id);

            const programId = fullApplication.programId._id || fullApplication.programId;
            this.logger.log('Extracted programId:', programId);
            this.logger.log('programId.toString():', programId.toString());

            const matriculationNumber = await this.matriculationService.generateMatriculationNumber(
                programId.toString()
            );

            // Update application with matriculation number and completion status
            fullApplication.matriculationNumber = matriculationNumber;
            fullApplication.status = ApplicationStatus.COMPLETED;
            fullApplication.currentStage = 10; // Set to final stage
            await fullApplication.save();

            // Extract the ObjectId from the populated entryAcademicSession
            const academicSessionId = typeof fullApplication.entryAcademicSession === 'object'
                && fullApplication.entryAcademicSession !== null
                ? (fullApplication.entryAcademicSession as any)._id
                : fullApplication.entryAcademicSession;
            const admissionYear = new Date().getFullYear();

            this.logger.log('About to check for existing student record...');
            this.logger.log('User ID for student check:', fullApplication.userId);

            // Create Student record (migrate from applicant to student)
            try {
                const existingStudent = await this.studentModel.findOne({
                    userId: fullApplication.userId
                });

                this.logger.log('Existing student check result:', existingStudent ? 'Found' : 'Not found');

                if (!existingStudent) {
                    this.logger.log('Creating new student record...');
                    this.logger.log('Student data:', {
                        userId: fullApplication.userId,
                        applicationId: fullApplication._id,
                        matriculationNumber: matriculationNumber,
                        programId: fullApplication.programId,
                        programTypeId: fullApplication.programTypeId,
                        programModeId: fullApplication.programModeId,
                        admissionYear: admissionYear,
                        academicSession: academicSessionId
                    });

                    const newStudent = new this.studentModel({
                        userId: fullApplication.userId,
                        applicationId: fullApplication._id,
                        matriculationNumber: matriculationNumber,
                        programId: fullApplication.programId,
                        programTypeId: fullApplication.programTypeId,
                        programModeId: fullApplication.programModeId,
                        admissionYear: admissionYear,
                        academicSession: academicSessionId, // Store ObjectId reference
                        status: 'active',
                        currentLevel: 1,
                        currentSemester: 1,
                        cumulativeGPA: 0.0,
                        isActive: true,
                        profileImageUrl: fullApplication.profileImageUrl // Copy profile image from application
                    });

                    await newStudent.save();
                    this.logger.log('✅ Student record created successfully:', newStudent._id);
                } else {
                    this.logger.log('Student record already exists:', existingStudent._id);
                }
            } catch (studentError) {
                this.logger.error('❌ Error creating student record:', studentError);
                throw studentError;
            }

            this.logger.log('About to update user role...');
            this.logger.log('Current user role:', user.role);

            // Update User role from APPLICANT to STUDENT
            try {
                if (user.role === UserRole.APPLICANT) {
                    this.logger.log('Updating user role from APPLICANT to STUDENT...');
                    user.role = UserRole.STUDENT;
                    await user.save();
                    this.logger.log('✅ User role updated from APPLICANT to STUDENT:', user._id);
                } else {
                    this.logger.log('User role already set to:', user.role);
                }
            } catch (userError) {
                this.logger.error('❌ Error updating user role:', userError);
                throw userError;
            }

            // Send matriculation email
            const studentPortalUrl = process.env.STUDENT_PORTAL_URL || 'http://localhost:3000/student-portal';
            await this.emailService.sendMatriculationEmail(
                user.email,
                user.firstName,
                matriculationNumber,
                studentPortalUrl
            );

            this.logger.log('Application completion process finished successfully for user:', userId);
            this.logger.log('Generated matriculation number:', matriculationNumber);
            this.logger.log('Student record created and user role updated');
            this.logger.log('Matriculation email sent to:', user.email);

        } catch (error) {
            this.logger.error('Error completing application process:', error);
            throw error;
        }
    }

    // Payment Management Methods for Staff Portal

    async getPaymentsForManagement(filters: {
        page?: number;
        limit?: number;
        search?: string;
        active?: boolean;
        sortBy?: string;
        sortOrder?: string;
    }) {
        const {
            page = 1,
            limit = 10,
            search,
            active,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = filters;

        // Build query
        const query: any = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { paymentCode: { $regex: search, $options: 'i' } }
            ];
        }

        if (active !== undefined) {
            query.active = active;
        }

        // Build sort object
        const sort: any = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Execute queries
        const [payments, totalCount] = await Promise.all([
            this.paymentModel
                .find(query)
                .select('_id name description amount category active paymentCode targetAudience createdAt updatedAt')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            this.paymentModel.countDocuments(query)
        ]);

        // Transform payments for frontend
        const transformedPayments = payments.map(payment => ({
            id: payment._id.toString(),
            name: payment.name,
            description: payment.description,
            amount: payment.amount,
            category: payment.category,
            isActive: payment.active,
            paymentCode: payment.paymentCode,
            targetAudience: payment.targetAudience,
            createdAt: (payment as any).createdAt,
            updatedAt: (payment as any).updatedAt
        }));

        return {
            payments: transformedPayments,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasNextPage: page < Math.ceil(totalCount / limit),
                hasPrevPage: page > 1
            }
        };
    }

    async getPaymentById(id: string) {
        try {
            const payment = await this.paymentModel.findById(id).lean();

            if (!payment) {
                return null;
            }

            return {
                id: payment._id.toString(),
                name: payment.name,
                description: payment.description,
                amount: payment.amount,
                category: payment.category,
                isActive: payment.active,
                paymentCode: payment.paymentCode,
                targetAudience: payment.targetAudience,
                createdAt: (payment as any).createdAt,
                updatedAt: (payment as any).updatedAt
            };
        } catch (error) {
            this.logger.error('Error getting payment by ID:', error);
            throw error;
        }
    }

    async createPayment(createPaymentDto: {
        name: string;
        description?: string;
        amount: number;
        category?: string;
        isActive?: boolean;
        paymentCode?: string;
        targetAudience?: PaymentAudience[];
    }) {
        try {
            const paymentData = {
                name: createPaymentDto.name,
                description: createPaymentDto.description,
                amount: createPaymentDto.amount,
                category: createPaymentDto.category,
                active: createPaymentDto.isActive !== undefined ? createPaymentDto.isActive : true,
                paymentCode: createPaymentDto.paymentCode,
                targetAudience: createPaymentDto.targetAudience || [PaymentAudience.APPLICANT]
            };

            const payment = new this.paymentModel(paymentData);
            const savedPayment = await payment.save();

            this.logger.log('Payment created successfully:', savedPayment._id);

            return {
                id: savedPayment._id.toString(),
                name: savedPayment.name,
                description: savedPayment.description,
                amount: savedPayment.amount,
                category: savedPayment.category,
                isActive: savedPayment.active,
                paymentCode: savedPayment.paymentCode,
                targetAudience: savedPayment.targetAudience,
                createdAt: (savedPayment as any).createdAt,
                updatedAt: (savedPayment as any).updatedAt
            };
        } catch (error) {
            this.logger.error('Error creating payment:', error);
            throw error;
        }
    }

    async updatePayment(id: string, updatePaymentDto: {
        name?: string;
        description?: string;
        amount?: number;
        category?: string;
        isActive?: boolean;
        paymentCode?: string;
        targetAudience?: PaymentAudience[];
    }) {
        try {
            const updateData: any = {};

            if (updatePaymentDto.name !== undefined) {
                updateData.name = updatePaymentDto.name;
            }
            if (updatePaymentDto.paymentCode !== undefined) {
                updateData.paymentCode = updatePaymentDto.paymentCode;
            }
            if (updatePaymentDto.description !== undefined) {
                updateData.description = updatePaymentDto.description;
            }
            if (updatePaymentDto.amount !== undefined) {
                updateData.amount = updatePaymentDto.amount;
            }
            if (updatePaymentDto.category !== undefined) {
                updateData.category = updatePaymentDto.category;
            }
            if (updatePaymentDto.isActive !== undefined) {
                updateData.active = updatePaymentDto.isActive;
            }
            if (updatePaymentDto.targetAudience !== undefined) {
                updateData.targetAudience = updatePaymentDto.targetAudience;
            }

            const payment = await this.paymentModel
                .findByIdAndUpdate(id, updateData, { new: true })
                .lean();

            if (!payment) {
                return null;
            }

            this.logger.log('Payment updated successfully:', payment._id);

            return {
                id: payment._id.toString(),
                name: payment.name,
                description: payment.description,
                amount: payment.amount,
                category: payment.category,
                isActive: payment.active,
                paymentCode: payment.paymentCode,
                targetAudience: payment.targetAudience,
                createdAt: (payment as any).createdAt,
                updatedAt: (payment as any).updatedAt
            };
        } catch (error) {
            this.logger.error('Error updating payment:', error);
            throw error;
        }
    }

    async togglePaymentStatus(id: string) {
        try {
            const payment = await this.paymentModel.findById(id);

            if (!payment) {
                return null;
            }

            payment.active = !payment.active;
            const updatedPayment = await payment.save();

            this.logger.log('Payment status toggled successfully:', {
                id: updatedPayment._id,
                active: updatedPayment.active
            });

            return {
                id: updatedPayment._id.toString(),
                name: updatedPayment.name,
                description: updatedPayment.description,
                amount: updatedPayment.amount,
                category: updatedPayment.category,
                isActive: updatedPayment.active,
                paymentCode: updatedPayment.paymentCode,
                createdAt: (updatedPayment as any).createdAt,
                updatedAt: (updatedPayment as any).updatedAt
            };
        } catch (error) {
            this.logger.error('Error toggling payment status:', error);
            throw error;
        }
    }

    async deletePayment(id: string) {
        try {
            // Check if payment is being used by any student payments
            const studentPaymentCount = await this.studentPaymentModel.countDocuments({
                paymentId: id
            });

            if (studentPaymentCount > 0) {
                throw new Error('Cannot delete payment that has been used by students');
            }

            const result = await this.paymentModel.findByIdAndDelete(id);

            if (!result) {
                return null;
            }

            this.logger.log('Payment deleted successfully:', id);
            return true;
        } catch (error) {
            this.logger.error('Error deleting payment:', error);
            throw error;
        }
    }

    /**
     * Get student payments statistics for staff dashboard
     */
    async getStudentPaymentsStats(filters: {
        academicSessionId?: string;
        status?: PaymentStatus;
        page?: number;
        limit?: number;
    } = {}) {
        try {
            const {
                academicSessionId,
                status = PaymentStatus.SUCCESSFUL,
                page = 1,
                limit = 1000
            } = filters;

            // Build query for successful payments
            const query: any = { status };

            // If academic session is specified, filter by users in that session
            let userIds: Types.ObjectId[] = [];
            if (academicSessionId) {
                const applications = await this.applicationModel
                    .find({ academicSessionId: new Types.ObjectId(academicSessionId) })
                    .select('userId')
                    .lean();

                userIds = applications.map(app => app.userId);
                query.userId = { $in: userIds };
            }

            // Get student payments with pagination
            const studentPayments = await this.studentPaymentModel
                .find(query)
                .populate('paymentId', 'name description amount')
                .populate('userId', 'firstName lastName email')
                .sort({ paidAt: -1 })
                .limit(limit)
                .skip((page - 1) * limit)
                .lean();

            // Calculate total revenue
            const totalRevenue = await this.studentPaymentModel.aggregate([
                { $match: query },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);

            // Get count for pagination
            const totalCount = await this.studentPaymentModel.countDocuments(query);

            const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

            return {
                payments: studentPayments,
                totalRevenue: revenue,
                totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            };
        } catch (error) {
            this.logger.error('Error getting student payments stats:', error);
            throw error;
        }
    }

    // Student Portal Specific Methods

    async getStudentPaymentsSummaryWithSession(userId: string, academicSessionId?: string): Promise<StudentPaymentsSummary> {
        const userObjectId = new Types.ObjectId(userId);

        // Get user to verify they exist
        const user = await this.userModel.findById(userObjectId).lean();
        if (!user) {
            throw new Error('User not found');
        }

        // Get student's successful payments for this session
        let studentPaymentQuery: any = {
            userId: userObjectId,
            status: PaymentStatus.SUCCESSFUL
        };

        if (academicSessionId) {
            studentPaymentQuery.academicSessionId = new Types.ObjectId(academicSessionId);
        }

        const studentPayments = await this.studentPaymentModel
            .find(studentPaymentQuery)
            .populate('paymentId')
            .lean();

        // Get currently active payments for unpaid calculation (filtered by session controls)
        let unpaidPaymentsQuery: any = {
            active: true,
            targetAudience: { $in: [PaymentAudience.STUDENT] }
        };

        // Filter unpaid payments by session controls if academic session is provided
        if (academicSessionId) {
            const sessionControls = await this.getActivePaymentsForSession(academicSessionId);
            if (sessionControls.payments.length > 0) {
                unpaidPaymentsQuery._id = { $in: sessionControls.payments.map(p => new Types.ObjectId(p)) };
            } else {
                unpaidPaymentsQuery = null; // No active payments for this session
            }
        }

        const activePaymentsForUnpaid = unpaidPaymentsQuery ? await this.paymentModel.find(unpaidPaymentsQuery).lean() : [];

        // Create a map of paid payment IDs for quick lookup
        const paidPaymentIds = new Set(
            studentPayments.map(sp => sp.paymentId._id.toString())
        );

        // Separate paid and unpaid fees
        const paidFees: PaymentSummary[] = [];
        const unpaidFees: PaymentSummary[] = [];

        // First, add all paid fees from student payments (even if payment is no longer active)
        studentPayments.forEach(studentPayment => {
            if (studentPayment.paymentId && typeof studentPayment.paymentId === 'object') {
                const payment = studentPayment.paymentId as any; // Type assertion since it's populated
                paidFees.push({
                    id: payment._id.toString(),
                    name: payment.name,
                    description: payment.description,
                    amount: studentPayment.amount, // Use actual paid amount
                    isPaid: true,
                    paymentCode: payment.paymentCode,
                    paidAt: studentPayment.paidAt,
                    reference: studentPayment.reference,
                    status: studentPayment.status,
                    channel: studentPayment.channel,
                    fee: studentPayment.fee
                });
            }
        });

        // Then, add unpaid fees from currently active payments
        activePaymentsForUnpaid.forEach(payment => {
            const paymentId = payment._id.toString();

            // Only add to unpaid if not already paid
            if (!paidPaymentIds.has(paymentId)) {
                unpaidFees.push({
                    id: paymentId,
                    name: payment.name,
                    description: payment.description,
                    amount: payment.amount,
                    isPaid: false,
                    paymentCode: payment.paymentCode
                });
            }
        });

        const totalPaid = paidFees.reduce((sum, fee) => sum + fee.amount, 0);
        const totalUnpaid = unpaidFees.reduce((sum, fee) => sum + fee.amount, 0);

        return {
            paidFees,
            unpaidFees,
            totalPaid,
            totalUnpaid
        };
    }

    async getStudentPaymentHistory(
        userId: string,
        academicSessionId?: string,
        options: { page?: number; limit?: number } = {}
    ) {
        const { page = 1, limit = 10 } = options;
        const userObjectId = new Types.ObjectId(userId);

        // Build query
        let query: any = {
            userId: userObjectId,
            status: PaymentStatus.SUCCESSFUL
        };

        if (academicSessionId) {
            query.academicSessionId = new Types.ObjectId(academicSessionId);
        }

        // Get payments with pagination
        const payments = await this.studentPaymentModel
            .find(query)
            .populate('paymentId', 'name description amount paymentCode')
            .populate('academicSessionId', 'sessionYear')
            .sort({ paidAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .lean();

        // Get total count for pagination
        const totalCount = await this.studentPaymentModel.countDocuments(query);

        // Calculate summary
        const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

        return {
            payments: payments.map(payment => ({
                id: payment._id,
                paymentId: payment.paymentId,
                amount: payment.amount,
                reference: payment.reference,
                paidAt: payment.paidAt,
                channel: payment.channel,
                fee: payment.fee,
                status: payment.status,
                academicSession: payment.academicSessionId
            })),
            totalPaid,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        };
    }

    async getLinkedPaymentsForStaffReview(
        userId: string,
        options: { applicationId?: string; academicSessionId?: string } = {}
    ): Promise<StaffLinkedPaymentsSummary> {
        const userObjectId = new Types.ObjectId(userId);
        const applicationObjectId = options.applicationId && Types.ObjectId.isValid(options.applicationId)
            ? new Types.ObjectId(options.applicationId)
            : null;
        const academicSessionObjectId = options.academicSessionId && Types.ObjectId.isValid(options.academicSessionId)
            ? new Types.ObjectId(options.academicSessionId)
            : null;

        const payments = await this.studentPaymentModel
            .find({ userId: userObjectId })
            .populate('paymentId', 'name description amount paymentCode')
            .populate('academicSessionId', 'sessionYear')
            .sort({ createdAt: -1, paidAt: -1 })
            .lean();

        const mappedPayments = payments.map(payment => {
            const linkedApplicationId = payment.applicationId?.toString();
            const linkedAcademicSessionId = payment.academicSessionId && typeof payment.academicSessionId === 'object' && '_id' in payment.academicSessionId
                ? payment.academicSessionId._id?.toString()
                : payment.academicSessionId?.toString();
            const linkedPayment = payment.paymentId && typeof payment.paymentId === 'object' && '_id' in payment.paymentId
                ? payment.paymentId as any
                : null;

            return {
                id: payment._id.toString(),
                amount: payment.amount,
                reference: payment.reference,
                paidAt: payment.paidAt,
                channel: payment.channel,
                fee: payment.fee,
                status: payment.status,
                remarks: payment.remarks,
                createdAt: payment.createdAt,
                updatedAt: payment.updatedAt,
                isApplicationLinked: !!applicationObjectId && linkedApplicationId === applicationObjectId.toString(),
                isAcademicSessionLinked: !!academicSessionObjectId && linkedAcademicSessionId === academicSessionObjectId.toString(),
                payment: {
                    id: linkedPayment?._id?.toString(),
                    name: linkedPayment?.name || 'Unknown Payment',
                    description: linkedPayment?.description,
                    amount: linkedPayment?.amount,
                    paymentCode: linkedPayment?.paymentCode,
                },
                academicSession: payment.academicSessionId && typeof payment.academicSessionId === 'object'
                    ? {
                        id: (payment.academicSessionId as any)._id?.toString(),
                        sessionYear: (payment.academicSessionId as any).sessionYear,
                    }
                    : undefined,
            };
        });

        return {
            payments: mappedPayments,
            totalCount: mappedPayments.length,
            totalPaid: mappedPayments
                .filter(payment => payment.status === PaymentStatus.SUCCESSFUL)
                .reduce((sum, payment) => sum + payment.amount, 0),
            successfulCount: mappedPayments.filter(payment => payment.status === PaymentStatus.SUCCESSFUL).length,
            pendingCount: mappedPayments.filter(payment => payment.status === PaymentStatus.PENDING).length,
            failedCount: mappedPayments.filter(payment => payment.status === PaymentStatus.FAILED).length,
            cancelledCount: mappedPayments.filter(payment => payment.status === PaymentStatus.CANCELLED).length,
        };
    }

    async initializeStudentPayment(
        userId: string,
        paymentId: string,
        email: string,
        academicSessionId?: string
    ): Promise<PaystackInitializeResponse> {
        // Check if payment is available for the academic session
        if (academicSessionId) {
            const isAvailable = await this.isPaymentAvailableForSession(paymentId, academicSessionId);
            if (!isAvailable) {
                throw new Error('Payment is not available for the selected academic session');
            }
        }

        // Get payment details
        const payment = await this.paymentModel.findById(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }

        // Check if user is authorized for this payment
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        if (!payment.targetAudience.includes(PaymentAudience.STUDENT)) {
            throw new Error('Payment not available for students');
        }

        // Check if this is an accommodation payment and if tenancy agreement is required
        if (payment.paymentCode === 'accommodationFee') {
            // Import TenancyAgreementService and check if agreement exists
            // For now, we'll implement a direct check to avoid circular dependency
            const student = await this.studentModel.findOne({
                userId: new Types.ObjectId(userId)
            });

            if (!student) {
                throw new Error('Student record not found');
            }

            // Check if tenancy agreement exists for this student
            const tenancyAgreement = await this.tenancyAgreementModel.findOne({
                studentId: student._id
            });

            if (!tenancyAgreement) {
                throw new Error('You must sign the tenancy agreement before making accommodation fee payments. Please go to the Tenancy Agreement section first.');
            }

            this.logger.log(`Accommodation payment authorized for user ${userId} - tenancy agreement signed`);
        }

        // Generate unique reference
        const reference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create student payment record
        const studentPayment = new this.studentPaymentModel({
            userId: new Types.ObjectId(userId),
            paymentId: new Types.ObjectId(paymentId),
            academicSessionId: academicSessionId ? new Types.ObjectId(academicSessionId) : undefined,
            amount: payment.amount,
            reference: reference,
            status: PaymentStatus.PENDING
        });

        await studentPayment.save();

        // Initialize with Paystack
        const paystackResponse = await this.initializePaystackPayment(reference, email, payment.amount);

        return {
            authorization_url: paystackResponse.authorization_url,
            access_code: paystackResponse.access_code,
            reference: reference
        };
    }

    async getAvailableStudentPayments(userId: string, academicSessionId?: string) {
        // Get user to verify they are a student
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Get all active payments for students
        let paymentQuery: any = {
            active: true,
            targetAudience: { $in: [PaymentAudience.STUDENT] }
        };

        // If academic session is provided, filter by session controls
        if (academicSessionId) {
            const sessionControls = await this.getActivePaymentsForSession(academicSessionId);
            if (sessionControls.payments.length > 0) {
                paymentQuery._id = { $in: sessionControls.payments.map(p => new Types.ObjectId(p)) };
            } else {
                return []; // No payments available for this session
            }
        }

        const availablePayments = await this.paymentModel.find(paymentQuery).lean();

        // Get already paid payments by this user for this session
        let paidQuery: any = {
            userId: new Types.ObjectId(userId),
            status: PaymentStatus.SUCCESSFUL
        };

        if (academicSessionId) {
            paidQuery.academicSessionId = new Types.ObjectId(academicSessionId);
        }

        const paidPayments = await this.studentPaymentModel
            .find(paidQuery)
            .select('paymentId')
            .lean();

        const paidPaymentIds = new Set(paidPayments.map(p => p.paymentId.toString()));

        // Filter out already paid payments
        return availablePayments
            .filter(payment => !paidPaymentIds.has(payment._id.toString()))
            .map(payment => ({
                id: payment._id,
                name: payment.name,
                description: payment.description,
                amount: payment.amount,
                paymentCode: payment.paymentCode,
                category: payment.category,
                isPaid: false
            }));
    }

    // Helper method to get active payments for a session
    private async getActivePaymentsForSession(academicSessionId: string): Promise<{
        controls: string[];
        payments: string[];
    }> {
        try {
            // This would require importing SessionControlsService, but to avoid circular dependencies,
            // we'll implement the logic directly here
            const sessionControl = await this.paymentModel.db.collection('sessioncontrols')
                .findOne({ academicSessionId: new Types.ObjectId(academicSessionId) });

            if (!sessionControl) {
                return { controls: [], payments: [] };
            }

            const activePayments = sessionControl.payments
                .filter((p: any) => p.active)
                .map((p: any) => p.paymentId.toString());

            return {
                controls: sessionControl.controls?.filter((c: any) => c.active).map((c: any) => c.name) || [],
                payments: activePayments
            };
        } catch (error) {
            this.logger.error('Error getting active payments for session:', error);
            return { controls: [], payments: [] };
        }
    }

    // Helper method to check if payment is available for session
    private async isPaymentAvailableForSession(paymentId: string, academicSessionId: string): Promise<boolean> {
        const sessionControls = await this.getActivePaymentsForSession(academicSessionId);
        return sessionControls.payments.includes(paymentId);
    }

    // Helper method for Paystack initialization
    private async initializePaystackPayment(reference: string, email: string, amount: number) {
        try {
            const response = await fetch(`${this.paystackBaseUrl}/transaction/initialize`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.paystackSecretKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    amount: amount * 100, // Convert to kobo
                    reference: reference,
                    callback_url: `${process.env.STUDENT_PORTAL_URL}/payment/verify/${reference}`,
                }),
            });

            if (!response.ok) {
                throw new Error(`Paystack API error: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.status) {
                throw new Error(data.message || 'Paystack initialization failed');
            }

            return data.data;
        } catch (error) {
            this.logger.error('Paystack initialization error:', error);
            throw error;
        }
    }
}

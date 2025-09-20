import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { StudentPayment, StudentPaymentDocument, PaymentStatus } from '../schemas/student-payment.schema';

export interface PaymentSummary {
    id: string;
    name: string;
    description?: string;
    amount: number;
    isPaid: boolean;
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

export interface PaystackInitializeResponse {
    authorization_url: string;
    access_code: string;
    reference: string;
}

@Injectable()
export class PaymentsService {
    private readonly paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    private readonly paystackBaseUrl = 'https://api.paystack.co';

    constructor(
        @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
        @InjectModel(StudentPayment.name) private studentPaymentModel: Model<StudentPaymentDocument>,
    ) {}

    async getStudentPaymentsSummary(userId: string): Promise<StudentPaymentsSummary> {
        const userObjectId = new Types.ObjectId(userId);

        // Get all active payments
        const allPayments = await this.paymentModel.find({ active: true }).lean();

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
                    isPaid: false
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
            console.log('initializePayment called with:', { userId, paymentId, email });
            
            // Ensure paymentId is a valid ObjectId
            if (!Types.ObjectId.isValid(paymentId)) {
                console.log('Invalid ObjectId format:', paymentId);
                throw new Error('Invalid payment ID format');
            }
            
            // Get payment details
            const payment = await this.paymentModel.findById(new Types.ObjectId(paymentId));
            console.log('Payment found:', payment);
            
            if (!payment) {
                console.log('Payment not found for ID:', paymentId);
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
                console.log('Found existing payment attempt:', {
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
                            console.log('Payment was marked as failed based on Paystack status');
                        }
                        // For pending status, we'll continue to reuse
                    }
                } catch (verifyError) {
                    console.log('Error verifying existing payment:', verifyError.message);
                    // Continue with the existing reference anyway
                }

                // If it's a failed attempt, update status to pending for retry
                if (existingAttempt.status === PaymentStatus.FAILED) {
                    existingAttempt.status = PaymentStatus.PENDING;
                    existingAttempt.retryCount = (existingAttempt.retryCount || 0) + 1;
                    existingAttempt.remarks = `Payment retry attempt x${existingAttempt.retryCount} - awaiting user action`;
                    await existingAttempt.save();
                    console.log(`Updated failed payment attempt to pending for retry #${existingAttempt.retryCount}`);
                } else if (existingAttempt.status === PaymentStatus.PENDING) {
                    // Update remarks to show it's being retried
                    existingAttempt.retryCount = (existingAttempt.retryCount || 0) + 1;
                    existingAttempt.remarks = `Payment re-initialized with new reference x${existingAttempt.retryCount} - awaiting user action`;
                    await existingAttempt.save();
                    console.log(`Updated pending payment attempt remarks for retry #${existingAttempt.retryCount}`);
                }

                // For existing attempts, we need to create a NEW Paystack transaction with a NEW reference
                // because Paystack references are unique and cannot be reused
                const newReference = `alc${Date.now()}`;
                console.log('Creating new Paystack transaction with new reference:', newReference);
                
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
            console.error('Error in initializePayment:', error);
            throw error;
        }
    }

    private async createPaystackTransaction(payment: any, email: string, reference: string, userId: string, paymentId: string) {
        console.log('Creating new Paystack transaction:', {
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
        
        console.log('Paystack response:', data);

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
    }    async verifyPayment(reference: string): Promise<any> {
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
        } else {
            studentPayment.status = PaymentStatus.FAILED;
            studentPayment.remarks = `Payment failed: ${transaction.gateway_response}`;
        }

        await studentPayment.save();

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

        console.log(`Marked ${result.modifiedCount} abandoned payments as failed`);
    }
}

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
}

export interface StudentPaymentsSummary {
    paidFees: PaymentSummary[];
    unpaidFees: PaymentSummary[];
    totalPaid: number;
    totalUnpaid: number;
}

@Injectable()
export class PaymentsService {
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
                    channel: studentPayment.channel
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

    async initializePayment(userId: string, paymentId: string, amount: number): Promise<any> {
        // This will be implemented when integrating with Paystack
        // For now, return a placeholder
        return {
            authorization_url: '#',
            access_code: 'placeholder',
            reference: `ALC-${Date.now()}`
        };
    }

    async verifyPayment(reference: string): Promise<any> {
        // This will be implemented when integrating with Paystack
        // For now, return a placeholder
        return {
            status: 'success',
            data: {
                status: 'success',
                reference,
                amount: 0
            }
        };
    }
}

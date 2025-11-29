/**
 * Alecons Student Portal
 * Payment Service - Handles all payment-related operations
 */

import { apiService } from './api.js';
import { logger } from '@shared/utils/logger';
import PaystackPop from '@paystack/inline-js';

class StudentPaymentService {
    constructor() {
        this.paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    }

    /**
     * Get student payment summary for a specific academic session
     */
    async getPaymentSummary(academicSessionId = null) {
        try {
            logger.info('Fetching payment summary for academic session:', academicSessionId);
            const response = await apiService.getPaymentSummary(academicSessionId);

            if (response.success) {
                logger.info('Successfully fetched payment summary');
                return {
                    success: true,
                    data: response.data
                };
            } else {
                throw new Error(response.message || 'Failed to fetch payment summary');
            }
        } catch (error) {
            logger.error('Error fetching payment summary:', error);
            return {
                success: false,
                message: error.message || 'Failed to fetch payment summary',
                error
            };
        }
    }

    /**
     * Get payment history with pagination
     */
    async getPaymentHistory(academicSessionId = null, page = 1, limit = 10) {
        try {
            logger.info('Fetching payment history:', { academicSessionId, page, limit });
            const response = await apiService.getPaymentHistory(academicSessionId, page, limit);

            if (response.success) {
                logger.info('Successfully fetched payment history');
                return {
                    success: true,
                    data: response.data
                };
            } else {
                throw new Error(response.message || 'Failed to fetch payment history');
            }
        } catch (error) {
            logger.error('Error fetching payment history:', error);
            return {
                success: false,
                message: error.message || 'Failed to fetch payment history',
                error
            };
        }
    }

    /**
     * Get available payments for a specific academic session
     */
    async getAvailablePayments(academicSessionId = null) {
        try {
            logger.info('Fetching available payments for academic session:', academicSessionId);
            const response = await apiService.getAvailablePayments(academicSessionId);

            if (response.success) {
                logger.info('Successfully fetched available payments');
                return {
                    success: true,
                    data: response.data
                };
            } else {
                throw new Error(response.message || 'Failed to fetch available payments');
            }
        } catch (error) {
            logger.error('Error fetching available payments:', error);
            return {
                success: false,
                message: error.message || 'Failed to fetch available payments',
                error
            };
        }
    }

    /**
     * Initialize payment with Paystack
     */
    async initializePayment(paymentId, email, academicSessionId = null) {
        try {
            logger.info('Initializing payment:', { paymentId, email, academicSessionId });

            const paymentData = {
                paymentId,
                email,
                ...(academicSessionId && { academicSessionId })
            };

            const response = await apiService.initializePayment(paymentData);

            if (response.success) {
                logger.info('Payment initialization successful');
                return {
                    success: true,
                    data: response.data
                };
            } else {
                throw new Error(response.message || 'Failed to initialize payment');
            }
        } catch (error) {
            logger.error('Error initializing payment:', error);
            return {
                success: false,
                message: error.message || 'Failed to initialize payment',
                error
            };
        }
    }

    /**
     * Launch Paystack popup for payment
     */
    async launchPaystackPayment(paymentData) {
        return new Promise((resolve, reject) => {
            try {
                if (!this.paystackPublicKey) {
                    throw new Error('Paystack public key not configured');
                }

                logger.info('Launching Paystack payment popup');

                // Extract access_code from the initialization response
                const { access_code, reference } = paymentData;

                if (!access_code) {
                    throw new Error('No access code provided for payment initialization');
                }

                const popup = new PaystackPop();

                popup.resumeTransaction(access_code, {
                    onSuccess: (response) => {
                        logger.info('Payment successful:', response);
                        this.verifyPayment(response.reference).then(verificationResult => {
                            resolve({
                                success: true,
                                data: {
                                    reference: response.reference,
                                    verification: verificationResult
                                }
                            });
                        }).catch(error => {
                            logger.error('Payment verification failed:', error);
                            resolve({
                                success: false,
                                message: 'Payment successful but verification failed',
                                data: { reference: response.reference }
                            });
                        });
                    },
                    onCancel: () => {
                        logger.info('Payment cancelled by user');
                        resolve({
                            success: false,
                            message: 'Payment cancelled by user'
                        });
                    },
                    onClose: () => {
                        logger.info('Payment popup closed');
                        resolve({
                            success: false,
                            message: 'Payment cancelled by user'
                        });
                    }
                });
            } catch (error) {
                logger.error('Error launching Paystack payment:', error);
                reject({
                    success: false,
                    message: error.message || 'Failed to launch payment',
                    error
                });
            }
        });
    }

    /**
     * Verify payment status
     */
    async verifyPayment(reference) {
        try {
            logger.info('Verifying payment:', reference);
            const response = await apiService.verifyPayment(reference);

            if (response.success) {
                logger.info('Payment verification successful');
                return {
                    success: true,
                    data: response.data
                };
            } else {
                throw new Error(response.message || 'Failed to verify payment');
            }
        } catch (error) {
            logger.error('Error verifying payment:', error);
            return {
                success: false,
                message: error.message || 'Failed to verify payment',
                error
            };
        }
    }

    /**
     * Get academic sessions for payment filtering
     */
    async getAcademicSessions() {
        try {
            logger.info('Fetching academic sessions');
            const response = await apiService.getAcademicSessions({ limit: 100 });

            if (response.success) {
                logger.info('Successfully fetched academic sessions');
                return {
                    success: true,
                    data: response.data
                };
            } else {
                throw new Error(response.message || 'Failed to fetch academic sessions');
            }
        } catch (error) {
            logger.error('Error fetching academic sessions:', error);
            return {
                success: false,
                message: error.message || 'Failed to fetch academic sessions',
                error
            };
        }
    }

    /**
     * Format currency for display
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    }

    /**
     * Format date for display
     */
    formatDate(date) {
        if (!date) return 'N/A';

        return new Intl.DateTimeFormat('en-NG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(date));
    }

    /**
     * Get payment status badge class
     */
    getStatusBadgeClass(status) {
        const statusClasses = {
            'successful': 'bg-success',
            'pending': 'bg-warning',
            'failed': 'bg-danger',
            'cancelled': 'bg-secondary'
        };

        return statusClasses[status?.toLowerCase()] || 'bg-secondary';
    }

    /**
     * Get payment status display text
     */
    getStatusText(status) {
        const statusTexts = {
            'successful': 'Paid',
            'pending': 'Pending',
            'failed': 'Failed',
            'cancelled': 'Cancelled'
        };

        return statusTexts[status?.toLowerCase()] || 'Unknown';
    }
}

// Create and export a singleton instance
export const studentPaymentService = new StudentPaymentService();

// Export the class for creating new instances if needed
export default StudentPaymentService;

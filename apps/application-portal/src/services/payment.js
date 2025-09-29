import { apiService } from './api.js';
import { logger } from '@shared/utils/logger';
import PaystackPop from '@paystack/inline-js';

class PaymentService {
    constructor() {
        this.paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    }

    /**
     * Get student payment summary (paid and unpaid fees)
     */
    async getPaymentsSummary() {
        try {
            logger.info('Fetching payments summary');
            const response = await apiService.get('/payments/summary');

            if (response.success) {
                logger.info('Successfully fetched payments summary');
                return {
                    success: true,
                    data: response.data
                };
            } else {
                throw new Error(response.message || 'Failed to fetch payments summary');
            }
        } catch (error) {
            logger.error('Error fetching payments summary:', error);
            return {
                success: false,
                message: error.message || 'Failed to fetch payments summary',
                error
            };
        }
    }

    /**
     * Initialize payment with Paystack
     */
    async initializePayment(paymentId, email) {
        try {
            logger.info('Initializing payment:', { paymentId, email });
            const response = await apiService.post('/payments/initialize', {
                paymentId,
                email
            });

            if (response.success) {
                logger.info('Payment initialized successfully');
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
        try {
            logger.info('Launching Paystack payment:', paymentData);

            // Extract data from the payment object
            const { email, paymentType: paymentId, amount, description } = paymentData;

            // Initialize payment first
            const initResult = await this.initializePayment(paymentId, email);

            if (!initResult.success) {
                throw new Error(initResult.message);
            }

            const { reference, access_code } = initResult.data;

            // Launch Paystack popup using modern API
            return new Promise((resolve, reject) => {
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
            });

        } catch (error) {
            logger.error('Error launching Paystack payment:', error);
            return {
                success: false,
                message: error.message || 'Failed to launch payment',
                error
            };
        }
    }

    /**
     * Verify payment status
     */
    async verifyPayment(reference) {
        try {
            logger.info('Verifying payment:', { reference });
            const response = await apiService.post(`/payments/verify/${reference}`);

            if (response.success) {
                logger.info('Payment verification successful');

                // Import auth store and refresh user data after successful payment
                try {
                    const { useAuthStore } = await import('../stores/auth.js');
                    const authStore = useAuthStore();
                    await authStore.refreshUserData();
                    logger.info('User data refreshed after successful payment');
                } catch (storeError) {
                    logger.error('Failed to refresh user data after payment:', storeError);
                    // Don't fail the payment verification if store refresh fails
                }

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
     * Format currency for display
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 2
        }).format(amount);
    }

    /**
     * Format date for display
     */
    formatDate(date) {
        if (!date) return '';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: '2-digit'
        });
    }
}

// Export singleton instance
export const paymentService = new PaymentService();

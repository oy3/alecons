import { apiService } from './api.js';
import { logger } from '@shared/utils/logger';

class PaymentService {
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
    async initializePayment(paymentId, amount) {
        try {
            logger.info('Initializing payment:', { paymentId, amount });
            const response = await apiService.post('/payments/initialize', {
                paymentId,
                amount
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
     * Verify payment status
     */
    async verifyPayment(reference) {
        try {
            logger.info('Verifying payment:', { reference });
            const response = await apiService.post(`/payments/verify/${reference}`);
            
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

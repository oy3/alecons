/**
 * Alecons Student Portal
 * Tenancy Agreement Service - Handles all tenancy agreement operations
 */

import { apiService } from './api.js';
import { logger } from '@shared/utils/logger';

class TenancyAgreementService {
    /**
     * Get the current tenancy agreement status for the logged-in student
     */
    async getAgreementStatus() {
        try {
            logger.info('Fetching tenancy agreement status');

            // Use the dedicated tenancy agreement status endpoint
            const response = await apiService.get('/student/tenancy-agreement/status');

            if (response.success) {
                logger.info('Successfully fetched agreement status');
                return {
                    success: true,
                    data: response.data
                };
            } else {
                throw new Error(response.message || 'Failed to fetch agreement status');
            }
        } catch (error) {
            logger.error('Error fetching agreement status:', error);
            return {
                success: false,
                message: error.message || 'Failed to fetch agreement status',
                error
            };
        }
    }

    /**
     * Submit tenancy agreement form
     * This will:
     * 1. Submit the agreement data
     * 2. Set hasSignedTenancyAgreement = true in student collection
     * 3. Generate PDF document with filled details
     * 4. Save PDF to DigitalOcean Spaces (applications/{application_number}/)
     * 5. Update student documents array with tenancy_agreement URL
     */
    async submitAgreement(agreementData) {
        try {
            logger.info('Submitting tenancy agreement with full processing');

            // Prepare submission data
            const submissionData = {
                personalInfo: {
                    tenantName: agreementData.tenantName,
                    courseOfStudy: agreementData.courseOfStudy,
                    residentialAddress: agreementData.residentialAddress,
                    phoneNumber: agreementData.phoneNumber
                },
                parentInfo: {
                    name: agreementData.parentName,
                    phoneNumber: agreementData.parentPhone
                },
                guarantorInfo: {
                    name: agreementData.guarantorName,
                    phoneNumber: agreementData.guarantorPhone,
                    address: agreementData.guarantorAddress,
                    occupation: agreementData.guarantorOccupation,
                    relationship: agreementData.guarantorRelationship
                },
                hostelInfo: {
                    address: agreementData.hostelAddress,
                    tenancyStartDate: agreementData.tenancyStartDate,
                    tenancyEndDate: agreementData.tenancyEndDate
                },
                witnessInfo: {
                    name: agreementData.witnessName,
                    address: agreementData.witnessAddress,
                    occupation: agreementData.witnessOccupation
                },
                agreementTerms: {
                    agreedToTerms: agreementData.agreeToTerms,
                    signedAt: new Date().toISOString()
                }
            };

            // Submit to backend which will:
            // - Process the agreement data
            // - Update student.hasSignedTenancyAgreement = true
            // - Generate PDF with filled agreement
            // - Save PDF to DigitalOcean Spaces
            // - Update student.documents.tenancy_agreement with PDF URL
            const response = await apiService.post('/student/tenancy-agreement/submit', submissionData);

            if (response.success) {
                logger.info('Successfully submitted and processed tenancy agreement');
                logger.info('PDF generated and saved to:', response.data.documentUrl);
                logger.info('Student hasSignedTenancyAgreement updated to true');

                return {
                    success: true,
                    data: {
                        ...response.data,
                        message: 'Tenancy agreement successfully signed and processed'
                    }
                };
            } else {
                throw new Error(response.message || 'Failed to submit agreement');
            }
        } catch (error) {
            logger.error('Error submitting tenancy agreement:', error);
            return {
                success: false,
                message: error.message || 'Failed to submit agreement',
                error
            };
        }
    }

    /**
     * Get tenancy agreement document/details
     */
    async getAgreementDocument() {
        try {
            logger.info('Fetching tenancy agreement document');
            const response = await apiService.get('/student/tenancy-agreement/document');

            if (response.success) {
                logger.info('Successfully fetched agreement document');
                return {
                    success: true,
                    data: response.data
                };
            } else {
                throw new Error(response.message || 'Failed to fetch agreement document');
            }
        } catch (error) {
            logger.error('Error fetching agreement document:', error);
            return {
                success: false,
                message: error.message || 'Failed to fetch agreement document',
                error
            };
        }
    }

    /**
     * Check if student can make accommodation payment
     */
    async canMakeAccommodationPayment() {
        try {
            logger.info('Checking accommodation payment eligibility from tenancy agreement status');

            // Check tenancy agreement status directly
            const response = await this.getAgreementStatus();

            if (response.success) {
                const hasSignedAgreement = response.data.hasSigned || false;
                logger.info('Accommodation payment eligibility:', hasSignedAgreement);

                return {
                    success: true,
                    canPay: hasSignedAgreement,
                    message: hasSignedAgreement
                        ? 'Student can make accommodation payment'
                        : 'Tenancy agreement must be signed before making accommodation payment'
                };
            } else {
                throw new Error(response.message || 'Failed to check agreement status');
            }
        } catch (error) {
            logger.error('Error checking accommodation payment eligibility:', error);
            return {
                success: false,
                canPay: false,
                message: error.message || 'Failed to check payment eligibility',
                error
            };
        }
    }

    /**
     * Get agreement status for display
     */
    getStatusText(status) {
        const statusMap = {
            'not_started': 'Not Started',
            'draft': 'Draft',
            'signed': 'Signed',
            'pending': 'Pending Review',
            'approved': 'Approved',
            'rejected': 'Rejected'
        };

        return statusMap[status] || 'Unknown';
    }

    /**
     * Get status badge CSS class
     */
    getStatusBadgeClass(status) {
        const classMap = {
            'not_started': 'bg-secondary',
            'draft': 'bg-warning',
            'signed': 'bg-success',
            'pending': 'bg-info',
            'approved': 'bg-primary',
            'rejected': 'bg-danger'
        };

        return classMap[status] || 'bg-secondary';
    }

    /**
     * Format date for display
     */
    formatDate(date) {
        if (!date) return 'Not set';

        return new Intl.DateTimeFormat('en-NG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(new Date(date));
    }

    /**
     * Validate agreement form data
     */
    validateAgreementData(data) {
        const errors = {};

        // Required fields validation
        const requiredFields = {
            'tenantName': 'Tenant name is required',
            'courseOfStudy': 'Course of study is required',
            'residentialAddress': 'Residential address is required',
            'phoneNumber': 'Phone number is required',
            'parentName': 'Parent/Guardian name is required',
            'parentPhone': 'Parent/Guardian phone is required',
            'guarantorName': 'Guarantor name is required',
            'guarantorPhone': 'Guarantor phone is required',
            'guarantorAddress': 'Guarantor address is required',
            'guarantorOccupation': 'Guarantor occupation is required',
            'guarantorRelationship': 'Relationship to guarantor is required',
            'hostelAddress': 'Hostel address is required',
            'tenancyStartDate': 'Tenancy start date is required',
            'tenancyEndDate': 'Tenancy end date is required',
            'witnessName': 'Witness name is required',
            'witnessAddress': 'Witness address is required',
            'witnessOccupation': 'Witness occupation is required'
        };

        // Check required fields
        for (const [field, message] of Object.entries(requiredFields)) {
            if (!data[field] || data[field].toString().trim() === '') {
                errors[field] = message;
            }
        }

        // Phone number validation
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (data.phoneNumber && !phoneRegex.test(data.phoneNumber)) {
            errors.phoneNumber = 'Please enter a valid phone number';
        }

        if (data.parentPhone && !phoneRegex.test(data.parentPhone)) {
            errors.parentPhone = 'Please enter a valid phone number';
        }

        if (data.guarantorPhone && !phoneRegex.test(data.guarantorPhone)) {
            errors.guarantorPhone = 'Please enter a valid phone number';
        }

        // Date validation
        if (data.tenancyStartDate && data.tenancyEndDate) {
            const startDate = new Date(data.tenancyStartDate);
            const endDate = new Date(data.tenancyEndDate);

            if (endDate <= startDate) {
                errors.tenancyEndDate = 'End date must be after start date';
            }

            // Check if start date is in the past (more than 30 days ago)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            if (startDate < thirtyDaysAgo) {
                errors.tenancyStartDate = 'Start date cannot be more than 30 days in the past';
            }
        }

        // Agreement checkbox validation
        if (!data.agreeToTerms) {
            errors.agreeToTerms = 'You must agree to the terms and conditions';
        }

        // Email validation if provided
        if (data.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                errors.email = 'Please enter a valid email address';
            }
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    /**
     * Generate agreement reference number
     */
    generateAgreementReference(studentId, year = null) {
        const currentYear = year || new Date().getFullYear();
        const timestamp = Date.now().toString().slice(-6);
        return `ACAS-TA-${currentYear}-${studentId}-${timestamp}`;
    }

    /**
     * Check if this is an accommodation payment by paymentCode
     */
    isAccommodationPayment(paymentCode) {
        // Check for specific accommodation fee payment code
        return paymentCode === 'accommodationFee';
    }
}

// Export singleton instance
export const tenancyAgreementService = new TenancyAgreementService();
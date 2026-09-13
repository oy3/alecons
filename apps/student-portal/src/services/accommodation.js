import { apiService } from './api.js';

const toPayload = (form, includeAcceptance = false) => ({
  personalInfo: {
    tenantName: form.tenantName || '',
    courseOfStudy: form.courseOfStudy || '',
    residentialAddress: form.residentialAddress || '',
    phoneNumber: form.phoneNumber || '',
  },
  parentInfo: { name: form.parentName || '', phoneNumber: form.parentPhone || '' },
  guarantorInfo: {
    name: form.guarantorName || '',
    phoneNumber: form.guarantorPhone || '',
    address: form.guarantorAddress || '',
    occupation: form.guarantorOccupation || '',
    relationship: form.guarantorRelationship || '',
  },
  ...(includeAcceptance ? { agreementTerms: { agreedToTerms: form.agreeToTerms === true } } : {}),
});

class AccommodationService {
  getOverview() {
    return apiService.get('/student/accommodation/overview');
  }

  saveAgreementDraft(form) {
    return apiService.put('/student/accommodation/agreement/draft', toPayload(form));
  }

  submitAgreement(form) {
    return apiService.post('/student/accommodation/agreement/submit', toPayload(form, true));
  }

  async canMakeAccommodationPayment() {
    const response = await this.getOverview();
    const signed = response.success && response.data?.agreement?.status !== 'not_started';
    return {
      success: response.success,
      canPay: signed,
      message: signed ? 'Student can make accommodation payment' : 'Complete the accommodation agreement before payment.',
    };
  }

  isAccommodationPayment(paymentCode) {
    return paymentCode === 'accommodationFee';
  }

  async downloadDocument(type) {
    const endpoint = type === 'agreement'
      ? '/student/accommodation/documents/agreement'
      : '/student/accommodation/documents/allocation-slip';
    const response = await fetch(`${apiService.baseURL}${endpoint}`, {
      headers: { Authorization: `Bearer ${apiService.token}` },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message || 'Document download failed');
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `accommodation-${type}.pdf`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

export const accommodationService = new AccommodationService();

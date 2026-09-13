const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_APP_API_URL ||
    "http://localhost:8000/api/v1";

class PublicApiService {
    async request(path, options = {}) {
        const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: 'application/json', ...(options.headers || {}) }, ...options });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
            throw new Error(message || 'The request could not be completed');
        }
        return data;
    }

    startExternalAccommodation(payload) {
        return this.request('/accommodation/external/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }

    getExternalAccommodationConfig() {
        return this.request('/accommodation/external/config');
    }

    verifyExternalAccommodation(token) {
        return this.request(`/accommodation/external/verify?token=${encodeURIComponent(token)}`);
    }

    resumeExternalAccommodation(token) {
        return this.request(`/accommodation/external/resume?token=${encodeURIComponent(token)}`);
    }

    completeExternalAccommodation(token, formData) {
        return this.request(`/accommodation/external/complete?token=${encodeURIComponent(token)}`, { method: 'POST', body: formData });
    }

    signExternalAccommodationAgreement(token, payload) {
        return this.request(`/accommodation/external/agreement?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }

    initializeExternalAccommodationPayment(resumeToken) {
        return this.request('/accommodation/external/payment/initialize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeToken }) });
    }

    getExternalAccommodationPaymentOptions(resumeToken) {
        return this.request('/accommodation/external/payment/options', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeToken }) });
    }

    submitExternalAccommodationManualTransfer(resumeToken, file) {
        const body = new FormData();
        body.append('receipt', file);
        return this.request(`/accommodation/external/payment/manual-transfer?token=${encodeURIComponent(resumeToken)}`, { method: 'POST', body });
    }

    verifyExternalAccommodationPayment(resumeToken, reference) {
        return this.request('/accommodation/external/payment/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeToken, reference }) });
    }

    async downloadExternalAccommodationDocument(resumeToken, documentType) {
        const response = await fetch(`${API_BASE_URL}/accommodation/external/documents/${documentType}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/pdf' },
            body: JSON.stringify({ resumeToken }),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
            throw new Error(message || 'The document could not be downloaded');
        }
        return response.blob();
    }
    async submitContactEnquiry(payload) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(`${API_BASE_URL}/public/contact-enquiries`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
                throw new Error(message || "We could not send your enquiry. Please try again.");
            }
            return data.data;
        } catch (error) {
            if (error?.name === "AbortError") {
                throw new Error("The request took too long. Please check your connection and try again.");
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    async getVerificationRecord(token) {
        const response = await fetch(
            `${API_BASE_URL}/public/verify/v1/${encodeURIComponent(token)}`,
            {
                headers: {
                    Accept: "application/json",
                },
            },
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message || data.error || "Unable to verify this identity card.",
            );
        }

        return data;
    }
}

export const publicApiService = new PublicApiService();

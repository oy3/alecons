const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_APP_API_URL ||
    "http://localhost:8000/api/v1";

class PublicApiService {
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

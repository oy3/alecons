const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_APP_API_URL ||
    "http://localhost:8000/api/v1";

class PublicApiService {
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
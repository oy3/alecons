export const toSentenceCase = (value = "") => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) {
        return "";
    }
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const toTitleCase = (value = "") =>
    String(value || "")
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .trim();

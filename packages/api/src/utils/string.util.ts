export const toTitleCase = (str: string): string =>
    str
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());

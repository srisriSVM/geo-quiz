export const normalizeText = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[._,;:!?()\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

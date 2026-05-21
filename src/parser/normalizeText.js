export function normalizeText(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff]/g, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

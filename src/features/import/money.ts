/** Decimal-string arithmetic avoids floating point penny errors. */
export function parsePounds(value: string): number {
  const text = value.trim().replace(/^£\s*/, '');
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) {
    throw new Error('Enter pounds and pence, for example 3.50.');
  }
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^[+-]/, '').replaceAll(',', '').split('.');
  const pence = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(pence) || pence > 100_000_000_000) {
    throw new Error('This amount is too large. Please check it.');
  }
  return negative ? -pence : pence;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseBritishDate(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : '';
  if (!isIsoDate(iso)) throw new Error('Use a valid date in DD/MM/YYYY format.');
  return iso;
}


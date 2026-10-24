import { parseBritishDate, parsePounds } from './money';
import { suggestClassification } from './ledger';
import type { ExtractedLine, ImportPreview, Transaction, UnresolvedRow } from './types';

export const LAYOUT_MARKER = 'CAMPUS DEMO STATEMENT V1';
export const COLUMN_HEADER = 'Date | Description | Money out | Money in';

/** Deliberately one documented layout. Unknown PDFs must not produce believable guesses. */
export function parseStatementLines(lines: readonly ExtractedLine[], fingerprint: string, filename: string): ImportPreview {
  if (!lines.some(line => line.text.trim() === LAYOUT_MARKER)) {
    throw new Error('This PDF layout is not supported yet. Try the downloadable sample statement, or add a cash purchase below.');
  }
  const period = lines.map(line => /^Period:\s*(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})$/.exec(line.text.trim())).find(Boolean);
  if (!period) throw new Error('The statement period is missing. Use the sample statement format.');
  const coverageStart = parseBritishDate(period[1]);
  const coverageEnd = parseBritishDate(period[2]);
  if (coverageEnd < coverageStart) throw new Error('The statement end date is before its start date.');
  const opening = lines.map(line => /^Opening balance:\s*(-?[\d,]+(?:\.\d{2})?)$/.exec(line.text.trim())).find(Boolean);
  const openingBalancePence = opening ? parsePounds(opening[1]) : null;
  const header = lines.findIndex(line => line.text.replace(/\s*\|\s*/g, ' | ').trim() === COLUMN_HEADER);
  const end = lines.findIndex((line, index) => index > header && line.text.trim() === 'END OF TRANSACTIONS');
  if (header < 0 || end < 0) throw new Error('The transaction table is incomplete. Check the PDF and try again.');
  const id = `pdf:${fingerprint}`;
  const transactions: Transaction[] = [];
  const unresolvedRows: UnresolvedRow[] = [];
  lines.slice(header + 1, end).forEach((line, index) => {
    const text = line.text.trim();
    if (!text || text === LAYOUT_MARKER || text.replace(/\s*\|\s*/g, ' | ') === COLUMN_HEADER || /^Page \d+ of \d+$/.test(text)) return;
    const rowId = `${id}:row:${index + 1}`;
    const sourceRow = `Page ${line.page}, line ${line.line}`;
    try {
      const parts = text.split('|').map(part => part.trim());
      if (parts.length !== 4) throw new Error('Expected date, description, money out and money in columns.');
      const [dateText, description, outText, inText] = parts;
      const date = parseBritishDate(dateText);
      if (date < coverageStart || date > coverageEnd) throw new Error('The date is outside the statement period.');
      if (!description) throw new Error('The description is missing.');
      const out = outText ? parsePounds(outText) : 0;
      const incoming = inText ? parsePounds(inText) : 0;
      if (out < 0 || incoming < 0 || (out > 0) === (incoming > 0)) throw new Error('Exactly one money column must contain a positive amount.');
      const amountPence = incoming - out;
      transactions.push({
        id: rowId, date, description, merchant: description, amountPence, currency: 'GBP',
        ...suggestClassification(description, amountPence), source: 'statement', importId: id, sourceRow,
      });
    } catch (error) {
      unresolvedRows.push({ id: rowId, rawText: text, sourceRow, reason: error instanceof Error ? error.message : 'This row could not be read.' });
    }
  });
  if (!transactions.length && !unresolvedRows.length) throw new Error('This statement has no transaction rows.');
  return { id, fingerprint, filename, layout: 'campus-v1', coverageStart, coverageEnd, openingBalancePence, transactions, unresolvedRows };
}

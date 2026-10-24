import { COLUMN_HEADER, LAYOUT_MARKER } from './statement';

export const SAMPLE_FILENAME = 'campus-demo-statement.pdf';

/** All names, balances and activity are fictional. No account identifiers are included. */
export const SAMPLE_STATEMENT_LINES = [
  LAYOUT_MARKER,
  'Campus Demo Bank - fictional institution',
  'Holder: Alex Student (fictional)',
  'Period: 01/10/2026 to 23/10/2026',
  'Currency: GBP. All data is synthetic. This is not a real bank statement.',
  COLUMN_HEADER,
  '01/10/2026 | MAINTENANCE FUNDING | | 2400.00',
  '02/10/2026 | STUDENT RENT | 650.00 |',
  '03/10/2026 | TESCO GLASGOW | 24.50 |',
  '04/10/2026 | STARBUCKS GLASGOW | 4.20 |',
  '04/10/2026 | CAMPUS BAKERY | 3.80 |',
  '05/10/2026 | ATM CASH WITHDRAWAL | 40.00 |',
  '05/10/2026 | SPOTIFY | 5.99 |',
  '06/10/2026 | TESCO REFUND | | 5.00',
  '07/10/2026 | TRANSFER TO OWN SAVINGS | 100.00 |',
  '08/10/2026 | PART TIME WAGES | | 320.00',
  '09/10/2026 | BLACK SHEEP COFFEE | 3.60 |',
  '11/10/2026 | WATERSTONES | 12.99 |',
  '12/10/2026 | TESCO GLASGOW | 18.75 |',
  '13/10/2026 | STARBUCKS GLASGOW | 4.20 |',
  '14/10/2026 | FIRST GLASGOW BUS | 3.40 |',
  '15/10/2026 | ENERGY BILL | 42.00 |',
  '22/10/2026 | BLACK SHEEP COFFEE | 3.60 |',
  '22/10/2026 | BLACK SHEEP COFFEE | 3.60 |',
  'END OF TRANSACTIONS',
  'The two identical coffee rows are separate purchases. Keep both.',
];

/** Small genuine, selectable-text PDF. Offsets use bytes; no PDF-generation dependency. */
export function createTextPdf(lines: readonly string[]): Uint8Array<ArrayBuffer> {
  if (lines.length > 42 || lines.some(line => /[^\x20-\x7e]/.test(line))) throw new Error('Sample PDF requires at most 42 ASCII text lines.');
  const escaped = lines.map(line => line.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)'));
  const stream = `BT\n/F1 9 Tf\n42 800 Td\n16 TL\n${escaped.map((line, i) => `${i ? 'T*\n' : ''}(${line}) Tj`).join('\n')}\nET\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

export function createSampleStatement(): File {
  return new File([createTextPdf(SAMPLE_STATEMENT_LINES)], SAMPLE_FILENAME, { type: 'application/pdf' });
}


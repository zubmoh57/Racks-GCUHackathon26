import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseStatementLines } from './statement';
import type { ExtractedLine, ImportPreview } from './types';

interface PositionedText { str: string; transform: number[]; }

/** PDF text order need not match visual row order. Group by baseline, then horizontal position. */
export function textItemsToLines(items: readonly PositionedText[], page: number): ExtractedLine[] {
  const rows: { y: number; items: PositionedText[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = item.transform[5];
    let row = rows.find(candidate => Math.abs(candidate.y - y) < 2);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push(item);
  }
  return rows.sort((a, b) => b.y - a.y).map((row, index) => ({
    text: row.items.sort((a, b) => a.transform[4] - b.transform[4]).map(item => item.str).join(' ').trim(),
    page, line: index + 1,
  }));
}

export async function parseStatement(file: File): Promise<ImportPreview> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a PDF smaller than 10 MB.');
  if (file.size === 0) throw new Error('This file is empty. Choose a statement PDF.');
  const data = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder().decode(data.slice(0, 1024)).includes('%PDF-')) throw new Error('This file is not a valid PDF.');
  const digest = await crypto.subtle.digest('SHA-256', data);
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const loading = pdfjs.getDocument({ data, isEvalSupported: false });
  // With no onPassword callback, PDF.js rejects encrypted PDFs instead of prompting.
  const lines: ExtractedLine[] = [];
  try {
    const document = await loading.promise;
    if (document.numPages > 20) throw new Error('This prototype supports statements up to 20 pages.');
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.filter((item): item is typeof item & PositionedText => 'str' in item);
      lines.push(...textItemsToLines(text, pageNumber));
      page.cleanup();
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new Error('Password-protected PDFs are not supported yet. Use an unencrypted statement or the sample PDF.');
    }
    if (error instanceof Error && error.message.includes('20 pages')) throw error;
    throw new Error('This PDF could not be read. Try an unencrypted, text-based statement or the sample PDF.');
  } finally {
    await loading.destroy();
  }
  if (!lines.length) throw new Error('No readable text was found. Scanned or image-only statements need OCR, which is not supported yet.');
  return parseStatementLines(lines, fingerprint, file.name);
}

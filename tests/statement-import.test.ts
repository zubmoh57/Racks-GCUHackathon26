import { describe, expect, it } from 'vitest';
import { parseBritishDate, parsePounds } from '../src/features/import/money';
import { confirmImport, possibleDuplicateIds, removeTransaction, summariseTransactions, upsertManualExpense, validateTransaction } from '../src/features/import/ledger';
import { parseStatementLines } from '../src/features/import/statement';
import { createTextPdf, sampleStatementFilename, sampleStatementLines, SAMPLE_STATEMENT_LINES } from '../src/features/import/sample';
import { textItemsToLines } from '../src/features/import/pdf';
import type { LedgerState, Transaction } from '../src/features/import/types';
import { getImportLedger, ledgerReplacement } from '../src/features/import/frontendAdapter';

const empty = (): LedgerState => ({ transactions: [], imports: [] });
const parse = (text: readonly string[] = SAMPLE_STATEMENT_LINES, fingerprint = 'fixture-a') => parseStatementLines(text.map((line, index) => ({ text: line, page: 1, line: index + 1 })), fingerprint, 'fixture.pdf');
const cash = (amountPence = -300): Transaction => ({ id: 'cash:1', date: '2026-10-23', description: 'Cash lunch', amountPence, currency: 'GBP', kind: 'expense', category: 'foodAndDrink', source: 'manual' });

describe('money and dates', () => {
  it('preserves pennies without floating point rounding', () => {
    expect(parsePounds('0.29')).toBe(29);
    expect(parsePounds('1,234.56')).toBe(123456);
    expect(parsePounds('-4.2')).toBe(-420);
    expect(parsePounds('£ 3.50')).toBe(350);
  });
  it.each(['1,2', '2.345', '1e3', '', 'NaN', '999999999999999999999'])('rejects ambiguous or invalid amount %s', amount => expect(() => parsePounds(amount)).toThrow());
  it('uses British dates and validates actual calendar days', () => {
    expect(parseBritishDate('04/10/2026')).toBe('2026-10-04');
    expect(parseBritishDate('29/02/2024')).toBe('2024-02-29');
    expect(() => parseBritishDate('29/02/2026')).toThrow();
    expect(() => parseBritishDate('31/04/2026')).toThrow();
  });
});

describe('statement layout and financial totals', () => {
  it('reconstructs positioned text in visual row order, rather than extraction order', () => {
    const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] });
    expect(textItemsToLines([
      item('3.00 |', 300, 100), item('NEXT ROW', 20, 80),
      item('10/10/2026 |', 20, 100), item('CAFE |', 150, 100.5),
    ], 2)).toEqual([
      { text: '10/10/2026 | CAFE | 3.00 |', page: 2, line: 1 },
      { text: 'NEXT ROW', page: 2, line: 2 },
    ]);
  });
  it('matches independently calculated fixture totals and keeps genuine repeated purchases', () => {
    const preview = parse();
    const summary = summariseTransactions(preview.transactions);
    expect(preview.transactions).toHaveLength(18);
    expect(preview.unresolvedRows).toEqual([]);
    expect(summary).toMatchObject({ grossSpendingPence: 61813, refundsPence: 500, netSpendingPence: 61313, incomePence: 41275, fundingPence: 240000, cashWithdrawalsPence: 4000 });
    expect(preview.openingBalancePence).toBe(156248);
    expect(summary.categoryTotals).toEqual({ housing: 48750, groceries: 3825, foodAndDrink: 2300, subscriptions: 599, shopping: 1299, transport: 340, bills: 4200, other: 0 });
    expect(preview.transactions.filter(item => item.date === '2026-10-22')).toHaveLength(2);
    expect(preview.transactions.every(item => !item.confirmedItem)).toBe(true);
  });
  it('reads changed contents, never a filename-based sample lookup', () => {
    const changed = SAMPLE_STATEMENT_LINES.map(line => line.replace('24.50', '25.50'));
    expect(summariseTransactions(parse(changed).transactions).netSpendingPence).toBe(61413);
  });
  it('surfaces invalid dates, dual amounts, missing descriptions and unknown rows', () => {
    const bad = [...SAMPLE_STATEMENT_LINES];
    bad.splice(8, 0, '31/02/2026 | CAFE | 3.00 |', '10/10/2026 | CAFE | 3.00 | 4.00', '10/10/2026 | | 3.00 |', 'BROKEN ROW');
    const result = parse(bad);
    expect(result.unresolvedRows).toHaveLength(4);
    expect(result.transactions).toHaveLength(18);
  });
  it('rejects unsupported layouts and missing table boundaries', () => {
    expect(() => parse(['Other bank layout'])).toThrow(/not supported/);
    expect(() => parse(SAMPLE_STATEMENT_LINES.filter(line => line !== 'END OF TRANSACTIONS'))).toThrow(/incomplete/);
  });
  it('creates a genuine PDF with correct xref location', () => {
    const pdf = new TextDecoder().decode(createTextPdf(SAMPLE_STATEMENT_LINES));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    const offset = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(offset, offset + 4)).toBe('xref');
    expect(pdf).toContain('2400.00');
  });
});

describe('review and confirmation', () => {
  it('requires explicit confirmation and rejects exact-file reimports', () => {
    const preview = parse();
    const ledger = empty();
    expect(ledger.transactions).toEqual([]);
    const next = confirmImport(ledger, preview, { transactions: preview.transactions, excludedRowIds: [], acknowledgedDuplicateIds: [] });
    expect(ledger.transactions).toEqual([]);
    expect(next.imports).toHaveLength(1);
    expect(() => confirmImport(next, preview, { transactions: preview.transactions, excludedRowIds: [], acknowledgedDuplicateIds: [] })).toThrow(/already/);
  });
  it('requires unresolved rows to be repaired or explicitly excluded', () => {
    const lines = [...SAMPLE_STATEMENT_LINES]; lines.splice(8, 0, 'BROKEN ROW');
    const preview = parse(lines);
    const options = { transactions: preview.transactions, excludedRowIds: [], acknowledgedDuplicateIds: [] };
    expect(() => confirmImport(empty(), preview, options)).toThrow(/unreadable/);
    const excluded = confirmImport(empty(), preview, { ...options, excludedRowIds: [preview.unresolvedRows[0].id] });
    expect(excluded.imports[0].excludedRows).toHaveLength(1);
    const row = preview.unresolvedRows[0];
    const repaired: Transaction = { ...cash(), id: row.id, source: 'statement', importId: preview.id, sourceRow: row.sourceRow };
    expect(confirmImport(empty(), preview, { ...options, transactions: [...preview.transactions, repaired] }).transactions).toHaveLength(19);
  });
  it('shifts the demo statement a whole month back so repeated demo imports stack up', () => {
    expect(sampleStatementLines(0)).toEqual(SAMPLE_STATEMENT_LINES);
    expect(sampleStatementLines(1)).toContain('Period: 01/09/2026 to 23/09/2026');
    expect(sampleStatementLines(10)).toContain('Period: 01/12/2025 to 23/12/2025');
    expect(sampleStatementFilename(1)).toBe('campus-demo-statement-2026-09.pdf');
    expect(sampleStatementLines(1)).toContain('Opening balance: 1762.86');
    expect(sampleStatementLines(2)).toContain('Opening balance: 1963.24');
    const october = parse();
    const september = parse(sampleStatementLines(1), 'fixture-september');
    const ledger = confirmImport(empty(), october, { transactions: october.transactions, excludedRowIds: [], acknowledgedDuplicateIds: [] });
    expect(possibleDuplicateIds(september.transactions, ledger.transactions)).toHaveLength(0);
    expect(confirmImport(ledger, september, { transactions: september.transactions, excludedRowIds: [], acknowledgedDuplicateIds: [] }).imports).toHaveLength(2);
  });
  it('flags overlapping statements without silently deleting legitimate purchases', () => {
    const first = parse();
    const ledger = confirmImport(empty(), first, { transactions: first.transactions, excludedRowIds: [], acknowledgedDuplicateIds: [] });
    const second = parse(SAMPLE_STATEMENT_LINES, 'fixture-b');
    expect(possibleDuplicateIds(second.transactions, ledger.transactions)).toHaveLength(18);
    expect(() => confirmImport(ledger, second, { transactions: second.transactions, excludedRowIds: [], acknowledgedDuplicateIds: [] })).toThrow(/duplicate/);
    expect(confirmImport(ledger, second, { transactions: second.transactions, excludedRowIds: [], acknowledgedDuplicateIds: second.transactions.map(item => item.id) }).transactions).toHaveLength(36);
  });
  it('validates review edits, signs, provenance and statement coverage', () => {
    const preview = parse();
    const options = { transactions: [{ ...preview.transactions[1], date: '2026-11-01' }], excludedRowIds: [], acknowledgedDuplicateIds: [] };
    expect(() => confirmImport(empty(), preview, options)).toThrow(/outside/);
    expect(validateTransaction({ ...cash(), amountPence: 300 })).toMatch(/money out/);
    expect(() => confirmImport(empty(), preview, { ...options, transactions: [{ ...cash(), source: 'statement' }] })).toThrow(/reference/);
  });
});

describe('manual expenses', () => {
  it('adds exactly GBP 3, edits and deletes without counting the ATM withdrawal twice', () => {
    const preview = parse();
    const ledger = confirmImport(empty(), preview, { transactions: preview.transactions, excludedRowIds: [], acknowledgedDuplicateIds: [] });
    const withCash = upsertManualExpense(ledger, cash());
    expect(summariseTransactions(withCash.transactions).netSpendingPence).toBe(61613);
    const edited = upsertManualExpense(withCash, cash(-450));
    expect(edited.transactions).toHaveLength(19);
    expect(summariseTransactions(edited.transactions).netSpendingPence).toBe(61763);
    expect(summariseTransactions(removeTransaction(edited, 'cash:1').transactions).netSpendingPence).toBe(61313);
  });
  it('cannot overwrite a statement entry through the cash form', () => {
    const ledger = { transactions: [{ ...cash(), source: 'statement' as const }], imports: [] };
    expect(() => upsertManualExpense(ledger, cash())).toThrow(/replace/);
    expect(() => upsertManualExpense(empty(), { ...cash(), kind: 'transfer' })).toThrow(/cash purchases/);
  });
});

describe('Racks frontend integration', () => {
  it('replaces fictional preview data rather than importing it as personal spending', () => {
    expect(getImportLedger({ transactions: [cash()], imports: [], isDemoData: true })).toEqual(empty());
  });
  it('round-trips signed pence, readable categories, provenance and duplicate fingerprints', () => {
    const preview = parse();
    const ledger = confirmImport(empty(), preview, { transactions: preview.transactions, excludedRowIds: [], acknowledgedDuplicateIds: [] });
    const action = ledgerReplacement(ledger);
    expect(action.coverage).toEqual({ startDate: '2026-10-01', endDate: '2026-10-23', statementCount: 1 });
    expect(action.transactions[1]).toMatchObject({ category: 'Rent & housing', amountPence: -48750, sourceRow: ledger.transactions[1].sourceRow });
    const restored = getImportLedger({ transactions: action.transactions, imports: action.imports!, isDemoData: false });
    expect(restored).toEqual(ledger);
    expect(() => confirmImport(restored, preview, { transactions: preview.transactions, excludedRowIds: [], acknowledgedDuplicateIds: [] })).toThrow(/already/);
  });
  it('covers all imported periods and manual dates while counting only statements', () => {
    const preview = parse();
    const ledger = confirmImport(empty(), preview, { transactions: preview.transactions, excludedRowIds: [], acknowledgedDuplicateIds: [] });
    const withCash = upsertManualExpense(ledger, { ...cash(), date: '2026-10-24' });
    expect(ledgerReplacement(withCash).coverage).toEqual({ startDate: '2026-10-01', endDate: '2026-10-24', statementCount: 1 });
    expect(ledgerReplacement(empty()).coverage).toBeNull();
  });
});

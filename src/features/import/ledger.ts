import { CATEGORY_LABELS, KIND_LABELS } from './types';
import type { Category, ImportPreview, LedgerState, SpendingSummary, Transaction, TransactionKind } from './types';
import { isIsoDate } from './money';

export function suggestClassification(description: string, amountPence: number): { kind: TransactionKind; category: Category } {
  const text = description.toUpperCase();
  let category: Category = 'other';
  if (/TESCO|CO-?OP|LIDL|ALDI|SAINSBURY|ASDA|MORRISONS/.test(text)) category = 'groceries';
  else if (/STARBUCKS|BLACK SHEEP|COFFEE|BAKERY|CAFE|CAFÉ|GREGGS|RESTAURANT/.test(text)) category = 'foodAndDrink';
  else if (/SPOTIFY|NETFLIX|DISNEY|SUBSCRIPTION/.test(text)) category = 'subscriptions';
  else if (/RENT|ACCOMMODATION/.test(text)) category = 'housing';
  else if (/ENERGY|ELECTRIC|BROADBAND|UTILITY/.test(text)) category = 'bills';
  else if (/FIRST GLASGOW|SCOTRAIL|BUS|SUBWAY|TRAIN/.test(text)) category = 'transport';
  else if (/WATERSTONES|AMAZON|BOOKSHOP/.test(text)) category = 'shopping';

  let kind: TransactionKind = amountPence < 0 ? 'expense' : 'income';
  if (/OWN ACCOUNT|OWN SAVINGS|TRANSFER TO SAVINGS|TRANSFER FROM SAVINGS/.test(text)) kind = 'transfer';
  else if (amountPence < 0 && /\bATM\b|CASH WITHDRAWAL/.test(text)) kind = 'cashWithdrawal';
  else if (amountPence > 0 && /REFUND|REVERSAL/.test(text)) kind = 'refund';
  else if (amountPence > 0 && /MAINTENANCE|SAAS|STUDENT LOAN|BURSARY|STUDENT FUNDING/.test(text)) kind = 'funding';
  return { kind, category };
}

export function validateTransaction(transaction: Transaction): string | null {
  if (!isIsoDate(transaction.date)) return 'Choose a valid date.';
  if (!transaction.description.trim()) return 'Add a description.';
  if (transaction.currency !== 'GBP') return 'Only GBP transactions are supported.';
  if (!(transaction.kind in KIND_LABELS) || !(transaction.category in CATEGORY_LABELS)) return 'Choose a valid type and category.';
  if (!Number.isSafeInteger(transaction.amountPence) || transaction.amountPence === 0 || Math.abs(transaction.amountPence) > 100_000_000_000) {
    return 'Enter a non-zero amount in pounds and pence.';
  }
  if (['expense', 'cashWithdrawal'].includes(transaction.kind) && transaction.amountPence > 0) return 'Purchases and withdrawals must be money out.';
  if (['income', 'funding', 'refund'].includes(transaction.kind) && transaction.amountPence < 0) return 'Income, funding and refunds must be money in.';
  return null;
}

export function summariseTransactions(transactions: readonly Transaction[]): SpendingSummary {
  const summary: SpendingSummary = {
    grossSpendingPence: 0, refundsPence: 0, netSpendingPence: 0, incomePence: 0,
    fundingPence: 0, cashWithdrawalsPence: 0,
    categoryTotals: Object.fromEntries(Object.keys(CATEGORY_LABELS).map(key => [key, 0])) as Record<Category, number>,
  };
  for (const transaction of transactions) {
    const problem = validateTransaction(transaction);
    if (problem) throw new Error(problem);
    if (transaction.kind === 'expense') {
      summary.grossSpendingPence -= transaction.amountPence;
      summary.categoryTotals[transaction.category] -= transaction.amountPence;
    } else if (transaction.kind === 'refund') {
      summary.refundsPence += transaction.amountPence;
      summary.categoryTotals[transaction.category] -= transaction.amountPence;
    } else if (transaction.kind === 'income') summary.incomePence += transaction.amountPence;
    else if (transaction.kind === 'funding') summary.fundingPence += transaction.amountPence;
    else if (transaction.kind === 'cashWithdrawal') summary.cashWithdrawalsPence -= transaction.amountPence;
  }
  summary.netSpendingPence = summary.grossSpendingPence - summary.refundsPence;
  return summary;
}

function duplicateKey(transaction: Transaction): string {
  return `${transaction.date}|${transaction.description.trim().toLowerCase().replace(/\s+/g, ' ')}|${transaction.amountPence}`;
}

export function possibleDuplicateIds(incoming: readonly Transaction[], existing: readonly Transaction[]): string[] {
  const keys = new Set(existing.map(duplicateKey));
  return incoming.filter(transaction => keys.has(duplicateKey(transaction))).map(transaction => transaction.id);
}

export interface ConfirmImportOptions {
  transactions: Transaction[];
  /** Each unresolved source row must be repaired with its original ID, or explicitly excluded. */
  excludedRowIds: string[];
  acknowledgedDuplicateIds: string[];
}

export function confirmImport(ledger: LedgerState, preview: ImportPreview, options: ConfirmImportOptions): LedgerState {
  if (ledger.imports.some(item => item.fingerprint === preview.fingerprint)) throw new Error('This statement has already been imported.');
  if (!options.transactions.length) throw new Error('Keep at least one transaction before importing.');
  const excluded = new Set(options.excludedRowIds);
  const repaired = new Set(options.transactions.map(transaction => transaction.id));
  const sourceIds = new Set([...preview.transactions.map(transaction => transaction.id), ...preview.unresolvedRows.map(row => row.id)]);
  for (const row of preview.unresolvedRows) {
    if (!excluded.has(row.id) && !repaired.has(row.id)) throw new Error('Fix or explicitly exclude every unreadable row before importing.');
    if (excluded.has(row.id) && repaired.has(row.id)) throw new Error('A repaired row cannot also be excluded.');
  }
  const ids = new Set(ledger.transactions.map(transaction => transaction.id));
  for (const transaction of options.transactions) {
    const problem = validateTransaction(transaction);
    if (problem) throw new Error(problem);
    if (!sourceIds.has(transaction.id) || transaction.importId !== preview.id || transaction.source !== 'statement') throw new Error('A reviewed row has lost its statement reference.');
    if (transaction.date < preview.coverageStart || transaction.date > preview.coverageEnd) throw new Error('A transaction falls outside this statement period.');
    if (ids.has(transaction.id)) throw new Error('A transaction ID is duplicated.');
    ids.add(transaction.id);
  }
  const acknowledged = new Set(options.acknowledgedDuplicateIds);
  if (possibleDuplicateIds(options.transactions, ledger.transactions).some(id => !acknowledged.has(id))) {
    throw new Error('Review possible duplicates: remove the extra row or choose to keep both.');
  }
  return {
    transactions: [...ledger.transactions, ...options.transactions],
    imports: [...ledger.imports, {
      id: preview.id, fingerprint: preview.fingerprint, filename: preview.filename, layout: preview.layout,
      coverageStart: preview.coverageStart, coverageEnd: preview.coverageEnd,
      transactionIds: options.transactions.map(transaction => transaction.id),
      excludedRows: preview.unresolvedRows.filter(row => excluded.has(row.id)),
    }],
  };
}

export function upsertManualExpense(ledger: LedgerState, transaction: Transaction): LedgerState {
  if (transaction.source !== 'manual' || transaction.kind !== 'expense' || transaction.importId) throw new Error('Use manual entry for cash purchases only.');
  const problem = validateTransaction(transaction);
  if (problem) throw new Error(problem);
  const existing = ledger.transactions.find(item => item.id === transaction.id);
  if (existing?.source === 'statement') throw new Error('A cash entry cannot replace a statement transaction.');
  return { ...ledger, transactions: existing
    ? ledger.transactions.map(item => item.id === transaction.id ? transaction : item)
    : [...ledger.transactions, transaction] };
}

export function removeTransaction(ledger: LedgerState, id: string): LedgerState {
  return { ...ledger, transactions: ledger.transactions.filter(transaction => transaction.id !== id) };
}

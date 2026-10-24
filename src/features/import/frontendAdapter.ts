import type { SharedAction, SharedState } from '../../assets/contracts';
import { CATEGORY_LABELS } from './types';
import type { Category, LedgerState } from './types';

const categories = new Map<string, Category>();
for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
  categories.set(key, key as Category);
  categories.set(label, key as Category);
}

/** The shell owns committed state; demo rows never become personal ledger entries. */
export function getImportLedger(state: Pick<SharedState, 'transactions' | 'imports' | 'isDemoData'>): LedgerState {
  if (state.isDemoData) return { transactions: [], imports: [] };
  return {
    transactions: state.transactions.map(transaction => ({
      ...transaction,
      category: categories.get(transaction.category) ?? 'other',
      sourceRow: transaction.sourceRow === undefined ? undefined : String(transaction.sourceRow),
    })),
    imports: state.imports,
  };
}

/** Preserve signed pence and source references; translate category IDs into dashboard labels. */
export function ledgerReplacement(ledger: LedgerState): Extract<SharedAction, { type: 'ledger/replace' }> {
  const dates = [
    ...ledger.imports.flatMap(item => [item.coverageStart, item.coverageEnd]),
    ...ledger.transactions.map(transaction => transaction.date),
  ].sort();
  return {
    type: 'ledger/replace',
    transactions: ledger.transactions.map(transaction => ({ ...transaction, category: CATEGORY_LABELS[transaction.category] })),
    imports: ledger.imports,
    coverage: dates.length ? { startDate: dates[0], endDate: dates[dates.length - 1], statementCount: ledger.imports.length } : null,
  };
}

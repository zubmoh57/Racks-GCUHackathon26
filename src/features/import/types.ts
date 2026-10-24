export const CATEGORY_LABELS = {
  housing: 'Rent & housing',
  groceries: 'Groceries',
  foodAndDrink: 'Food & drink',
  transport: 'Transport',
  subscriptions: 'Subscriptions',
  shopping: 'Shopping & books',
  bills: 'Bills',
  other: 'Other',
} as const;

export const KIND_LABELS = {
  expense: 'Purchase or bill',
  income: 'Income',
  funding: 'Student funding',
  refund: 'Refund',
  transfer: 'Own-account transfer',
  cashWithdrawal: 'Cash withdrawal',
} as const;

export type Category = keyof typeof CATEGORY_LABELS;
export type TransactionKind = keyof typeof KIND_LABELS;

export interface Transaction {
  id: string;
  date: string;
  description: string;
  merchant?: string;
  amountPence: number;
  currency: 'GBP';
  kind: TransactionKind;
  category: Category;
  source: 'statement' | 'manual';
  importId?: string;
  sourceRow?: string;
  confirmedItem?: string;
}

export interface ExtractedLine {
  text: string;
  page: number;
  line: number;
}

export interface UnresolvedRow {
  id: string;
  rawText: string;
  sourceRow: string;
  reason: string;
}

export interface ImportPreview {
  id: string;
  fingerprint: string;
  filename: string;
  layout: 'campus-v1';
  coverageStart: string;
  coverageEnd: string;
  transactions: Transaction[];
  unresolvedRows: UnresolvedRow[];
}

export interface StatementImport {
  id: string;
  fingerprint: string;
  filename: string;
  layout: 'campus-v1';
  coverageStart: string;
  coverageEnd: string;
  transactionIds: string[];
  excludedRows: UnresolvedRow[];
}

export interface LedgerState {
  transactions: Transaction[];
  imports: StatementImport[];
}

export interface SpendingSummary {
  grossSpendingPence: number;
  refundsPence: number;
  netSpendingPence: number;
  incomePence: number;
  fundingPence: number;
  cashWithdrawalsPence: number;
  categoryTotals: Record<Category, number>;
}

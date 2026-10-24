import type { Coverage, Transaction } from './contracts'

// Clearly fictional preview rows. Replace these with Zubair's reviewed sample ledger.
export const demoCoverage: Coverage = { startDate: '2026-10-18', endDate: '2026-10-24', statementCount: 1 }
export const demoTransactions: Transaction[] = [
  { id: 'demo-01', date: '2026-10-24', description: 'The Good Coffee Cart', merchant: 'The Good Coffee Cart', amountPence: -360, currency: 'GBP', kind: 'expense', category: 'Coffee & drinks', source: 'statement' },
  { id: 'demo-02', date: '2026-10-24', description: 'Tesco Express', merchant: 'Tesco Express', amountPence: -1245, currency: 'GBP', kind: 'expense', category: 'Groceries', source: 'statement' },
  { id: 'demo-03', date: '2026-10-23', description: 'Loop & Scoop', merchant: 'Loop & Scoop', amountPence: -480, currency: 'GBP', kind: 'expense', category: 'Coffee & treats', source: 'statement' },
  { id: 'demo-04', date: '2026-10-23', description: 'First Bus', merchant: 'First Bus', amountPence: -520, currency: 'GBP', kind: 'expense', category: 'Travel', source: 'statement' },
  { id: 'demo-05', date: '2026-10-22', description: 'Sainsbury’s Local', merchant: 'Sainsbury’s Local', amountPence: -1680, currency: 'GBP', kind: 'expense', category: 'Groceries', source: 'statement' },
  { id: 'demo-06', date: '2026-10-21', description: 'The Good Coffee Cart', merchant: 'The Good Coffee Cart', amountPence: -490, currency: 'GBP', kind: 'expense', category: 'Coffee & drinks', source: 'statement' },
  { id: 'demo-07', date: '2026-10-21', description: 'First Bus', merchant: 'First Bus', amountPence: -270, currency: 'GBP', kind: 'expense', category: 'Travel', source: 'statement' },
  { id: 'demo-08', date: '2026-10-20', description: 'Waterstones', merchant: 'Waterstones', amountPence: -900, currency: 'GBP', kind: 'expense', category: 'Books & study', source: 'statement' },
  { id: 'demo-09', date: '2026-10-19', description: 'Tesco Express', merchant: 'Tesco Express', amountPence: -2310, currency: 'GBP', kind: 'expense', category: 'Groceries', source: 'statement' },
  { id: 'demo-10', date: '2026-10-19', description: 'First Bus', merchant: 'First Bus', amountPence: -270, currency: 'GBP', kind: 'expense', category: 'Travel', source: 'statement' },
  { id: 'demo-11', date: '2026-10-18', description: 'Union Café', merchant: 'Union Café', amountPence: -720, currency: 'GBP', kind: 'expense', category: 'Eating out', source: 'statement' },
]

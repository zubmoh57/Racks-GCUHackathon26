import type { StatementImport as ImportRecord } from '../features/import/types'

export type TransactionKind = 'expense' | 'income' | 'funding' | 'refund' | 'transfer' | 'cashWithdrawal'
export type TransactionSource = 'statement' | 'manual'
export type Transaction = {
  id: string
  date: string
  description: string
  merchant?: string
  amountPence: number
  currency: 'GBP'
  kind: TransactionKind
  category: string
  source: TransactionSource
  importId?: string
  sourceRow?: string | number
  confirmedItem?: string
  reviewReason?: string
}
export type Coverage = { startDate: string; endDate: string; statementCount: number }
export type StatementImport = ImportRecord
export type DashboardPeriod = 'week' | 'month' | 'year'
export type AppRoute = 'dashboard' | 'import' | 'opportunities' | 'planning'
export type ProtectionRule = { id: string; scope: 'transaction' | 'confirmedItem' | 'merchant'; matchingKey: string; label: string }
export type OpportunityPreview = { id: string; kind: 'discount' | 'alternative' | 'free'; title: string; explanation: string; destinationUrl: string; sourceUrl: string; sourceLabel: string; checkedDate: string; eligibility: string; overlapGroup?: string; savingPence?: number; savingBasis?: 'purchase' | 'week' | 'month' }
export type SelectedAction = { id: string; opportunityId: string; frequency: 'week' | 'month' | 'one-off'; startDate: string; endDate?: string; selected: boolean; projectedSavingPence?: number }
export type BudgetSnapshot = { allowancePence: number; remainingPence: number; shortfallPence?: number; asOfDate: string }
export type GoalSnapshot = { id: string; name: string; targetPence: number; savedPence: number; targetDate?: string; potentialActionPence?: number }
export type MoneyPlan = {
  incomePence: number | null
  essentialsPence: number | null
  fundingPence: number
  freedom: number
  cushion: number
  future: number
  investmentReady: boolean
}
export type SharedState = {
  route: AppRoute
  transactions: Transaction[]
  imports: StatementImport[]
  coverage: Coverage | null
  isDemoData: boolean
  period: DashboardPeriod
  periodOffset: number
  selectedDate: string | null
  budget: BudgetSnapshot | null
  goal: GoalSnapshot | null
  opportunities: OpportunityPreview[]
  protections: ProtectionRule[]
  selectedActions: SelectedAction[]
  moneyPlan: MoneyPlan
}
export type SharedAction =
  | { type: 'navigation/go'; route: AppRoute }
  | { type: 'ledger/replace'; transactions: Transaction[]; coverage: Coverage | null; imports?: StatementImport[] }
  | { type: 'dashboard/period'; period: DashboardPeriod }
  | { type: 'dashboard/offset'; offset: number }
  | { type: 'dashboard/select-date'; date: string | null }
  | { type: 'planning/budget'; budget: BudgetSnapshot | null }
  | { type: 'planning/goal'; goal: GoalSnapshot | null }
  | { type: 'opportunities/replace'; opportunities: OpportunityPreview[] }
  | { type: 'protections/replace'; protections: ProtectionRule[] }
  | { type: 'actions/replace'; selectedActions: SelectedAction[] }
  | { type: 'planning/preferences'; patch: Partial<MoneyPlan> }

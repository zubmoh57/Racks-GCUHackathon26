import type { Coverage, Priorities, Transaction } from '../../assets/contracts'

export const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100)
export const dateLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export function transactionTone(row: Transaction): 'essential' | 'risk' | 'flexible' | 'incoming' | 'neutral' {
  if (row.kind === 'income' || row.kind === 'funding' || row.kind === 'refund') return 'incoming'
  if (row.kind !== 'expense') return 'neutral'
  if (/\b(bet365|betfair|ladbrokes|coral|paddy power|william hill|casino|gambling|sky bet|unibet)\b/i.test(`${row.description} ${row.merchant ?? ''}`)) return 'risk'
  if (['housing', 'groceries', 'transport', 'bills', 'Rent & housing', 'Groceries', 'Transport', 'Bills'].includes(row.category)) return 'essential'
  return 'flexible'
}

export function totals(rows: readonly Transaction[]) {
  const sum = (kind: Transaction['kind']) => rows.filter(row => row.kind === kind).reduce((total, row) => total + row.amountPence, 0)
  return { income: sum('income'), funding: sum('funding'), spending: -sum('expense') - sum('refund'), refunds: sum('refund') }
}

export function spendingRatio(spending: number, income: number) {
  if (income <= 0) return { percent: null, label: 'No income recorded', tone: 'neutral' }
  const percent = Math.max(0, spending / income * 100)
  const grade = percent <= 70 ? ['Great', 'great'] : percent <= 90 ? ['Good', 'good'] : percent <= 100 ? ['Needs improvement', 'warning'] : ['Over budget', 'risk']
  return { percent, label: grade[0], tone: grade[1] }
}

export function monthlyBaseline(rows: readonly Transaction[], coverage: Coverage | null) {
  if (!coverage) return { income: 0, funding: 0, essentials: 0 }
  const monthNumber = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7))
  const months = Math.max(1, monthNumber(coverage.endDate) - monthNumber(coverage.startDate) + 1)
  const essentialCategories = new Set(rows.filter(row => transactionTone(row) === 'essential').map(row => row.category))
  const essentials = rows.filter(row => transactionTone(row) === 'essential' || row.kind === 'refund' && essentialCategories.has(row.category)).reduce((sum, row) => sum - row.amountPence, 0)
  const summary = totals(rows)
  return { income: Math.round(summary.income / months), funding: Math.round(summary.funding / months), essentials: Math.max(0, Math.round(essentials / months)) }
}

export const coveredMonths = (rows: readonly Transaction[]) => [...new Set(rows.map(row => row.date.slice(0, 7)))].sort()

/** Income less spending, the same two figures the breakdown shows, carried from zero at the first statement. */
export function monthBalances(rows: readonly Transaction[], month: string) {
  const flow = (subset: readonly Transaction[]) => { const summary = totals(subset); return summary.income - summary.spending }
  const during = rows.filter(row => row.date.slice(0, 7) === month)
  const opening = flow(rows.filter(row => row.date.slice(0, 7) < month)), change = flow(during)
  return { opening, closing: opening + change, change, covered: during.length > 0 }
}

/** Essentials never reserve the last slice, so a plan always has something left to allocate. */
export const MINIMUM_ALLOCATABLE_SHARE = 0.01
export const PRIORITY_MAX = 10

/** Bills first, then the remainder in proportion to the ratings. Integer pence always reconcile to money in. */
export function recommendAllocation(moneyIn: number, essentials: number, priorities: Priorities) {
  if (![moneyIn, essentials].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('Use non-negative amounts in pence.')
  const ratings = [priorities.everyday, priorities.savings, priorities.investing]
  if (!ratings.every(value => Number.isInteger(value) && value >= 0 && value <= PRIORITY_MAX)) throw new Error(`Rate each priority from 0 to ${PRIORITY_MAX}.`)
  const reserved = Math.min(moneyIn, essentials, Math.floor(moneyIn * (1 - MINIMUM_ALLOCATABLE_SHARE)))
  const available = moneyIn - reserved
  const ratingTotal = ratings.reduce((sum, rating) => sum + rating, 0)
  const everyday = ratingTotal ? Math.floor(available * ratings[0] / ratingTotal) : 0
  const investing = ratingTotal ? Math.floor(available * ratings[2] / ratingTotal) : 0
  return {
    moneyIn, available, essentials: reserved, everyday, investing,
    /** Nothing rated, and every rounding penny, waits in cash savings. */
    savings: available - everyday - investing,
    shortfall: Math.max(0, essentials - moneyIn),
  }
}

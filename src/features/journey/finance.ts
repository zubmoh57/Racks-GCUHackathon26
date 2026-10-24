import type { Coverage, MoneyPlan, Transaction } from '../../assets/contracts'

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
  if (!coverage) return { income: 0, essentials: 0 }
  const monthNumber = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7))
  const months = Math.max(1, monthNumber(coverage.endDate) - monthNumber(coverage.startDate) + 1)
  const essentialCategories = new Set(rows.filter(row => transactionTone(row) === 'essential').map(row => row.category))
  const essentials = rows.filter(row => transactionTone(row) === 'essential' || row.kind === 'refund' && essentialCategories.has(row.category)).reduce((sum, row) => sum - row.amountPence, 0)
  return { income: Math.round(totals(rows).income / months), essentials: Math.max(0, Math.round(essentials / months)) }
}

/** Bills first; integer rounding always reconciles exactly to the available income. */
export function allocateMoney(income: number, essentials: number, preferences: Pick<MoneyPlan, 'freedom' | 'cushion' | 'future' | 'investmentReady'>) {
  if (![income, essentials].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('Use non-negative amounts in pence.')
  const weights = [preferences.freedom, preferences.cushion, preferences.future]
  if (!weights.every(value => Number.isFinite(value) && value >= 0 && value <= 100)) throw new Error('Choose priorities from 0 to 100.')
  const reserved = Math.min(income, essentials), available = income - reserved
  const weightTotal = weights.reduce((a, b) => a + b, 0)
  const freedom = weightTotal ? Math.floor(available * weights[0] / weightTotal) : 0
  const future = weightTotal ? Math.floor(available * weights[2] / weightTotal) : 0
  const cushion = available - freedom - future
  return { essentials: reserved, freedom, cushion: cushion + (preferences.investmentReady ? 0 : future), invest: preferences.investmentReady ? future : 0, shortfall: Math.max(0, essentials - income) }
}

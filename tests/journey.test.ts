import { describe, expect, it } from 'vitest'
import type { Transaction } from '../src/assets/contracts'
import { monthBalances, monthlyBaseline, PRIORITY_MAX, recommendAllocation, spendingRatio, totals, transactionTone } from '../src/features/journey/finance'
import { isProtected, savingsInput } from '../src/features/journey/savingsAdapter'
import { monthLabel, statementMonths } from '../src/features/import/statementMonths'
import type { StatementImport } from '../src/features/import/types'

const row = (patch: Partial<Transaction> = {}): Transaction => ({ id: 'purchase', date: '2026-10-10', description: 'TESCO GLASGOW', merchant: 'Tesco', amountPence: -2500, currency: 'GBP', kind: 'expense', category: 'Groceries', source: 'statement', ...patch })

describe('income and spending breakdown', () => {
  it('separates funding and income, nets refunds and excludes own transfers and withdrawals', () => {
    expect(totals([row(), row({ kind: 'refund', amountPence: 500 }), row({ kind: 'income', amountPence: 32000 }), row({ kind: 'funding', amountPence: 240000 }), row({ kind: 'transfer', amountPence: -10000 }), row({ kind: 'cashWithdrawal', amountPence: -4000 })])).toEqual({ income: 32000, funding: 240000, spending: 2000, refunds: 500 })
  })
  it.each([[70, 'Great'], [90, 'Good'], [100, 'Needs improvement'], [101, 'Over budget']])('rates %s percent as %s', (percent, label) => expect(spendingRatio(percent, 100).label).toBe(label))
  it('does not invent a ratio when no income was recorded', () => expect(spendingRatio(2000, 0).percent).toBeNull())
  it('shows negative net spending without a negative health ratio', () => {
    expect(totals([row({ kind: 'refund', amountPence: 500 })]).spending).toBe(-500)
    expect(spendingRatio(-500, 10000).percent).toBe(0)
  })
  it('labels a gambling merchant for checking without marking every flexible purchase red', () => {
    expect(transactionTone(row({ description: 'BET365', category: 'Other' }))).toBe('risk')
    expect(transactionTone(row({ description: 'Cafe', category: 'Food & drink' }))).toBe('flexible')
    expect(transactionTone(row({ description: 'First Glasgow', category: 'Transport' }))).toBe('essential')
  })
  it('does not treat a refunded gambling charge or an own transfer as current gambling spending', () => {
    expect(transactionTone(row({ description: 'BET365 REFUND', kind: 'refund', amountPence: 500 }))).toBe('incoming')
    expect(transactionTone(row({ description: 'Casino own transfer', kind: 'transfer' }))).toBe('neutral')
  })
  it('averages wages and net essentials over covered calendar months, excluding termly funding', () => {
    const baseline = monthlyBaseline([row(), row({ kind: 'refund', amountPence: 500 }), row({ kind: 'income', amountPence: 32000 }), row({ kind: 'funding', amountPence: 240000 })], { startDate: '2026-09-20', endDate: '2026-10-23', statementCount: 1 })
    expect(baseline).toEqual({ income: 16000, funding: 120000, essentials: 1000 })
  })
  it('runs a balance from zero through the months, counting transfers and withdrawals', () => {
    const rows = [row({ id: 'a', date: '2026-09-08', kind: 'income', amountPence: 32000 }), row({ id: 'b', date: '2026-09-12', amountPence: -2000 }), row({ id: 'c', date: '2026-10-05', kind: 'cashWithdrawal', amountPence: -4000 }), row({ id: 'd', date: '2026-10-07', kind: 'transfer', amountPence: -10000 })]
    expect(monthBalances(rows, '2026-09')).toEqual({ opening: 0, closing: 30000, change: 30000, covered: true })
    expect(monthBalances(rows, '2026-10')).toEqual({ opening: 30000, closing: 16000, change: -14000, covered: true })
  })
  it('carries the running balance into a month with no activity of its own', () => {
    expect(monthBalances([row({ date: '2026-09-12', amountPence: -2000 })], '2026-10')).toEqual({ opening: -2000, closing: -2000, change: 0, covered: false })
  })
})

describe('recommended allocation', () => {
  const ratings = { everyday: 5, savings: 3, investing: 2 }

  it('reserves essentials, then splits the remainder in proportion to the ratings', () => {
    expect(recommendAllocation(100000, 60000, ratings)).toEqual({ moneyIn: 100000, available: 40000, essentials: 60000, everyday: 20000, savings: 12000, investing: 8000, shortfall: 0 })
  })
  it('gives the bigger share to the higher rating', () => {
    const result = recommendAllocation(100000, 0, { everyday: 1, savings: 2, investing: 7 })
    expect(result.investing).toBeGreaterThan(result.savings)
    expect(result.savings).toBeGreaterThan(result.everyday)
  })
  it('reports the shortfall but still leaves 1% to allocate when essentials exceed money in', () => {
    expect(recommendAllocation(32000, 70000, { everyday: 5, savings: 5, investing: 0 })).toEqual({ moneyIn: 32000, available: 320, essentials: 31680, everyday: 160, savings: 160, investing: 0, shortfall: 38000 })
  })
  it('leaves everything in cash savings when nothing is rated', () => {
    expect(recommendAllocation(10000, 1000, { everyday: 0, savings: 0, investing: 0 })).toMatchObject({ essentials: 1000, everyday: 0, savings: 9000, investing: 0 })
  })
  it('reconciles every penny even for small amounts and uneven ratings', () => {
    for (let moneyIn = 0; moneyIn < 300; moneyIn++) {
      const result = recommendAllocation(moneyIn, 17, { everyday: 3, savings: 1, investing: 9 })
      expect(result.essentials + result.everyday + result.savings + result.investing).toBe(moneyIn)
      expect(Math.min(result.essentials, result.everyday, result.savings, result.investing)).toBeGreaterThanOrEqual(0)
    }
  })
  it('rejects invalid amounts and ratings', () => {
    expect(() => recommendAllocation(-1, 0, ratings)).toThrow()
    expect(() => recommendAllocation(100, 0, { ...ratings, everyday: PRIORITY_MAX + 1 })).toThrow()
    expect(() => recommendAllocation(100, 0, { ...ratings, savings: 2.5 })).toThrow()
  })
})

describe('uploaded statement months', () => {
  const statement = (start: string, end: string): StatementImport => ({ id: start, fingerprint: start, filename: 'unhelpful-filename.pdf', layout: 'campus-v1', coverageStart: start, coverageEnd: end, transactionIds: [], excludedRows: [] })
  it('uses statement coverage and includes every month across a year boundary', () => expect(statementMonths([statement('2026-12-20', '2027-02-03')])).toEqual(['2026-12', '2027-01', '2027-02']))
  it('sorts and deduplicates months from multiple statements', () => expect(statementMonths([statement('2026-11-01', '2026-11-23'), statement('2026-10-01', '2026-11-10')])).toEqual(['2026-10', '2026-11']))
  it('includes the year in the readable month label', () => expect(monthLabel('2026-10')).toBe('October 2026'))
})

describe('savings integration', () => {
  it('converts only purchases into positive pounds and reduces them by category refunds', () => {
    const result = savingsInput([row(), row({ kind: 'refund', amountPence: 500 }), row({ kind: 'income', amountPence: 10000 }), row({ kind: 'funding', amountPence: 20000 }), row({ kind: 'cashWithdrawal', amountPence: -5000 })], [])
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(20)
    expect(result[0].category).toBe('groceries')
  })
  it('never turns excess refunds into new savings opportunities', () => expect(savingsInput([row(), row({ kind: 'refund', amountPence: 3000 })], [])).toEqual([]))
  it('retains every penny when a refund is shared between multiple purchases', () => {
    const input = savingsInput([row({ amountPence: -2450 }), row({ id: 'second', amountPence: -1875 }), row({ kind: 'refund', amountPence: 500 })], [])
    expect(input.reduce((sum, item) => sum + Math.round(item.amount * 100), 0)).toBe(3825)
  })
  it('applies protection after refund allocation instead of reallocating protected spending to other purchases', () => {
    const input = savingsInput([row(), row({ id: 'second' }), row({ kind: 'refund', amountPence: 1000 })], [{ id: 'rule', scope: 'transaction', matchingKey: 'purchase', label: 'Keep' }])
    expect(input).toHaveLength(1)
    expect(input[0].amount).toBe(20)
  })
  it('excludes a protected purchase before the recommendation engine sees it', () => expect(savingsInput([row()], [{ id: 'rule', scope: 'transaction', matchingKey: 'purchase', label: 'Keep this' }])).toEqual([]))
  it('supports exact merchant and confirmed-item protections', () => {
    expect(isProtected(row(), [{ id: 'rule', scope: 'merchant', matchingKey: 'tesco', label: 'Keep this' }])).toBe(true)
    expect(isProtected(row({ confirmedItem: 'Favourite cake' }), [{ id: 'rule', scope: 'confirmedItem', matchingKey: 'favourite cake', label: 'Keep this' }])).toBe(true)
  })
})

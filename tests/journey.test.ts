import { describe, expect, it } from 'vitest'
import type { Transaction } from '../src/assets/contracts'
import { allocateMoney, monthlyBaseline, moveDivider, piePercentages, rebalanceShares, spendingRatio, totals, transactionTone } from '../src/features/journey/finance'
import { isProtected, savingsInput } from '../src/features/journey/savingsAdapter'
import { monthLabel, statementMonths } from '../src/features/import/statementMonths'
import type { StatementImport } from '../src/features/import/types'

const row = (patch: Partial<Transaction> = {}): Transaction => ({ id: 'purchase', date: '2026-10-10', description: 'TESCO GLASGOW', merchant: 'Tesco', amountPence: -2500, currency: 'GBP', kind: 'expense', category: 'Groceries', source: 'statement', ...patch })
const preferences = { freedom: 50, cushion: 35, future: 15, investmentReady: true }

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
    expect(baseline).toEqual({ income: 16000, essentials: 1000 })
  })
})

describe('monthly allocation', () => {
  it('reserves essentials before sharing the remainder', () => expect(allocateMoney(100000, 60000, preferences)).toEqual({ essentials: 60000, freedom: 20000, cushion: 14000, invest: 6000, shortfall: 0 }))
  it('shows a shortfall instead of allocating money that does not exist', () => expect(allocateMoney(32000, 70000, preferences)).toEqual({ essentials: 32000, freedom: 0, cushion: 0, invest: 0, shortfall: 38000 }))
  it('keeps the long-term share in cash until investing is explicitly enabled', () => expect(allocateMoney(100000, 60000, { ...preferences, investmentReady: false }).cushion).toBe(20000))
  it('keeps the remainder in cash if all priorities are zero', () => expect(allocateMoney(10000, 1000, { freedom: 0, cushion: 0, future: 0, investmentReady: true })).toEqual({ essentials: 1000, freedom: 0, cushion: 9000, invest: 0, shortfall: 0 }))
  it('reconciles every penny even for small amounts and uneven weights', () => {
    for (let amount = 0; amount < 300; amount++) {
      const result = allocateMoney(amount, 17, { freedom: 31, cushion: 7, future: 99, investmentReady: true })
      expect(result.essentials + result.freedom + result.cushion + result.invest).toBe(amount)
      expect(Math.min(result.essentials, result.freedom, result.cushion, result.invest)).toBeGreaterThanOrEqual(0)
    }
  })
  it('rejects invalid amounts and priorities', () => {
    expect(() => allocateMoney(-1, 0, preferences)).toThrow()
    expect(() => allocateMoney(100, 0, { ...preferences, freedom: NaN })).toThrow()
  })
})

describe('percentage controls', () => {
  it('moves a divider between spending and cash without changing investing', () => expect(moveDivider(preferences, 'freedom', 'cushion', 60)).toEqual({ freedom: 60, cushion: 25, future: 15 }))
  it('moves a cash/investing divider without changing spending', () => expect(moveDivider(preferences, 'cushion', 'future', 20)).toEqual({ freedom: 50, cushion: 20, future: 30 }))
  it('clamps divider movement to its two slices without creating negative amounts', () => {
    expect(moveDivider(preferences, 'freedom', 'cushion', 100)).toEqual({ freedom: 85, cushion: 0, future: 15 })
    expect(moveDivider(preferences, 'cushion', 'future', -1)).toEqual({ freedom: 50, cushion: 0, future: 50 })
  })
  it('keeps the essentials percentage fixed while rounding the other slices to a complete 100%', () => {
    for (let spending = 0; spending <= 1000; spending++) {
      const percentages = piePercentages([20000, spending, 100000 - spending, 0], true)
      expect(percentages[0]).toBe(16.7)
      expect(percentages.reduce((sum, value) => sum + Math.round(value * 10), 0)).toBe(1000)
    }
  })
  it('preserves the chosen percentage and rebalances the other two', () => {
    expect(rebalanceShares({ freedom: 50, cushion: 35, future: 15 }, 'freedom', 70)).toEqual({ freedom: 70, cushion: 21, future: 9 })
  })
  it('handles a slice going from all to none without introducing an investing allocation', () => {
    expect(rebalanceShares({ freedom: 0, cushion: 100, future: 0 }, 'cushion', 0)).toEqual({ freedom: 100, cushion: 0, future: 0 })
  })
  it('prevents floating-point rebalancing from creating a negative sliver', () => {
    const result = rebalanceShares({ freedom: 0.1, cushion: 99.9, future: 0 }, 'cushion', 0.1)
    expect(result).toEqual({ freedom: 99.9, cushion: 0.1, future: 0 })
    expect(() => allocateMoney(100000, 0, { ...result, investmentReady: true })).not.toThrow()
  })
  it('clamps boundaries and always keeps the split at 100%', () => {
    for (const key of ['freedom', 'cushion', 'future'] as const) {
      for (const amount of [-10, 0, 0.1, 29.7, 70, 100, 120]) {
        const result = rebalanceShares(preferences, key, amount)
        expect(result.freedom + result.cushion + result.future).toBeCloseTo(100, 10)
        expect(Math.min(result.freedom, result.cushion, result.future)).toBeGreaterThanOrEqual(0)
      }
    }
  })
  it('displays a complete 100% even when every slice would round down', () => expect(piePercentages([1, 1, 1])).toEqual([33.4, 33.3, 33.3]))
  it('reconciles chart percentages to 100.0% across small and uneven monetary values', () => {
    for (let amount = 1; amount <= 300; amount++) {
      const result = allocateMoney(amount, 17, preferences)
      const percentages = piePercentages([result.essentials, result.freedom, result.cushion, result.invest])
      expect(percentages.reduce((sum, value) => sum + Math.round(value * 10), 0)).toBe(1000)
    }
  })
  it('shows no allocation for no money rather than a fictional full pie', () => expect(piePercentages([0, 0, 0, 0])).toEqual([0, 0, 0, 0]))
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

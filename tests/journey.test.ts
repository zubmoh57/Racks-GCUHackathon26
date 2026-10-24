import { describe, expect, it } from 'vitest'
import type { Transaction } from '../src/assets/contracts'
import { allocateMoney, monthlyBaseline, spendingRatio, totals, transactionTone } from '../src/features/journey/finance'
import { isProtected, savingsInput } from '../src/features/journey/savingsAdapter'

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

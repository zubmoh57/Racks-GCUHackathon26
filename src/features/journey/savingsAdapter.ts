import type { ProtectionRule, Transaction } from '../../assets/contracts'
import type { SavingsInput } from '../../../savings/engine/index.js'

const categoryMap: Record<string, string> = {
  housing: 'housing', 'Rent & housing': 'housing', groceries: 'groceries', Groceries: 'groceries',
  foodAndDrink: 'eating-out', 'Food & drink': 'eating-out', transport: 'transport', Transport: 'transport',
  bills: 'utilities', Bills: 'utilities', subscriptions: 'extra-subs', Subscriptions: 'extra-subs',
  shopping: 'personal-care', 'Shopping & books': 'personal-care',
}

export function isProtected(row: Transaction, rules: readonly ProtectionRule[]) {
  return rules.some(rule => rule.scope === 'transaction' ? rule.matchingKey === row.id : rule.scope === 'confirmedItem'
    ? !!row.confirmedItem && rule.matchingKey.toLowerCase() === row.confirmedItem.toLowerCase()
    : !!row.merchant && rule.matchingKey.toLowerCase() === row.merchant.toLowerCase())
}

/** The engine expects positive pounds. Exclude non-purchases and offset category refunds. */
export function savingsInput(rows: readonly Transaction[], protections: readonly ProtectionRule[]): SavingsInput[] {
  const expenses = rows.filter(row => row.kind === 'expense')
  const allocated = new Map<string, number>()
  return expenses.map(row => {
    const categorySpend = expenses.filter(other => other.category === row.category).reduce((sum, other) => sum - other.amountPence, 0)
    const refunds = rows.filter(other => other.kind === 'refund' && other.category === row.category).reduce((sum, other) => sum + other.amountPence, 0)
    const previous = allocated.get(row.category) ?? 0
    const current = previous - row.amountPence
    allocated.set(row.category, current)
    const net = Math.max(0, categorySpend - refunds)
    // Cumulative rounding keeps the category's final penny, including before protection.
    const amount = (Math.floor(current * net / Math.max(1, categorySpend)) - Math.floor(previous * net / Math.max(1, categorySpend))) / 100
    const isBook = /waterstones|blackwell|\bbook\b|kindle/i.test(`${row.description} ${row.confirmedItem ?? ''}`)
    return { id: row.id, date: row.date, description: `${row.description} ${row.confirmedItem ?? ''}`.trim(), merchant: row.merchant, amount, category: isBook ? 'tuition' : categoryMap[row.category] ?? 'unknown' }
  }).filter(row => row.amount > 0 && !isProtected(expenses.find(expense => expense.id === row.id)!, protections))
}

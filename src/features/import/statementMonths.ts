import type { StatementImport } from './types'

export const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Months come from the statement period, not the filename or upload date. */
export function statementMonths(imports: readonly StatementImport[]): string[] {
  const months = new Set<string>()
  for (const statement of imports) {
    const date = new Date(`${statement.coverageStart.slice(0, 7)}-01T00:00:00Z`)
    const end = statement.coverageEnd.slice(0, 7)
    while (date.toISOString().slice(0, 7) <= end) {
      months.add(date.toISOString().slice(0, 7))
      date.setUTCMonth(date.getUTCMonth() + 1)
    }
  }
  return [...months].sort()
}

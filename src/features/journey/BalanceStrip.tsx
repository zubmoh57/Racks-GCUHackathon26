import type { StatementImport, Transaction } from '../../assets/contracts'
import { monthLabel } from '../import/statementMonths'
import { monthBalances, money, startingBalance } from './finance'

/** Income less spending, carried month to month. Funding, transfers and withdrawals stay out of it. */
export function BalanceStrip({ rows, imports, month }: { rows: readonly Transaction[]; imports: readonly StatementImport[]; month: string }) {
  const startsAt = startingBalance(imports)
  const balances = monthBalances(rows, month, startsAt ?? 0)
  const name = monthLabel(month)
  const source = startsAt === null
    ? 'from £0, because no statement declared an opening balance'
    : `on from the ${money(startsAt)} opening balance on your earliest statement`
  return <div className="balance-strip" aria-label={`Balance across ${name}`}>
    <span className="balance-strip-label">BALANCE · {name.toUpperCase()}</span>
    <div className="balance-tiles">
      <div className="balance-tile"><span>START OF MONTH</span><strong>{money(balances.opening)}</strong></div>
      <span className="balance-arrow" aria-hidden="true">⟶</span>
      <div className="balance-tile"><span>END OF MONTH</span><strong>{money(balances.closing)}</strong></div>
      <div className={'balance-tile balance-change ' + (balances.change < 0 ? 'down' : 'up')}><span>CHANGE</span><strong>{balances.change > 0 ? '+' : ''}{money(balances.change)}</strong></div>
    </div>
    <small>{balances.covered
      ? `Your income less your spending, carried ${source}. Student funding, transfers and cash withdrawals are not counted.`
      : `No transactions in ${name}.`}</small>
  </div>
}

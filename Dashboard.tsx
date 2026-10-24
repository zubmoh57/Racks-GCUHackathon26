import { useState } from 'react'
import { useAppState } from './useAppState'
import { getImportLedger, ledgerReplacement } from './src/features/import/frontendAdapter'
import { ReviewTransactionForm } from './src/features/import/ReviewTransactionForm'
import { removeTransaction, upsertManualExpense } from './src/features/import/ledger'
import type { Transaction } from './src/features/import/types'
import { coveredMonths, dateLabel, money, spendingRatio, totals, transactionTone } from './src/features/journey/finance'
import { BalanceStrip } from './src/features/journey/BalanceStrip'

const labels = { essential: 'Essential', flexible: 'Flexible', risk: 'Check this · gambling', incoming: 'Money in', neutral: 'Transfer / cash' }

export default function Dashboard() {
  const { state, dispatch } = useAppState()
  const [period, setPeriod] = useState('all')
  const [anchor, setAnchor] = useState(state.coverage?.endDate ?? new Date().toISOString().slice(0, 10))
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const ledger = getImportLedger(state)
  const rows = state.transactions.filter(row => period === 'all' || row.date.slice(0, period === 'day' ? 10 : period === 'month' ? 7 : 4) === anchor.slice(0, period === 'day' ? 10 : period === 'month' ? 7 : 4))
  const summary = totals(rows)
  const income = summary.income
  const ratio = spendingRatio(summary.spending, income)
  const covered = coveredMonths(state.transactions)
  const balanceMonth = period === 'day' || period === 'month' ? anchor.slice(0, 7) : covered[covered.length - 1] ?? anchor.slice(0, 7)
  const displayed = rows.filter(row => (filter === 'all' || transactionTone(row) === filter) && `${row.description} ${row.confirmedItem ?? ''} ${row.category}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date))
  const coverageLabel = state.coverage ? `${dateLabel(state.coverage.startDate)} – ${dateLabel(state.coverage.endDate)} ${state.coverage.endDate.slice(0, 4)}` : 'Your statements'

  function save(row: Transaction) {
    const next = row.source === 'manual' ? upsertManualExpense(ledger, row) : { ...ledger, transactions: ledger.transactions.map(existing => existing.id === row.id ? row : existing) }
    dispatch(ledgerReplacement(next))
    setEditing(null)
  }
  function addCash() {
    setEditing({ id: `manual:${crypto.randomUUID()}`, date: anchor, description: '', amountPence: 0, currency: 'GBP', kind: 'expense', category: 'other', source: 'manual' })
  }
  function removeCash(id: string) {
    dispatch(ledgerReplacement(removeTransaction(ledger, id)))
  }

  return <div className="breakdown-page">
    <div className="page-heading"><div><p className="step-kicker">STEP 02 / YOUR BREAKDOWN</p><h1>Your income & spending.</h1></div><span className="heading-tag">{coverageLabel}</span></div>
    <section className="surface balance-panel" aria-label="Income and spending summary">
      <div className="panel-toolbar"><h2>Your money at a glance</h2><div className="date-controls"><div className="segmented" aria-label="Reporting period">{[['all', 'All dates'], ['day', 'Day'], ['month', 'Month'], ['year', 'Year']].map(([value, label]) => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>)}</div>{period !== 'all' && <input type="date" aria-label="Date within reporting period" value={anchor} onChange={event => { if (event.target.value) setAnchor(event.target.value) }} />}</div></div>
      <div className="balance-grid">
        <div className="balance-amount income-amount"><span className="metric-label">INCOME</span><strong>{money(income)}</strong><span className="metric-detail">Wages and other income</span></div>
        <div className={'ratio-summary ' + ratio.tone}><span className="metric-label">SPENDING / INCOME</span><strong>{ratio.percent === null ? '—' : `${ratio.percent.toLocaleString('en-GB', { maximumFractionDigits: 1 })}%`}</strong><span className="status-label">{ratio.label}</span></div>
        <div className="balance-amount spending-amount"><span className="metric-label">SPENDING</span><strong>{money(summary.spending)}</strong><span className="metric-detail">Purchases less {money(summary.refunds)} in refunds</span></div>
      </div>
      <BalanceStrip rows={state.transactions} month={balanceMonth} />
    </section>
    <section className="surface purchases-panel" aria-labelledby="purchases-title">
      <div className="panel-toolbar"><div><h2 id="purchases-title">Your transactions <span className="count-badge">{displayed.length}</span></h2><p className="subtle">Categories are suggestions. Edit anything that doesn’t look right.</p></div><button className="secondary-button" onClick={addCash}>+ Add other expenses</button></div>
      <div className="purchase-filters"><div className="filter-tabs" aria-label="Filter transactions">{[['all', 'All activity'], ['essential', 'Essentials'], ['flexible', 'Flexible']].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><input className="transaction-search" type="search" aria-label="Search transactions" placeholder="Search transactions" value={search} onChange={event => setSearch(event.target.value)} /></div>
      {editing && <div className="pdf-import transaction-editor"><h3>{editing.source === 'manual' ? 'Other expenses' : 'Edit transaction'}</h3><ReviewTransactionForm key={editing.id} transaction={editing} startDate={editing.source === 'manual' ? '1900-01-01' : state.coverage?.startDate ?? '1900-01-01'} endDate={editing.source === 'manual' ? '2100-12-31' : state.coverage?.endDate ?? '2100-12-31'} onSave={save} onCancel={() => setEditing(null)} /></div>}
      <div className="purchase-table-scroll" tabIndex={0} aria-label="Transaction list"><table className="purchase-table"><thead><tr><th>Transaction</th><th>Date</th><th>Category</th><th>Spending type</th><th className="numeric">Amount</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {displayed.map(row => { const tone = transactionTone(row); return <tr key={row.id} className={'transaction-' + tone}>
          <td><div className="merchant-cell"><span className="merchant-mark" aria-hidden="true">{tone === 'incoming' ? '↓' : tone === 'risk' ? '!' : row.description.slice(0, 1)}</span><div><b>{row.description}</b>{row.confirmedItem && <small>{row.confirmedItem}</small>}{row.source === 'manual' && <small>Added by you</small>}</div></div></td>
          <td><time dateTime={row.date}>{dateLabel(row.date)}</time></td><td>{row.category}</td><td><span className={'transaction-badge ' + tone}>{labels[tone]}</span></td><td className={'numeric ' + (row.amountPence > 0 ? 'positive' : '')}>{row.amountPence > 0 ? '+' : '−'}{money(Math.abs(row.amountPence))}</td>
          <td><div className="row-actions"><button className="text-link" aria-label={`Edit ${row.description}`} onClick={() => setEditing(ledger.transactions.find(item => item.id === row.id) ?? null)}>Edit</button>{row.source === 'manual' && <button className="text-link danger-link" aria-label={`Remove ${row.description}`} onClick={() => removeCash(row.id)}>Remove</button>}</div></td>
        </tr> })}
      </tbody></table>{!displayed.length && <p className="empty-state">No transactions match this view. Try another date or filter.</p>}</div>
      <div className="purchase-legend"><span><i className="dot essential-dot"/>Essential spending</span></div>
    </section>
    <div className="page-actions"><button className="back-button" onClick={() => dispatch({ type: 'navigation/go', route: 'import' })}>← Upload another statement</button><button className="primary-button" onClick={() => dispatch({ type: 'navigation/go', route: 'opportunities' })}>Find ways to save <span aria-hidden="true">→</span></button></div>
  </div>
}

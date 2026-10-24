import { useAppState } from './useAppState'
import type { DashboardPeriod, Transaction } from './src/assets/contracts'

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const periods: [DashboardPeriod, string][] = [['week', '7 days'], ['month', 'Month'], ['year', 'Year']]
const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100)
const utc = (value: string) => new Date(value + 'T00:00:00.000Z')
const iso = (date: Date) => date.toISOString().slice(0, 10)

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + amount)
  return next
}

function rangeFor(period: DashboardPeriod, coverageEnd: string, offset: number) {
  const anchor = utc(coverageEnd)
  if (period === 'week') {
    const end = addDays(anchor, -7 * offset)
    return { start: iso(addDays(end, -6)), end: iso(end) }
  }
  if (period === 'month') {
    const month = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - offset, 1))
    return { start: iso(month), end: iso(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0))) }
  }
  const year = anchor.getUTCFullYear() - offset
  return { start: year + '-01-01', end: year + '-12-31' }
}

function spendValue(transaction: Transaction) {
  return transaction.kind === 'expense' || transaction.kind === 'refund' ? -transaction.amountPence : 0
}

function buckets(period: DashboardPeriod, start: string, end: string) {
  const first = utc(start)
  const last = utc(end)
  const result: { start: string; end: string; label: string }[] = []
  if (period === 'year') {
    for (let month = first.getUTCMonth(); month <= last.getUTCMonth(); month += 1) {
      const monthStart = new Date(Date.UTC(first.getUTCFullYear(), month, 1))
      const monthEnd = new Date(Date.UTC(first.getUTCFullYear(), month + 1, 0))
      result.push({ start: iso(monthStart), end: iso(monthEnd), label: monthStart.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }) })
    }
  } else if (period === 'month') {
    for (let date = new Date(first); date <= last;) {
      const weekEnd = addDays(date, 6)
      const clippedEnd = weekEnd > last ? last : weekEnd
      result.push({ start: iso(date), end: iso(clippedEnd), label: date.getUTCDate() + '–' + clippedEnd.getUTCDate() })
      date = addDays(clippedEnd, 1)
    }
  } else {
    for (let date = new Date(first); date <= last; date = addDays(date, 1)) {
      result.push({ start: iso(date), end: iso(date), label: shortDays[date.getUTCDay()] })
    }
  }
  return result
}

function Dashboard() {
  const { state, dispatch } = useAppState()
  const coverage = state.coverage
  const bounds = coverage ? rangeFor(state.period, coverage.endDate, state.periodOffset) : null
  const clipped = bounds && coverage
    ? { start: bounds.start > coverage.startDate ? bounds.start : coverage.startDate, end: bounds.end < coverage.endDate ? bounds.end : coverage.endDate }
    : null
  const visible = clipped && clipped.start <= clipped.end ? clipped : null
  const rows = visible ? state.transactions.filter(transaction => transaction.date >= visible.start && transaction.date <= visible.end) : []
  const spendingRows = rows.filter(transaction => transaction.kind === 'expense' || transaction.kind === 'refund')
  const total = spendingRows.reduce((sum, transaction) => sum + spendValue(transaction), 0)
  const activeDayCount = new Set(spendingRows.map(transaction => transaction.date)).size
  const average = activeDayCount ? Math.round(total / activeDayCount) : 0
  const grouped = spendingRows.reduce<Record<string, number>>((totals, transaction) => {
    totals[transaction.category] = (totals[transaction.category] || 0) + spendValue(transaction)
    return totals
  }, {})
  const categories = Object.entries(grouped).sort((left, right) => right[1] - left[1])
  const chartBuckets = visible ? buckets(state.period, visible.start, visible.end) : []
  const chartValues = chartBuckets.map(bucket => rows.filter(transaction => transaction.date >= bucket.start && transaction.date <= bucket.end).reduce((sum, transaction) => sum + spendValue(transaction), 0))
  const chartMaximum = Math.max(1, ...chartValues)
  const shownRows = state.selectedDate ? rows.filter(transaction => transaction.date === state.selectedDate) : rows
  const rangeLabel = visible
    ? new Date(visible.start + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' – ' +
      new Date(visible.end + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'No imported dates'
  const chartTitle = state.period === 'week' ? 'Daily spending' : state.period === 'month' ? 'Weekly spending' : 'Monthly spending'
  const changePeriod = (period: DashboardPeriod) => dispatch({ type: 'dashboard/period', period })

  return (
    <div className="dashboard">
      <section className="dashboard-heading">
        <div>
          <p className="eyebrow">MORROW / MONEY OVERVIEW</p>
          <h1>Your money,<br /><span>in motion.</span></h1>
          <p className="dashboard-intro">A clear picture of what has gone out, where it went, and what you can look at next.</p>
        </div>
        <div className="reporting-chip">
          <span className="reporting-icon" aria-hidden="true">⌁</span>
          <span><small>Reporting window</small><b>{rangeLabel}</b></span>
        </div>
      </section>

      {state.isDemoData && (
        <div className="demo-banner">
          <span className="demo-indicator" />
          <div><b>Sample activity</b><p>These fictional transactions are here to preview the dashboard. Reviewed statement data will replace them when connected.</p></div>
          <button onClick={() => dispatch({ type: 'navigation/go', route: 'import' })}>Review transactions <span>→</span></button>
        </div>
      )}

      <section className="summary-grid" aria-label="Spending summary">
        <article className="summary-card summary-primary">
          <div className="summary-label"><span>SPENDING RECORDED</span><span className="summary-period">{state.period === 'week' ? '7 DAY VIEW' : state.period.toUpperCase() + ' VIEW'}</span></div>
          <strong>{money(total)}</strong>
          <div className="summary-foot"><span>Purchases and refunds</span><span>{spendingRows.length} transactions</span></div>
        </article>
        <article className="summary-card">
          <div className="summary-label"><span>DAILY AVERAGE</span><span className="summary-symbol">↗</span></div>
          <strong>{money(average)}</strong>
          <div className="summary-foot"><span>On days with activity</span><span>{activeDayCount} days</span></div>
        </article>
        <article className="summary-card">
          <div className="summary-label"><span>STATEMENT COVERAGE</span><span className="summary-symbol">◷</span></div>
          <strong>{coverage?.statementCount ?? 0}</strong>
          <div className="summary-foot"><span>{coverage?.statementCount === 1 ? 'statement connected' : 'statements connected'}</span><span>Recorded dates only</span></div>
        </article>
      </section>

      <section className="surface chart-surface">
        <div className="section-heading">
          <div><p className="eyebrow">SPENDING TREND</p><h2>{chartTitle}</h2></div>
          <div className="chart-controls">
            <div className="period-picker" role="group" aria-label="Choose spending period">
              {periods.map(([value, label]) => <button key={value} className={state.period === value ? 'selected' : ''} onClick={() => changePeriod(value)}>{label}</button>)}
            </div>
            <div className="period-arrows">
              <button aria-label="Earlier dates" onClick={() => dispatch({ type: 'dashboard/offset', offset: state.periodOffset + 1 })}>‹</button>
              <button aria-label="Later dates" disabled={state.periodOffset === 0} onClick={() => dispatch({ type: 'dashboard/offset', offset: Math.max(0, state.periodOffset - 1) })}>›</button>
            </div>
          </div>
        </div>
        <div className="chart-meta"><span>{rangeLabel}</span><span>Recorded spending</span></div>
        {chartValues.length ? (
          <div className="chart-wrap">
            <div className="axis-labels"><span>{money(Math.ceil(chartMaximum / 10000) * 10000)}</span><span>{money(Math.ceil(chartMaximum / 20000) * 10000)}</span><span>£0</span></div>
            <div className={'bar-chart' + (state.period !== 'week' ? ' wide-range' : '')}>
              {chartBuckets.map((bucket, index) => {
                const value = chartValues[index]
                const selected = state.selectedDate === bucket.start && state.period === 'week'
                return (
                  <button key={bucket.start} className={'bar-column' + (selected ? ' bar-selected' : '')} aria-label={bucket.label + ', ' + money(value)} title={bucket.label + ': ' + money(value)} onClick={() => state.period === 'week' && dispatch({ type: 'dashboard/select-date', date: selected ? null : bucket.start })}>
                    <span className="bar-tip">{money(value)}</span><i style={{ height: Math.max(value ? 4 : 1, (value / chartMaximum) * 100) + '%' }} /><small>{bucket.label}</small>
                  </button>
                )
              })}
            </div>
          </div>
        ) : <div className="chart-empty"><span>◌</span><p>No recorded transactions in this date range.</p></div>}
        <div className="chart-foot"><span className="legend-dot" /> Transfers and cash withdrawals are excluded from spending totals.</div>
      </section>
      <section className="insights-grid">
        <article className="surface category-surface">
          <div className="section-heading">
            <div><p className="eyebrow">WHERE IT WENT</p><h2>Spending by category</h2></div>
            <span className="category-total">{money(total)}</span>
          </div>
          {categories.length ? (
            <div className="category-list">
              {categories.slice(0, 6).map(([name, value], index) => (
                <div className="category-row" key={name}>
                  <span className={'category-dot category-' + (index % 5)} />
                  <span className="category-name">{name}</span>
                  <span className="category-bar"><i style={{ width: Math.max(value, 0) / Math.max(1, ...categories.map(([, amount]) => Math.max(amount, 0))) * 100 + '%' }} /></span>
                  <b>{money(value)}</b>
                </div>
              ))}
            </div>
          ) : <p className="empty-copy">Category totals will appear when transactions are available.</p>}
          <button className="text-link" onClick={() => dispatch({ type: 'navigation/go', route: 'import' })}>See all transactions <span>→</span></button>
        </article>

        <article className="surface activity-surface">
          <div className="section-heading">
            <div><p className="eyebrow">RECENT ACTIVITY</p><h2>{state.selectedDate ? 'Spending on ' + weekdayNames[utc(state.selectedDate).getUTCDay()] : 'Transactions'}</h2></div>
            {state.selectedDate && <button className="clear-filter" onClick={() => dispatch({ type: 'dashboard/select-date', date: null })}>Clear date</button>}
          </div>
          <div className="transaction-list">
            {shownRows.slice(0, 6).map(transaction => (
              <div className="transaction-row" key={transaction.id}>
                <span className={'merchant-mark kind-' + transaction.kind}>{transaction.kind === 'refund' ? '↶' : transaction.kind === 'cashWithdrawal' ? '⌑' : '·'}</span>
                <span className="transaction-detail">
                  <b>{transaction.merchant || transaction.description}</b>
                  <small>{transaction.category} · {new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small>
                </span>
                <b className={'transaction-amount' + (transaction.kind === 'refund' || transaction.amountPence > 0 ? ' positive' : '')}>{money(transaction.amountPence)}</b>
              </div>
            ))}
            {!shownRows.length && <div className="empty-copy">No transactions recorded for this date. This does not mean there was no spending.</div>}
          </div>
          <button className="text-link" onClick={() => dispatch({ type: 'navigation/go', route: 'import' })}>Add or review transactions <span>→</span></button>
        </article>
      </section>

      <section className="tools-section">
        <div className="tools-heading"><div><p className="eyebrow">YOUR MONEY TOOLKIT</p><h2>Built with your team</h2></div><span>Pick up where you need</span></div>
        <div className="tools-grid">
          <button className="tool-card" onClick={() => dispatch({ type: 'navigation/go', route: 'import' })}>
            <span className="tool-icon tool-blue">↥</span><span className="tool-copy"><small>ZUBAIR · LEDGER</small><b>Import & review</b><em>Check statement rows and add spending.</em></span><span className="tool-arrow">→</span>
          </button>
          <button className="tool-card" onClick={() => dispatch({ type: 'navigation/go', route: 'opportunities' })}>
            <span className="tool-icon tool-mint">✳</span><span className="tool-copy"><small>AVI · SMART SAVING</small><b>Ways to save</b><em>{state.opportunities[0]?.title ?? 'Find ideas that fit your routine.'}</em></span><span className="tool-arrow">→</span>
          </button>
          <button className="tool-card" onClick={() => dispatch({ type: 'navigation/go', route: 'planning' })}>
            <span className="tool-icon tool-violet">◎</span><span className="tool-copy"><small>CHIRAG · PLANNING</small><b>Budget & goals</b><em>{state.goal ? state.goal.name : 'Set a goal at your own pace.'}</em></span><span className="tool-arrow">→</span>
          </button>
        </div>
      </section>

      <footer className="dashboard-footer"><span>Made for real student life.</span><span>Sample values are illustrative. Not financial advice.</span></footer>
    </div>
  )
}

export default Dashboard
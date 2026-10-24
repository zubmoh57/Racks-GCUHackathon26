import { useEffect, useState } from 'react'
import { useAppState } from '../../../useAppState'
import { parsePounds } from '../import/money'
import { allocateMoney, money, monthlyBaseline } from './finance'
import { projectContributions } from '../../../features/planning/calculators'

function AmountField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState((value / 100).toFixed(2))
  const [error, setError] = useState('')
  useEffect(() => { setDraft((value / 100).toFixed(2)); setError('') }, [value])
  return <label className="amount-field"><span>{label}</span><div><span aria-hidden="true">£</span><input inputMode="decimal" value={draft} aria-invalid={!!error} onChange={event => setDraft(event.target.value)} onBlur={() => {
    try { const next = parsePounds(draft); if (next < 0 || next > 100_000_000) throw new Error('Enter an amount between £0 and £1,000,000.'); onChange(next); setDraft((next / 100).toFixed(2)); setError('') }
    catch (problem) { setError((problem as Error).message + ' The previous amount is still used.') }
  }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /></div>{error && <small role="alert" className="field-error">{error}</small>}</label>
}

export function MoneyPlanPage() {
  const { state, dispatch } = useAppState()
  const preferences = state.moneyPlan
  const baseline = monthlyBaseline(state.transactions, state.coverage)
  const income = preferences.incomePence ?? baseline.income
  const essentials = preferences.essentialsPence ?? baseline.essentials
  const totalIncome = income + preferences.fundingPence
  const plan = allocateMoney(totalIncome, essentials, preferences)
  const update = (patch: Partial<typeof preferences>) => dispatch({ type: 'planning/preferences', patch })
  const portions = [
    { label: 'Essentials', amount: plan.essentials, color: '#232f3e', description: 'Bills, food and getting around' },
    { label: 'Everyday spending', amount: plan.freedom, color: '#ff9900', description: 'Your life outside the lectures' },
    { label: 'Cash savings', amount: plan.cushion, color: '#16866b', description: 'Your cushion and nearer goals' },
    { label: 'Investing illustration', amount: plan.invest, color: '#3979af', description: 'A hypothetical long-term contribution' },
  ]
  let angle = 0
  const gradient = portions.map(portion => { const start = angle; angle += totalIncome ? portion.amount / totalIncome * 360 : 0; return `${portion.color} ${start}deg ${angle}deg` }).join(', ')
  const scenarios = projectContributions(plan.invest, 10)
  const priorities = [
    { key: 'freedom' as const, title: 'Everyday freedom', description: 'Coffee, plans with friends, the things you enjoy.', symbol: '01' },
    { key: 'cushion' as const, title: 'Safety cushion', description: 'Money you can reach when life happens.', symbol: '02' },
    { key: 'future' as const, title: 'Long-term goals', description: 'Room for the person you’re becoming.', symbol: '03' },
  ]

  return <div>
    <div className="page-heading"><div><p className="step-kicker">STEP 04 / LOOK AHEAD</p><h1>Your money plan.</h1><p>Cover the essentials. Then choose what matters most.</p></div><span className="heading-tag">Monthly amounts</span></div>
    <div className="plan-layout">
      <section className="surface plan-controls" aria-labelledby="plan-priorities-title"><div className="panel-toolbar"><h2 id="plan-priorities-title">Make it yours</h2><span className="offer-kicker">ADJUSTABLE PLAN</span></div>
        <div className="income-fields"><AmountField label="Reliable monthly income" value={income} onChange={incomePence => update({ incomePence })} /><AmountField label="Monthly student funding to budget" value={preferences.fundingPence} onChange={fundingPence => update({ fundingPence })} /><AmountField label="Monthly essentials & required payments" value={essentials} onChange={essentialsPence => update({ essentialsPence })} /></div>
        <p className="subtle baseline-note">Income and essentials start from recorded averages per covered calendar month, including partial months. Confirm or change them. Spread termly funding across the months it must cover; add any missing bills and debt payments.</p>
        <div className="priority-heading"><h3>What matters to you?</h3><span>Less priority → more priority</span></div>
        {priorities.map(priority => <div className="priority-control" key={priority.key}><label htmlFor={`priority-${priority.key}`}><span className="priority-number">{priority.symbol}</span><span><b>{priority.title}</b><small>{priority.description}</small></span><output htmlFor={`priority-${priority.key}`}>{preferences[priority.key]}</output></label><input id={`priority-${priority.key}`} type="range" min="0" max="100" value={preferences[priority.key]} onChange={event => update({ [priority.key]: Number(event.target.value) })} /></div>)}
        <label className="check-label investment-check"><input type="checkbox" checked={preferences.investmentReady} onChange={event => update({ investmentReady: event.target.checked })} /><span>I have an emergency cash fund, my short-term debt is covered, and I want to explore investing.</span></label>
        <p className="subtle">Essentials are reserved first. Sliders share what’s left; they are relative priorities, not percentages. With all three at zero, the remainder stays in cash savings.</p>
      </section>
      <section className="surface plan-result" aria-labelledby="plan-result-title"><div className="panel-toolbar"><h2 id="plan-result-title">Where your money could go</h2><span className="live-badge"><i/> Updates as you drag</span></div>
        <div className="money-donut" role="img" aria-label={`Monthly plan: ${portions.map(portion => `${portion.label} ${money(portion.amount)}`).join(', ')}`} style={{ background: totalIncome ? `conic-gradient(${gradient})` : '#e5e7eb' }}><div><span>MONTHLY MONEY IN</span><strong>{money(totalIncome)}</strong><small>{plan.shortfall ? 'Essentials need more room' : 'Every pound has a place'}</small></div></div>
        <div className="plan-legend" aria-live="polite">{portions.map(portion => <div key={portion.label}><span className="legend-square" style={{ background: portion.color }}/><span><b>{portion.label}</b><small>{portion.description}</small></span><strong>{money(portion.amount)}<small>{totalIncome ? Math.round(portion.amount / totalIncome * 100) : 0}%</small></strong></div>)}</div>
        {plan.shortfall > 0 && <p className="plan-warning" role="status">Your essentials exceed monthly money in by <b>{money(plan.shortfall)}</b>. Spending, savings and investing stay at £0. Check your funding, bills and income first.</p>}
        {!preferences.investmentReady && !plan.shortfall && <p className="plan-note">Your long-term share stays in cash savings until you choose to explore investing.</p>}
        <details className="projection-details"><summary>Explore a 10-year investing illustration <span>+</span></summary><p>If you chose to contribute {money(plan.invest)} each month:</p><table><caption>Hypothetical returns, not forecasts</caption><thead><tr><th>Annual return</th><th>After 10 years</th></tr></thead><tbody>{scenarios.map(scenario => <tr key={scenario.annualReturn}><td>{scenario.annualReturn * 100}%</td><td>{money(scenario.valuePence)}</td></tr>)}</tbody></table><p>You contribute {money(scenarios[0].contributedPence)}. Zero opening balance; fees, tax and inflation excluded. Investments can lose some or all of their value.</p></details>
        <p className="plan-source">An editable illustration, not a personalised investment recommendation. <a href="https://www.fca.org.uk/investsmart/should-you-invest" target="_blank" rel="noreferrer">FCA: before you invest ↗</a></p>
      </section>
    </div>
    <div className="page-actions"><button className="back-button" onClick={() => dispatch({ type: 'navigation/go', route: 'opportunities' })}>← Potential savings</button><button className="secondary-button" onClick={() => dispatch({ type: 'navigation/go', route: 'dashboard' })}>Back to your breakdown ↗</button></div>
  </div>
}

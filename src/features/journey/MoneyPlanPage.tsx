import { useEffect, useState } from 'react'
import { useAppState } from '../../../useAppState'
import { parsePounds } from '../import/money'
import { allocateMoney, money, monthlyBaseline, piePercentages, rebalanceShares } from './finance'
import type { ShareKey } from './finance'
import { AllocationPie } from './AllocationPie'
import { projectContributions } from '../../../features/planning/calculators'

function AmountField({ label, value, onChange, onValidityChange, onDraftChange }: { label: string; value: number; onChange: (value: number) => void; onValidityChange: (valid: boolean) => void; onDraftChange: () => void }) {
  const [draft, setDraft] = useState((value / 100).toFixed(2))
  const [error, setError] = useState('')
  useEffect(() => { setDraft((value / 100).toFixed(2)); setError('') }, [value])
  function validate(text: string) {
    const next = parsePounds(text)
    if (next < 0 || next > 100_000_000) throw new Error('Enter an amount between £0 and £1,000,000.')
    return next
  }
  return <label className="amount-field"><span>{label}</span><div><span aria-hidden="true">£</span><input inputMode="decimal" value={draft} aria-invalid={!!error} onChange={event => {
    setDraft(event.target.value)
    onDraftChange()
    try { validate(event.target.value); onValidityChange(true); setError('') } catch { onValidityChange(false) }
  }} onBlur={() => {
    try { const next = validate(draft); onChange(next); setDraft((next / 100).toFixed(2)); setError(''); onValidityChange(true) }
    catch (problem) { setError((problem as Error).message); onValidityChange(false) }
  }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} /></div>{error && <small role="alert" className="field-error">{error}</small>}</label>
}

export function MoneyPlanPage() {
  const { state, dispatch } = useAppState()
  const [invalidFields, setInvalidFields] = useState<string[]>([])
  const preferences = state.moneyPlan
  const baseline = monthlyBaseline(state.transactions, state.coverage)
  const income = preferences.incomePence ?? baseline.income
  const essentials = preferences.essentialsPence ?? baseline.essentials
  const totalIncome = income + preferences.fundingPence
  const plan = allocateMoney(totalIncome, essentials, preferences)
  const update = (patch: Partial<typeof preferences>) => dispatch({ type: 'planning/preferences', patch })
  const portions = [
    { label: 'Essentials', amount: plan.essentials, color: '#232f3e', description: 'Reserved for bills and required payments', key: null },
    { label: 'Everyday spending', amount: plan.freedom, color: '#ff9900', description: 'Your day-to-day spending', key: 'freedom' as const },
    { label: 'Cash savings', amount: plan.cushion, color: '#16866b', description: 'Your cushion and savings goal', key: 'cushion' as const },
    { label: 'Investing illustration', amount: plan.invest, color: '#3979af', description: 'A hypothetical long-term contribution', key: 'future' as const },
  ]
  const percentages = piePercentages(portions.map(portion => portion.amount))
  const remaining = Math.max(0, 100 - percentages[0])
  function changePercentage(key: ShareKey, percentage: number) {
    if (!totalIncome || remaining <= 0 || key === 'future' && !preferences.investmentReady) return
    const next = Math.max(0, Math.min(remaining, percentage)) / remaining * 100
    update(rebalanceShares(preferences, key, next))
  }
  function field(label: string, value: number, onChange: (value: number) => void) {
    return <AmountField label={label} value={value} onChange={onChange} onDraftChange={() => update({ confirmed: false })} onValidityChange={valid => setInvalidFields(current => valid ? current.filter(item => item !== label) : current.includes(label) ? current : [...current, label])} />
  }
  const scenarios = projectContributions(plan.invest, 10)
  const canConfirm = totalIncome > 0 && !plan.shortfall && invalidFields.length === 0 && preferences.goalName.trim().length > 0 && preferences.goalTargetPence > 0

  return <div>
    <div className="page-heading"><div><p className="step-kicker">STEP 04 / LOOK AHEAD</p><h1>Your money plan.</h1><p>Set a goal, adjust your percentages, then confirm your plan.</p></div><span className="heading-tag">Monthly amounts</span></div>
    <div className="plan-layout">
      <section className="surface plan-controls" aria-labelledby="plan-priorities-title"><div className="panel-toolbar"><h2 id="plan-priorities-title">Your income & goal</h2><span className="offer-kicker">ADJUSTABLE PLAN</span></div>
        <div className="income-fields">{field('Reliable monthly income', income, incomePence => update({ incomePence }))}{field('Monthly student funding to budget', preferences.fundingPence, fundingPence => update({ fundingPence }))}{field('Monthly essentials & required payments', essentials, essentialsPence => update({ essentialsPence }))}</div>
        <p className="subtle baseline-note">Starting amounts use your statements, including partial months. Confirm your income and bills, and spread termly funding across the months it needs to cover.</p>
        <div className="goal-fields"><h3>What are you saving for?</h3><label className="goal-name-field"><span>Goal name</span><input value={preferences.goalName} maxLength={80} placeholder="e.g. Summer trip" onChange={event => update({ goalName: event.target.value })} required /></label>{field('Goal target', preferences.goalTargetPence, goalTargetPence => update({ goalTargetPence }))}</div>
        <label className="check-label investment-check"><input type="checkbox" checked={preferences.investmentReady} onChange={event => update({ investmentReady: event.target.checked, ...(!event.target.checked ? { cushion: preferences.cushion + preferences.future, future: 0 } : {}) })} /><span>I have an emergency cash fund, my short-term debt is covered, and I want to explore investing.</span></label>
        <p className="subtle">Essentials are reserved first. Investing stays at 0% until you choose to explore it.</p>
      </section>
      <section className="surface plan-result" aria-labelledby="plan-result-title"><div className="panel-toolbar"><h2 id="plan-result-title">Set your percentages</h2><span className="allocation-total">{totalIncome ? 'Total 100%' : 'Add income to allocate'}</span></div>
        <AllocationPie percentages={percentages} colors={portions.map(portion => portion.color)} totalLabel={money(totalIncome)} canInvest={preferences.investmentReady} onChange={changePercentage} />
        <p className="pie-instructions">Drag the white points or edit the percentages below. Other slices adjust automatically so the total stays at 100%. Essentials stay tied to your bills above.</p>
        <div className="percentage-legend">{portions.map((portion, index) => <div className="percentage-row" key={portion.label}><span className="legend-square" style={{ background: portion.color }}/><span className="percentage-description"><b>{portion.label}</b><small>{portion.description}</small></span><strong>{money(portion.amount)}</strong>{portion.key === null ? <span className="fixed-percentage" aria-label={`Essentials ${percentages[index]} percent, fixed`}>{percentages[index]}%<small>Fixed</small></span> : <label className="percentage-input"><span className="sr-only">{portion.label} percentage</span><input type="number" min="0" max={remaining} step="0.1" value={percentages[index]} disabled={!totalIncome || !remaining || portion.key === 'future' && !preferences.investmentReady} onChange={event => { if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) changePercentage(portion.key!, event.target.valueAsNumber) }} /><span aria-hidden="true">%</span></label>}</div>)}</div>
        {preferences.confirmed && <div className="plan-confirmed" role="status"><b>✓ Plan confirmed</b><span>{preferences.goalName} · Target {money(preferences.goalTargetPence)}</span><small>Saved for this session. Changing your plan or statements will require confirmation again.</small></div>}
        {plan.shortfall > 0 && <p className="plan-warning" role="status">Essentials exceed monthly money in by <b>{money(plan.shortfall)}</b>. Check your funding, bills and income before confirming.</p>}
        <details className="projection-details"><summary>Explore a 10-year investing illustration <span>+</span></summary><p>If you chose to contribute {money(plan.invest)} each month:</p><table><caption>Hypothetical returns, not forecasts</caption><thead><tr><th>Annual return</th><th>After 10 years</th></tr></thead><tbody>{scenarios.map(scenario => <tr key={scenario.annualReturn}><td>{scenario.annualReturn * 100}%</td><td>{money(scenario.valuePence)}</td></tr>)}</tbody></table><p>You contribute {money(scenarios[0].contributedPence)}. Zero opening balance; fees, tax and inflation excluded. Investments can lose some or all of their value.</p></details>
        <p className="plan-source">An editable illustration, not a personalised investment recommendation. <a href="https://www.fca.org.uk/investsmart/should-you-invest" target="_blank" rel="noreferrer">FCA: before you invest ↗</a></p>
      </section>
    </div>
    <div className="page-actions"><button className="back-button" onClick={() => dispatch({ type: 'navigation/go', route: 'opportunities' })}>← Potential savings</button><div className="confirm-plan-action">{!canConfirm && <span>Check your income, bills and goal before confirming.</span>}<button className="primary-button" disabled={!canConfirm || preferences.confirmed} onClick={() => dispatch({ type: 'planning/confirm', incomePence: income, essentialsPence: essentials })}>{preferences.confirmed ? '✓ Plan confirmed' : 'Confirm my plan'}</button></div></div>
  </div>
}

import { useAppState } from '../../../useAppState'
import type { Priorities } from '../../assets/contracts'
import { money, monthlyBaseline, PRIORITY_MAX, recommendAllocation } from './finance'

const ratings: { key: keyof Priorities; label: string; hint: string }[] = [
  { key: 'everyday', label: 'Everyday spending', hint: 'Food, travel and going out' },
  { key: 'savings', label: 'Cash savings', hint: 'A cushion you can reach this week' },
  { key: 'investing', label: 'Investing', hint: 'Money you can leave alone for years' },
]

export function MoneyPlanPage() {
  const { state, dispatch } = useAppState()
  const plan = state.moneyPlan
  const baseline = monthlyBaseline(state.transactions, state.coverage)
  const moneyIn = baseline.income + baseline.funding
  const result = plan.applied && recommendAllocation(moneyIn, baseline.essentials, plan.applied)
  const stale = plan.applied ? ratings.some(rating => plan.applied![rating.key] !== plan[rating.key]) : false
  const slices = result ? [
    { label: 'Essentials', amount: result.essentials, note: 'Reserved first', hint: 'Rent, bills, groceries and travel' },
    { label: 'Everyday spending', amount: result.everyday, note: `${plan.applied!.everyday} / ${PRIORITY_MAX}`, hint: 'Food, travel and going out' },
    { label: 'Cash savings', amount: result.savings, note: `${plan.applied!.savings} / ${PRIORITY_MAX}`, hint: 'A cushion you can reach this week' },
    { label: 'Investing', amount: result.investing, note: `${plan.applied!.investing} / ${PRIORITY_MAX}`, hint: 'Money you can leave alone for years' },
  ] : []

  return <div>
    <div className="page-heading"><div><p className="step-kicker">STEP 04 / LOOK AHEAD</p><h1>Your money plan.</h1><p>Rate what matters, then see what to put where each month.</p></div><span className="heading-tag">Monthly amounts</span></div>
    <div className="plan-layout">
      <section className="surface plan-controls" aria-labelledby="plan-priorities-title">
        <div className="panel-toolbar"><h2 id="plan-priorities-title">How much does each one matter?</h2><span className="offer-kicker">RATE 0–{PRIORITY_MAX}</span></div>
        <p className="subtle baseline-note">Racks reserves your essentials first, then splits what is left in proportion to your ratings. A higher rating takes a bigger share.</p>
        <div className="priority-sliders">{ratings.map(rating => <label className="priority-slider" key={rating.key}>
          <span className="priority-head"><b>{rating.label}</b><span className="priority-value">{plan[rating.key]} / {PRIORITY_MAX}</span></span>
          <input type="range" min={0} max={PRIORITY_MAX} step={1} value={plan[rating.key]} aria-describedby={`${rating.key}-hint`}
            onChange={event => dispatch({ type: 'planning/priorities', patch: { [rating.key]: Number(event.target.value) } })} />
          <small id={`${rating.key}-hint`}>{rating.hint}</small>
        </label>)}</div>
        <button className="primary-button calculate-button" disabled={!moneyIn} onClick={() => dispatch({ type: 'planning/calculate' })}>Calculate my plan</button>
        {!moneyIn && <p className="subtle">Add a statement with income or student funding to build a plan.</p>}
      </section>
      <section className="surface plan-result" aria-labelledby="plan-result-title">
        <div className="panel-toolbar"><h2 id="plan-result-title">What to put where</h2>{result && <span className="allocation-total">{money(moneyIn)} a month</span>}</div>
        {result ? <>
          {stale && <p className="allocation-feedback" role="status">Your ratings changed. Calculate again to update these amounts.</p>}
          <div className="allocation-cards">{slices.map(slice => <article className="allocation-card" key={slice.label}>
            <span className="allocation-title">{slice.label}</span>
            <strong>{money(slice.amount)}</strong>
            <span className="allocation-note">{slice.note}</span>
            <small>{slice.hint}</small>
          </article>)}</div>
          <p className="plan-note">Based on {money(moneyIn)} a month across your statements — wages and student funding — with {money(result.essentials)} held back for essentials.</p>
          {result.shortfall > 0 && <p className="plan-warning" role="status">Your essentials come to <b>{money(result.shortfall)}</b> more than your money in. Add the statements that cover your funding, or cut back on what is counted as essential.</p>}
        </> : <p className="empty-state">Rate each priority, then choose <b>Calculate my plan</b> to see your monthly amounts.</p>}
        <p className="plan-source">A starting point from your own statements, not personalised financial advice. <a href="https://www.fca.org.uk/investsmart/should-you-invest" target="_blank" rel="noreferrer">FCA: before you invest ↗</a></p>
      </section>
    </div>
    <div className="page-actions"><button className="back-button" onClick={() => dispatch({ type: 'navigation/go', route: 'opportunities' })}>← Potential savings</button></div>
  </div>
}

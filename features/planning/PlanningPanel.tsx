import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { ActionImpact, DatedAmount, PlannerState } from './types.ts';
import { formatMoney as gbp, parsePounds, planBudget, planGoal, projectContributions } from './calculators.ts';
import './planning.css';

export interface PlanningPanelProps {
  value: PlannerState;
  onChange: (next: PlannerState) => void;
  acceptedActionImpacts?: readonly ActionImpact[];
  /** Host can hide the optional educational panel entirely. */
  allowIllustration?: boolean;
  /** Change when the host resets/replaces the planning session, even with equal values. */
  resetKey?: string | number;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="cp-field"><span>{label}</span>{children}</label>;
}
function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [error, setError] = useState('');
  const [draft, setDraft] = useState((value / 100).toFixed(2));
  useEffect(() => { setDraft((value / 100).toFixed(2)); setError(''); }, [value]);
  const id = useId();
  return <div><Field label={label}><input type="text" inputMode="decimal" value={draft} onChange={event => setDraft(event.target.value)}
    aria-invalid={!!error} aria-describedby={error ? id : undefined}
    onBlur={event => { try { const amount = parsePounds(event.target.value); setError(''); setDraft((amount / 100).toFixed(2)); onChange(amount); } catch (e) { setError((e as Error).message); } }}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></Field>
    {error && <small className="cp-error" id={id} role="alert">{error} The previous value is still used.</small>}</div>;
}
function YearsField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value)), [error, setError] = useState('');
  useEffect(() => { setDraft(String(value)); setError(''); }, [value]);
  const id = useId();
  return <div><Field label="Years"><input type="text" inputMode="numeric" value={draft} aria-invalid={!!error} aria-describedby={error ? id : undefined}
    onChange={e => setDraft(e.target.value)} onBlur={() => {
      if (!/^\d+$/.test(draft) || Number(draft) > 100) { setError('Enter whole years from 0 to 100. The previous value is still used.'); return; }
      setError(''); onChange(Number(draft));
    }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></Field>{error && <small id={id} className="cp-error" role="alert">{error}</small>}</div>;
}
function Entries({ title, rows, onChange }: { title: string; rows: DatedAmount[]; onChange: (rows: DatedAmount[]) => void }) {
  const [label, setLabel] = useState(''), [date, setDate] = useState(''), [amount, setAmount] = useState(''), [error, setError] = useState('');
  function add() {
    try {
      if (!label.trim() || !date) throw new Error('Enter a label and date.');
      const amountPence = parsePounds(amount);
      onChange([...rows, { id: crypto.randomUUID(), label: label.trim(), date, amountPence }]);
      setLabel(''); setAmount(''); setError('');
    } catch (e) { setError((e as Error).message); }
  }
  return <details className="cp-entries"><summary>{title} ({rows.length})</summary>
    <ul>{rows.map(row => <li key={row.id}><span>{row.label}<small>{row.date}</small></span><strong>{gbp(row.amountPence)}</strong>
      <button type="button" className="cp-subtle" onClick={() => onChange(rows.filter(item => item.id !== row.id))} aria-label={`Remove ${row.label}`}>Remove</button></li>)}</ul>
    <p>To correct an entry, remove it and add the corrected details.</p>
    <div className="cp-entry-form"><Field label={`${title}: description`}><input value={label} onChange={e => setLabel(e.target.value)} /></Field>
      <Field label={`${title}: date`}><input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label={`${title}: amount (£)`}><input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
      <button type="button" onClick={add}>Add entry</button></div>{error && <p role="alert" className="cp-error">{error}</p>}
  </details>;
}
export function PlanningPanel({ value, onChange, acceptedActionImpacts = [], allowIllustration = true, resetKey }: PlanningPanelProps) {
  const { budget, goal, illustration } = value;
  const updateBudget = (patch: Partial<typeof budget>) => onChange({ ...value, budget: { ...budget, ...patch, inputsConfirmed: patch.inputsConfirmed ?? false } });
  const updateGoal = (patch: Partial<typeof goal>) => onChange({ ...value, goal: { ...goal, ...patch } });
  const updateIllustration = (patch: Partial<typeof illustration>) => onChange({ ...value, illustration: { ...illustration, ...patch } });
  let result: ReturnType<typeof planBudget> | undefined, goalResult: ReturnType<typeof planGoal> | undefined, error = '';
  try { result = planBudget(budget); goalResult = planGoal(goal, budget, acceptedActionImpacts); } catch (e) { error = (e as Error).message; }
  let scenarios: ReturnType<typeof projectContributions> = [], scenarioError = '';
  if (illustration.enabled && allowIllustration) {
    try { scenarios = projectContributions(illustration.monthlyPence, illustration.years); } catch (e) { scenarioError = (e as Error).message; }
  }
  return <section key={resetKey} className="cp-planner" aria-label="Budget and savings planner">
    <header className="cp-header"><div><h1>Make room for your next goal.</h1><p>Plan until your next funding date. Keep the spending that matters to you.</p></div><span className="cp-stamp">Your money, your choices</span></header>
    <div className="cp-layout"><div className="cp-budget"><h2>Your term budget</h2><p>All amounts are in pounds. Changes apply when you leave a money field.</p>
      <div className="cp-grid"><Field label="Balance as of"><input type="date" value={budget.asOfDate} onChange={e => updateBudget({ asOfDate: e.target.value })} /></Field>
        <Field label="Plan until"><input type="date" value={budget.horizonEnd} onChange={e => updateBudget({ horizonEnd: e.target.value })} /></Field>
        <MoneyField label="Accessible bank funds (£)" value={budget.accessibleFundsPence} onChange={accessibleFundsPence => updateBudget({ accessibleFundsPence })} />
        <MoneyField label="Cash on hand (£)" value={budget.cashPence} onChange={cashPence => updateBudget({ cashPence })} />
        <MoneyField label="Emergency reserve (£)" value={budget.emergencyReservePence} onChange={emergencyReservePence => updateBudget({ emergencyReservePence })} />
        <MoneyField label="Spending allowance for this whole plan (£)" value={budget.desiredSpendingAllowancePence} onChange={desiredSpendingAllowancePence => updateBudget({ desiredSpendingAllowancePence })} /></div>
      <p className="cp-hint">Include protected future treats inside the allowance. Exclude goal savings and credit from accessible funds. Historical purchases are already reflected in your balance.</p>
      <Entries title="Confirmed future funding" rows={budget.confirmedInflows} onChange={confirmedInflows => updateBudget({ confirmedInflows })} />
      <Entries title="Upcoming essentials" rows={budget.essentials} onChange={essentials => updateBudget({ essentials })} />
      <Entries title="Required debt payments" rows={budget.requiredPayments} onChange={requiredPayments => updateBudget({ requiredPayments })} />
      <label className="cp-check"><input type="checkbox" checked={budget.inputsConfirmed} onChange={e => updateBudget({ inputsConfirmed: e.target.checked })} />I have checked my funds, future funding, bills and required payments for this period.</label>
    </div><aside className="cp-summary" aria-live="polite"><h2>Your budget estimate</h2>
      {error && <p role="alert" className="cp-error">{error}</p>}
      {result && <><dl><div><dt>Future funding included</dt><dd>{gbp(result.includedInflowsPence)}</dd></div><div><dt>Upcoming essentials and payments</dt><dd>{gbp(result.includedCostsPence)}</dd></div><div><dt>Allowance per day ({result.days} days)</dt><dd>{gbp(result.dailyAllowancePence)}</dd></div></dl>
        <div className={`cp-result ${result.shortfallPence ? 'cp-shortfall' : ''}`}><span>{result.shortfallPence ? 'Plan shortfall' : 'Potential room for a goal'}</span><strong>{gbp(result.shortfallPence || result.potentialGoalAllocationPence)}</strong><p>{result.shortfallPence ? 'Review your allowance and upcoming costs. An action estimate is not cash available today.' : 'One amount for this horizon. This is not a recurring monthly saving.'}</p></div>
        {!result.confirmed && <p className="cp-warning">Inputs are unconfirmed. Goal allocation projections are paused.</p>}
        {result.firstNegativeDate && <p className="cp-warning">Scheduled cash shortfall on {result.firstNegativeDate}. Goal projections are paused even if the final total is positive.</p>}
        <p className="cp-hint">{result.timingNote}</p>{result.ignoredRows > 0 && <p>{result.ignoredRows} entries outside (balance date, plan end] are excluded. Already received funds belong in your current balance.</p>}
      </>}
    </aside></div>
    <section className="cp-goal"><div><h2>A goal you choose</h2><div className="cp-grid">
      <Field label="Goal name"><input value={goal.label} onChange={e => updateGoal({ label: e.target.value })} /></Field>
      <Field label="Target date (optional)"><input type="date" value={goal.targetDate ?? ''} onChange={e => updateGoal({ targetDate: e.target.value || undefined })} /></Field>
      <MoneyField label="Target (£)" value={goal.targetPence} onChange={targetPence => updateGoal({ targetPence })} />
      <MoneyField label="Actually saved (£)" value={goal.actualSavedPence} onChange={actualSavedPence => updateGoal({ actualSavedPence })} />
      <MoneyField label="Proposed contribution this period (£)" value={goal.proposedContributionPence} onChange={proposedContributionPence => updateGoal({ proposedContributionPence })} /></div>
      <p className="cp-hint">Actually saved is your confirmed existing balance, held separately from accessible funds. Editing it records an amount; this app moves no money.</p></div>
      {goalResult && <div className="cp-goal-progress" aria-live="polite"><p><strong>{gbp(goalResult.actualSavedPence)}</strong> actually saved towards {gbp(goal.targetPence)}</p>
        <progress value={goalResult.progressPercent} max={100} aria-label="Actual goal progress" />
        <dl><div><dt>Planned contribution within budget</dt><dd>{gbp(goalResult.baseContributionPence)}</dd></div><div><dt>Potential extra from selected actions</dt><dd>{gbp(goalResult.potentialActionUpliftPence)}</dd></div><div><dt>Potential balance at plan end</dt><dd>{gbp(goalResult.potentialBalancePence)}</dd></div></dl>
        <p>Potential amounts are estimates, never money already saved.</p><p className="cp-hint">{goalResult.targetStatus}</p>
        {goalResult.unfundedContributionPence > 0 && <p className="cp-warning">{gbp(goalResult.unfundedContributionPence)} of your requested contribution is not supported by the base plan.</p>}
        <details><summary>Selected action assumptions ({goalResult.impact.accepted.length})</summary><p>Estimates arrive from the opportunities module. No selected estimates means no extra goal impact.</p>
          <ul>{goalResult.impact.accepted.map(a => <li key={a.id}>{a.label}: {gbp(a.estimatedSavingPence)} potential; {a.basis}; {a.periodStart} to {a.periodEnd}.</li>)}</ul>
          {goalResult.impact.capped && <p>Combined estimates are capped at your existing spending allowance.</p>}
          {goalResult.impact.excluded.map((a, i) => <p key={`${a.id}-${i}`} className="cp-warning">Excluded {a.id}: {a.reason}</p>)}
        </details></div>}
    </section>
    {allowIllustration && <section className="cp-education"><label className="cp-check"><input type="checkbox" checked={illustration.enabled} onChange={e => updateIllustration({ enabled: e.target.checked })} />Explore an optional long-term contribution illustration</label>
      {illustration.enabled && <><h2>What could regular contributions look like?</h2><p>Choose your own hypothetical amount. It is independent of your budget and is not a recommended investment amount.</p>
        <div className="cp-grid"><MoneyField label="Hypothetical monthly contribution (£)" value={illustration.monthlyPence} onChange={monthlyPence => updateIllustration({ monthlyPence })} />
          <YearsField value={illustration.years} onChange={years => updateIllustration({ years })} /></div>
        {scenarioError && <p role="alert" className="cp-error">{scenarioError}</p>}
        <div className="cp-table-wrap"><table><caption>Hypothetical effective annual returns; contributions at each month end</caption><thead><tr><th scope="col">Scenario</th><th scope="col">You contribute</th><th scope="col">Illustrative value</th></tr></thead><tbody>{scenarios.map(s => <tr key={s.annualReturn}><th scope="row">{s.annualReturn > 0 ? '+' : ''}{s.annualReturn * 100}%</th><td>{gbp(s.contributedPence)}</td><td>{gbp(s.valuePence)}</td></tr>)}</tbody></table></div>
        <p>Zero opening balance. Fees, tax and inflation excluded. These scenarios are not predictions or limits on losses. Investments can lose some or all of their value. Keep short-term bills, required payments and emergency access in view.</p>
        <p><a href="https://www.moneyhelper.org.uk/en/savings/investing/thinking-about-investing-make-sure-you-understand-the-risks">MoneyHelper: understand investing risks</a> · <a href="https://www.fca.org.uk/investsmart/risk-returns">FCA: risk and returns</a></p>
      </>}
    </section>}
  </section>;
}

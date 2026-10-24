import type { ActionImpact, BudgetInput, DatedAmount, Goal } from './types.ts';

export function money(value: number, label = 'Amount'): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be non-negative integer pence.`);
  return value;
}
function safe(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error('Total exceeds the supported money range.');
  return value;
}
export function parsePounds(text: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(text.trim())) throw new Error('Enter pounds with at most two decimal places.');
  const [whole, fraction = ''] = text.trim().split('.');
  return money(Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
}
export function formatMoney(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}
export function dateDay(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Dates must use YYYY-MM-DD.');
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) throw new Error('Enter a real calendar date.');
  return ms / 86400000;
}
function validateRows(rows: readonly DatedAmount[]): void {
  const ids = new Set<string>();
  rows.forEach(row => {
    if (!row.id || ids.has(row.id)) throw new Error('Dated entries need unique IDs within each list.');
    ids.add(row.id); dateDay(row.date); money(row.amountPence, row.label);
  });
}
export function planBudget(input: BudgetInput) {
  const start = dateDay(input.asOfDate), end = dateDay(input.horizonEnd);
  if (end <= start) throw new Error('Planning end must be after the balance date.');
  [input.accessibleFundsPence, input.cashPence, input.emergencyReservePence, input.desiredSpendingAllowancePence].forEach(v => money(v));
  [input.confirmedInflows, input.essentials, input.requiredPayments].forEach(validateRows);
  const within = (row: DatedAmount) => dateDay(row.date) > start && dateDay(row.date) <= end;
  const inflows = input.confirmedInflows.filter(within);
  const costs = [...input.essentials, ...input.requiredPayments].filter(within);
  const sum = (rows: DatedAmount[]) => rows.reduce((a, row) => safe(a + row.amountPence), 0);
  const current = safe(input.accessibleFundsPence + input.cashPence);
  const beforeAllowance = safe(current + sum(inflows) - sum(costs) - input.emergencyReservePence);
  const rawHeadroomPence = safe(beforeAllowance - input.desiredSpendingAllowancePence);
  // Bills precede inflows on the same date: conservative when intraday order is unknown.
  const events = [...costs.map(row => ({ ...row, delta: -row.amountPence })), ...inflows.map(row => ({ ...row, delta: row.amountPence }))]
    .sort((a, b) => a.date.localeCompare(b.date) || a.delta - b.delta);
  let running = current, minimum = current;
  let firstNegativeDate: string | null = null;
  for (const event of events) {
    running = safe(running + event.delta);
    minimum = Math.min(minimum, running);
    if (running < 0 && !firstNegativeDate) firstNegativeDate = event.date;
  }
  return {
    days: end - start, rawHeadroomPence,
    potentialGoalAllocationPence: Math.max(0, rawHeadroomPence),
    shortfallPence: Math.max(0, -rawHeadroomPence),
    maximumAllowanceEstimatePence: Math.max(0, beforeAllowance),
    dailyAllowancePence: Math.floor(input.desiredSpendingAllowancePence / (end - start)),
    includedInflowsPence: sum(inflows), includedCostsPence: sum(costs),
    ignoredRows: input.confirmedInflows.length + input.essentials.length + input.requiredPayments.length - inflows.length - costs.length,
    minimumScheduledBalancePence: minimum, firstNegativeDate,
    confirmed: input.inputsConfirmed,
    timingNote: 'Budget estimate. Scheduled bills are checked before same-day funding; allowance spending timing is unconfirmed.',
  };
}
export function estimateActions(actions: readonly ActionImpact[], budget: BudgetInput) {
  const accepted: ActionImpact[] = [], excluded: { id: string; reason: string }[] = [];
  const ids = new Set<string>(), groups = new Set<string>();
  const from = dateDay(budget.asOfDate), to = dateDay(budget.horizonEnd);
  for (const action of actions) {
    if (action.state !== 'selected') continue;
    const overlapGroup = action.overlapGroup.trim();
    let reason = '';
    try {
      money(action.estimatedSavingPence);
      const a = dateDay(action.periodStart), b = dateDay(action.periodEnd);
      if (!action.id || !action.overlapGroup.trim() || !action.basis.trim()) reason = 'Missing identity, overlap group or calculation basis.';
      else if (a <= from || b > to || b < a) reason = 'Estimate must be normalized to dates inside this planning horizon.';
      else if (action.appliesTo !== 'spendingAllowance') reason = 'Estimate must reduce the existing spending allowance.';
      else if (ids.has(action.id)) reason = 'Duplicate action ID.';
      else if (groups.has(overlapGroup)) reason = 'Overlapping alternative: first selected estimate retained.';
    } catch (error) { reason = (error as Error).message; }
    if (reason) { excluded.push({ id: action.id, reason }); continue; }
    ids.add(action.id); groups.add(overlapGroup); accepted.push(action);
  }
  const uncapped = accepted.reduce((total, action) => safe(total + action.estimatedSavingPence), 0);
  return { accepted, excluded, estimatedSavingPence: Math.min(uncapped, budget.desiredSpendingAllowancePence), capped: uncapped > budget.desiredSpendingAllowancePence };
}
export function planGoal(goal: Goal, budget: BudgetInput, actions: readonly ActionImpact[] = []) {
  if (!goal.label.trim()) throw new Error('Give the goal a name.');
  [goal.targetPence, goal.actualSavedPence, goal.proposedContributionPence].forEach(v => money(v));
  if (goal.targetPence === 0) throw new Error('Goal target must be greater than zero.');
  const budgetResult = planBudget(budget), impact = estimateActions(actions, budget);
  const remainingPence = Math.max(0, goal.targetPence - goal.actualSavedPence);
  const canProject = budget.inputsConfirmed && !budgetResult.firstNegativeDate;
  const baseCapacity = canProject ? budgetResult.potentialGoalAllocationPence : 0;
  const actionCapacity = canProject ? Math.max(0, safe(budgetResult.rawHeadroomPence + impact.estimatedSavingPence)) : 0;
  const baseContributionPence = Math.min(remainingPence, goal.proposedContributionPence, baseCapacity);
  const potentialContributionPence = Math.min(remainingPence, safe(goal.proposedContributionPence + impact.estimatedSavingPence), actionCapacity);
  let targetStatus = 'No target date set.';
  if (goal.targetDate) {
    const target = dateDay(goal.targetDate);
    targetStatus = target <= dateDay(budget.asOfDate) ? 'Target date has been reached; review your goal.'
      : target < dateDay(budget.horizonEnd) ? 'Target falls before this plan ends; this estimate does not prove it is met by that date.'
      : 'Projection covers this horizon only; future contributions are not assumed.';
  }
  return { actualSavedPence: goal.actualSavedPence, remainingPence, baseContributionPence, potentialContributionPence,
    potentialBalancePence: safe(goal.actualSavedPence + potentialContributionPence),
    potentialActionUpliftPence: potentialContributionPence - baseContributionPence,
    unfundedContributionPence: Math.max(0, goal.proposedContributionPence - baseContributionPence),
    progressPercent: Math.min(100, goal.actualSavedPence / goal.targetPence * 100), canProject, targetStatus, impact };
}
export function projectContributions(monthlyPence: number, years: number, annualReturns: readonly number[] = [-0.03, 0, 0.05]) {
  money(monthlyPence);
  if (!Number.isFinite(years) || years < 0 || !Number.isSafeInteger(years * 12) || years > 100) throw new Error('Use a horizon of 0–100 years in whole months.');
  const months = years * 12, contributedPence = safe(monthlyPence * months);
  return annualReturns.map(annualReturn => {
    if (!Number.isFinite(annualReturn) || annualReturn <= -1) throw new Error('Annual return must be finite and greater than -100%.');
    const logMonthly = Math.log1p(annualReturn) / 12;
    const value = annualReturn === 0 ? contributedPence : monthlyPence * Math.expm1(months * logMonthly) / Math.expm1(logMonthly);
    const valuePence = safe(Math.round(value));
    return { annualReturn, contributedPence, valuePence, gainPence: valuePence - contributedPence };
  });
}

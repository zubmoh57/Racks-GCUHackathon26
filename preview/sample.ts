import type { ActionImpact, PlannerState } from '../features/planning/types.ts';
export function makeSample(): PlannerState {
  return {
    budget: {
      asOfDate: '2026-10-24', horizonEnd: '2026-11-23',
      accessibleFundsPence: 100000, cashPence: 2000,
      confirmedInflows: [{ id: 'maintenance', label: 'Confirmed term funding', date: '2026-11-10', amountPence: 30000 }],
      essentials: [
        { id: 'rent', label: 'Rent', date: '2026-11-01', amountPence: 60000 },
        { id: 'bills', label: 'Bills', date: '2026-11-05', amountPence: 8000 },
      ],
      requiredPayments: [{ id: 'payment', label: 'Required payment', date: '2026-11-12', amountPence: 2000 }],
      emergencyReservePence: 20000,
      desiredSpendingAllowancePence: 30000,
      inputsConfirmed: true,
    },
    goal: { id: 'laptop', label: 'Laptop repair', targetPence: 30000, actualSavedPence: 5000, proposedContributionPence: 12000, targetDate: '2026-11-23' },
    illustration: { enabled: false, monthlyPence: 2500, years: 10 },
  };
}
export const sampleAction: ActionImpact = {
  id: 'synthetic-action', label: 'Synthetic selected action', state: 'selected',
  periodStart: '2026-10-25', periodEnd: '2026-11-23',
  estimatedSavingPence: 2000, overlapGroup: 'synthetic-spending',
  basis: 'Illustrative £5 per week × 4 confirmed weeks, already inside allowance',
  appliesTo: 'spendingAllowance',
};

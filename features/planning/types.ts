/** Local module contracts; map host application types at the integration boundary. */
export interface DatedAmount {
  id: string;
  label: string;
  date: string;
  amountPence: number;
}
export interface BudgetInput {
  asOfDate: string;
  horizonEnd: string;
  /** Excludes this goal's actualSavedPence and overdraft/credit availability. */
  accessibleFundsPence: number;
  cashPence: number;
  confirmedInflows: DatedAmount[];
  essentials: DatedAmount[];
  requiredPayments: DatedAmount[];
  emergencyReservePence: number;
  /** Total for (asOfDate, horizonEnd], including protected future treats. */
  desiredSpendingAllowancePence: number;
  inputsConfirmed: boolean;
}
export interface Goal {
  id: string;
  label: string;
  targetPence: number;
  actualSavedPence: number;
  targetDate?: string;
  proposedContributionPence: number;
}
/** Selected actions are supplied by the host's recommendations feature. */
export interface ActionImpact {
  id: string;
  label: string;
  state: 'selected' | 'dismissed';
  periodStart: string;
  periodEnd: string;
  estimatedSavingPence: number;
  /** Required: alternatives covering the same purchases share a group. */
  overlapGroup: string;
  basis: string;
  /** Savings must reduce spending already inside this allowance. */
  appliesTo: 'spendingAllowance';
}
export interface PlannerState {
  budget: BudgetInput;
  goal: Goal;
  illustration: { enabled: boolean; monthlyPence: number; years: number };
}

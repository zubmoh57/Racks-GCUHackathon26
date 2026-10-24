# Student Financial Planning Module

Standalone React/TypeScript planning feature for the hackathon student financial-wellbeing application.

## Includes
- Budget controls for current funds, confirmed future inflows, essential expenses, required payments, emergency reserve and spending allowance
- Savings goals with actual versus potential contributions
- Support for preselected, normalized action estimates from the host recommendations module
- Optional educational investment-contribution illustration (hypothetical -3%, 0%, +5% annual scenarios)
- Local calculator tests, integration adapter and demo script

## Integration

Copy only `features/planning/` into the app. Import `PlanningPanel` from `features/planning/index.ts`. The host owns state; provide `value: PlannerState`, `onChange`, `acceptedActionImpacts` and `resetKey`. Use `examples/AppIntegration.tsx` as a wiring reference. Keep the team's package manifest, global styles, root app and other features unchanged.

The module stores monetary amounts as integer pence and dates as YYYY-MM-DD. Selected actions change projected goals only, not cash or actual savings.

## Verification

Arithmetic tests cover shortfalls, cash timing, action overlap, goal caps, monetary parsing, date validation and long-term contribution projections. Run with Node 24+: `node --test tests/calculators.test.mjs`. For a full integration test, validate the host app's store mapping and selected-action semantics.

No real personal finance data or credentials are included. Educational illustration is not an investment recommendation.

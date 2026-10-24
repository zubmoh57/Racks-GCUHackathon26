# Planning module integration contract

This standalone module must be connected by the host application's integration owner. It does not create a parallel store or modify existing shared types.

```tsx
<PlanningPanel
  value={planningState}
  onChange={updatePlanningState}
  acceptedActionImpacts={selectedActionEstimates}
  resetKey={sessionResetVersion}
  allowIllustration
/>
```

- `value` and `onChange` should target the existing single application store.
- `resetKey` changes on full app reset to discard uncommitted form drafts.
- Selected actions should be normalized in the recommendations feature. Each needs stable ID, start/end dates within the planning horizon, overlap group, estimated saving in integer pence, basis and `appliesTo: 'spendingAllowance'`.
- Overlapping alternatives must share an overlap group; one estimate per group can contribute.
- Historical expenses are already reflected in the current balance; never deduct them twice.
- Confirmed future bills/inflows must be dated after the balance date through the horizon end.
- Protected purchases remain in the allowance; selected actions change only potential allocations.
- Do not replace the host app's app entry, package files, dashboard, import parser or recommendation UI.

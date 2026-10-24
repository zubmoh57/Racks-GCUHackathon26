# CaledoniaHackathon26

## Student Financial Planning Module

This branch contains the independent **budget control, savings goals, and optional educational investment illustration** feature for the student financial-wellbeing application. Its files are available from this branch's root, without an enclosing module folder.

### Source files

- [PlanningPanel.tsx — responsive planning interface](features/planning/PlanningPanel.tsx)
- [calculators.ts — budget, goal and contribution calculations](features/planning/calculators.ts)
- [types.ts — local data contracts](features/planning/types.ts)
- [planning.css — locally scoped styles](features/planning/planning.css)
- [index.ts — feature exports](features/planning/index.ts)
- [AppIntegration.tsx — host integration example](examples/AppIntegration.tsx)

### Documentation and tests

- [INTEGRATION.md — connecting shared state and selected actions](INTEGRATION.md)
- [DEMO_SCRIPT.md — presentation walkthrough](docs/DEMO_SCRIPT.md)
- [VERIFICATION.md — testing scope and limitations](docs/VERIFICATION.md)
- [calculators.test.mjs — calculator tests](tests/calculators.test.mjs)
- [sample.ts — fictional demo data](preview/sample.ts)
- [main.tsx — standalone demo entry](preview/main.tsx)

### Run the standalone preview

Requires Node.js 24 or later:

```bash
npm install
npm test
npm run build
npm run dev
```

The app and its source live **directly in this branch**, not in `planning-module/`. Integration should copy `features/planning/` into the team's app without replacing its root files or shared state.

The module handles money in integer pence. Selected actions affect **potential** goal contributions, never actual saved balances or bank funds. All preview values are fictional. The contribution illustration is educational, not a recommendation to invest.

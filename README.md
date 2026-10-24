# Morrow — student financial wellbeing

Combined Caledonia Hackathon project for students aged 18+ in Glasgow and the UK.

## Run the app

Use Node.js 20.19+ or 22.13+.

```sh
npm install
npm run dev
npm test
npm run build
```

The main app starts at `/`: Blazej's dashboard and theme plus Zubair's PDF upload and review flow. Select **Transactions**, then **Try sample PDF**, review the entries and confirm to replace the fictional dashboard data. Imports stay in memory for the current session.

The parser currently supports the synthetic **Campus v1** layout, not arbitrary bank PDFs or scanned documents. Download the sample from the upload page or use the PDFs in `fixtures/`.

## Merged modules

- [PDF import, ledger and manual-expense logic](src/features/import/README.md): signed integer pence, explicit review, duplicate checks and synthetic PDFs.
- [Savings engine and reference demo](savings/README.md): protected treats, sourced suggestions and selected actions. Its standalone demo is at `/savings/demo/index.html` on the development server.
- [Planning interface and calculators](features/planning/index.ts): budgets, cash timing, goals and optional educational contribution illustrations. Its fictional standalone preview is at `/preview/index.html` on the development server.
- [Planning integration contract](INTEGRATION.md) and [example adapter](examples/AppIntegration.tsx).
- [Team context and responsibilities](TEAM_CONTEXT.md).

The main app's **Ways to save** and **Budget & goals** routes are still integration placeholders. The two modules are preserved alongside the app; connecting them to shared state and navigation is separate implementation work. Manual cash-expense logic is available in the ledger module; its main-app form is also pending.

## Checks

`npm test` runs the PDF/ledger tests, dependency-free savings tests and planning calculator tests. `tsx` lets the planning tests run on Node 20 as well as newer versions without changing their source. `npm run build` type-checks the app, planning module, preview and integration example, then builds the main app.

The savings and planning previews use fictional data, independent of the app's reviewed ledger. Suggestions and contribution illustrations are estimates; nothing moves money or connects to a live bank.

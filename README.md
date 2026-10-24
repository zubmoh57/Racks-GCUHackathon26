# Morrow — student financial wellbeing

A website for students aged 18+ in Glasgow and the UK.

## Run

Use Node.js 20.19+ or 22.13+.

```sh
npm install
npm run dev
npm test
npm run build
```

The app starts with an empty ledger on the PDF upload page. Select **Use demo statement** for a fictional statement, or download the sample PDF and upload it yourself. Everything stays in memory in the browser; refreshing clears the session.

## Four-page flow

1. **Upload statement** — local PDF extraction with a processing animation and automatic transition to the breakdown. Unreadable rows and possible overlaps pause for explicit review. Re-uploading the same file is blocked.
2. **Your breakdown** — income and spending side by side, a spending-to-income ratio, date filters and the complete transaction list. Green labels mark suggested essentials; red labels flag possible gambling merchants. Edit categories and transaction types, add/edit/delete cash spending, and protect individual purchases.
3. **Find savings** — comparison arrows, alternatives and a student-discounts tab, using the reviewed ledger and the existing savings engine. Protected purchases are excluded. Coffee comparisons use recorded merchant averages, not verified identical products. Tesco/Co-op sandwich prices are explicitly fictional examples. Provider links show eligibility and current-offer checks.
4. **Your money plan** — editable monthly income, funding and essentials; relative sliders for Everyday freedom, Safety cushion and Long-term goals; a live allocation donut with exact monetary totals. Essentials come first. A deficit cannot generate discretionary, saving or investment amounts. Long-term allocations remain in cash unless the user explicitly enables the optional investing illustration.

Ratio grades are transparent product heuristics for the selected dates, not a full assessment of financial health. Wages and student funding are separate; the user can explicitly include funding in the ratio. Monthly starting values average recorded activity over covered calendar months, including partial months; users must confirm their budget and spread termly funding themselves.

## Prototype limits

The parser supports the synthetic **Campus v1** layout, not arbitrary bank PDFs or scanned documents. Files in `fixtures/` cover success, changed amounts, unreadable rows and unsupported/no-text input. Merchant names do not identify individual purchased products. Offers can change and borrowing depends on catalogue availability. No real bank connection, authentication, transactions or investment orders are implemented.

The ten-year illustration reuses the planning module's calculator with negative, zero and positive hypothetical returns. It excludes fees, tax and inflation and is not a personalised investment recommendation.

## Modules and checks

- [PDF import and ledger](src/features/import/README.md)
- [Savings engine and reference demo](savings/README.md)
- [Journey components and integration](src/features/journey/)
- [Original planning module](features/planning/index.ts), [integration contract](INTEGRATION.md) and [standalone preview](preview/index.html)
- [Team context](TEAM_CONTEXT.md)

`npm test` runs 45 PDF/ledger/journey checks, 23 savings-engine checks and 13 original planning checks. `npm run build` type-checks the app and planning sources and builds the main app. The original independent previews remain available at `/preview/index.html` and `/savings/demo/index.html` under `npm run dev`; they use their own fictional data.

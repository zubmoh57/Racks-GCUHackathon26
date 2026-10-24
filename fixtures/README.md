# Synthetic statement fixtures

All data is fictional. The institution is explicitly fictional; there are no real account identifiers. None of these PDFs should be presented as a real bank statement or evidence of financial outcomes.

| File | What to check |
| --- | --- |
| `campus-demo-statement.pdf` | Actual selectable-text PDF: 18 transactions; GBP 775.63 net spending, GBP 320 wages, GBP 2,400 maintenance funding |
| `changed-amount.pdf` | One grocery purchase is GBP 1 higher: net spending must be GBP 776.63, proving the parser reads file contents |
| `unreadable-row.pdf` | Eighteen valid transactions and one unreadable row: confirmation must wait for explicit repair or exclusion |
| `unsupported-layout.pdf` | A readable PDF in an unsupported layout: show an actionable error and add no transactions |
| `no-text.pdf` | A valid PDF with no text: explain the text/OCR limitation and add no transactions |

`expected-totals.json` contains independently calculated expected amounts in integer pence. Purchases total GBP 780.63; the GBP 5 refund reduces net spending to GBP 775.63. The GBP 40 withdrawal and GBP 100 own-account transfer do not count as purchases. The two identical 22 October coffee transactions are both legitimate and must remain. Adding a GBP 3 cash purchase takes net spending to GBP 778.63.

The parser supports the documented **Campus v1** layout, not arbitrary bank statements. This is a real parser for that format, not a sample-data lookup. Extend `src/features/import/statement.ts` with a new explicit adapter when a real bank's layout is agreed.

To regenerate fixtures in a project with `tsx` installed:

```sh
npx tsx fixtures/generate-statements.ts
```

`createSampleStatement(monthsBack)` generates a genuine PDF file for the frontend teammate to pass into the normal parser: the same statement, shifted back that many whole months, so repeated demo imports stack instead of colliding. Filename changes alone do not bypass duplicate checks; the fingerprint comes from the file's own bytes.

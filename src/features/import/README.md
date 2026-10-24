# PDF upload, review and ledger logic - Zubair / role B

This module supplies the PDF upload/review page and its parsing/ledger functions. The user subsequently requested a complete four-page flow and an Amazon-inspired navy/white/orange theme. The main app now opens here with an empty ledger; the breakdown includes manual cash spending and transaction corrections.

## Scope

- PDF drag/drop or file selection, sample PDF download, uploaded month/year labels and statement coverage list, an **Add another statement** button, and explicit review when rows are unreadable or overlap existing records. Users continue to the breakdown after adding the desired statements.
- Local PDF text extraction with PDF.js and one documented **Campus v1** adapter.
- Structured review data: editable transactions, original row references and unresolved rows.
- Confirmation rules: validate edits, require explicit repair/exclusion of unreadable rows, prevent exact-file duplicate imports and flag possible overlapping transactions.
- Manual cash expense validation, add/edit/delete and spending totals.
- Five synthetic PDF fixtures, expected totals and 23 unit/integration tests.

## Racks app integration

Blazej's frontend was the original base. After all branches were merged into `main`, the user requested the upload-first redesign. `App.tsx` connects the first journey step to `PdfUploadPage.tsx`. `pdf-upload.css` matches the shared navy/white/orange shell; the app respects reduced-motion preferences throughout.

`frontendAdapter.ts` connects the canonical parser ledger to the shell's `ledger/replace` action. It displays readable category labels without changing signed pence, retains row references and file fingerprints, and derives coverage from imported periods and recorded dates. The app starts without demo rows. Clean statements are validated and added automatically; unreadable rows or potential overlaps pause for repair/exclusion or duplicate decisions. Later imports add to the same ledger.

`statementMonths.ts` derives sorted, deduplicated calendar months from each statement's actual coverage, including multi-month statements and year boundaries. The upload area shows these months after parsing, and the list below retains each file's precise dates so partial months are not presented as complete coverage. The user selects **Continue to breakdown**; returning to step one retains all uploaded months in the current session.

`SharedState.imports` retains import metadata across navigation. The shell's exported `StatementImport` now aliases the parser's canonical record, so there is one fingerprint/coverage schema. The shared source-row type accepts text references as well as numeric references. The page keeps only unconfirmed review edits locally; the app store owns committed transactions. Nothing is sent to a server or persisted across a refresh.

From the project root:

```sh
npm install
npm run dev
```

Open the printed local URL. Upload a supported PDF or choose **Use demo statement**. The breakdown, savings/discounts and monthly plan follow as steps two through four.

**Arbitrary real bank PDFs are not supported yet.** A real bank's agreed layout needs its own adapter. Scanned/image-only files require OCR, which is outside this version.

## Dependency and runtime

The app owner adds `pdfjs-dist@5.6.205` to the main app's dependencies. It was verified with Node 20.20.2, TypeScript 5.9 and Vite 8.3.5. The parser uses browser `File` and Web Crypto APIs and runs on-device; it is not a server endpoint.

The PDF worker uses Vite's `?url` asset import. A different bundler needs its equivalent local worker configuration. Keep the API and worker from the same package version. Parsing and ledger functions remain independent of React; the upload page uses the app's existing React setup.

## Functions for the frontend teammate

Import functions and types from `src/features/import/index.ts`.

| Function | Input and result |
| --- | --- |
| `parseStatement(file)` | Browser `File` -> `Promise<ImportPreview>`. Extracts actual PDF contents; does not commit transactions. |
| `parseStatementLines(lines, fingerprint, filename)` | Extracted positioned-text rows -> the same preview; useful for adapter tests. |
| `validateTransaction(transaction)` | Returns an error string or `null`; use to validate review edits. |
| `possibleDuplicateIds(incoming, existing)` | IDs needing explicit keep/remove review. Identical repeated purchases are not silently deleted. |
| `confirmImport(ledger, preview, options)` | Returns a new `LedgerState` after validating all review decisions. Throws on unresolved errors. |
| `upsertManualExpense(ledger, transaction)` | Adds a cash purchase or edits an existing manual purchase with the same ID. Returns a new ledger. |
| `removeTransaction(ledger, id)` | Returns a ledger without that transaction. |
| `summariseTransactions(transactions)` | Spending, refunds, income, funding, withdrawals and category totals, in integer pence. |
| `parsePounds(text)` | Converts decimal pound text to integer pence without floating point penny errors. |
| `createSampleStatement(monthsBack)` | Generates a genuine synthetic PDF `File` for the frontend to pass into the normal parser, shifted back `monthsBack` whole months. |

All ledger functions return new state; the parent application owns storage and state updates. They do not render UI, navigate, display notifications or save data externally. Catch thrown errors and present them in the teammate's interface.

### Parse, review and confirm

```ts
import { parseStatement, confirmImport, possibleDuplicateIds } from './features/import';
import type { LedgerState } from './features/import';

let ledger: LedgerState = { transactions: [], imports: [] };
const preview = await parseStatement(file);

// The frontend shows preview.transactions and preview.unresolvedRows.
// It owns review controls and stores the user's edited transactions/decisions.
const duplicateIds = possibleDuplicateIds(preview.transactions, ledger.transactions);

// On explicit confirmation, pass the user's decisions, not automatic approval.
ledger = confirmImport(ledger, preview, {
  transactions: reviewedTransactions,
  excludedRowIds: explicitlyExcludedUnreadableRowIds,
  acknowledgedDuplicateIds: explicitlyKeptDuplicateIds,
});
```

The example's `file`, `reviewedTransactions` and decision arrays come from the teammate's UI. `duplicateIds` identifies the incoming rows needing duplicate review. Block confirmation in the interface until errors are resolved; `confirmImport` also enforces these rules.

To repair an unresolved row, create a valid `Transaction` using that row's original `id` and `sourceRow`, `source: 'statement'` and `importId: preview.id`, then include it in reviewed transactions. To omit it, put its ID in `excludedRowIds`. To remove a readable row, omit it from reviewed transactions. Original PDF bytes are not kept in the ledger.

### Manual cash expense

```ts
import { parsePounds, upsertManualExpense, removeTransaction } from './features/import';
import type { Transaction } from './features/import';

const purchase: Transaction = {
  id: `cash:${crypto.randomUUID()}`,
  date: '2026-10-23',
  description: 'Cash lunch',
  amountPence: -parsePounds('3.00'),
  currency: 'GBP',
  kind: 'expense',
  category: 'foodAndDrink',
  source: 'manual',
};

ledger = upsertManualExpense(ledger, purchase);
ledger = upsertManualExpense(ledger, { ...purchase, amountPence: -450 });
ledger = removeTransaction(ledger, purchase.id);
```

Validate that a form's unsigned amount is greater than zero before applying the outgoing sign. The ledger function enforces negative, non-zero cash purchases. Reuse the same ID when editing. IDs for imported rows cannot be overwritten through the cash-entry function.

## Shared data rules

- `amountPence` is a signed integer: outgoing negative, incoming positive.
- `kind`: `expense`, `income`, `funding`, `refund`, `transfer`, `cashWithdrawal`.
- `category`: `housing`, `groceries`, `foodAndDrink`, `transport`, `subscriptions`, `shopping`, `bills`, `other`.
- `date` is `YYYY-MM-DD`, without a timestamp or timezone conversion.
- `source` is `statement` or `manual`. Reviewed imported rows retain their import ID and source row.
- `confirmedItem` is optional user-provided detail. A merchant name never proves what item was purchased.
- ATM withdrawals and own-account transfers do not count as purchases. Actual cash purchases do. Refunds reduce category spending; maintenance funding is separate from wages.
- File fingerprints remain in `ledger.imports` even if individual transactions are removed. Use `ledger.transactions` for current totals, not import metadata's historical IDs.
- Data is session-local unless the app owner explicitly adds persistence. No logging, cloud AI upload or raw-PDF storage is part of this module.

## Fixtures and checks

See the [fixture guide](../../../fixtures/README.md). The base PDF has 18 transactions and GBP 775.63 net spending. The modified PDF totals GBP 776.63. A GBP 3 cash purchase added to the base ledger gives GBP 778.63. The two identical 22 October coffees are separate fictional purchases and both remain.

`tests/statement-import.test.ts` uses Vitest and lives outside `src`. After the tester installs/configures Vitest in the integrated app, run:

```sh
npx vitest run tests/statement-import.test.ts
```

The app includes the test runner. `tests/statement-import.test.ts` contains 23 core parser/ledger/adapter checks. `npm test` also runs journey calculations and savings integration tests, the savings engine suite and the original planning suite. `npm run build` runs the app's TypeScript and production bundle checks.

Role E owns integrated UI testing with the frontend teammate: real PDF upload, review correction, explicit unreadable-row repair/exclusion, duplicate decisions, cash changes updating the dashboard and production worker loading. Also test unsupported/no-text PDFs, a password-protected PDF and a renamed non-PDF. The individual encrypted-file case still needs a dedicated fixture check.

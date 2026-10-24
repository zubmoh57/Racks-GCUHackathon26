# Savings Recommendations

The part of the ledger that looks at a categorised statement and tells the
student, kindly, where their money could go further.

Four pieces:

| Piece | What it does |
|---|---|
| **Recommendations** | Turns a month of spending into advice that is warm rather than scolding |
| **Protected treats** | Spending the student has ring-fenced, which the engine is not allowed to see |
| **Sourced offers** | A named provider and a link behind every suggestion, so it creates awareness rather than guilt |
| **Selected actions** | What the student actually chose to do, and whether they did it |

No dependencies, no build step. Plain ES modules that work in a browser, in
Node, and inside React or Vue without changes.

## Using it

```js
import { analyseStatement, createTreat, createActionStore, localStorageAdapter }
  from './savings/engine/index.js';

const store = createActionStore(localStorageAdapter());

const result = analyseStatement({
  transactions,          // from the categoriser
  treats,                // whatever the student has protected
  actionStore: store,    // optional — hides advice they already answered
});
```

### Input

One transaction, as the categoriser produces it:

```js
{
  id: 't04',
  date: '2026-09-03',
  description: 'WATERSTONES EBOOK PURCHASE',
  merchant: 'Waterstones',
  amount: 18.99,                            // positive, money out
  category: 'Tuition & Course Materials'    // id or display name, both work
}
```

Only `amount` is really required. A missing category, merchant or id is
handled quietly rather than throwing.

### Output

```js
{
  period: { from, to },
  totals: { spend, protected, byCategory },
  protection: { labels, note, entries },     // proof we left the treats alone
  recommendations: [ … ],
  potentialMonthlySaving,
  lifestyleAsk,                              // the part that asks for a change
  ceiling,
  suggestedTreats,
}
```

A recommendation:

```js
{
  id, kind, title, opener, message,
  categoryId, categoryName,
  estimatedMonthlySaving, estimatedMonthlySavingLabel,
  confidence,
  evidence: { transactionIds, transactionCount, total },
  offers: [ { title, provider, url, blurb, verify, estimatedSaving } ],
  protectedNote,
  tone: { gentle, harshWords },
  state: { selected, dismissed },
}
```

`kind` is one of `sourced-offer`, `pattern` or `encouragement`. Render
`opener` above `title`, and `message` as the body.

## The rules this feature holds itself to

These are the reason the module is shaped the way it is.

**It does not scold.** Every message is assembled by `tone.js`, which keeps a
list of shaming and commanding words. A test fails the run if any of them
reach the student. Advice points at the money, never at the person.

**Protected treats are absolute.** Anything a treat covers is removed in
`applyProtection()` before a single rule runs, so no rule can build advice on
top of it even by accident. There is a test for exactly that.

**Nobody is asked to stop living.** `DEFAULT_JOY_ALLOWANCE` (£40) of
discretionary spending is left alone even with no treats set, and the
behavioural rules cannot collectively ask for more than the ceiling. Sourced
offers are exempt — a cheaper route to the same thing costs the student
nothing, so it is not rationed.

**Rent is never a suggestion.** Categories marked `neverSuggestCuts` are
invisible to every offer except support-style ones such as the hardship fund,
which adds money rather than asking someone to go without.

**Saying no is an answer.** Dismissed advice does not return. Turn the same
suggestion down twice and the app offers to protect it instead.

**Every suggestion is sourced.** An offer without a named provider and a link
is not allowed in the catalogue; a test enforces it. Offers marked `verify`
differ between universities and councils, so the UI shows them as
"check yours" rather than stating them as fact.

## Files

```
savings/
  engine/
    index.js             public API — the only file other teams import
    categories.js        the ten categories and how flexible each one is
    protected-treats.js  the guardrail
    offers.js            the sourced offers catalogue
    rules.js             what counts as worth saying
    tone.js              how it gets said
    actions.js           selected actions and dismissals
  data/sample-statement.json
  demo/                  reference dashboard — not the production UI
  test/run-tests.mjs
```

## Running it

```bash
node savings/test/run-tests.mjs                     # 23 tests, no install
python3 -m http.server 4178                         # then open
                                                    # localhost:4178/savings/demo/
```

## Notes for whoever wires this in

- `analyseStatement` is pure. Same input, same output, no network, no clock
  beyond timestamps on newly created treats and actions.
- Action storage goes through an adapter. `localStorageAdapter()` is there for
  the demo; swap in one that calls the API and nothing else changes.
- The offers catalogue is plain data in `offers.js`. Adding an offer needs no
  code — a title, provider, url, blurb, what it applies to, and how much it
  saves.
- Saving estimates are deliberately conservative and clearly indicative. They
  should never be presented as a promise.

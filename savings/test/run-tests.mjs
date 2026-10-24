/**
 * Tests for the savings recommendations.
 *
 *   node savings/test/run-tests.mjs
 *
 * No framework and no install, so a teammate can run them on a laptop that
 * has nothing set up.
 *
 * The tone tests are the ones that matter most. The whole premise of this
 * feature is that it speaks kindly, and that is the easiest thing to break
 * without noticing — a rule gets reworded under time pressure and suddenly
 * the app is scolding people. These fail the run if that happens.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyseStatement,
  createTreat,
  createActionStore,
  memoryAdapter,
  findHarshWords,
  getCategory,
  findOffers,
  applyProtection,
  STATUS,
} from '../engine/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sample = JSON.parse(
  fs.readFileSync(path.join(here, '..', 'data', 'sample-statement.json'), 'utf8'),
);

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.log(`  FAIL ${name}`);
    console.log(`       ${error.message}`);
  }
}

function group(name) {
  console.log(`\n${name}`);
}

const txns = sample.transactions;

/* ---------------------------------------------------------------- */
group('Categories');

test('a category resolves by id and by display name', () => {
  assert.equal(getCategory('eating-out').name, 'Eating Out & Takeaways');
  assert.equal(getCategory('Eating Out & Takeaways').id, 'eating-out');
});

test('rent is marked as never suggested for cuts', () => {
  assert.equal(getCategory('Housing / Rent').neverSuggestCuts, true);
});

/* ---------------------------------------------------------------- */
group('Protected treats');

test('spending inside a cap is hidden from the rules', () => {
  const treat = createTreat({ label: 'coffee', match: { merchants: ['costa'] }, monthlyCap: 25 });
  const { open, protection } = applyProtection(txns, [treat]);

  assert.equal(open.some((t) => t.merchant === 'Costa'), false, 'Costa should not reach the rules');
  assert.equal(protection[0].protectedAmount, 17.75);
  assert.equal(protection[0].overflowAmount, 0);
});

test('a cap splits the month rather than protecting everything', () => {
  const treat = createTreat({ label: 'coffee', match: { merchants: ['costa'] }, monthlyCap: 10 });
  const { protection } = applyProtection(txns, [treat]);

  assert.equal(protection[0].protectedAmount, 10, 'protects exactly up to the cap');
  assert.ok(protection[0].overflowAmount > 0, 'the rest is reported as overflow');
  assert.equal(
    Math.round((protection[0].protectedAmount + protection[0].overflowAmount) * 100) / 100,
    17.75,
    'nothing is lost in the split',
  );
});

test('a treat with no cap protects the lot', () => {
  const treat = createTreat({ label: 'gigs', match: { keywords: ['o2 academy'] }, monthlyCap: null });
  const { protection } = applyProtection(txns, [treat]);
  assert.equal(protection[0].overflowAmount, 0);
  assert.equal(protection[0].protectedAmount, 24.5);
});

test('no recommendation is ever built on protected spending', () => {
  const treat = createTreat({ label: 'takeaways', match: { categories: ['eating-out'] }, monthlyCap: null });
  const result = analyseStatement({ transactions: txns, treats: [treat] });

  const protectedIds = new Set(
    txns.filter((t) => t.category === 'Eating Out & Takeaways').map((t) => t.id),
  );

  for (const rec of result.recommendations) {
    for (const id of rec.evidence.transactionIds || []) {
      assert.equal(protectedIds.has(id), false, `"${rec.title}" used protected transaction ${id}`);
    }
  }
});

test('the student is told what was left alone', () => {
  const treat = createTreat({ label: 'your Costa run', match: { merchants: ['costa'] }, monthlyCap: 25 });
  const result = analyseStatement({ transactions: txns, treats: [treat] });
  assert.match(result.protection.note, /your Costa run/);
});

/* ---------------------------------------------------------------- */
group('Sourced offers');

test('an ebook points at the university library', () => {
  const ebook = [{
    id: 'e1', date: '2026-09-03', description: 'WATERSTONES EBOOK PURCHASE',
    merchant: 'Waterstones', amount: 18.99, category: 'Tuition & Course Materials',
  }];

  const matches = findOffers(ebook);
  const library = matches.find((m) => m.offer.id === 'uni-library-texts');

  assert.ok(library, 'the library offer should match an ebook purchase');
  assert.equal(library.estimatedSaving, 18.99);
});

test('every offer names a provider and a link the student can check', () => {
  for (const { offer } of findOffers(txns)) {
    assert.ok(offer.provider, `${offer.id} has no provider`);
    assert.match(offer.url, /^https:\/\//, `${offer.id} has no usable link`);
    assert.ok(offer.blurb.length > 20, `${offer.id} has no explanation`);
  }
});

test('nothing suggests trimming the rent', () => {
  const rentOnly = txns.filter((t) => t.category === 'Housing / Rent');
  const matches = findOffers(rentOnly).filter((m) => !m.offer.supportOnly);
  assert.equal(matches.length, 0, 'only support-style offers may look at housing');
});

test('a fixed-value offer never claims more than was spent', () => {
  const tiny = [{
    id: 'p1', date: '2026-09-01', description: 'O2 MOBILE', merchant: 'O2',
    amount: 4, category: 'Phone & Essential Subscriptions',
  }];
  const sim = findOffers(tiny).find((m) => m.offer.id === 'sim-only-switch');
  assert.ok(sim.estimatedSaving <= 4, 'cannot save £10 on a £4 bill');
});

/* ---------------------------------------------------------------- */
group('Tone');

test('no recommendation contains a harsh word', () => {
  const result = analyseStatement({ transactions: txns, maxRecommendations: 20 });
  assert.ok(result.recommendations.length > 0, 'there should be something to check');

  for (const rec of result.recommendations) {
    const harsh = findHarshWords(`${rec.title} ${rec.opener} ${rec.message}`);
    assert.deepEqual(harsh, [], `"${rec.title}" used: ${harsh.join(', ')}`);
    assert.equal(rec.tone.gentle, true);
  }
});

test('every offer blurb in the catalogue is gentle too', () => {
  for (const { offer } of findOffers(txns)) {
    assert.deepEqual(
      findHarshWords(offer.blurb),
      [],
      `the blurb for ${offer.id} is not gentle`,
    );
  }
});

test('a month of advice includes something encouraging', () => {
  const result = analyseStatement({ transactions: txns, maxRecommendations: 20 });
  assert.ok(
    result.recommendations.some((r) => r.kind === 'encouragement'),
    'advice should not be entirely corrective',
  );
});

/* ---------------------------------------------------------------- */
group('Limits');

test('the lifestyle ask stays under the ceiling', () => {
  const result = analyseStatement({ transactions: txns });
  assert.ok(
    result.lifestyleAsk <= result.ceiling,
    `asked ${result.lifestyleAsk} against a ceiling of ${result.ceiling}`,
  );
});

test('the same spending is not claimed by two recommendations', () => {
  const result = analyseStatement({ transactions: txns, maxRecommendations: 20 });
  const seen = new Map();

  for (const rec of result.recommendations) {
    if (rec.kind === 'encouragement') continue;
    if (rec.offers.some((o) => o.supportOnly)) continue;

    for (const id of rec.evidence.transactionIds || []) {
      if (seen.has(id)) {
        // Partial overlap is allowed; wholesale double counting is not.
        const overlap = (rec.evidence.transactionIds || [])
          .filter((other) => seen.has(other)).length;
        assert.ok(
          overlap / rec.evidence.transactionIds.length <= 0.5,
          `"${rec.title}" mostly repeats "${seen.get(id)}"`,
        );
      }
    }
    for (const id of rec.evidence.transactionIds || []) seen.set(id, rec.title);
  }
});

test('an empty statement produces no advice and no crash', () => {
  const result = analyseStatement({ transactions: [] });
  assert.equal(result.recommendations.length, 0);
  assert.equal(result.totals.spend, 0);
});

test('a transaction with no category is handled quietly', () => {
  const result = analyseStatement({
    transactions: [{ id: 'x', date: '2026-09-01', description: 'UNKNOWN', amount: 10 }],
  });
  assert.equal(result.totals.spend, 10);
});

/* ---------------------------------------------------------------- */
group('Selected actions');

test('choosing a recommendation puts it on the list', () => {
  const store = createActionStore(memoryAdapter());
  const result = analyseStatement({ transactions: txns, actionStore: store });
  const first = result.recommendations.find((r) => r.estimatedMonthlySaving > 0);

  store.select(first);

  assert.equal(store.progress().selectedCount, 1);
  assert.equal(store.progress().targetMonthlySaving, first.estimatedMonthlySaving);
  assert.equal(store.isSelected(first.id), true);
});

test('only completed actions count towards achieved savings', () => {
  const store = createActionStore(memoryAdapter());
  const result = analyseStatement({ transactions: txns, actionStore: store });
  const first = result.recommendations.find((r) => r.estimatedMonthlySaving > 0);

  const action = store.select(first);
  assert.equal(store.progress().achievedMonthlySaving, 0);

  store.setStatus(action.id, STATUS.DONE);
  assert.equal(store.progress().achievedMonthlySaving, first.estimatedMonthlySaving);
  assert.equal(store.progress().doneCount, 1);
});

test('dismissed advice does not come back next time', () => {
  const store = createActionStore(memoryAdapter());
  const first = analyseStatement({ transactions: txns, actionStore: store });
  const unwanted = first.recommendations[0];

  store.dismiss(unwanted, 'not for me');

  const second = analyseStatement({ transactions: txns, actionStore: store });
  assert.equal(
    second.recommendations.some((r) => r.id === unwanted.id),
    false,
    'the student already said no to this',
  );
});

test('saying no twice offers to protect it instead', () => {
  const store = createActionStore(memoryAdapter());
  const result = analyseStatement({ transactions: txns, actionStore: store });
  const rec = result.recommendations.find((r) => r.categoryId);

  store.dismiss(rec);
  store.dismiss(rec);

  const suggested = store.suggestTreatsFromDismissals();
  assert.equal(suggested.length, 1);
  assert.equal(suggested[0].match.categories[0], rec.categoryId);
});

test('choosing something previously dismissed clears the dismissal', () => {
  const store = createActionStore(memoryAdapter());
  const result = analyseStatement({ transactions: txns, actionStore: store });
  const rec = result.recommendations[0];

  store.dismiss(rec);
  assert.equal(store.isDismissed(rec.id), true);

  store.select(rec);
  assert.equal(store.isDismissed(rec.id), false);
  assert.equal(store.isSelected(rec.id), true);
});

/* ---------------------------------------------------------------- */

console.log(`\n${passed} passed, ${failures.length} failed\n`);
process.exit(failures.length ? 1 : 0);

/**
 * Savings recommendations — public entry point.
 *
 * Give it a month of categorised transactions and the student's protected
 * treats, and it returns the advice to show, what was deliberately left
 * alone, and the offers behind each suggestion.
 *
 *   import { analyseStatement } from './savings/engine/index.js';
 *
 *   const result = analyseStatement({
 *     transactions,            // from the categoriser
 *     treats,                  // whatever the student has protected
 *     actionStore,             // optional, hides advice they already answered
 *   });
 *
 * The categoriser, the dashboard and the backend each depend only on this
 * file, so the rules underneath can change without anyone else noticing.
 */

import { getCategory } from './categories.js';
import {
  applyProtection,
  savingCeiling,
  DEFAULT_JOY_ALLOWANCE,
  SUGGESTED_TREATS,
} from './protected-treats.js';
import { runRules } from './rules.js';
import { compose, opener, protectedNote, findHarshWords, money } from './tone.js';

export { CATEGORIES, getCategory } from './categories.js';
export {
  createTreat,
  SUGGESTED_TREATS,
  DEFAULT_JOY_ALLOWANCE,
  applyProtection,
} from './protected-treats.js';
export { OFFERS, getOffer, findOffers } from './offers.js';
export { createActionStore, memoryAdapter, localStorageAdapter, STATUS } from './actions.js';
export { money, isGentle, findHarshWords } from './tone.js';

/** Fills in the fields a transaction might be missing without complaining. */
function normalise(transaction, index) {
  const amount = Math.abs(Number(transaction.amount) || 0);
  return {
    id: transaction.id || `txn_${index}`,
    date: transaction.date || '',
    description: transaction.description || '',
    merchant: transaction.merchant || '',
    amount,
    category: transaction.category || null,
    categoryId: getCategory(transaction.category)?.id || null,
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function periodOf(transactions) {
  const dates = transactions.map((t) => t.date).filter(Boolean).sort();
  return { from: dates[0] || null, to: dates[dates.length - 1] || null };
}

function spendByCategory(transactions) {
  const totals = new Map();
  for (const t of transactions) {
    const name = getCategory(t.category)?.name || 'Uncategorised';
    totals.set(name, round((totals.get(name) || 0) + t.amount));
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function analyseStatement({
  transactions = [],
  treats = [],
  joyAllowance = DEFAULT_JOY_ALLOWANCE,
  actionStore = null,
  maxRecommendations = 6,
} = {}) {
  const clean = transactions.map(normalise);
  const period = periodOf(clean);
  const totalSpend = round(clean.reduce((sum, t) => sum + t.amount, 0));

  // 1. Take the student's treats off the table before anything else looks at
  //    the data. Nothing downstream can undo this.
  const { open, protection, activeLabels } = applyProtection(clean, treats);

  // 2. Find everything worth saying.
  const findings = runRules(open);

  // 3. Drop anything the student has already turned down. Advice that keeps
  //    coming back after a no stops being advice.
  const live = actionStore
    ? findings.filter((f) => !actionStore.isDismissed(f.id))
    : findings;

  const encouragement = live.filter((f) => f.kind === 'encouragement');
  const savings = live
    .filter((f) => f.kind !== 'encouragement')
    .sort((a, b) => b.monthlySaving - a.monthlySaving);

  // 4. Hold the total ask under the ceiling.
  //
  //    The ceiling only governs findings that ask the student to go without
  //    something — the behavioural rules. A sourced offer is a cheaper route
  //    to the same thing, so it costs them nothing and is not rationed.
  //    Spending the ceiling on offers was starving the behavioural advice.
  const ceiling = round(savingCeiling(clean, protection, joyAllowance));
  const kept = [];
  const claimed = new Set();
  let asked = 0;
  let running = 0;

  for (const finding of savings) {
    const isSupport = finding.offers.some((o) => o.supportOnly);

    // Support findings are help rather than advice. They never compete for a
    // slot and never count towards a total, so they are handled separately
    // below instead of being squeezed out by higher-value savings.
    if (isSupport) continue;

    if (kept.length >= maxRecommendations) break;

    // Two rules can reach for the same money — a takeaway habit and a
    // cheaper-food offer both looking at the same six orders. Showing both
    // is fine; adding both to the total is not, and it is also two pieces of
    // advice about one evening. Whichever saves more gets the spend.
    const ids = finding.evidence.transactionIds || [];
    const overlap = ids.filter((id) => claimed.has(id)).length;
    if (ids.length && overlap / ids.length > 0.5) continue;

    const costsLifestyle = finding.kind === 'pattern';
    if (costsLifestyle && asked + finding.monthlySaving > ceiling) continue;

    kept.push(finding);
    ids.forEach((id) => claimed.add(id));
    running += finding.monthlySaving;
    if (costsLifestyle) asked += finding.monthlySaving;
  }

  const support = savings.filter((f) => f.offers.some((o) => o.supportOnly));

  // 5. Hand everything to the tone layer. Nothing reaches a student before
  //    this point.
  const note = protectedNote(activeLabels);
  const recommendations = [...kept, ...support, ...encouragement].map((finding) =>
    present(finding, note, actionStore),
  );

  return {
    period,
    // What we are asking the student to go without, kept separate from the
    // total, so the dashboard can be honest about the difference.
    lifestyleAsk: round(asked),
    totals: {
      spend: totalSpend,
      protected: round(protection.reduce((sum, p) => sum + p.protectedAmount, 0)),
      byCategory: spendByCategory(clean),
    },
    protection: {
      labels: activeLabels,
      note,
      entries: protection.map((entry) => ({
        treatId: entry.treat.id,
        label: entry.treat.label,
        reason: entry.treat.reason,
        monthlyCap: entry.treat.monthlyCap,
        protectedAmount: round(entry.protectedAmount),
        overflowAmount: round(entry.overflowAmount),
        transactionCount: entry.matched.length,
      })),
    },
    recommendations,
    potentialMonthlySaving: round(running),
    ceiling,
    suggestedTreats: SUGGESTED_TREATS,
  };
}

function present(finding, note, actionStore) {
  const seed = finding.id;
  const register = finding.register || 'optional';
  const message = compose({
    observation: finding.observation,
    suggestion: finding.suggestion,
    seed,
    register,
  });

  // A guard rather than a formality. If a rule ever slips into scolding, this
  // is what catches it before a student reads it.
  const harsh = findHarshWords(`${finding.title} ${message}`);
  if (harsh.length) {
    console.warn(`Savings advice "${finding.id}" used harsh wording: ${harsh.join(', ')}`);
  }

  return {
    id: finding.id,
    kind: finding.kind,
    title: finding.title,
    opener: finding.kind === 'encouragement'
      ? 'Worth saying'
      : opener(finding.monthlySaving, seed, register),
    message,
    categoryId: finding.categoryId,
    categoryName: finding.categoryName,
    estimatedMonthlySaving: round(finding.monthlySaving),
    estimatedMonthlySavingLabel: finding.monthlySaving > 0 ? money(finding.monthlySaving) : null,
    confidence: finding.confidence,
    evidence: finding.evidence,
    offers: (finding.offers || []).map((offer) => ({
      id: offer.id,
      title: offer.title,
      provider: offer.provider,
      url: offer.url,
      blurb: offer.blurb,
      verify: Boolean(offer.verify),
      supportOnly: Boolean(offer.supportOnly),
      estimatedSaving: round(offer.estimatedSaving || 0),
    })),
    protectedNote: note,
    tone: { gentle: harsh.length === 0, harshWords: harsh },
    state: {
      selected: actionStore ? actionStore.isSelected(finding.id) : false,
      dismissed: actionStore ? actionStore.isDismissed(finding.id) : false,
    },
  };
}

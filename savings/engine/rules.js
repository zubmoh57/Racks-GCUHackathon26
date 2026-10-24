/**
 * The rules that spot something worth saying.
 *
 * A rule never writes the message a student reads. It produces a finding: a
 * plain observation, a plain suggestion, an estimated monthly saving, and the
 * transactions that back it up. The tone layer turns that into the warm copy,
 * and index.js decides which findings actually make the cut.
 *
 * Rules only ever see "open" transactions — protected treats have already
 * been taken out upstream, so no rule can accidentally build advice on top of
 * someone's Friday night.
 */

import { getCategory } from './categories.js';
import { findOffers } from './offers.js';
import { money } from './tone.js';

function round(value) {
  return Math.round(value * 100) / 100;
}

function total(transactions) {
  return round(transactions.reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0));
}

/**
 * Rule 1 — an offer exists for money already spent.
 *
 * This is the rule that carries the feature. It is what turns "you bought an
 * ebook" into "the library has it", which is the awareness the whole product
 * is for.
 */
function offerLedFindings(transactions) {
  return findOffers(transactions)
    .filter((match) => match.estimatedSaving >= 2 || match.offer.supportOnly)
    .map((match) => {
      const { offer, matchedSpend, estimatedSaving, transactions: matched } = match;
      const category = getCategory(matched[0]?.category);

      const observation = offer.supportOnly
        ? `Your essentials came to ${money(matchedSpend)} this month, which is a lot to carry on a student budget.`
        : `${money(matchedSpend)} went on ${describe(matched)} this month.`;

      // The blurb stands on its own. An earlier version opened with the
      // offer's name, which the card already shows as its heading and which
      // produced lines like "Own-brand and student discount days covers this."
      const check = offer.verify ? ' Worth a look at what yours offers.' : '';
      const suggestion = `${offer.blurb}${check}`;

      return {
        id: `offer:${offer.id}`,
        kind: 'sourced-offer',
        title: offer.title,
        register: offer.supportOnly ? 'support' : 'optional',
        categoryId: category?.id || null,
        categoryName: category?.name || null,
        observation,
        suggestion,
        monthlySaving: estimatedSaving,
        confidence: offer.verify ? 'medium' : 'high',
        evidence: {
          transactionIds: matched.map((t) => t.id),
          transactionCount: matched.length,
          total: matchedSpend,
        },
        offers: [{ ...offer, estimatedSaving }],
      };
    });
}

/**
 * Rule 2 — subscriptions quietly stacking up.
 *
 * Students rarely decide to pay for five services. They sign up for one a
 * term and never see them side by side. Showing the pile is usually enough.
 */
function subscriptionStackFinding(transactions) {
  const subs = transactions.filter((t) => getCategory(t.category)?.id === 'extra-subs');
  if (subs.length < 3) return [];

  const spend = total(subs);
  if (spend < 10) return [];

  // We only ever suggest letting go of the smallest handful, never the lot.
  const sorted = [...subs].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const candidates = sorted.slice(2);
  const saving = total(candidates);

  return [{
    id: 'rule:subscription-stack',
    kind: 'pattern',
    register: 'keep',
    title: 'Your subscriptions, side by side',
    categoryId: 'extra-subs',
    categoryName: 'Extra Subscriptions',
    observation:
      `You have ${subs.length} subscriptions running alongside each other, coming to ${money(spend)} a month.`,
    suggestion:
      'Seen together they add up faster than they do one at a time. If any of them have gone quiet lately, '
      + 'pausing one or two would put that money back in your pocket without changing much day to day.',
    monthlySaving: round(saving),
    confidence: 'medium',
    evidence: {
      transactionIds: subs.map((t) => t.id),
      transactionCount: subs.length,
      total: spend,
    },
    offers: [],
  }];
}

/**
 * Rule 3 — lots of small takeaways.
 *
 * Phrased around the count rather than the money, because the student already
 * knows what it cost. What they usually have not noticed is how many times.
 */
function takeawayFrequencyFinding(transactions) {
  const takeaways = transactions.filter((t) => getCategory(t.category)?.id === 'eating-out');
  if (takeaways.length < 5) return [];

  const spend = total(takeaways);
  const average = round(spend / takeaways.length);
  // A rough, deliberately conservative figure: swapping a third of them.
  const saving = round(spend * 0.33);

  return [{
    id: 'rule:takeaway-frequency',
    kind: 'pattern',
    register: 'keep',
    title: 'Something easy in the freezer',
    categoryId: 'eating-out',
    categoryName: 'Eating Out & Takeaways',
    observation:
      `There were ${takeaways.length} takeaways and meals out this month, averaging ${money(average)} each.`,
    suggestion:
      'Most of these tend to happen on the evenings when cooking feels like one job too many. '
      + 'Having something easy already in the freezer for two of those nights would keep the rest exactly as they are.',
    monthlySaving: saving,
    confidence: 'low',
    evidence: {
      transactionIds: takeaways.map((t) => t.id),
      transactionCount: takeaways.length,
      total: spend,
    },
    offers: [],
  }];
}

/**
 * Rule 4 — something they already did well.
 *
 * Not a saving, and it is not here to pad the list. A month of advice with no
 * acknowledgement in it reads as a telling-off however carefully it is worded.
 */
function encouragementFinding(transactions) {
  const groceries = transactions.filter((t) => getCategory(t.category)?.id === 'groceries');
  const eatingOut = transactions.filter((t) => getCategory(t.category)?.id === 'eating-out');

  const groceriesTotal = total(groceries);
  const eatingOutTotal = total(eatingOut);

  if (groceries.length < 2 || groceriesTotal <= eatingOutTotal) return [];

  return [{
    id: 'rule:cooking-at-home',
    kind: 'encouragement',
    register: 'none',
    title: 'You are already doing the hard part',
    categoryId: 'groceries',
    categoryName: 'Groceries',
    observation:
      `You spent more on groceries (${money(groceriesTotal)}) than on eating out (${money(eatingOutTotal)}) this month.`,
    suggestion:
      'That is the habit most students find hardest, and it is already doing the heavy lifting in your budget. '
      + 'Nothing to change here.',
    monthlySaving: 0,
    confidence: 'high',
    evidence: {
      transactionIds: groceries.map((t) => t.id),
      transactionCount: groceries.length,
      total: groceriesTotal,
    },
    offers: [],
  }];
}

/** Describes a group of transactions by their most common merchant. */
function describe(transactions) {
  const counts = new Map();
  for (const t of transactions) {
    const name = t.merchant || t.description || 'these';
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const [topName] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (transactions.length === 1) return topName;
  if (counts.size === 1) return topName;
  return `${topName} and ${counts.size - 1} other place${counts.size > 2 ? 's' : ''}`;
}

const RULES = [
  offerLedFindings,
  subscriptionStackFinding,
  takeawayFrequencyFinding,
  encouragementFinding,
];

/** Runs every rule and returns the raw findings, unfiltered and unworded. */
export function runRules(openTransactions) {
  // Categories marked neverSuggestCuts are screened inside the offer matcher,
  // so support-style offers can still see them. The pattern rules below only
  // look at discretionary categories, so nothing extra is needed here.
  const eligible = openTransactions;

  return RULES.flatMap((rule) => {
    // One broken rule should never take the whole dashboard down.
    try {
      return rule(eligible) || [];
    } catch (error) {
      console.warn(`Savings rule failed: ${error.message}`);
      return [];
    }
  });
}

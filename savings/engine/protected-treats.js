/**
 * Protected treats — the guardrail that stops this feature becoming a nag.
 *
 * A student can ring-fence the spending that makes their life worth living:
 * the morning coffee, Friday night pizza, the gig they go to every month.
 * Anything a treat covers is removed before the rules ever see it, so no
 * recommendation can be built on top of it.
 *
 * Each treat carries a monthly cap. Spending inside the cap is invisible to
 * the engine. Spending beyond it is not punished either — it comes back as a
 * quiet "overflow" signal that only speaks up when the gap is genuinely large.
 */

import { getCategory, isDiscretionary } from './categories.js';

/**
 * Even with no treats defined, this much discretionary spending per month is
 * left alone. It stops the engine from recommending a student down to a life
 * of rent and porridge.
 */
export const DEFAULT_JOY_ALLOWANCE = 40;

/**
 * Starter treats the UI can offer on first run, so a student does not face an
 * empty "protect something" screen. None of these are active until chosen.
 */
export const SUGGESTED_TREATS = [
  {
    id: 'suggested-coffee',
    label: 'your coffee run',
    match: { keywords: ['coffee', 'costa', 'starbucks', 'pret', 'caffe nero'] },
    monthlyCap: 25,
    reason: 'The small ritual that makes the morning work.',
  },
  {
    id: 'suggested-friday-night',
    label: 'your Friday night out',
    match: { categories: ['social'] },
    monthlyCap: 60,
    reason: 'Seeing people is not a luxury.',
  },
  {
    id: 'suggested-takeaway',
    label: 'your weekly takeaway',
    match: { categories: ['eating-out'] },
    monthlyCap: 30,
    reason: 'One night a week with no washing up.',
  },
  {
    id: 'suggested-streaming',
    label: 'your one streaming service',
    match: { keywords: ['netflix', 'spotify', 'disney', 'prime video'] },
    monthlyCap: 12,
    reason: 'Somewhere to disappear after a long day.',
  },
];

let treatCounter = 0;

/** Builds a treat, filling in the parts the UI does not need to care about. */
export function createTreat({ id, label, match = {}, monthlyCap = null, reason = '' }) {
  if (!label) throw new Error('A protected treat needs a label the student recognises.');
  return {
    id: id || `treat_${Date.now()}_${treatCounter++}`,
    label,
    match: {
      merchants: (match.merchants || []).map((m) => m.toLowerCase()),
      categories: match.categories || [],
      keywords: (match.keywords || []).map((k) => k.toLowerCase()),
    },
    // null cap means "protect this completely, whatever it costs".
    monthlyCap: monthlyCap === null ? null : Number(monthlyCap),
    reason,
    createdAt: new Date().toISOString(),
  };
}

export function matchesTreat(transaction, treat) {
  const haystack = `${transaction.description || ''} ${transaction.merchant || ''}`.toLowerCase();

  if (treat.match.merchants.length) {
    const merchant = (transaction.merchant || '').toLowerCase();
    if (treat.match.merchants.some((m) => merchant.includes(m))) return true;
  }

  if (treat.match.keywords.length) {
    if (treat.match.keywords.some((k) => haystack.includes(k))) return true;
  }

  if (treat.match.categories.length) {
    const category = getCategory(transaction.category);
    if (category && treat.match.categories.some((c) => getCategory(c)?.id === category.id)) {
      return true;
    }
  }

  return false;
}

/**
 * Splits a month of transactions into what the rules may look at and what is
 * protected.
 *
 * Transactions are taken in date order, so a cap protects the earliest
 * spending in the month — the student's regular habit — rather than whichever
 * transaction happened to be largest.
 *
 * Returns:
 *   open          transactions the rules are free to reason about
 *   protection    one entry per treat that matched something
 *   activeLabels  labels to show the student, proving we left their treats alone
 */
export function applyProtection(transactions, treats = []) {
  if (!treats.length) {
    return { open: [...transactions], protection: [], activeLabels: [] };
  }

  const ordered = [...transactions].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const spentPerTreat = new Map(treats.map((t) => [t.id, 0]));
  const protection = new Map(
    treats.map((t) => [t.id, { treat: t, matched: [], protectedAmount: 0, overflowAmount: 0 }]),
  );
  const open = [];

  for (const transaction of ordered) {
    const treat = treats.find((t) => matchesTreat(transaction, t));
    if (!treat) {
      open.push(transaction);
      continue;
    }

    const entry = protection.get(treat.id);
    const amount = Math.abs(Number(transaction.amount) || 0);
    entry.matched.push(transaction);

    if (treat.monthlyCap === null) {
      entry.protectedAmount += amount;
      spentPerTreat.set(treat.id, spentPerTreat.get(treat.id) + amount);
      continue;
    }

    const alreadySpent = spentPerTreat.get(treat.id);
    const headroom = Math.max(0, treat.monthlyCap - alreadySpent);
    const covered = Math.min(amount, headroom);

    entry.protectedAmount += covered;
    entry.overflowAmount += amount - covered;
    spentPerTreat.set(treat.id, alreadySpent + amount);
  }

  const used = [...protection.values()].filter((entry) => entry.matched.length > 0);

  return {
    open,
    protection: used,
    activeLabels: used.map((entry) => entry.treat.label),
  };
}

/**
 * The floor on how much the engine is willing to recommend away.
 *
 * Discretionary spending minus the joy allowance (and minus anything already
 * protected) is the most we will ever ask a student to reconsider in a month.
 */
export function savingCeiling(transactions, protection, joyAllowance = DEFAULT_JOY_ALLOWANCE) {
  const discretionaryTotal = transactions
    .filter((t) => isDiscretionary(t.category))
    .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

  const alreadyProtected = protection.reduce((sum, entry) => sum + entry.protectedAmount, 0);

  return Math.max(0, discretionaryTotal - alreadyProtected - joyAllowance);
}

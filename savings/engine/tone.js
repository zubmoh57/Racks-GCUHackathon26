/**
 * The voice of the savings advice.
 *
 * Every rule produces a dry finding (category, amount, evidence). Nothing
 * reaches the student until it passes through here, so the whole feature
 * speaks in one warm, non-judgemental voice instead of each rule inventing
 * its own.
 *
 * The rule we hold ourselves to: point at the money, never at the person.
 * "Your ebooks came to 32 pounds" is fine. "You wasted 32 pounds" is not.
 */

/**
 * Words that shame, scold, or give orders. If any of these reach the student
 * the tone has slipped, so the test suite fails the build on them.
 */
export const HARSH_WORDS = [
  'wasted', 'waste', 'wasteful',
  'overspent', 'overspending', 'splurged', 'blew',
  'bad', 'terrible', 'awful', 'poor choice', 'mistake',
  'you should', 'you must', 'you need to', 'stop ',
  'too much', 'excessive', 'irresponsible', 'reckless',
  'guilty', 'shame', 'failure', 'failed',
  'cut out', 'give up', 'quit ', 'avoid ',
  "can't afford", 'cannot afford',
];

/** Case-insensitive scan for anything in HARSH_WORDS. */
export function findHarshWords(text) {
  if (!text) return [];
  const haystack = String(text).toLowerCase();
  return HARSH_WORDS.filter((word) => haystack.includes(word));
}

export function isGentle(text) {
  return findHarshWords(text).length === 0;
}

export function money(amount, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount ?? 0);
}

/**
 * Openers rotate so a dashboard full of advice does not read like a form
 * letter. Keyed by how much slack the finding has: a gentle nudge for small
 * sums, a warmer framing for the ones worth real money.
 */
const OPENERS = {
  small: [
    'A small one, if you fancy it',
    'Only a little thing',
    'Worth a glance when you have a minute',
  ],
  medium: [
    'Something we noticed',
    'Here is one that could free up a bit',
    'A gentle thought for next month',
  ],
  large: [
    'This one could make a real difference',
    'The biggest opportunity we found',
    'Worth five minutes of your time',
  ],
  // Used when the finding is help rather than a saving.
  support: [
    'If money is tight right now',
    'Something that exists for exactly this',
    'In case nobody has mentioned it',
  ],
};

/**
 * Closers keep the student in charge — the advice is always optional.
 *
 * Split by register, because the right sign-off depends on what is being
 * suggested. "Keep it if you love it" is warm on a takeaway habit and absurd
 * on a council tax refund.
 */
const CLOSERS = {
  // A cheaper route to the same thing: nothing is being given up.
  optional: [
    'Entirely up to you, of course.',
    'No pressure either way.',
    'Your call — we are just pointing it out.',
    'Worth knowing either way.',
  ],
  // Spending we are inviting them to reconsider. Their life, their choice.
  keep: [
    'Keep it exactly as it is if it is working for you.',
    'Only if it suits how you live.',
    'No pressure either way.',
    'You know your week better than we do.',
  ],
  // Help that exists because things are hard. Nothing breezy here.
  support: [
    'There is no catch, and asking costs nothing.',
    'Plenty of students use it, and nobody needs to know.',
    'Worth knowing it is there.',
  ],
};

function pick(list, seed) {
  // Deterministic by seed so the same statement always renders the same copy,
  // which keeps the tests and the demo stable.
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return list[hash % list.length];
}

export function sizeOf(monthlySaving) {
  if (monthlySaving >= 20) return 'large';
  if (monthlySaving >= 7) return 'medium';
  return 'small';
}

export function opener(monthlySaving, seed, register = 'optional') {
  if (register === 'support') return pick(OPENERS.support, seed);
  return pick(OPENERS[sizeOf(monthlySaving)], seed);
}

export function closer(seed, register = 'optional') {
  // 'none' is for advice that already ends on the right note.
  if (register === 'none') return '';
  return pick(CLOSERS[register] || CLOSERS.optional, seed);
}

/**
 * Wraps a finding's plain observation and suggestion into the final message.
 * `observation` states what the money did; `suggestion` offers the softer
 * alternative. Neither should contain an instruction.
 */
export function compose({ observation, suggestion, seed, register = 'optional' }) {
  const parts = [observation.trim(), suggestion.trim(), closer(seed, register)];
  return parts.filter(Boolean).join(' ');
}

/**
 * The line we show when a protected treat kept something out of the advice.
 * It matters that the student sees this: it is the proof that the app is on
 * their side rather than quietly counting every coffee.
 */
export function protectedNote(treatLabels) {
  if (!treatLabels || treatLabels.length === 0) return null;
  if (treatLabels.length === 1) {
    return `We left ${treatLabels[0]} out of this — that one is yours to keep.`;
  }
  const last = treatLabels[treatLabels.length - 1];
  const rest = treatLabels.slice(0, -1).join(', ');
  return `We left ${rest} and ${last} out of this — those are yours to keep.`;
}

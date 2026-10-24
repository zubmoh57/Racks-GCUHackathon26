/**
 * The ten ledger categories shared across the whole dashboard.
 *
 * The categoriser owns assigning these to transactions. This module only
 * describes them, so the savings engine can reason about which spending is
 * essential (never nag), semi-flexible, or discretionary.
 */

export const ESSENTIAL = 'essential';
export const SEMI_FLEXIBLE = 'semi-flexible';
export const DISCRETIONARY = 'discretionary';

export const CATEGORIES = [
  {
    id: 'housing',
    name: 'Housing / Rent',
    flexibility: ESSENTIAL,
    // A roof is not a lifestyle choice. We never suggest cutting this back.
    neverSuggestCuts: true,
  },
  {
    id: 'utilities',
    name: 'Utilities & Bills',
    flexibility: SEMI_FLEXIBLE,
    neverSuggestCuts: false,
  },
  {
    id: 'tuition',
    name: 'Tuition & Course Materials',
    flexibility: SEMI_FLEXIBLE,
    // Course materials are often free somewhere the student has not looked yet.
    neverSuggestCuts: false,
  },
  {
    id: 'groceries',
    name: 'Groceries',
    flexibility: SEMI_FLEXIBLE,
    neverSuggestCuts: false,
  },
  {
    id: 'transport',
    name: 'Transportation',
    flexibility: SEMI_FLEXIBLE,
    neverSuggestCuts: false,
  },
  {
    id: 'phone',
    name: 'Phone & Essential Subscriptions',
    flexibility: SEMI_FLEXIBLE,
    neverSuggestCuts: false,
  },
  {
    id: 'social',
    name: 'Socializing & Entertainment',
    flexibility: DISCRETIONARY,
    neverSuggestCuts: false,
  },
  {
    id: 'eating-out',
    name: 'Eating Out & Takeaways',
    flexibility: DISCRETIONARY,
    neverSuggestCuts: false,
  },
  {
    id: 'personal-care',
    name: 'Personal Care & Clothing',
    flexibility: DISCRETIONARY,
    neverSuggestCuts: false,
  },
  {
    id: 'extra-subs',
    name: 'Extra Subscriptions',
    flexibility: DISCRETIONARY,
    neverSuggestCuts: false,
  },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
const BY_NAME = new Map(CATEGORIES.map((c) => [c.name.toLowerCase(), c]));

/** Accepts either a category id ('eating-out') or its display name. */
export function getCategory(idOrName) {
  if (!idOrName) return null;
  const key = String(idOrName).toLowerCase().trim();
  return BY_ID.get(key) || BY_NAME.get(key) || null;
}

export function isEssential(idOrName) {
  const category = getCategory(idOrName);
  return category ? category.flexibility === ESSENTIAL : false;
}

export function isDiscretionary(idOrName) {
  const category = getCategory(idOrName);
  return category ? category.flexibility === DISCRETIONARY : false;
}

/**
 * Sourced offers — the half of this feature that creates awareness.
 *
 * A recommendation without an alternative is just criticism. Every piece of
 * advice we give should be able to finish the sentence "...and here is where
 * to get it instead". That is what an offer is: a named provider, a link the
 * student can open, and an honest estimate of what it would save.
 *
 * "Sourced" is the bar for entry. Anything in this catalogue names who
 * provides it, so a student can check us rather than take our word for it.
 * Offers with `verify: true` differ by institution and are shown with a
 * "check your own university" framing rather than stated as fact.
 */

import { getCategory } from './categories.js';

/**
 * savingModel tells the engine how much of the matched spend an offer could
 * realistically replace:
 *   { type: 'percent', value: 0.33 }   a third off
 *   { type: 'fixed',   value: 8 }      about 8 pounds a month
 */
export const OFFERS = [
  {
    id: 'uni-library-texts',
    title: 'Your university library',
    provider: 'University library services',
    url: 'https://www.jisc.ac.uk/library-support',
    blurb:
      'Most course texts, ebooks and journal articles are already paid for by your fees. '
      + 'Search the library catalogue with your student login before buying a copy.',
    appliesTo: {
      categories: ['tuition'],
      keywords: ['ebook', 'e-book', 'textbook', 'book', 'kindle', 'waterstones', 'blackwell', 'pearson', 'wiley', 'journal', 'article'],
    },
    savingModel: { type: 'percent', value: 1.0 },
    verify: true,
  },
  {
    id: 'uni-printing',
    title: 'Campus print credit',
    provider: 'University print services',
    url: 'https://www.jisc.ac.uk/library-support',
    blurb: 'Campus printing is usually a few pence a page, and some courses include a free allowance.',
    appliesTo: {
      categories: ['tuition'],
      keywords: ['print', 'printing', 'photocopy', 'stationery', 'ryman'],
    },
    savingModel: { type: 'percent', value: 0.6 },
    verify: true,
  },
  {
    id: 'software-student-licence',
    title: 'Free student software licences',
    provider: 'Microsoft, Autodesk, JetBrains and others',
    url: 'https://www.microsoft.com/en-gb/education/products/office',
    blurb:
      'Office, Autodesk, JetBrains and many design tools are free with a student email address. '
      + 'Worth checking before renewing a paid licence.',
    appliesTo: {
      categories: ['tuition', 'extra-subs'],
      keywords: ['adobe', 'microsoft', 'office 365', 'autodesk', 'jetbrains', 'figma', 'canva', 'grammarly', 'chegg', 'coursehero'],
    },
    savingModel: { type: 'percent', value: 1.0 },
    verify: true,
  },
  {
    id: 'student-railcard',
    title: '16-25 Railcard',
    provider: 'National Rail',
    url: 'https://www.16-25railcard.co.uk/',
    blurb: 'A third off most rail fares for 30 pounds a year. It pays for itself in about four journeys.',
    appliesTo: {
      categories: ['transport'],
      keywords: ['rail', 'train', 'scotrail', 'lner', 'trainline', 'avanti', 'northern'],
    },
    savingModel: { type: 'percent', value: 0.33 },
    verify: false,
  },
  {
    id: 'student-bus-pass',
    title: 'Student bus and tram passes',
    provider: 'Your local transport operator',
    url: 'https://www.firstbus.co.uk/tickets/student-tickets',
    blurb: 'A termly or monthly student pass is usually far cheaper than paying for single fares.',
    appliesTo: {
      categories: ['transport'],
      keywords: ['bus', 'tram', 'subway', 'firstbus', 'stagecoach', 'lothian', 'megabus'],
    },
    savingModel: { type: 'percent', value: 0.35 },
    verify: true,
  },
  {
    id: 'totum',
    title: 'TOTUM and UNiDAYS discounts',
    provider: 'NUS TOTUM / UNiDAYS',
    url: 'https://www.totum.com/',
    blurb: 'Student discount on clothing, tech and high street shops. UNiDAYS is free to join.',
    appliesTo: {
      categories: ['personal-care'],
      keywords: ['asos', 'h&m', 'zara', 'boots', 'superdrug', 'nike', 'apple', 'currys', 'uniqlo'],
    },
    savingModel: { type: 'percent', value: 0.15 },
    verify: false,
  },
  {
    id: 'too-good-to-go',
    title: 'Too Good To Go',
    provider: 'Too Good To Go',
    url: 'https://www.toogoodtogo.com/en-gb',
    blurb: 'Surprise bags of unsold food from local cafes and bakeries, usually two to four pounds.',
    appliesTo: {
      categories: ['eating-out', 'groceries'],
      keywords: ['deliveroo', 'uber eats', 'just eat', 'takeaway', 'greggs', 'bakery'],
    },
    savingModel: { type: 'percent', value: 0.5 },
    verify: false,
  },
  {
    id: 'olio-foodshare',
    title: 'Olio and campus food shares',
    provider: 'Olio / students union',
    url: 'https://olioapp.com/en/',
    blurb: 'Free surplus food shared by neighbours and shops, plus most unions run a food pantry.',
    appliesTo: {
      categories: ['groceries'],
      keywords: ['tesco', 'sainsbury', 'asda', 'morrisons', 'co-op', 'waitrose', 'lidl', 'aldi'],
    },
    savingModel: { type: 'fixed', value: 15 },
    verify: true,
  },
  {
    id: 'supermarket-own-brand',
    title: 'Own-brand and student discount days',
    provider: 'Major UK supermarkets',
    url: 'https://www.moneysavingexpert.com/shopping/supermarket-shopping/',
    blurb:
      'Own-brand staples are typically a third cheaper, and several supermarkets run a student '
      + 'discount day midweek with a valid card.',
    appliesTo: {
      categories: ['groceries'],
      keywords: ['tesco', 'sainsbury', 'asda', 'morrisons', 'co-op', 'waitrose', 'marks'],
    },
    savingModel: { type: 'percent', value: 0.2 },
    verify: false,
  },
  {
    id: 'sim-only-switch',
    title: 'SIM-only and student mobile plans',
    provider: 'Giffgaff, Smarty, Voxi and others',
    url: 'https://www.uswitch.com/mobiles/sim-only/',
    blurb: 'SIM-only plans with plenty of data commonly run from six to twelve pounds a month.',
    appliesTo: {
      categories: ['phone'],
      keywords: ['ee', 'o2', 'vodafone', 'three', 'sky mobile', 'mobile', 'phone bill'],
    },
    savingModel: { type: 'fixed', value: 10 },
    verify: false,
  },
  {
    id: 'student-streaming-rate',
    title: 'Student rates on streaming',
    provider: 'Spotify, Apple, Amazon and others',
    url: 'https://www.spotify.com/uk/student/',
    blurb: 'Spotify, Apple Music and Prime all run student pricing at roughly half the usual rate.',
    appliesTo: {
      categories: ['extra-subs', 'phone'],
      keywords: ['spotify', 'apple music', 'netflix', 'disney', 'prime', 'youtube premium', 'audible'],
    },
    savingModel: { type: 'percent', value: 0.5 },
    verify: false,
  },
  {
    id: 'council-tax-exemption',
    title: 'Council tax student exemption',
    provider: 'Your local council',
    url: 'https://www.gov.uk/council-tax/discounts-for-full-time-students',
    blurb:
      'Full-time students are exempt from council tax. If a bill has been going out, you can usually '
      + 'claim it back for the whole period you were studying.',
    appliesTo: {
      categories: ['utilities', 'housing'],
      keywords: ['council tax', 'council'],
    },
    savingModel: { type: 'percent', value: 1.0 },
    verify: false,
  },
  {
    id: 'uni-gym-and-societies',
    title: 'Campus gym and society memberships',
    provider: 'Students union',
    url: 'https://www.nus.org.uk/',
    blurb: 'Campus gyms and society socials usually cost a fraction of commercial memberships.',
    appliesTo: {
      categories: ['extra-subs', 'social'],
      keywords: ['gym', 'puregym', 'thegym', 'fitness', 'david lloyd', 'nuffield'],
    },
    savingModel: { type: 'percent', value: 0.5 },
    verify: true,
  },
  {
    id: 'hardship-fund',
    title: 'University hardship fund',
    provider: 'Your university student services',
    url: 'https://www.gov.uk/extra-money-pay-university',
    blurb:
      'Most universities hold a hardship fund that does not need repaying. Applying is confidential '
      + 'and does not affect your course.',
    appliesTo: {
      categories: ['housing', 'utilities'],
      keywords: [],
    },
    savingModel: { type: 'fixed', value: 0 },
    verify: true,
    // Shown as support rather than a saving, so it never competes on value.
    supportOnly: true,
  },
];

const OFFERS_BY_ID = new Map(OFFERS.map((o) => [o.id, o]));

export function getOffer(id) {
  return OFFERS_BY_ID.get(id) || null;
}

function offerMatchesTransaction(offer, transaction) {
  const category = getCategory(transaction.category);
  const categoryHit = offer.appliesTo.categories.some((c) => getCategory(c)?.id === category?.id);
  if (!categoryHit) return false;

  // Rent is not something we will ever suggest trimming. Support-style offers
  // such as a hardship fund are the one thing allowed to look at it, because
  // they add money rather than asking the student to go without.
  if (category?.neverSuggestCuts && !offer.supportOnly) return false;

  if (!offer.appliesTo.keywords.length) return true;

  const haystack = `${transaction.description || ''} ${transaction.merchant || ''}`.toLowerCase();
  return offer.appliesTo.keywords.some((keyword) => haystack.includes(keyword));
}

/** Every offer relevant to a set of transactions, best saving first. */
export function findOffers(transactions) {
  const matchedSpend = new Map();

  for (const transaction of transactions) {
    for (const offer of OFFERS) {
      if (!offerMatchesTransaction(offer, transaction)) continue;
      const current = matchedSpend.get(offer.id) || { offer, spend: 0, transactions: [] };
      current.spend += Math.abs(Number(transaction.amount) || 0);
      current.transactions.push(transaction);
      matchedSpend.set(offer.id, current);
    }
  }

  return [...matchedSpend.values()]
    .map(({ offer, spend, transactions: matched }) => ({
      offer,
      matchedSpend: round(spend),
      transactions: matched,
      estimatedSaving: offer.supportOnly ? 0 : round(estimateSaving(offer, spend)),
    }))
    .sort((a, b) => b.estimatedSaving - a.estimatedSaving);
}

export function estimateSaving(offer, matchedSpend) {
  if (offer.savingModel.type === 'percent') {
    return matchedSpend * offer.savingModel.value;
  }
  // A fixed offer can never claim to save more than was actually spent.
  return Math.min(offer.savingModel.value, matchedSpend);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

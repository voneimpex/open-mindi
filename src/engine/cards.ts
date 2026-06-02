/**
 * Cards, suits, ranks and deck construction for Open Mindi.
 *
 * Rank values are numeric for easy comparison. The Ace is HIGH (14) for the
 * purpose of winning tricks, even though the 10 ("mindi") is the valuable
 * point card. So trick-winning order high -> low is: A K Q J 10 9 ... 3 2.
 */

export type Suit = 'S' | 'H' | 'D' | 'C';
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export const SUIT_NAME: Record<Suit, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs'
};

export const SUIT_SYMBOL: Record<Suit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣'
};

export const SUIT_IS_RED: Record<Suit, boolean> = {
  S: false,
  H: true,
  D: true,
  C: false
};

/** Rank values 2..14 (J=11, Q=12, K=13, A=14). The 10 is the mindi. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export const MINDI_RANK: Rank = 10;

export const RANK_LABEL: Record<Rank, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
};

export interface Card {
  /** Unique id within a single dealt game (stable for animation/identity). */
  uid: number;
  suit: Suit;
  rank: Rank;
  /** Which physical deck copy this came from (0, 1, ...). Used only to keep
   *  uids distinct when two decks / added tens create identical face cards. */
  copy: number;
}

/** Two cards are "the same card" (for the top-card-wins tie rule) when their
 *  face matches, regardless of which deck copy they came from. */
export function sameFace(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function isMindi(c: Card): boolean {
  return c.rank === MINDI_RANK;
}

export function cardLabel(c: Card): string {
  return `${RANK_LABEL[c.rank]}${SUIT_SYMBOL[c.suit]}`;
}

export interface RemoveCardSpec {
  rank: Rank;
  suit: Suit;
  /** Number of copies to remove. Omit to remove ALL copies of this face. */
  count?: number;
}

export interface DeckSpec {
  /** Number of physical 52-card decks to start from. */
  decks: number;
  /** Remove every card of these ranks (all suits, all copies). */
  removeRanks?: Rank[];
  /** Remove specific faces, optionally limited to a number of copies. */
  removeCards?: RemoveCardSpec[];
  /** Add this many extra tens (mindis) for the "double" variants. With 4 we
   *  add one ten per suit, creating duplicates that obey top-card-wins. */
  addTens?: number;
}

/**
 * Build the deck for a round from a DeckSpec. Pure & deterministic ordering;
 * shuffling is done separately so it can be seeded for tests.
 */
export function buildDeck(spec: DeckSpec): Card[] {
  let uid = 0;
  const cards: Card[] = [];

  for (let copy = 0; copy < spec.decks; copy++) {
    for (const suit of SUITS) {
      for (let r = 2 as number; r <= 14; r++) {
        cards.push({ uid: uid++, suit, rank: r as Rank, copy });
      }
    }
  }

  let result = cards;

  if (spec.removeRanks && spec.removeRanks.length) {
    const banned = new Set(spec.removeRanks);
    result = result.filter((c) => !banned.has(c.rank));
  }

  if (spec.removeCards && spec.removeCards.length) {
    for (const rc of spec.removeCards) {
      let toRemove = rc.count ?? Infinity;
      result = result.filter((c) => {
        if (toRemove > 0 && c.rank === rc.rank && c.suit === rc.suit) {
          toRemove--;
          return false;
        }
        return true;
      });
    }
  }

  if (spec.addTens && spec.addTens > 0) {
    // Distribute added tens one per suit, cycling. copy index continues past
    // the physical decks so uids stay unique and these read as duplicates.
    for (let i = 0; i < spec.addTens; i++) {
      const suit = SUITS[i % SUITS.length];
      result.push({ uid: uid++, suit, rank: MINDI_RANK, copy: spec.decks + Math.floor(i / SUITS.length) });
    }
  }

  // Re-assign uids densely so they are 0..n-1 regardless of removals.
  result.forEach((c, i) => (c.uid = i));
  return result;
}

/** Mulberry32 — small seedable PRNG so games/tests are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

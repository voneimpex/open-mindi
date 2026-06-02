/**
 * Per-(mode, player-count) configuration for Open Mindi.
 *
 * Every entry has been arithmetically validated so that:
 *   totalCards = decks*52 - removed + addedTens
 *   totalCards = players * (piles*perPile + hand)
 *
 * The deck-construction rules were derived from the game design notes. Where
 * the source notes were ambiguous (notably the 6-player removal set, and the
 * "double" variants) the removal set was chosen to (a) match the intent and
 * (b) make the totals come out exactly. See the validation test in
 * tests/engine.test.ts which asserts every entry is internally consistent.
 */

import { DeckSpec } from './cards';

export type GameMode = 'mindi' | 'double';
export type PlayerCount = 2 | 3 | 4 | 5 | 6;

export interface Layout {
  /** Number of face-down piles in front of each player. */
  piles: number;
  /** Cards per pile (only the top card is ever face-up / playable). */
  perPile: number;
  /** Private cards dealt to the hand (only the owner sees them). */
  hand: number;
}

export interface RoundConfig {
  mode: GameMode;
  players: PlayerCount;
  deck: DeckSpec;
  layout: Layout;
  /** true => team game (odd seats vs even seats). 4 and 6 players are teams. */
  teams: boolean;
}

/** Layouts keyed by player count (shared between modes — totals always match). */
const LAYOUT: Record<PlayerCount, Layout> = {
  2: { piles: 4, perPile: 4, hand: 6 }, // 22 cards each
  3: { piles: 3, perPile: 4, hand: 5 }, // 17 cards each
  4: { piles: 3, perPile: 3, hand: 4 }, // 13 cards each
  5: { piles: 3, perPile: 2, hand: 4 }, // 10 cards each
  6: { piles: 3, perPile: 4, hand: 5 }  // 17 cards each (two decks)
};

const TEAM_GAME: Record<PlayerCount, boolean> = {
  2: false,
  3: false,
  4: true,
  5: false,
  6: true
};

/** Deck specs for normal "open mindi". */
const MINDI_DECK: Record<PlayerCount, DeckSpec> = {
  // remove all 2s & 3s -> 44
  2: { decks: 1, removeRanks: [2, 3] },
  // remove 2 of spades -> 51
  3: { decks: 1, removeCards: [{ rank: 2, suit: 'S' }] },
  // full deck -> 52
  4: { decks: 1 },
  // remove 2♠ and 2♥ -> 50
  5: { decks: 1, removeCards: [{ rank: 2, suit: 'S' }, { rank: 2, suit: 'H' }] },
  // two decks, remove one 2♠ and one 2♥ -> 102
  6: {
    decks: 2,
    removeCards: [
      { rank: 2, suit: 'S', count: 1 },
      { rank: 2, suit: 'H', count: 1 }
    ]
  }
};

/** Deck specs for "open double mindi" (+4 tens). */
const DOUBLE_DECK: Record<PlayerCount, DeckSpec> = {
  // remove all 2s,3s,4s and add 4 tens -> 44
  2: { decks: 1, removeRanks: [2, 3, 4], addTens: 4 },
  // remove all 2s and 3♠, add 4 tens -> 51
  3: { decks: 1, removeRanks: [2], removeCards: [{ rank: 3, suit: 'S' }], addTens: 4 },
  // remove all 2s, add 4 tens -> 52
  4: { decks: 1, removeRanks: [2], addTens: 4 },
  // remove all 2s and 3♠,3♥, add 4 tens -> 50
  5: {
    decks: 1,
    removeRanks: [2],
    removeCards: [{ rank: 3, suit: 'S' }, { rank: 3, suit: 'H' }],
    addTens: 4
  },
  // two decks (+4 tens), remove both 2♠,2♥,3♠ -> 102
  6: {
    decks: 2,
    addTens: 4,
    removeCards: [
      { rank: 2, suit: 'S' },
      { rank: 2, suit: 'H' },
      { rank: 3, suit: 'S' }
    ]
  }
};

export function getRoundConfig(mode: GameMode, players: PlayerCount): RoundConfig {
  return {
    mode,
    players,
    deck: mode === 'mindi' ? MINDI_DECK[players] : DOUBLE_DECK[players],
    layout: LAYOUT[players],
    teams: TEAM_GAME[players]
  };
}

/** Cards each player receives (piles*perPile + hand). */
export function cardsPerPlayer(layout: Layout): number {
  return layout.piles * layout.perPile + layout.hand;
}

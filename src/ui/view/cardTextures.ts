/** Maps engine cards to the downloaded public-domain card-face image keys. */

import { Card, Rank, Suit } from '../../engine';

const RANK_WORD: Record<Rank, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'jack', 12: 'queen', 13: 'king', 14: 'ace'
};

const SUIT_WORD: Record<Suit, string> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs'
};

/** Texture key used when loading/looking up a card face image. */
export function faceTextureKey(card: Card): string {
  return `cf_${card.suit}${card.rank}`;
}

/** Filename of the card face PNG under public/cards/. */
export function faceFile(suit: Suit, rank: Rank): string {
  return `${RANK_WORD[rank]}_of_${SUIT_WORD[suit]}.png`;
}

/** The downloaded card-back art texture key. */
export const CARD_BACK_ART_KEY = 'card-back-art';

/** All (suit, rank) pairs for a single deck, for preloading. */
export function allFaces(): { suit: Suit; rank: Rank; key: string; file: string }[] {
  const suits: Suit[] = ['S', 'H', 'D', 'C'];
  const out: { suit: Suit; rank: Rank; key: string; file: string }[] = [];
  for (const suit of suits) {
    for (let r = 2; r <= 14; r++) {
      const rank = r as Rank;
      out.push({ suit, rank, key: faceTextureKey({ suit, rank } as Card), file: faceFile(suit, rank) });
    }
  }
  return out;
}

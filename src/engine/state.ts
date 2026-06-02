/** Mutable game state types for an Open Mindi round. */

import { Card, Suit } from './cards';
import { GameMode, Layout, PlayerCount } from './config';

/** A single face-down pile; only the top (last) card is visible/playable. */
export interface Pile {
  /** Bottom -> top. The last element is the visible, playable card. */
  cards: Card[];
}

export interface Player {
  seat: number; // 0-based seat index (seat 0 is the human in the UI)
  name: string;
  isHuman: boolean;
  team: number; // team id (0 or 1); in individual games team === seat
  /** Private hand cards (only owner sees the faces). */
  hand: Card[];
  /** Face-down piles in front of the player. */
  piles: Pile[];
  /** Cards this player has captured by winning tricks (face up, public). */
  captured: Card[];
}

/** One card played into the current trick. */
export interface PlayedCard {
  seat: number;
  card: Card;
  /** Where it came from, for the UI animation and undo-free auditing. */
  source: { type: 'hand' } | { type: 'pile'; pileIndex: number };
  /** Play order within the trick (0 = led). Used for top-card-wins ties. */
  order: number;
}

export interface Trick {
  leadSeat: number;
  ledSuit: Suit | null;
  plays: PlayedCard[];
}

export type Phase = 'dealing' | 'playing' | 'trick-complete' | 'round-over';

export interface GameState {
  mode: GameMode;
  players: PlayerCount;
  teams: boolean;
  layout: Layout;
  trump: Suit;
  dealerSeat: number;
  turnSeat: number;
  phase: Phase;
  playerList: Player[];
  trick: Trick;
  /** Completed tricks this round, in order. */
  history: Trick[];
  /** Tricks won, indexed by seat. */
  tricksWon: number[];
}

/** A move the engine accepts. */
export interface Move {
  seat: number;
  source: { type: 'hand' } | { type: 'pile'; pileIndex: number };
  /** Index into hand, or ignored for pile (top card is implied). */
  handIndex?: number;
  card: Card;
}

/** The set of cards a player can currently choose from: hand + each pile top. */
export interface PlayableCard {
  card: Card;
  source: { type: 'hand'; handIndex: number } | { type: 'pile'; pileIndex: number };
}

export function pileTop(p: Pile): Card | null {
  return p.cards.length ? p.cards[p.cards.length - 1] : null;
}

/** All cards a player may legally *reach* (before follow-suit filtering). */
export function reachableCards(player: Player): PlayableCard[] {
  const out: PlayableCard[] = [];
  player.hand.forEach((card, handIndex) =>
    out.push({ card, source: { type: 'hand', handIndex } })
  );
  player.piles.forEach((pile, pileIndex) => {
    const top = pileTop(pile);
    if (top) out.push({ card: top, source: { type: 'pile', pileIndex } });
  });
  return out;
}

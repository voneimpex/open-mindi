/**
 * Public-information analysis used by the Expert bot: card counting, void
 * inference and "is this card a guaranteed winner" reasoning. Everything here
 * is derived ONLY from information any seat could legitimately observe
 * (trick history, the current trick, and visible pile tops), plus the known
 * deck composition for the round.
 */

import {
  buildDeck,
  Card,
  GameState,
  RoundConfig,
  Suit,
  SUITS,
  reachableCards
} from '../engine';

const faceKey = (suit: Suit, rank: number) => `${suit}${rank}`;

export class RoundKnowledge {
  /** count of each face present in the round's deck (handles 2-deck dupes). */
  readonly deckCounts: Map<string, number>;

  constructor(config: RoundConfig) {
    this.deckCounts = new Map();
    for (const c of buildDeck(config.deck)) {
      const k = faceKey(c.suit, c.rank);
      this.deckCounts.set(k, (this.deckCounts.get(k) ?? 0) + 1);
    }
  }

  /** All cards that have been played and are now face-up in won piles. */
  gone(state: GameState): Card[] {
    const out: Card[] = [];
    for (const t of state.history) for (const p of t.plays) out.push(p.card);
    for (const p of state.trick.plays) out.push(p.card);
    return out;
  }

  /** Suits each seat is known to be void in (failed to follow a led suit). */
  voids(state: GameState): Record<number, Set<Suit>> {
    const v: Record<number, Set<Suit>> = {};
    for (let s = 0; s < state.players; s++) v[s] = new Set();
    const scan = (led: Suit | null, plays: { seat: number; card: Card }[]) => {
      if (led == null) return;
      for (const pl of plays) {
        if (pl.card.suit !== led) v[pl.seat].add(led);
      }
    };
    for (const t of state.history) scan(t.ledSuit, t.plays);
    scan(state.trick.ledSuit, state.trick.plays);
    return v;
  }

  /**
   * How many cards strictly higher than `rank` in `suit` could still be held
   * by an opponent (i.e. not gone and not in my own reachable cards). Visible
   * opponent pile tops are counted as threats since they can still be played.
   */
  outstandingHigher(
    state: GameState,
    seat: number,
    suit: Suit,
    rank: number
  ): number {
    const mine = new Set(reachableCards(state.playerList[seat]).map((p) => p.card.uid));
    const goneFaces = new Map<string, number>();
    for (const c of this.gone(state)) {
      const k = faceKey(c.suit, c.rank);
      goneFaces.set(k, (goneFaces.get(k) ?? 0) + 1);
    }
    const myFaces = new Map<string, number>();
    for (const p of reachableCards(state.playerList[seat])) {
      if (mine.has(p.card.uid)) {
        const k = faceKey(p.card.suit, p.card.rank);
        myFaces.set(k, (myFaces.get(k) ?? 0) + 1);
      }
    }
    let count = 0;
    for (let r = rank + 1; r <= 14; r++) {
      const k = faceKey(suit, r);
      const total = this.deckCounts.get(k) ?? 0;
      const accounted = (goneFaces.get(k) ?? 0) + (myFaces.get(k) ?? 0);
      count += Math.max(0, total - accounted);
    }
    return count;
  }

  /** Trumps an opponent could still hold (not gone, not mine). */
  trumpsOutstanding(state: GameState, seat: number): number {
    return this.outstandingHigher(state, seat, state.trump, 1);
  }

  /** Mindis (tens) not yet captured/seen and not in my reachable cards. */
  mindisOutstanding(state: GameState, seat: number): number {
    let n = 0;
    for (const s of SUITS) n += this.outstandingHigher(state, seat, s, 9) - this.outstandingHigher(state, seat, s, 10);
    return n;
  }

  /**
   * Would leading `card` be a guaranteed trick winner? True when no higher
   * in-suit card is outstanding AND either the card is a trump, or no trumps
   * are outstanding (so it cannot be ruffed).
   */
  isBossLead(state: GameState, seat: number, card: Card): boolean {
    const higher = this.outstandingHigher(state, seat, card.suit, card.rank);
    if (higher > 0) return false;
    if (card.suit === state.trump) return true;
    return this.trumpsOutstanding(state, seat) === 0;
  }
}

/**
 * Expert bot.
 *
 * Tracks everything a skilled player would: which cards have already been
 * played (card counting), which opponents are void in which suits, how many
 * trumps and mindis are still outstanding, and whether a card is a guaranteed
 * winner. Uses this to win mindi tricks safely, avoid wasting high cards, feed
 * partners points, and pull trumps when leading.
 */

import { Card, GameState, isMindi, Move, RoundConfig } from '../engine';
import { RoundKnowledge } from './analysis';
import {
  Bot,
  currentWinning,
  Difficulty,
  highest,
  isTeammate,
  legal,
  lowest,
  mindis,
  nonMindi,
  PlayableCard,
  teammateWinning,
  toMove,
  trickHasMindi,
  winningMoves
} from './common';

export class ExpertBot implements Bot {
  readonly difficulty: Difficulty = 'expert';
  private k: RoundKnowledge;

  constructor(config: RoundConfig) {
    this.k = new RoundKnowledge(config);
  }

  chooseMove(state: GameState, seat: number): Move {
    const moves = legal(state, seat);
    if (moves.length === 1) return toMove(seat, moves[0]);
    const leading = state.trick.plays.length === 0;
    const pick = leading ? this.lead(state, seat, moves) : this.follow(state, seat, moves);
    return toMove(seat, pick);
  }

  // ---- Leading -----------------------------------------------------------

  private lead(state: GameState, seat: number, moves: PlayableCard[]): PlayableCard {
    const trumpsOut = this.k.trumpsOutstanding(state, seat);

    // 1. Cash a guaranteed non-trump winner (likely draws a mindi from others).
    const bossSide = moves.filter(
      (m) => m.card.suit !== state.trump && !isMindi(m.card) && this.k.isBossLead(state, seat, m.card)
    );
    if (bossSide.length) return highest(bossSide);

    // 2. If opponents still hold trumps and I have plenty, pull trumps by
    //    leading my highest guaranteed trump.
    const bossTrump = moves.filter(
      (m) => m.card.suit === state.trump && this.k.isBossLead(state, seat, m.card)
    );
    const myTrumps = moves.filter((m) => m.card.suit === state.trump);
    if (trumpsOut > 0 && bossTrump.length && myTrumps.length >= 2 && !isMindi(bossTrump[0].card)) {
      return highest(bossTrump.filter((m) => !isMindi(m.card)));
    }

    // 3. Otherwise lead low to lose the lead cheaply; never lead a mindi while
    //    anything else is available. Prefer shedding from a short side suit.
    const nm = nonMindi(moves).filter((m) => m.card.suit !== state.trump);
    if (nm.length) return this.shortestSuitLow(state, seat, nm);
    const anyNonMindi = nonMindi(moves);
    if (anyNonMindi.length) return lowest(anyNonMindi);
    return lowest(moves);
  }

  private shortestSuitLow(state: GameState, seat: number, cands: PlayableCard[]): PlayableCard {
    // Lead the lowest card of the suit I hold fewest of (to create voids/ruffs).
    const counts = new Map<string, number>();
    for (const m of legal(state, seat)) counts.set(m.card.suit, (counts.get(m.card.suit) ?? 0) + 1);
    return cands.slice().sort((a, b) => {
      const ca = counts.get(a.card.suit)!;
      const cb = counts.get(b.card.suit)!;
      if (ca !== cb) return ca - cb;
      return a.card.rank - b.card.rank;
    })[0];
  }

  // ---- Following ---------------------------------------------------------

  private follow(state: GameState, seat: number, moves: PlayableCard[]): PlayableCard {
    const wins = winningMoves(state, moves);
    const hasMindi = trickHasMindi(state);
    const isLast = state.trick.plays.length === state.players - 1;

    if (teammateWinning(state, seat)) {
      const safe = this.partnerWinIsSafe(state, seat);
      if (safe) {
        // Partner has it locked — give them a mindi if we can.
        const m = mindis(moves);
        if (m.length) return highest(m);
      }
      const nm = nonMindi(moves);
      return nm.length ? lowest(nm) : lowest(moves);
    }

    // Opponent is winning (or no winner yet & it's an opponent's trick to take).
    if (wins.length) {
      if (hasMindi) {
        // Points on the table: take them as cheaply as possible. If winning
        // needs a trump and a later opponent could over-trump, only commit when
        // it's the safest available winner.
        return this.cheapestSafeWinner(state, seat, wins, isLast);
      }
      // No points yet. Win cheaply only with a guaranteed non-trump boss, or if
      // we're last and a cheap non-trump win sets up our lead.
      const cheapBoss = wins.filter(
        (m) => m.card.suit !== state.trump && this.k.isBossLead(state, seat, m.card)
      );
      if (cheapBoss.length) return lowest(cheapBoss);
      if (isLast) {
        const cheap = wins.filter((m) => m.card.suit !== state.trump);
        if (cheap.length) return lowest(cheap);
      }
      // Not worth spending a trump on an empty trick — discard instead.
    }

    // Can't or won't win: discard lowest non-mindi; protect mindis to the end.
    const nm = nonMindi(moves);
    return nm.length ? lowest(nm) : lowest(moves);
  }

  /** Among winning moves, the cheapest that a remaining opponent can't beat;
   *  falls back to the globally cheapest winner. */
  private cheapestSafeWinner(
    state: GameState,
    seat: number,
    wins: PlayableCard[],
    isLast: boolean
  ): PlayableCard {
    const sorted = wins.slice().sort((a, b) => a.card.rank - b.card.rank);
    if (isLast) return sorted[0]; // nobody left to overtake us
    for (const w of sorted) {
      if (this.winIsSafe(state, seat, w.card)) return w;
    }
    return sorted[sorted.length - 1]; // can't be safe — use strongest to try
  }

  /** Could any opponent who has yet to play beat `card` if it leads now? */
  private winIsSafe(state: GameState, seat: number, card: Card): boolean {
    const led = state.trick.ledSuit ?? card.suit;
    const oppAfter = this.opponentsAfter(state, seat);
    if (oppAfter.length === 0) return true;
    const voids = this.k.voids(state);
    const trumpsOut = this.k.trumpsOutstanding(state, seat);

    if (card.suit === state.trump) {
      // Winning with a trump: only a higher trump can beat it.
      return this.k.outstandingHigher(state, seat, state.trump, card.rank) === 0;
    }

    // Winning with a led-suit card: beaten by a higher led-suit card, or by a
    // ruff from a later opponent KNOWN to be void in the led suit (unknown
    // opponents are assumed to follow suit).
    if (this.k.outstandingHigher(state, seat, led, card.rank) > 0) return false;
    if (trumpsOut > 0) {
      for (const opp of oppAfter) if (voids[opp].has(led)) return false;
    }
    return true;
  }

  private partnerWinIsSafe(state: GameState, _seat: number): boolean {
    const best = currentWinning(state.trick.plays, state.trump, state.trick.ledSuit ?? state.trump);
    if (!best) return false;
    return this.winIsSafe(state, best.seat, best.card);
  }

  private opponentsAfter(state: GameState, seat: number): number[] {
    const out: number[] = [];
    const played = state.trick.plays.length;
    for (let i = played + 1; i < state.players; i++) {
      const s = (state.trick.leadSeat + i) % state.players;
      if (!isTeammate(state, seat, s) && s !== seat) out.push(s);
    }
    return out;
  }
}

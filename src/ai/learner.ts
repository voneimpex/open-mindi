/**
 * Learner bot.
 *
 * Reasons only about what it can directly see right now: its own cards, the
 * visible top card of every player's piles, and the cards on the table in the
 * current trick. It does NOT remember which cards have already been played,
 * does NOT infer who is void in a suit, and does NOT count probabilities.
 */

import { GameState, Move } from '../engine';
import {
  Bot,
  Difficulty,
  highest,
  legal,
  lowest,
  mindis,
  nonMindi,
  teammateWinning,
  toMove,
  trickHasMindi,
  winningMoves
} from './common';

export class LearnerBot implements Bot {
  readonly difficulty: Difficulty = 'learner';

  chooseMove(state: GameState, seat: number): Move {
    const moves = legal(state, seat);
    const leading = state.trick.plays.length === 0;

    if (leading) return toMove(seat, this.lead(moves));
    return toMove(seat, this.follow(state, seat, moves));
  }

  private lead(moves: ReturnType<typeof legal>) {
    // Prefer to lead a strong, non-trump, non-mindi card to try to win the
    // trick; keep mindis and trumps in reserve. Fall back to lowest.
    const safe = nonMindi(moves).filter((m) => m.card.suit !== this.trumpHint);
    if (safe.length) return highest(safe);
    const nm = nonMindi(moves);
    if (nm.length) return lowest(nm);
    return lowest(moves);
  }

  // Learner doesn't track trump cleverly; we set it per call from state.
  private trumpHint: string = '';

  private follow(state: GameState, seat: number, moves: ReturnType<typeof legal>) {
    this.trumpHint = state.trump;
    const wins = winningMoves(state, moves);
    const partnerWinning = teammateWinning(state, seat);

    if (partnerWinning) {
      // Help the partner: feed them a mindi if we have one to spare, else duck.
      const myMindis = mindis(moves);
      if (myMindis.length) return lowest(myMindis);
      const nm = nonMindi(moves);
      return nm.length ? lowest(nm) : lowest(moves);
    }

    const hasMindi = trickHasMindi(state);

    if (wins.length && hasMindi) {
      // There are points on the table — grab them with the cheapest winner.
      return lowest(wins);
    }

    if (wins.length) {
      // No points yet: only bother winning if it's cheap (a non-trump win).
      const cheap = wins.filter((m) => m.card.suit !== state.trump);
      if (cheap.length) return lowest(cheap);
    }

    // Can't / won't win: shed the lowest non-mindi; never volunteer a mindi.
    const nm = nonMindi(moves);
    return nm.length ? lowest(nm) : lowest(moves);
  }
}

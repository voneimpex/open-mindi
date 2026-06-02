/** Shared bot helpers and the Bot interface. */

import {
  Card,
  GameState,
  isMindi,
  Move,
  PlayableCard,
  Suit,
  currentWinning,
  legalMoves,
  wouldTakeLead
} from '../engine';

export type Difficulty = 'learner' | 'expert';

export interface Bot {
  readonly difficulty: Difficulty;
  chooseMove(state: GameState, seat: number): Move;
}

export function toMove(seat: number, p: PlayableCard): Move {
  if (p.source.type === 'hand') {
    return { seat, source: { type: 'hand' }, handIndex: p.source.handIndex, card: p.card };
  }
  return { seat, source: { type: 'pile', pileIndex: p.source.pileIndex }, card: p.card };
}

export function isTeammate(state: GameState, a: number, b: number): boolean {
  if (a === b) return false;
  return state.teams && state.playerList[a].team === state.playerList[b].team;
}

/** Sort ascending by trick-winning rank (2 low ... A high). */
export function byRankAsc(a: PlayableCard, b: PlayableCard): number {
  return a.card.rank - b.card.rank;
}

export function lowest(cards: PlayableCard[]): PlayableCard {
  return cards.slice().sort(byRankAsc)[0];
}

export function highest(cards: PlayableCard[]): PlayableCard {
  return cards.slice().sort(byRankAsc)[cards.length - 1];
}

export function nonMindi(cards: PlayableCard[]): PlayableCard[] {
  return cards.filter((c) => !isMindi(c.card));
}

export function mindis(cards: PlayableCard[]): PlayableCard[] {
  return cards.filter((c) => isMindi(c.card));
}

/** Moves that would currently take the lead of the trick. */
export function winningMoves(state: GameState, moves: PlayableCard[]): PlayableCard[] {
  const { plays, ledSuit } = state.trick;
  return moves.filter((m) => wouldTakeLead(m.card, plays, state.trump, ledSuit));
}

export function trickHasMindi(state: GameState): boolean {
  return state.trick.plays.some((p) => isMindi(p.card));
}

export function mindisInTrick(state: GameState): number {
  return state.trick.plays.filter((p) => isMindi(p.card)).length;
}

/** Is one of my teammates currently winning the (partial) trick? */
export function teammateWinning(state: GameState, seat: number): boolean {
  const best = currentWinning(state.trick.plays, state.trump, state.trick.ledSuit ?? state.trump);
  if (!best) return false;
  return isTeammate(state, seat, best.seat);
}

export function legal(state: GameState, seat: number): PlayableCard[] {
  return legalMoves(state, seat);
}

/** Count how many opponents are still to play AFTER this seat in the trick. */
export function opponentsStillToPlay(state: GameState, _seat: number): number {
  const played = state.trick.plays.length;
  const remaining = state.players - played - 1; // seats after me this trick
  // In team games some of those may be teammates, but a simple count is enough
  // for the learner; the expert refines this.
  return Math.max(0, remaining);
}

export { isMindi, currentWinning };
export type { Card, GameState, Move, PlayableCard, Suit };

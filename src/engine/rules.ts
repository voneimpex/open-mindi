/** Core rules: legal moves, trick resolution, scoring. */

import { Card, isMindi, sameFace, Suit } from './cards';
import {
  GameState,
  PlayableCard,
  Player,
  PlayedCard,
  reachableCards
} from './state';

/**
 * Legal moves for a player given the current trick.
 * Rule: you MUST follow the led suit if you can reach any card of it
 * (across hand + visible pile tops). Otherwise you may play anything,
 * including a trump.
 */
export function legalMoves(state: GameState, seat: number): PlayableCard[] {
  const player = state.playerList[seat];
  const reachable = reachableCards(player);
  const led = state.trick.ledSuit;
  if (led == null) return reachable; // leader may play anything
  const followers = reachable.filter((p) => p.card.suit === led);
  return followers.length ? followers : reachable;
}

export function canFollow(player: Player, led: Suit): boolean {
  return reachableCards(player).some((p) => p.card.suit === led);
}

/**
 * Compare two plays to decide which beats which, given the trump suit and the
 * led suit. Returns the winner of the pair.
 *
 * Order of precedence:
 *  1. A trump beats any non-trump.
 *  2. Among trumps, higher rank wins; on equal rank the later-played wins
 *     (top-card-wins rule for duplicate cards in two-deck games).
 *  3. A card following the led suit beats an off-suit non-trump.
 *  4. Among led-suit cards, higher rank wins; equal rank -> later-played.
 *  5. Off-suit non-trumps can never win.
 */
function beats(a: PlayedCard, b: PlayedCard, trump: Suit, led: Suit): boolean {
  // returns true if `a` beats `b`
  const aTrump = a.card.suit === trump;
  const bTrump = b.card.suit === trump;
  if (aTrump !== bTrump) return aTrump;
  if (aTrump && bTrump) return rankBeats(a, b);

  const aLed = a.card.suit === led;
  const bLed = b.card.suit === led;
  if (aLed !== bLed) return aLed;
  if (aLed && bLed) return rankBeats(a, b);

  return false; // both off-suit non-trump: leader-relative, neither "wins"
}

function rankBeats(a: PlayedCard, b: PlayedCard): boolean {
  if (a.card.rank !== b.card.rank) return a.card.rank > b.card.rank;
  // Equal rank (duplicate face): the card played later (higher order) wins.
  return a.order > b.order;
}

/** Determine the winning seat of a completed trick. */
export function trickWinner(plays: PlayedCard[], trump: Suit, led: Suit): number {
  let best = plays[0];
  for (let i = 1; i < plays.length; i++) {
    if (beats(plays[i], best, trump, led)) best = plays[i];
  }
  return best.seat;
}

/** The play currently winning a (possibly partial) trick, or null if empty. */
export function currentWinning(plays: PlayedCard[], trump: Suit, led: Suit): PlayedCard | null {
  if (!plays.length) return null;
  let best = plays[0];
  for (let i = 1; i < plays.length; i++) {
    if (beats(plays[i], best, trump, led)) best = plays[i];
  }
  return best;
}

/**
 * Would playing `card` (as the next card, i.e. at order = plays.length) take
 * the lead of the current trick? Assumes `led` is the trick's led suit; if the
 * trick is empty the player is leading and trivially "wins" so far.
 */
export function wouldTakeLead(
  card: Card,
  plays: PlayedCard[],
  trump: Suit,
  led: Suit | null
): boolean {
  if (!plays.length || led == null) return true;
  const candidate: PlayedCard = {
    seat: -1,
    card,
    source: { type: 'hand' },
    order: plays.length
  };
  const best = currentWinning(plays, trump, led)!;
  return beats(candidate, best, trump, led);
}

export function countMindis(cards: Card[]): number {
  return cards.filter(isMindi).length;
}

export interface SeatScore {
  seat: number;
  mindis: number;
  tricks: number;
}

/** A scoring side: a team (in team games) or a single seat (individual games). */
export interface SideScore {
  /** team id in team games, otherwise the seat index. */
  id: number;
  seats: number[];
  mindis: number;
  tricks: number;
  /** +1 if this side has (or ties for) the most tricks this round. */
  trickBonus: number;
  /** mindis + trickBonus. */
  points: number;
}

export interface RoundResult {
  perSeat: SeatScore[];
  /** Scoring sides (teams or individuals) with points breakdown. */
  sides: SideScore[];
  /** Total mindis in play this round (for "got all the tens" detection). */
  totalMindis: number;
  /** Highest trick count among sides this round. */
  maxTricks: number;
  /** Winning side id(s) — those with the most points. Ties share. */
  winners: number[];
  /** "whitewash": a single side captured every mindi in the round. */
  whitewash: boolean;
  /** true when sides are teams, false when sides are individual seats. */
  byTeam: boolean;
}

/**
 * Score a finished round.
 *
 * Points per side:
 *   - +1 for every mindi (ten) captured, and
 *   - +1 for having the most tricks ("hands"); if several sides tie for the
 *     most tricks they each get the bonus point.
 * The side(s) with the most total points win the round; ties share the prize.
 */
export function scoreRound(state: GameState): RoundResult {
  const perSeat: SeatScore[] = state.playerList.map((p) => ({
    seat: p.seat,
    mindis: countMindis(p.captured),
    tricks: state.tricksWon[p.seat]
  }));

  const totalMindis = perSeat.reduce((s, x) => s + x.mindis, 0);
  const byTeam = state.teams;

  // Aggregate seats into sides (individual games: each seat is its own side).
  const sideMap = new Map<number, SideScore>();
  for (const p of state.playerList) {
    const id = byTeam ? p.team : p.seat;
    const side = sideMap.get(id) ?? { id, seats: [], mindis: 0, tricks: 0, trickBonus: 0, points: 0 };
    side.seats.push(p.seat);
    side.mindis += perSeat[p.seat].mindis;
    side.tricks += perSeat[p.seat].tricks;
    sideMap.set(id, side);
  }
  const sides = [...sideMap.values()].sort((a, b) => a.id - b.id);

  // Trick bonus: every side tied for the most tricks gets +1 point.
  const maxTricks = Math.max(...sides.map((s) => s.tricks));
  for (const s of sides) {
    s.trickBonus = s.tricks === maxTricks ? 1 : 0;
    s.points = s.mindis + s.trickBonus;
  }

  const maxPoints = Math.max(...sides.map((s) => s.points));
  const winners = sides.filter((s) => s.points === maxPoints).map((s) => s.id);

  const maxMindis = Math.max(...sides.map((s) => s.mindis));
  const whitewash =
    maxMindis === totalMindis &&
    sides.filter((s) => s.mindis === maxMindis).length === 1 &&
    totalMindis > 0;

  return { perSeat, sides, totalMindis, maxTricks, winners, whitewash, byTeam };
}

/** Helper to test two cards being "the same card" for tie reporting. */
export { sameFace };

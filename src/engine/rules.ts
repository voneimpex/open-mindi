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

export interface TeamScore {
  team: number;
  seats: number[];
  mindis: number;
  tricks: number;
}

export interface RoundResult {
  perSeat: SeatScore[];
  perTeam: TeamScore[];
  /** Total mindis in play this round (for "got all the tens" detection). */
  totalMindis: number;
  /** Winning team id(s) or seat(s) — those with the most mindis. Ties share. */
  winners: number[];
  /** "whitewash": a single side captured every mindi in the round. */
  whitewash: boolean;
  /** true when winners are teams, false when winners are individual seats. */
  byTeam: boolean;
}

/**
 * Score a finished round.
 *
 * Primary objective per the design notes: capture as many mindis (tens) as
 * possible. The side with the most captured mindis wins the point; ties share.
 * Tricks won are tracked and reported as a tie-breaker / secondary stat.
 */
export function scoreRound(state: GameState): RoundResult {
  const perSeat: SeatScore[] = state.playerList.map((p) => ({
    seat: p.seat,
    mindis: countMindis(p.captured),
    tricks: state.tricksWon[p.seat]
  }));

  const totalMindis = perSeat.reduce((s, x) => s + x.mindis, 0);

  // Aggregate to teams (individual games: each seat is its own team).
  const teamMap = new Map<number, TeamScore>();
  for (const p of state.playerList) {
    const t = teamMap.get(p.team) ?? { team: p.team, seats: [], mindis: 0, tricks: 0 };
    t.seats.push(p.seat);
    t.mindis += perSeat[p.seat].mindis;
    t.tricks += perSeat[p.seat].tricks;
    teamMap.set(p.team, t);
  }
  const perTeam = [...teamMap.values()].sort((a, b) => a.team - b.team);

  const byTeam = state.teams;
  const groups = byTeam
    ? perTeam.map((t) => ({ id: t.team, mindis: t.mindis, tricks: t.tricks }))
    : perSeat.map((s) => ({ id: s.seat, mindis: s.mindis, tricks: s.tricks }));

  const maxMindis = Math.max(...groups.map((g) => g.mindis));
  // Tie-break by tricks when mindis are equal at the top.
  const topByMindi = groups.filter((g) => g.mindis === maxMindis);
  const maxTricks = Math.max(...topByMindi.map((g) => g.tricks));
  const winners = topByMindi.filter((g) => g.tricks === maxTricks).map((g) => g.id);

  const whitewash = maxMindis === totalMindis && winners.length === 1 && totalMindis > 0;

  return { perSeat, perTeam, totalMindis, winners, whitewash, byTeam };
}

/** Helper to test two cards being "the same card" for tie reporting. */
export { sameFace };

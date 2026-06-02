import { describe, it, expect } from 'vitest';
import {
  buildDeck,
  cardsPerPlayer,
  getRoundConfig,
  GameEngine,
  GameMode,
  PlayerCount,
  trickWinner,
  scoreRound,
  isMindi
} from '../src/engine';
import { createBot } from '../src/ai';

const MODES: GameMode[] = ['mindi', 'double'];
const COUNTS: PlayerCount[] = [2, 3, 4, 5, 6];

describe('deck composition is internally consistent', () => {
  for (const mode of MODES) {
    for (const players of COUNTS) {
      it(`${mode} ${players}p: deck size matches dealt cards`, () => {
        const cfg = getRoundConfig(mode, players);
        const deck = buildDeck(cfg.deck);
        const expected = players * cardsPerPlayer(cfg.layout);
        expect(deck.length).toBe(expected);
        // uids are dense and unique
        const uids = new Set(deck.map((c) => c.uid));
        expect(uids.size).toBe(deck.length);
      });
    }
  }

  it('known totals', () => {
    const total = (m: GameMode, p: PlayerCount) => buildDeck(getRoundConfig(m, p).deck).length;
    expect(total('mindi', 2)).toBe(44);
    expect(total('mindi', 3)).toBe(51);
    expect(total('mindi', 4)).toBe(52);
    expect(total('mindi', 5)).toBe(50);
    expect(total('mindi', 6)).toBe(102);
    expect(total('double', 2)).toBe(44);
    expect(total('double', 3)).toBe(51);
    expect(total('double', 4)).toBe(52);
    expect(total('double', 5)).toBe(50);
    expect(total('double', 6)).toBe(102);
  });

  it('double mindi adds tens (more mindis than normal)', () => {
    const mindiTens = buildDeck(getRoundConfig('mindi', 4).deck).filter(isMindi).length;
    const doubleTens = buildDeck(getRoundConfig('double', 4).deck).filter(isMindi).length;
    expect(doubleTens).toBe(mindiTens + 4);
  });
});

describe('dealing', () => {
  for (const mode of MODES) {
    for (const players of COUNTS) {
      it(`${mode} ${players}p deals every card exactly once`, () => {
        const g = new GameEngine({ mode, players, seed: 42 });
        const seen = new Set<number>();
        let count = 0;
        for (const p of g.state.playerList) {
          for (const c of p.hand) (seen.add(c.uid), count++);
          for (const pile of p.piles) for (const c of pile.cards) (seen.add(c.uid), count++);
        }
        const cfg = getRoundConfig(mode, players);
        expect(count).toBe(players * cardsPerPlayer(cfg.layout));
        expect(seen.size).toBe(count);
      });
    }
  }

  it('teams: 4 and 6 players split odd/even seats', () => {
    const g4 = new GameEngine({ mode: 'mindi', players: 4, seed: 1 });
    expect(g4.state.teams).toBe(true);
    expect(g4.state.playerList.map((p) => p.team)).toEqual([0, 1, 0, 1]);
    const g3 = new GameEngine({ mode: 'mindi', players: 3, seed: 1 });
    expect(g3.state.teams).toBe(false);
  });

  it('turn starts to the left of the dealer', () => {
    const g = new GameEngine({ mode: 'mindi', players: 4, seed: 1, dealerSeat: 2 });
    expect(g.state.turnSeat).toBe(3);
  });
});

describe('trick resolution', () => {
  const mk = (suit: any, rank: any, seat: number, order: number) => ({
    seat,
    card: { uid: order, suit, rank, copy: 0 },
    source: { type: 'hand' as const },
    order
  });

  it('highest of led suit wins when no trump played', () => {
    const plays = [mk('H', 9, 0, 0), mk('H', 12, 1, 1), mk('H', 5, 2, 2), mk('C', 14, 3, 3)];
    expect(trickWinner(plays, 'S', 'H')).toBe(1); // Q hearts; A clubs is off-suit
  });

  it('trump beats higher led-suit card', () => {
    const plays = [mk('H', 14, 0, 0), mk('S', 2, 1, 1)];
    expect(trickWinner(plays, 'S', 'H')).toBe(1); // 2 of trump beats A hearts
  });

  it('higher trump beats lower trump', () => {
    const plays = [mk('S', 5, 0, 0), mk('S', 11, 1, 1)];
    expect(trickWinner(plays, 'S', 'S')).toBe(1);
  });

  it('duplicate face: later (top) card wins', () => {
    const plays = [mk('H', 10, 0, 0), mk('H', 10, 1, 1)];
    expect(trickWinner(plays, 'S', 'H')).toBe(1);
  });
});

describe('full games run to completion vs bots', () => {
  for (const mode of MODES) {
    for (const players of COUNTS) {
      for (const diff of ['learner', 'expert'] as const) {
        it(`${mode} ${players}p all-${diff} bots finish a legal round`, () => {
          const cfg = getRoundConfig(mode, players);
          const g = new GameEngine({ mode, players, seed: 7 });
          const bots = g.state.playerList.map(() => createBot(diff, cfg));
          let guard = 0;
          while (g.state.phase === 'playing') {
            const seat = g.state.turnSeat;
            const move = bots[seat].chooseMove(g.state, seat);
            g.play(move);
            if (++guard > 5000) throw new Error('did not terminate');
          }
          // every card was captured into some trick
          const cardsPerRound = players * cardsPerPlayer(cfg.layout);
          const captured = g.state.playerList.reduce((s, p) => s + p.captured.length, 0);
          expect(captured).toBe(cardsPerRound);
          const result = scoreRound(g.state);
          expect(result.winners.length).toBeGreaterThan(0);
          // points == mindis + trick bonus; bonus only for the most-tricks side(s)
          for (const side of result.sides) {
            expect(side.points).toBe(side.mindis + side.trickBonus);
            expect(side.trickBonus).toBe(side.tricks === result.maxTricks ? 1 : 0);
          }
          // winners hold the max points
          const maxPts = Math.max(...result.sides.map((s) => s.points));
          for (const wid of result.winners) {
            expect(result.sides.find((s) => s.id === wid)!.points).toBe(maxPts);
          }
          // total tricks == cards / players
          const totalTricks = g.state.tricksWon.reduce((a, b) => a + b, 0);
          expect(totalTricks).toBe(cardsPerRound / players);
        });
      }
    }
  }
});

describe('follow-suit is enforced', () => {
  it('a player holding the led suit must play it', () => {
    const g = new GameEngine({ mode: 'mindi', players: 4, seed: 3 });
    const leader = g.state.turnSeat;
    const lead = g.legalMoves(leader)[0];
    g.play({ seat: leader, source: lead.source as any, card: lead.card, handIndex: (lead.source as any).handIndex });
    const next = g.state.turnSeat;
    const led = g.state.trick.ledSuit!;
    const moves = g.legalMoves(next);
    const canFollow = moves.some((m) => m.card.suit === led);
    if (canFollow) expect(moves.every((m) => m.card.suit === led)).toBe(true);
  });
});

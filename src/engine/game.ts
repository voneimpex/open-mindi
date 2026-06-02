/** GameEngine: deals a round and drives trick-by-trick play. */

import {
  buildDeck,
  Card,
  mulberry32,
  shuffle,
  SUITS,
  Suit
} from './cards';
import { cardsPerPlayer, GameMode, getRoundConfig, PlayerCount, RoundConfig } from './config';
import { legalMoves, scoreRound, RoundResult, trickWinner } from './rules';
import {
  GameState,
  Move,
  PlayableCard,
  Player,
  PlayedCard,
  pileTop
} from './state';

export interface NewGameOptions {
  mode: GameMode;
  players: PlayerCount;
  /** Seat index that deals (turn order starts at dealer+1). Default 0. */
  dealerSeat?: number;
  /** RNG seed for reproducible deals/trump. Omit for random. */
  seed?: number;
  /** Display names; index = seat. */
  names?: string[];
  /** Fix the trump suit (else random). */
  trump?: Suit;
}

export class GameEngine {
  state: GameState;
  config: RoundConfig;
  private rng: () => number;

  constructor(opts: NewGameOptions) {
    this.config = getRoundConfig(opts.mode, opts.players);
    const seed = opts.seed ?? (Math.random() * 2 ** 31) >>> 0;
    this.rng = mulberry32(seed);
    this.state = this.deal(opts);
  }

  private deal(opts: NewGameOptions): GameState {
    const { players, layout, teams } = this.config;
    const dealerSeat = opts.dealerSeat ?? 0;

    const deck = buildDeck(this.config.deck);
    const expected = players * cardsPerPlayer(layout);
    if (deck.length !== expected) {
      throw new Error(
        `Deck size ${deck.length} != expected ${expected} for ${opts.mode} ${players}p`
      );
    }

    const shuffled = shuffle(deck, this.rng);

    const playerList: Player[] = [];
    for (let seat = 0; seat < players; seat++) {
      playerList.push({
        seat,
        name: opts.names?.[seat] ?? (seat === 0 ? 'You' : `Bot ${seat}`),
        isHuman: seat === 0,
        team: teams ? seat % 2 : seat,
        hand: [],
        piles: Array.from({ length: layout.piles }, () => ({ cards: [] as Card[] })),
        captured: []
      });
    }

    // Deal piles first (face down, top card face up), then private hands.
    let idx = 0;
    for (let p = 0; p < layout.piles; p++) {
      for (let c = 0; c < layout.perPile; c++) {
        for (let seat = 0; seat < players; seat++) {
          playerList[seat].piles[p].cards.push(shuffled[idx++]);
        }
      }
    }
    for (let h = 0; h < layout.hand; h++) {
      for (let seat = 0; seat < players; seat++) {
        playerList[seat].hand.push(shuffled[idx++]);
      }
    }

    const trump = opts.trump ?? SUITS[Math.floor(this.rng() * SUITS.length)];
    const turnSeat = (dealerSeat + 1) % players;

    return {
      mode: this.config.mode,
      players,
      teams,
      layout,
      trump,
      dealerSeat,
      turnSeat,
      phase: 'playing',
      playerList,
      trick: { leadSeat: turnSeat, ledSuit: null, plays: [] },
      history: [],
      tricksWon: Array(players).fill(0)
    };
  }

  /** Legal moves for the seat whose turn it currently is. */
  legalMoves(seat = this.state.turnSeat): PlayableCard[] {
    return legalMoves(this.state, seat);
  }

  isHumansTurn(): boolean {
    return this.state.playerList[this.state.turnSeat].isHuman;
  }

  /**
   * Apply a move. Validates legality. Returns info about what happened,
   * including a revealed pile card (when a pile top was played) and, if the
   * trick completed, the winner and resolved trick.
   */
  play(move: Move): {
    revealed: Card | null;
    trickComplete: boolean;
    trickWinnerSeat?: number;
    roundOver: boolean;
  } {
    const s = this.state;
    if (s.phase !== 'playing') throw new Error(`Cannot play in phase ${s.phase}`);
    if (move.seat !== s.turnSeat) throw new Error(`Not seat ${move.seat}'s turn`);

    const legal = this.legalMoves(move.seat);
    const ok = legal.some(
      (l) =>
        l.card.uid === move.card.uid &&
        l.source.type === move.source.type &&
        (l.source.type !== 'pile' ||
          (move.source.type === 'pile' && l.source.pileIndex === move.source.pileIndex))
    );
    if (!ok) throw new Error(`Illegal move: ${move.card.suit}${move.card.rank}`);

    const player = s.playerList[move.seat];
    let revealed: Card | null = null;

    if (move.source.type === 'hand') {
      const hi = player.hand.findIndex((c) => c.uid === move.card.uid);
      player.hand.splice(hi, 1);
    } else {
      const pile = player.piles[move.source.pileIndex];
      pile.cards.pop(); // remove top
      revealed = pileTop(pile); // newly visible card (or null if pile empty)
    }

    const order = s.trick.plays.length;
    const played: PlayedCard = { seat: move.seat, card: move.card, source: move.source, order };
    if (s.trick.ledSuit == null) s.trick.ledSuit = move.card.suit;
    s.trick.plays.push(played);

    // Advance turn or complete the trick.
    if (s.trick.plays.length === s.players) {
      const winner = trickWinner(s.trick.plays, s.trump, s.trick.ledSuit!);
      // Winner captures all cards in the trick.
      for (const pl of s.trick.plays) s.playerList[winner].captured.push(pl.card);
      s.tricksWon[winner]++;
      s.history.push(s.trick);

      const roundOver = this.noCardsLeft();
      if (roundOver) {
        s.phase = 'round-over';
      } else {
        s.turnSeat = winner;
        s.trick = { leadSeat: winner, ledSuit: null, plays: [] };
      }
      return { revealed, trickComplete: true, trickWinnerSeat: winner, roundOver };
    }

    s.turnSeat = (s.turnSeat + 1) % s.players;
    return { revealed, trickComplete: false, roundOver: false };
  }

  private noCardsLeft(): boolean {
    return this.state.playerList.every(
      (p) => p.hand.length === 0 && p.piles.every((pi) => pi.cards.length === 0)
    );
  }

  score(): RoundResult {
    return scoreRound(this.state);
  }

  /** Number of cards still unrevealed beneath each pile (for UI badges). */
  pileDepth(seat: number, pileIndex: number): number {
    const cards = this.state.playerList[seat].piles[pileIndex].cards.length;
    return Math.max(0, cards - 1); // exclude the visible top card
  }
}

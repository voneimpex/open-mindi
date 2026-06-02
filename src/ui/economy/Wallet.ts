/**
 * Coin economy: wallet, daily bonus and game betting.
 *
 * Rules (per the design):
 *  - A new player starts with 10,000 coins.
 *  - A daily bonus of 1% of the player's *max balance ever* can be claimed once
 *    per day. It must be collected manually — it does NOT accrue, so a missed
 *    day is simply lost (only one day's bonus is ever available at a time).
 *  - Before each game the player bets coins. The recommended bet is 10% of the
 *    current balance, adjustable with a slider.
 *  - Every side antes the bet into a prize fund; the winning side(s) split the
 *    fund equally (leaderboard ties share it).
 */

import { RoundResult } from '../../engine';

export interface WalletState {
  balance: number;
  /** Highest balance ever reached — the daily bonus is 1% of this. */
  maxBalance: number;
  /** Local date (YYYY-MM-DD) the bonus was last collected, or null. */
  lastBonusDay: string | null;
}

const KEY = 'open-mindi:wallet:v1';
const START_COINS = 10_000;
const DAILY_RATE = 0.01;
const BET_RECOMMEND = 0.1;
const MIN_BET = 100;

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function loadWallet(): WalletState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const w = JSON.parse(raw) as WalletState;
      // self-heal old/corrupt values
      w.balance = Math.max(0, Math.floor(w.balance ?? START_COINS));
      w.maxBalance = Math.max(w.balance, Math.floor(w.maxBalance ?? w.balance));
      return w;
    }
  } catch {
    /* ignore */
  }
  return { balance: START_COINS, maxBalance: START_COINS, lastBonusDay: null };
}

export function saveWallet(w: WalletState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    /* ignore */
  }
}

/** Apply a coin change and keep maxBalance up to date. Never goes below 0. */
export function applyDelta(w: WalletState, delta: number): WalletState {
  const balance = Math.max(0, Math.floor(w.balance + delta));
  return { ...w, balance, maxBalance: Math.max(w.maxBalance, balance) };
}

export function bonusAvailable(w: WalletState, today = todayStr()): boolean {
  return w.lastBonusDay !== today;
}

export function bonusAmount(w: WalletState): number {
  return Math.max(1, Math.floor(w.maxBalance * DAILY_RATE));
}

/** Collect today's bonus if available. Returns the new wallet and amount paid. */
export function collectBonus(w: WalletState, today = todayStr()): { wallet: WalletState; amount: number } {
  if (!bonusAvailable(w, today)) return { wallet: w, amount: 0 };
  const amount = bonusAmount(w);
  const wallet = applyDelta({ ...w, lastBonusDay: today }, amount);
  return { wallet, amount };
}

export function recommendedBet(balance: number): number {
  return Math.max(minBet(balance), Math.floor(balance * BET_RECOMMEND));
}

export function minBet(balance: number): number {
  if (balance <= 0) return 0;
  return Math.min(MIN_BET, balance);
}

export function clampBet(bet: number, balance: number): number {
  return Math.max(minBet(balance), Math.min(Math.floor(bet), balance));
}

export interface Settlement {
  /** Coins contributed by all sides. */
  pot: number;
  /** Coins the human's side received from the pot (0 if they lost). */
  payout: number;
  /** Net change to the human's wallet (payout - bet). */
  net: number;
  won: boolean;
  /** Was it a shared (tied) win? */
  shared: boolean;
}

/**
 * Settle a finished game's bet. Each scoring side antes `bet` into the pot; the
 * winning side(s) split it equally. The human always occupies side 0
 * (seat 0 / team 0).
 */
export function settleGame(result: RoundResult, bet: number, humanSideId = 0): Settlement {
  const numSides = result.sides.length;
  const pot = bet * numSides;
  const humanWon = result.winners.includes(humanSideId);
  const payout = humanWon ? Math.floor(pot / result.winners.length) : 0;
  return {
    pot,
    payout,
    net: payout - bet,
    won: humanWon,
    shared: humanWon && result.winners.length > 1
  };
}

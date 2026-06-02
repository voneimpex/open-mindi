import { describe, it, expect } from 'vitest';
import {
  applyDelta,
  bonusAmount,
  bonusAvailable,
  clampBet,
  collectBonus,
  minBet,
  recommendedBet,
  settleGame,
  WalletState
} from '../src/ui/economy/Wallet';
import { RoundResult, SideScore } from '../src/engine';

const wallet = (balance: number, maxBalance = balance, lastBonusDay: string | null = null): WalletState => ({
  balance,
  maxBalance,
  lastBonusDay
});

describe('wallet', () => {
  it('applyDelta updates maxBalance and never goes below zero', () => {
    let w = wallet(10_000);
    w = applyDelta(w, 500);
    expect(w.balance).toBe(10_500);
    expect(w.maxBalance).toBe(10_500);
    w = applyDelta(w, -999_999);
    expect(w.balance).toBe(0);
    expect(w.maxBalance).toBe(10_500); // max preserved
  });

  it('daily bonus is 1% of max balance, not current balance', () => {
    const w = wallet(2_000, 10_000);
    expect(bonusAmount(w)).toBe(100); // 1% of 10,000
  });

  it('bonus can be claimed once per day and does not accrue', () => {
    let w = wallet(5_000, 10_000, null);
    expect(bonusAvailable(w, '2026-06-02')).toBe(true);
    const r = collectBonus(w, '2026-06-02');
    w = r.wallet;
    expect(r.amount).toBe(100);
    expect(w.balance).toBe(5_100);
    expect(bonusAvailable(w, '2026-06-02')).toBe(false);
    // same day, second attempt pays nothing
    const r2 = collectBonus(w, '2026-06-02');
    expect(r2.amount).toBe(0);
    // a new day re-enables it (no stacking of the missed days)
    expect(bonusAvailable(w, '2026-06-03')).toBe(true);
  });

  it('recommended bet is 10% and clamped to balance', () => {
    expect(recommendedBet(10_000)).toBe(1_000);
    expect(clampBet(99_999, 5_000)).toBe(5_000);
    expect(clampBet(0, 5_000)).toBe(minBet(5_000));
  });
});

const mkResult = (winners: number[], sides: number): RoundResult => {
  const s: SideScore[] = Array.from({ length: sides }, (_, i) => ({
    id: i,
    seats: [i],
    mindis: 0,
    tricks: 0,
    trickBonus: 0,
    points: winners.includes(i) ? 5 : 1
  }));
  return { perSeat: [], sides: s, totalMindis: 4, maxTricks: 1, winners, whitewash: false, byTeam: false };
};

describe('settlement', () => {
  it('outright win pays the whole pot minus the ante', () => {
    const r = mkResult([0], 4);
    const s = settleGame(r, 1_000, 0);
    expect(s.pot).toBe(4_000);
    expect(s.payout).toBe(4_000);
    expect(s.net).toBe(3_000);
    expect(s.won).toBe(true);
    expect(s.shared).toBe(false);
  });

  it('a tie splits the prize fund equally', () => {
    const r = mkResult([0, 1], 2);
    const s = settleGame(r, 1_000, 0);
    expect(s.pot).toBe(2_000);
    expect(s.payout).toBe(1_000);
    expect(s.net).toBe(0);
    expect(s.shared).toBe(true);
  });

  it('a loss costs the bet', () => {
    const r = mkResult([1], 3);
    const s = settleGame(r, 800, 0);
    expect(s.payout).toBe(0);
    expect(s.net).toBe(-800);
    expect(s.won).toBe(false);
  });
});

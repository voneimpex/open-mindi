/** Persisted player preferences (localStorage). */

import { Difficulty } from '../../ai';
import { GameMode, PlayerCount } from '../../engine';

export interface AppSettings {
  mode: GameMode;
  players: PlayerCount;
  difficulty: Difficulty;
  cardBack: string; // skin id
  table: string; // skin id
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
}

const KEY = 'open-mindi:settings:v1';

const DEFAULTS: AppSettings = {
  mode: 'mindi',
  players: 4,
  difficulty: 'learner',
  cardBack: 'classic-blue',
  table: 'green-felt',
  musicVolume: 0.5,
  sfxVolume: 0.8
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore (private mode etc.) */
  }
}

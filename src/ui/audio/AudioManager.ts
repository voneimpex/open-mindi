/**
 * AudioManager — generative music + SFX via the Web Audio API.
 *
 * No binary audio assets are required: the home and in-game music are
 * synthesised from simple oscillators so the game ships and runs standalone.
 * To use real tracks instead, drop files in /public/audio and call
 * `loadTrack('home', url)` / `loadTrack('game', url)` (see playFileTrack).
 *
 * Browsers block audio until a user gesture, so call `unlock()` from the
 * first tap/click.
 */

export type TrackName = 'home' | 'game';

interface Scale {
  root: number; // base midi note
  steps: number[]; // semitone offsets that form the loop
  bpm: number;
  waveform: OscillatorType;
}

const SCALES: Record<TrackName, Scale> = {
  // Calm, major, slow — menu.
  home: { root: 57, steps: [0, 4, 7, 11, 12, 7, 4, 2], bpm: 70, waveform: 'triangle' },
  // Warmer, slightly faster, minor-pentatonic — table.
  game: { root: 50, steps: [0, 3, 5, 7, 10, 7, 5, 3], bpm: 92, waveform: 'sine' }
};

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private current: TrackName | null = null;
  private step = 0;
  private timer: number | null = null;
  private fileBuffers = new Map<TrackName, AudioBuffer>();
  private fileSource: AudioBufferSourceNode | null = null;

  musicVolume = 0.5;
  sfxVolume = 0.8;
  private unlocked = false;
  /** Set when the Web Audio API is unavailable (e.g. some WebViews). The game
   *  then runs silently instead of crashing. */
  private unavailable = false;

  /** Lazily create the AudioContext. Returns null when Web Audio is missing. */
  private ensure(): AudioContext | null {
    if (this.unavailable) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) {
        this.unavailable = true;
        return null;
      }
      this.ctx = new Ctor();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      this.applyVolumes();
    }
    return this.ctx;
  }

  unlock(): void {
    const ctx = this.ensure();
    if (!ctx) return; // no Web Audio: stay silent
    if (ctx.state === 'suspended') ctx.resume();
    this.unlocked = true;
    if (this.current) this.playMusic(this.current);
  }

  setMusicVolume(v: number): void {
    this.musicVolume = v;
    this.applyVolumes();
  }
  setSfxVolume(v: number): void {
    this.sfxVolume = v;
    this.applyVolumes();
  }
  private applyVolumes(): void {
    if (!this.ctx) return;
    this.musicGain.gain.value = this.musicVolume * 0.35;
    this.sfxGain.gain.value = this.sfxVolume;
  }

  /** Optionally preload a real music file to override the generative track. */
  async loadTrack(name: TrackName, url: string): Promise<void> {
    const ctx = this.ensure();
    if (!ctx) return;
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    this.fileBuffers.set(name, await ctx.decodeAudioData(buf));
    // If this track is the one currently playing, swap from the generative
    // version to the real file now that it's ready.
    if (this.unlocked && this.current === name) this.playMusic(name);
  }

  playMusic(name: TrackName): void {
    this.current = name;
    if (!this.unlocked) return; // will start on unlock()
    this.stopMusic(false);
    if (this.fileBuffers.has(name)) return this.playFileTrack(name);
    this.step = 0;
    const scale = SCALES[name];
    const beat = (60 / scale.bpm) * 1000;
    const tick = () => this.noteTick(scale);
    tick();
    this.timer = window.setInterval(tick, beat);
  }

  private playFileTrack(name: TrackName): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.fileBuffers.get(name)!;
    src.loop = true;
    src.connect(this.musicGain);
    src.start();
    this.fileSource = src;
  }

  stopMusic(clearCurrent = true): void {
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.fileSource) {
      try {
        this.fileSource.stop();
      } catch {
        /* already stopped */
      }
      this.fileSource = null;
    }
    if (clearCurrent) this.current = null;
  }

  private noteTick(scale: Scale): void {
    const semitone = scale.steps[this.step % scale.steps.length];
    this.step++;
    const freq = midiToFreq(scale.root + semitone);
    // Melody note + a soft fifth below for body.
    this.blip(freq, scale.waveform, 0.45, this.musicGain, 0.0);
    if (this.step % 4 === 0) this.blip(midiToFreq(scale.root - 5), 'sine', 0.8, this.musicGain, 0.0);
  }

  private blip(freq: number, type: OscillatorType, dur: number, dest: GainNode, delay: number): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.6, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // ---- SFX ---------------------------------------------------------------
  private sfx(freq: number, type: OscillatorType, dur: number): void {
    if (!this.unlocked) return;
    this.blip(freq, type, dur, this.sfxGain, 0);
  }
  deal(): void {
    this.sfx(320, 'square', 0.06);
  }
  playCard(): void {
    this.sfx(440, 'triangle', 0.08);
  }
  winTrick(): void {
    this.sfx(660, 'sine', 0.18);
  }
  captureMindi(): void {
    this.sfx(880, 'sine', 0.12);
    window.setTimeout(() => this.sfx(1175, 'sine', 0.16), 90);
  }
  button(): void {
    this.sfx(520, 'square', 0.05);
  }
}

export const audio = new AudioManager();

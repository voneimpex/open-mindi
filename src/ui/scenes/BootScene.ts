import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { loadSettings } from '../settings/Settings';
import { allFaces, CARD_BACK_ART_KEY } from '../view/cardTextures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Public-domain card art (see public/cards/CREDITS.md). If a file is
    // missing the game falls back to procedural drawing in CardView.
    this.load.setPath('cards');
    for (const f of allFaces()) this.load.image(f.key, f.file);
    this.load.image(CARD_BACK_ART_KEY, 'back.png');
    this.load.setPath();
    // Don't let a missing asset block startup.
    this.load.on('loaderror', () => {});
  }

  create(): void {
    const s = loadSettings();
    audio.setMusicVolume(s.musicVolume);
    audio.setSfxVolume(s.sfxVolume);

    // Load the bundled CC0 music tracks (see public/audio/CREDITS.md). These
    // load in the background; until they're ready the generative tracks play,
    // then loadTrack hot-swaps to the file. Falls back silently on error.
    const baseUrl = import.meta.env.BASE_URL;
    audio.loadTrack('home', `${baseUrl}audio/home.mp3`).catch(() => {});
    audio.loadTrack('game', `${baseUrl}audio/game.mp3`).catch(() => {});

    this.scene.start('Home');
  }
}

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
    this.scene.start('Home');
  }
}

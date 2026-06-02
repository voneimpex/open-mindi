import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { loadSettings } from '../settings/Settings';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const s = loadSettings();
    audio.setMusicVolume(s.musicVolume);
    audio.setSfxVolume(s.sfxVolume);
    this.scene.start('Home');
  }
}

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HomeScene } from './scenes/HomeScene';
import { SettingsScene } from './scenes/SettingsScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#06231a',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight
  },
  // Both orientations are supported; layout recomputes on resize so rotating
  // the phone re-arranges the table around the seats.
  scene: [BootScene, HomeScene, SettingsScene, GameScene]
};

// eslint-disable-next-line no-new
new Phaser.Game(config);

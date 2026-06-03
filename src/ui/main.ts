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
    // RESIZE fills the window 1:1 so pointer coordinates map exactly to what's
    // drawn. (autoCenter is intentionally omitted — with RESIZE it can offset
    // the canvas and make clicks land away from the cursor.)
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight
  },
  // Both orientations are supported; layout recomputes on resize so rotating
  // the phone re-arranges the table around the seats.
  scene: [BootScene, HomeScene, SettingsScene, GameScene]
};

// eslint-disable-next-line no-new
new Phaser.Game(config);

// Register the service worker so the game is installable and works offline.
// (No-op on file:// or unsupported browsers — e.g. the single-file build.)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}

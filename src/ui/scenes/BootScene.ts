import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { loadSettings } from '../settings/Settings';
import { assetUrl } from '../view/assets';
import { allFaces, CARD_BACK_ART_KEY } from '../view/cardTextures';

/** Optional art keys. Drop matching files in /public and they appear
 *  automatically; otherwise the game falls back to its procedural look.
 *  See assets/manifest/README.md for filenames and sizes. */
export const ART = {
  homeBg: 'home-bg',
  tableBg: 'table-bg',
  logo: 'logo',
  avatarYou: 'av_you',
  avatarBot: (i: number) => `av_bot${i}`
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.on('loaderror', () => {}); // missing optional art is fine

    // Public-domain card art (see public/cards/CREDITS.md). The single-file
    // download build inlines these as data URIs via assetUrl().
    for (const f of allFaces()) this.load.image(f.key, assetUrl(f.file, `cards/${f.file}`));
    this.load.image(CARD_BACK_ART_KEY, assetUrl('back.png', 'cards/back.png'));

    // Optional custom art — backgrounds, logo and avatars.
    this.load.image(ART.homeBg, 'ui/home-bg.png');
    this.load.image(ART.tableBg, 'ui/table-bg.png');
    this.load.image(ART.logo, 'ui/logo.png');
    this.load.image(ART.avatarYou, 'avatars/you.png');
    for (let i = 1; i <= 5; i++) this.load.image(ART.avatarBot(i), `avatars/bot${i}.png`);
  }

  create(): void {
    const s = loadSettings();
    audio.setMusicVolume(s.musicVolume);
    audio.setSfxVolume(s.sfxVolume);

    // Crop any avatar images to circles so square art still looks right.
    this.makeCircular([ART.avatarYou, ART.avatarBot(1), ART.avatarBot(2), ART.avatarBot(3), ART.avatarBot(4), ART.avatarBot(5)]);

    // Bundled CC0 music (see public/audio/CREDITS.md), loaded in the background.
    const baseUrl = import.meta.env.BASE_URL;
    audio.loadTrack('home', assetUrl('audio/home.mp3', `${baseUrl}audio/home.mp3`)).catch(() => {});
    audio.loadTrack('game', assetUrl('audio/game.mp3', `${baseUrl}audio/game.mp3`)).catch(() => {});

    this.scene.start('Home');
  }

  /** Produce a `${key}_c` circular texture from each loaded avatar image. */
  private makeCircular(keys: string[]): void {
    for (const key of keys) {
      if (!this.textures.exists(key)) continue;
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const size = 128;
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const ctx = cv.getContext('2d');
      if (!ctx) continue;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(src, 0, 0, size, size);
      if (this.textures.exists(`${key}_c`)) this.textures.remove(`${key}_c`);
      this.textures.addCanvas(`${key}_c`, cv);
    }
  }
}

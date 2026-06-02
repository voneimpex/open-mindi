import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { AppSettings, loadSettings, saveSettings } from '../settings/Settings';
import { CARD_BACKS, TABLES, cardBack, tableSkin } from '../skins/skins';
import { drawTableBackground, makeButton } from '../view/widgets';
import { CardView } from '../view/CardView';

export class SettingsScene extends Phaser.Scene {
  private settings!: AppSettings;
  private bg!: Phaser.GameObjects.Graphics;
  private root!: Phaser.GameObjects.Container;
  private preview!: CardView;
  private musicTxt!: Phaser.GameObjects.Text;
  private sfxTxt!: Phaser.GameObjects.Text;

  constructor() {
    super('Settings');
  }

  create(): void {
    this.settings = loadSettings();
    this.bg = this.add.graphics();
    this.root = this.add.container(0, 0);
    this.build();
    this.scale.on('resize', this.layout, this);
    this.layout();
  }

  shutdown(): void {
    this.scale.off('resize', this.layout, this);
  }

  private build(): void {
    const c = this.root;
    c.removeAll(true);

    const title = this.add
      .text(0, 0, 'Skins & Audio', { fontFamily: 'Georgia, serif', fontSize: '40px', color: '#ffd24a', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setName('title');
    c.add(title);

    c.add(this.heading('Card Back', 'cardBackLabel'));
    CARD_BACKS.forEach((s, i) => {
      const sw = this.swatch(s.color, s.accent, this.settings.cardBack === s.id, () => {
        this.settings.cardBack = s.id;
        saveSettings(this.settings);
        this.preview.setBackSkin(cardBack(s.id));
        this.refreshSwatches();
        audio.button();
      });
      sw.setName(`cb_${i}`);
      sw.setData('skinId', s.id);
      sw.setData('kind', 'cb');
      c.add(sw);
    });

    c.add(this.heading('Table / Environment', 'tableLabel'));
    TABLES.forEach((s, i) => {
      const sw = this.swatch(s.feltCenter, s.rail, this.settings.table === s.id, () => {
        this.settings.table = s.id;
        saveSettings(this.settings);
        this.layout();
        this.refreshSwatches();
        audio.button();
      });
      sw.setName(`tb_${i}`);
      sw.setData('skinId', s.id);
      sw.setData('kind', 'tb');
      c.add(sw);
    });

    // Preview card
    this.preview = new CardView(this, null, cardBack(this.settings.cardBack)).setFaceUp(false);
    this.preview.setName('preview');
    c.add(this.preview);

    // Volume controls
    c.add(this.heading('Music Volume', 'musicLabel'));
    this.musicTxt = this.valueText(`${Math.round(this.settings.musicVolume * 100)}%`, 'musicVal');
    c.add(this.musicTxt);
    c.add(makeButton(this, 0, 0, '–', () => this.adjMusic(-0.1), { w: 56, h: 48 }).setName('musicMinus') as any);
    c.add(makeButton(this, 0, 0, '+', () => this.adjMusic(0.1), { w: 56, h: 48 }).setName('musicPlus') as any);

    c.add(this.heading('Sound Effects', 'sfxLabel'));
    this.sfxTxt = this.valueText(`${Math.round(this.settings.sfxVolume * 100)}%`, 'sfxVal');
    c.add(this.sfxTxt);
    c.add(makeButton(this, 0, 0, '–', () => this.adjSfx(-0.1), { w: 56, h: 48 }).setName('sfxMinus') as any);
    c.add(makeButton(this, 0, 0, '+', () => this.adjSfx(0.1), { w: 56, h: 48 }).setName('sfxPlus') as any);

    c.add(makeButton(this, 0, 0, '‹  Back', () => this.scene.start('Home'), { w: 200, h: 56, active: true }).setName('back') as any);
  }

  private adjMusic(d: number): void {
    this.settings.musicVolume = Phaser.Math.Clamp(this.settings.musicVolume + d, 0, 1);
    audio.setMusicVolume(this.settings.musicVolume);
    saveSettings(this.settings);
    this.musicTxt.setText(`${Math.round(this.settings.musicVolume * 100)}%`);
  }
  private adjSfx(d: number): void {
    this.settings.sfxVolume = Phaser.Math.Clamp(this.settings.sfxVolume + d, 0, 1);
    audio.setSfxVolume(this.settings.sfxVolume);
    saveSettings(this.settings);
    this.sfxTxt.setText(`${Math.round(this.settings.sfxVolume * 100)}%`);
    audio.button();
  }

  private heading(s: string, name: string): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, s, { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#9fd4bf', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setName(name);
  }
  private valueText(s: string, name: string): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, s, { fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5)
      .setName(name);
  }

  private swatch(color: number, accent: number, active: boolean, onClick: () => void): Phaser.GameObjects.Container {
    const cc = this.add.container(0, 0);
    const g = this.add.graphics();
    cc.add(g);
    cc.setData('draw', (a: boolean) => {
      g.clear();
      g.fillStyle(color, 1);
      g.fillRoundedRect(-28, -36, 56, 72, 8);
      g.lineStyle(a ? 4 : 2, a ? 0xffe066 : accent, 1);
      g.strokeRoundedRect(-28, -36, 56, 72, 8);
    });
    (cc.getData('draw') as (a: boolean) => void)(active);
    cc.setSize(56, 72);
    cc.setInteractive(new Phaser.Geom.Rectangle(-28, -36, 56, 72), Phaser.Geom.Rectangle.Contains);
    cc.on('pointerdown', onClick);
    return cc;
  }

  private refreshSwatches(): void {
    this.root.list.forEach((o) => {
      const go = o as Phaser.GameObjects.Container;
      const kind = go.getData?.('kind');
      if (kind === 'cb' || kind === 'tb') {
        const id = go.getData('skinId');
        const active = kind === 'cb' ? this.settings.cardBack === id : this.settings.table === id;
        (go.getData('draw') as (a: boolean) => void)(active);
      }
    });
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    drawTableBackground(this, this.bg, tableSkin(this.settings.table), w, h);
    const cx = w / 2;
    const find = (n: string) => this.root.getByName(n) as any;

    let y = h * 0.07;
    find('title').setPosition(cx, y);

    y += 56;
    find('cardBackLabel').setPosition(cx, y);
    y += 50;
    const cbStart = cx - ((CARD_BACKS.length - 1) * 72) / 2;
    CARD_BACKS.forEach((_, i) => find(`cb_${i}`).setPosition(cbStart + i * 72, y));

    y += 80;
    find('tableLabel').setPosition(cx, y);
    y += 50;
    const tbStart = cx - ((TABLES.length - 1) * 72) / 2;
    TABLES.forEach((_, i) => find(`tb_${i}`).setPosition(tbStart + i * 72, y));

    // preview to the right (or below in portrait)
    find('preview').setPosition(w - 90, h * 0.2).setScale(0.9);

    y += 90;
    find('musicLabel').setPosition(cx - 120, y);
    find('musicMinus').setPosition(cx + 30, y);
    find('musicVal').setPosition(cx + 100, y);
    find('musicPlus').setPosition(cx + 170, y);

    y += 64;
    find('sfxLabel').setPosition(cx - 120, y);
    find('sfxMinus').setPosition(cx + 30, y);
    find('sfxVal').setPosition(cx + 100, y);
    find('sfxPlus').setPosition(cx + 170, y);

    y += 80;
    find('back').setPosition(cx, y);
  }
}

import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { AppSettings, loadSettings, saveSettings } from '../settings/Settings';
import { makeSlider, Slider } from '../view/widgets';
import {
  avatarDisc,
  coinBadge,
  coverBackground,
  drawPanel,
  fancyButton,
  FancyButton,
  goldText,
  setCoinBadge,
  THEME
} from '../view/theme';
import { ART } from './BootScene';
import { GameMode, PlayerCount } from '../../engine';
import { Difficulty } from '../../ai';
import {
  WalletState,
  bonusAmount,
  bonusAvailable,
  clampBet,
  collectBonus,
  loadWallet,
  minBet,
  recommendedBet,
  saveWallet
} from '../economy/Wallet';

export class HomeScene extends Phaser.Scene {
  private settings!: AppSettings;
  private wallet!: WalletState;
  private bet = 0;
  private bg!: Phaser.GameObjects.Graphics;
  __bgImg?: Phaser.GameObjects.Image;
  private root!: Phaser.GameObjects.Container;
  private modeBtns: Record<GameMode, FancyButton> = {} as any;
  private playerBtns: Record<number, FancyButton> = {};
  private diffBtns: Record<Difficulty, FancyButton> = {} as any;
  private betSlider!: Slider;
  private betText!: Phaser.GameObjects.Text;
  private coin!: Phaser.GameObjects.Container;
  private bonusBtn!: FancyButton;

  constructor() {
    super('Home');
  }

  create(): void {
    this.settings = loadSettings();
    this.wallet = loadWallet();
    this.bet = recommendedBet(this.wallet.balance);
    this.bg = this.add.graphics();
    this.root = this.add.container(0, 0);
    this.build();
    this.scale.on('resize', this.layout, this);
    this.layout();
    window.addEventListener('mindi-installable', this.onInstallable);
    this.updateInstall();

    audio.playMusic('home');
    this.input.once('pointerdown', () => audio.unlock());
  }

  shutdown(): void {
    this.scale.off('resize', this.layout, this);
    window.removeEventListener('mindi-installable', this.onInstallable);
  }

  private onInstallable = (): void => this.updateInstall();

  /** Show the install button only when the browser can install (or on iOS). */
  private updateInstall(): void {
    const win = window as any;
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
    const show = !win.__isStandalone && (win.__canInstall || isIOS);
    (this.root.getByName('install') as FancyButton | null)?.setVisible(show);
  }

  private doInstall(): void {
    const win = window as any;
    if (win.__deferredPrompt && win.installApp) {
      win.installApp();
    } else {
      const t = this.root.getByName('installHint') as Phaser.GameObjects.Text | null;
      if (!t) return;
      t.setText('On iPhone: tap  Share  →  “Add to Home Screen”').setVisible(true).setAlpha(1);
      this.tweens.add({ targets: t, alpha: 0, delay: 3500, duration: 800, onComplete: () => t.setVisible(false) });
    }
  }

  private build(): void {
    this.root.removeAll(true);
    const c = this.root;
    const named = (o: Phaser.GameObjects.GameObject, n: string) => {
      o.setName(n);
      c.add(o);
      return o;
    };

    // Top bar
    named(avatarDisc(this, 0, 0, 22, 'P', 0xffd24a, ART.avatarYou), 'avatar');
    this.coin = coinBadge(this, 0, 0, this.wallet.balance, { plus: () => this.scene.start('Settings') }) as any;
    named(this.coin, 'coin');
    this.bonusBtn = fancyButton(this, 0, 0, '', () => this.claimBonus(), { w: 170, h: 36, variant: 'gold2', size: 15 });
    named(this.bonusBtn, 'bonus');

    // Title (custom logo image if provided, else gold text)
    named(goldText(this, 0, 0, 'OPEN MINDI', 60), 'title');
    if (this.textures.exists(ART.logo)) named(this.add.image(0, 0, ART.logo).setOrigin(0.5), 'logo');
    named(
      this.add
        .text(0, 0, 'COLLECT THE MINDIS · PLAY VS BOTS', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '15px',
          color: THEME.textDim,
          fontStyle: 'bold'
        })
        .setOrigin(0.5),
      'subtitle'
    );

    // Panel behind the options
    named(this.add.graphics(), 'panel');

    // Mode
    named(this.label('GAME MODE'), 'modeLabel');
    this.modeBtns.mindi = fancyButton(this, 0, 0, 'OPEN MINDI', () => this.setMode('mindi'), {
      w: 200,
      h: 52,
      variant: 'primary',
      selected: this.settings.mode === 'mindi'
    });
    this.modeBtns.double = fancyButton(this, 0, 0, 'DOUBLE MINDI', () => this.setMode('double'), {
      w: 200,
      h: 52,
      variant: 'primary',
      selected: this.settings.mode === 'double'
    });
    named(this.modeBtns.mindi, 'mode_mindi');
    named(this.modeBtns.double, 'mode_double');

    // Players
    named(this.label('PLAYERS'), 'playersLabel');
    for (let n = 2; n <= 6; n++) {
      const b = fancyButton(this, 0, 0, this.playersText(n as PlayerCount), () => this.setPlayers(n as PlayerCount), {
        w: 92,
        h: 46,
        size: 16,
        variant: 'primary',
        selected: this.settings.players === n
      });
      this.playerBtns[n] = b;
      named(b, `pl_${n}`);
    }

    // Difficulty
    named(this.label('BOT DIFFICULTY'), 'diffLabel');
    this.diffBtns.learner = fancyButton(this, 0, 0, 'LEARNER', () => this.setDiff('learner'), {
      w: 200,
      h: 46,
      variant: 'primary',
      selected: this.settings.difficulty === 'learner'
    });
    this.diffBtns.expert = fancyButton(this, 0, 0, 'EXPERT', () => this.setDiff('expert'), {
      w: 200,
      h: 46,
      variant: 'primary',
      selected: this.settings.difficulty === 'expert'
    });
    named(this.diffBtns.learner, 'diff_learner');
    named(this.diffBtns.expert, 'diff_expert');

    // Bet
    named(this.label('BET'), 'betLabel');
    this.betText = this.add
      .text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ffe9a8', fontStyle: 'bold' })
      .setOrigin(0.5);
    named(this.betText, 'betText');
    this.betSlider = makeSlider(this, 0, 0, 320, minBet(this.wallet.balance), this.wallet.balance, this.bet, (v) =>
      this.setBet(v)
    );
    named(this.betSlider, 'betSlider');

    // Actions
    named(fancyButton(this, 0, 0, '▶  PLAY', () => this.startGame(), { w: 300, h: 70, variant: 'green', size: 28, selected: true }), 'play');
    named(fancyButton(this, 0, 0, '⚙  Skins & Audio', () => this.scene.start('Settings'), { w: 300, h: 46, variant: 'primary', size: 18 }), 'settings');
    named(fancyButton(this, 0, 0, '⤓  Install App', () => this.doInstall(), { w: 200, h: 44, variant: 'gold2', size: 17 }), 'install');
    named(
      this.add
        .text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#ffe9a8', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setVisible(false),
      'installHint'
    );

    this.refreshWallet();
    this.updateBetText();
  }

  private setBet(v: number): void {
    this.bet = clampBet(v, this.wallet.balance);
    this.updateBetText();
  }
  private updateBetText(): void {
    this.betText.setText(`💰 ${this.bet.toLocaleString()} coins`);
  }
  private refreshWallet(): void {
    setCoinBadge(this.coin, this.wallet.balance);
    if (bonusAvailable(this.wallet)) {
      this.bonusBtn.setLabel(`🎁 +${bonusAmount(this.wallet).toLocaleString()}`);
      this.bonusBtn.setEnabled(true);
    } else {
      this.bonusBtn.setLabel('🎁 Claimed');
      this.bonusBtn.setEnabled(false);
    }
  }
  private claimBonus(): void {
    if (!bonusAvailable(this.wallet)) return;
    const { wallet, amount } = collectBonus(this.wallet);
    this.wallet = wallet;
    saveWallet(this.wallet);
    if (amount > 0) audio.captureMindi();
    this.bet = clampBet(this.bet, this.wallet.balance);
    this.betSlider.setRange(minBet(this.wallet.balance), this.wallet.balance, this.bet);
    this.refreshWallet();
    this.updateBetText();
  }

  private label(s: string): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, s, { fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: THEME.textDim, fontStyle: 'bold' })
      .setOrigin(0.5);
  }

  private playersText(n: PlayerCount): string {
    return n === 4 || n === 6 ? `${n}♟` : `${n}`;
  }

  private setMode(m: GameMode): void {
    this.settings.mode = m;
    saveSettings(this.settings);
    this.modeBtns.mindi.setSelected(m === 'mindi');
    this.modeBtns.double.setSelected(m === 'double');
  }
  private setPlayers(n: PlayerCount): void {
    this.settings.players = n;
    saveSettings(this.settings);
    for (let i = 2; i <= 6; i++) this.playerBtns[i].setSelected(i === n);
  }
  private setDiff(d: Difficulty): void {
    this.settings.difficulty = d;
    saveSettings(this.settings);
    this.diffBtns.learner.setSelected(d === 'learner');
    this.diffBtns.expert.setSelected(d === 'expert');
  }

  private startGame(): void {
    audio.unlock();
    this.scene.start('Game', { ...this.settings, bet: clampBet(this.bet, this.wallet.balance) });
  }

  private placeTitle(find: (n: string) => any, cx: number, titleY: number, subY: number, size: number): void {
    const logo = find('logo');
    const title = find('title');
    const sub = find('subtitle');
    if (logo) {
      title.setVisible(false);
      const src = this.textures.get(ART.logo).getSourceImage();
      const sc = Math.min((size * 6) / src.width, (size * 2) / src.height);
      logo.setVisible(true).setPosition(cx, titleY).setScale(sc);
    } else {
      title.setVisible(true).setFontSize(size).setPosition(cx, titleY);
    }
    sub.setPosition(cx, subY);
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    coverBackground(this, this, this.bg, ART.homeBg, w, h);
    const cx = w / 2;
    const find = (n: string) => this.root.getByName(n) as any;

    // top bar — avatar far left, coin far right, bonus pill beside the avatar
    const topY = Phaser.Math.Clamp(Math.round(h * 0.085), 20, 40);
    find('avatar').setPosition(26, topY).setScale(Phaser.Math.Clamp(topY / 30, 0.72, 1.05));
    find('coin').setPosition(w - 196, topY);

    if (w >= h) this.layoutLandscape(w, h, cx, find);
    else this.layoutPortrait(w, h, cx, find);
  }

  // Two columns side by side — designed for a phone held sideways. Everything
  // is sized from the available height so it fits short landscape screens.
  private layoutLandscape(w: number, h: number, cx: number, find: (n: string) => any): void {
    const topY = Phaser.Math.Clamp(Math.round(h * 0.085), 20, 40);
    find('bonus').setPosition(116, topY).setSize2(150, 30);

    const titleSize = Phaser.Math.Clamp(Math.round(h * 0.13), 22, 46);
    const titleY = topY + 2;
    const subY = titleY + titleSize * 0.5 + 2;
    this.placeTitle(find, cx, titleY, subY, titleSize);

    // Reserve a footer for the PLAY button so it is always fully visible.
    const playH = Phaser.Math.Clamp(Math.round(h * 0.15), 42, 62);
    const playY = h - playH / 2 - 6;

    // Options panel fills the space between the subtitle and the footer.
    const panelTop = subY + titleSize * 0.4 + 6;
    const panelBottom = playY - playH / 2 - 10;
    const panelH = panelBottom - panelTop;
    const cwid = Phaser.Math.Clamp(Math.min(w * 0.9, 960), 460, 960);
    const colL = cx - cwid / 4;
    const colR = cx + cwid / 4;
    const inner = cwid / 2 - 40;

    const pg = find('panel') as Phaser.GameObjects.Graphics;
    pg.setPosition(cx, (panelTop + panelBottom) / 2);
    drawPanel(pg, cwid, panelH, { radius: 18, glow: true });

    // Four sub-rows inside the panel: label / controls, twice.
    const lab1 = panelTop + panelH * 0.13;
    const row1 = panelTop + panelH * 0.36;
    const lab2 = panelTop + panelH * 0.63;
    const row2 = panelTop + panelH * 0.86;
    const bh = Phaser.Math.Clamp(Math.round(panelH * 0.2), 34, 52);

    find('modeLabel').setPosition(colL, lab1).setOrigin(0.5);
    find('playersLabel').setPosition(colR, lab1).setOrigin(0.5);
    this.modeBtns.mindi.setPosition(colL - inner / 4 - 4, row1).setSize2(inner / 2 - 8, bh);
    this.modeBtns.double.setPosition(colL + inner / 4 + 4, row1).setSize2(inner / 2 - 8, bh);
    const pw = inner / 5;
    for (let n = 2; n <= 6; n++) {
      this.playerBtns[n].setPosition(colR - inner / 2 + (n - 2) * pw + pw / 2, row1).setSize2(pw - 6, bh);
    }

    find('diffLabel').setPosition(colL, lab2).setOrigin(0.5);
    find('betLabel').setPosition(colR - inner / 2, lab2).setOrigin(0, 0.5);
    find('betText').setPosition(colR + inner / 2, lab2).setOrigin(1, 0.5);
    this.diffBtns.learner.setPosition(colL - inner / 4 - 4, row2).setSize2(inner / 2 - 8, bh);
    this.diffBtns.expert.setPosition(colL + inner / 4 + 4, row2).setSize2(inner / 2 - 8, bh);
    this.betSlider.setPosition(colR, row2);
    this.betSlider.setWidth(inner);

    const playW = Phaser.Math.Clamp(cwid * 0.32, 220, 300);
    find('play').setPosition(cx, playY).setSize2(playW, playH);
    find('settings').setPosition(w - 150, playY).setSize2(220, Math.min(playH, 40));
    const instW = Phaser.Math.Clamp(cx - playW / 2 - 24, 120, 200);
    find('install').setPosition(8 + instW / 2, playY).setSize2(instW, Math.min(playH, 44));
    find('installHint').setPosition(cx, playY - playH / 2 - 16).setFontSize(Phaser.Math.Clamp(Math.round(h * 0.045), 12, 18));
  }

  // Single column — only seen briefly before the "rotate" prompt; kept tidy.
  private layoutPortrait(w: number, h: number, cx: number, find: (n: string) => any): void {
    const titleSize = Phaser.Math.Clamp(Math.round(w / 11), 30, 56);
    this.placeTitle(find, cx, h * 0.09, h * 0.09 + titleSize * 0.7, titleSize);

    const cwid = Phaser.Math.Clamp(w * 0.92, 300, 520);
    const left = cx - cwid / 2 + 18;
    let y = h * 0.09 + titleSize * 0.7 + 40;
    const panelTop = y - 16;
    const half = cwid / 4;

    find('modeLabel').setPosition(cx, y).setOrigin(0.5);
    y += 28;
    this.modeBtns.mindi.setPosition(cx - half, y).setSize2(cwid / 2 - 22, 50);
    this.modeBtns.double.setPosition(cx + half, y).setSize2(cwid / 2 - 22, 50);
    y += 56;
    find('playersLabel').setPosition(cx, y).setOrigin(0.5);
    y += 26;
    const pw = (cwid - 16) / 5;
    for (let n = 2; n <= 6; n++) this.playerBtns[n].setPosition(left + (n - 2) * pw + pw / 2 - 9, y).setSize2(pw - 6, 44);
    y += 52;
    find('diffLabel').setPosition(cx, y).setOrigin(0.5);
    y += 26;
    this.diffBtns.learner.setPosition(cx - half, y).setSize2(cwid / 2 - 22, 44);
    this.diffBtns.expert.setPosition(cx + half, y).setSize2(cwid / 2 - 22, 44);
    y += 50;
    find('betLabel').setPosition(left + 14, y).setOrigin(0, 0.5);
    find('betText').setPosition(cx + cwid / 2 - 14, y).setOrigin(1, 0.5);
    y += 26;
    this.betSlider.setPosition(cx, y);
    this.betSlider.setWidth(cwid - 56);
    y += 30;
    const pg = find('panel') as Phaser.GameObjects.Graphics;
    pg.setPosition(cx, (panelTop + y) / 2);
    drawPanel(pg, cwid, y - panelTop, { radius: 18, glow: true });
    y += 30;
    find('play').setPosition(cx, y).setSize2(280, 64);
    y += 56;
    find('settings').setPosition(cx - 74, y).setSize2(148, 42);
    find('install').setPosition(cx + 80, y).setSize2(160, 42);
    find('installHint').setPosition(cx, y + 30).setFontSize(13);
  }
}

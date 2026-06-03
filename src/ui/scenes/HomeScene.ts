import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { AppSettings, loadSettings, saveSettings } from '../settings/Settings';
import { makeSlider, Slider } from '../view/widgets';
import {
  avatarDisc,
  coinBadge,
  drawBackground,
  drawPanel,
  fancyButton,
  FancyButton,
  goldText,
  setCoinBadge,
  THEME
} from '../view/theme';
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

    audio.playMusic('home');
    this.input.once('pointerdown', () => audio.unlock());
  }

  shutdown(): void {
    this.scale.off('resize', this.layout, this);
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
    named(avatarDisc(this, 0, 0, 22, 'P', 0xffd24a), 'avatar');
    this.coin = coinBadge(this, 0, 0, this.wallet.balance, { plus: () => this.scene.start('Settings') }) as any;
    named(this.coin, 'coin');
    this.bonusBtn = fancyButton(this, 0, 0, '', () => this.claimBonus(), { w: 170, h: 36, variant: 'gold2', size: 15 });
    named(this.bonusBtn, 'bonus');

    // Title
    named(goldText(this, 0, 0, 'OPEN MINDI', 60), 'title');
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

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    drawBackground(this.bg, w, h);
    const cx = w / 2;
    const find = (n: string) => this.root.getByName(n) as any;

    // top bar
    find('avatar').setPosition(34, 32);
    find('coin').setPosition(w - 230, 30);
    find('bonus').setPosition(w - 96, 66);

    if (w >= h) this.layoutLandscape(w, h, cx, find);
    else this.layoutPortrait(w, h, cx, find);
  }

  // Two columns side by side — designed for a phone held sideways.
  private layoutLandscape(w: number, h: number, cx: number, find: (n: string) => any): void {
    const titleSize = Phaser.Math.Clamp(Math.round(h / 11), 28, 56);
    const titleY = h * 0.1;
    const subY = titleY + titleSize * 0.62;
    find('title').setFontSize(titleSize).setPosition(cx, titleY);
    find('subtitle').setPosition(cx, subY);

    const cwid = Phaser.Math.Clamp(Math.min(w * 0.86, 940), 460, 940);
    const colL = cx - cwid / 4;
    const colR = cx + cwid / 4;
    const inner = cwid / 2 - 40;

    const top = subY + 44;
    const r1 = top + 28; // controls row 1
    const r2lab = r1 + 56; // labels row 2
    const r2 = r2lab + 26; // controls row 2

    find('modeLabel').setPosition(colL, top).setOrigin(0.5);
    find('playersLabel').setPosition(colR, top).setOrigin(0.5);

    this.modeBtns.mindi.setPosition(colL - inner / 4 - 4, r1).setSize2(inner / 2 - 8, 48);
    this.modeBtns.double.setPosition(colL + inner / 4 + 4, r1).setSize2(inner / 2 - 8, 48);

    const pw = inner / 5;
    for (let n = 2; n <= 6; n++) {
      this.playerBtns[n].setPosition(colR - inner / 2 + (n - 2) * pw + pw / 2, r1).setSize2(pw - 6, 46);
    }

    find('diffLabel').setPosition(colL, r2lab).setOrigin(0.5);
    find('betLabel').setPosition(colR - inner / 2, r2lab).setOrigin(0, 0.5);
    find('betText').setPosition(colR + inner / 2, r2lab).setOrigin(1, 0.5);

    this.diffBtns.learner.setPosition(colL - inner / 4 - 4, r2).setSize2(inner / 2 - 8, 44);
    this.diffBtns.expert.setPosition(colL + inner / 4 + 4, r2).setSize2(inner / 2 - 8, 44);
    this.betSlider.setPosition(colR, r2 + 2);
    this.betSlider.setWidth(inner);

    const panelTop = top - 30;
    const panelBottom = r2 + 34;
    const pg = find('panel') as Phaser.GameObjects.Graphics;
    pg.setPosition(cx, (panelTop + panelBottom) / 2);
    drawPanel(pg, cwid, panelBottom - panelTop, { radius: 20, glow: true });

    const py = panelBottom + 44;
    find('play').setPosition(cx, py).setSize2(Phaser.Math.Clamp(cwid * 0.34, 240, 320), 64);
    find('settings').setPosition(w - 150, h - 30).setSize2(260, 40);
  }

  // Single column — only seen briefly before the "rotate" prompt; kept tidy.
  private layoutPortrait(w: number, h: number, cx: number, find: (n: string) => any): void {
    const titleSize = Phaser.Math.Clamp(Math.round(w / 11), 30, 56);
    find('title').setFontSize(titleSize).setPosition(cx, h * 0.09);
    find('subtitle').setPosition(cx, h * 0.09 + titleSize * 0.7);

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
    y += 58;
    find('settings').setPosition(cx, y).setSize2(280, 42);
  }
}

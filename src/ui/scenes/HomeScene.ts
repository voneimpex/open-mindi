import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { AppSettings, loadSettings, saveSettings } from '../settings/Settings';
import { tableSkin } from '../skins/skins';
import { drawTableBackground, makeButton, makeSlider, Button, Slider } from '../view/widgets';
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
  private modeBtns: Record<GameMode, Button> = {} as any;
  private playerBtns: Record<number, Button> = {};
  private diffBtns: Record<Difficulty, Button> = {} as any;
  private betSlider!: Slider;
  private betText!: Phaser.GameObjects.Text;
  private balanceText!: Phaser.GameObjects.Text;
  private bonusBtn!: Button;

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
    // Browsers need a gesture to start audio.
    this.input.once('pointerdown', () => audio.unlock());
  }

  shutdown(): void {
    this.scale.off('resize', this.layout, this);
  }

  private build(): void {
    this.root.removeAll(true);
    const c = this.root;

    const title = this.add
      .text(0, 0, 'OPEN MINDI', {
        fontFamily: 'Georgia, serif',
        fontSize: '64px',
        color: '#ffd24a',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(0, 0, 'Collect the tens • Play vs bots', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#cfe9dd'
      })
      .setOrigin(0.5);
    c.add([title, subtitle]);
    title.setName('title');
    subtitle.setName('subtitle');

    // Mode
    const modeLabel = this.label('Game Mode');
    this.modeBtns.mindi = makeButton(this, 0, 0, 'Open Mindi', () => this.setMode('mindi'), {
      w: 200,
      active: this.settings.mode === 'mindi'
    });
    this.modeBtns.double = makeButton(this, 0, 0, 'Double Mindi', () => this.setMode('double'), {
      w: 200,
      active: this.settings.mode === 'double'
    });
    c.add([modeLabel, this.modeBtns.mindi, this.modeBtns.double]);
    modeLabel.setName('modeLabel');

    // Players
    const playersLabel = this.label('Players');
    for (let n = 2; n <= 6; n++) {
      const b = makeButton(this, 0, 0, this.playersText(n as PlayerCount), () => this.setPlayers(n as PlayerCount), {
        w: 120,
        active: this.settings.players === n
      });
      this.playerBtns[n] = b;
      c.add(b);
    }
    c.add(playersLabel);
    playersLabel.setName('playersLabel');

    // Difficulty
    const diffLabel = this.label('Bot Difficulty');
    this.diffBtns.learner = makeButton(this, 0, 0, 'Learner', () => this.setDiff('learner'), {
      w: 200,
      active: this.settings.difficulty === 'learner'
    });
    this.diffBtns.expert = makeButton(this, 0, 0, 'Expert', () => this.setDiff('expert'), {
      w: 200,
      active: this.settings.difficulty === 'expert'
    });
    c.add([diffLabel, this.diffBtns.learner, this.diffBtns.expert]);
    diffLabel.setName('diffLabel');

    // Wallet bar + daily bonus
    this.balanceText = this.add
      .text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffd24a', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setName('balance');
    this.bonusBtn = makeButton(this, 0, 0, '', () => this.claimBonus(), { w: 220, h: 44 });
    this.bonusBtn.setName('bonus');
    c.add([this.balanceText, this.bonusBtn]);
    this.refreshWallet();

    // Bet selector (slider)
    const betLabel = this.label('Bet (drag to change)');
    betLabel.setName('betLabel');
    this.betText = this.add
      .text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontSize: '24px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setName('betText');
    this.betSlider = makeSlider(this, 0, 0, 320, minBet(this.wallet.balance), this.wallet.balance, this.bet, (v) => this.setBet(v));
    this.betSlider.setName('betSlider');
    c.add([betLabel, this.betText, this.betSlider]);
    this.updateBetText();

    const play = makeButton(this, 0, 0, '▶  PLAY', () => this.startGame(), { w: 280, h: 70, fill: 0x2bb673, active: true });
    play.setName('play');
    const settings = makeButton(this, 0, 0, '⚙  Skins & Audio', () => this.scene.start('Settings'), { w: 280, h: 50 });
    settings.setName('settings');
    c.add([play, settings]);
  }

  private setBet(v: number): void {
    this.bet = clampBet(v, this.wallet.balance);
    this.updateBetText();
  }
  private updateBetText(): void {
    this.betText.setText(`💰 ${this.bet.toLocaleString()}`);
  }
  private refreshWallet(): void {
    this.balanceText.setText(`Balance: ${this.wallet.balance.toLocaleString()} coins`);
    if (bonusAvailable(this.wallet)) {
      this.bonusBtn.setLabel(`🎁 Claim +${bonusAmount(this.wallet).toLocaleString()}`);
      this.bonusBtn.setActive2(true);
    } else {
      this.bonusBtn.setLabel('🎁 Bonus claimed today');
      this.bonusBtn.setActive2(false);
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
      .text(0, 0, s, { fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#9fd4bf' })
      .setOrigin(0.5);
  }

  private playersText(n: PlayerCount): string {
    const team = n === 4 || n === 6;
    return team ? `${n} (teams)` : `${n}`;
  }

  private setMode(m: GameMode): void {
    this.settings.mode = m;
    saveSettings(this.settings);
    this.modeBtns.mindi.setActive2(m === 'mindi');
    this.modeBtns.double.setActive2(m === 'double');
  }
  private setPlayers(n: PlayerCount): void {
    this.settings.players = n;
    saveSettings(this.settings);
    for (let i = 2; i <= 6; i++) this.playerBtns[i].setActive2(i === n);
  }
  private setDiff(d: Difficulty): void {
    this.settings.difficulty = d;
    saveSettings(this.settings);
    this.diffBtns.learner.setActive2(d === 'learner');
    this.diffBtns.expert.setActive2(d === 'expert');
  }

  private startGame(): void {
    audio.unlock();
    this.scene.start('Game', { ...this.settings, bet: clampBet(this.bet, this.wallet.balance) });
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    drawTableBackground(this, this.bg, tableSkin(this.settings.table), w, h);

    const cx = w / 2;
    const portrait = h >= w;
    const find = (n: string) => this.root.getByName(n) as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;

    // Wallet bar pinned to the top-right / top.
    (find('balance') as any).setPosition(cx, h * 0.035);
    (find('bonus') as any).setPosition(cx, h * 0.035 + 30);

    let y = h * (portrait ? 0.13 : 0.12);
    (find('title') as any).setPosition(cx, y);
    y += portrait ? 52 : 46;
    (find('subtitle') as any).setPosition(cx, y);

    y += portrait ? 52 : 42;
    (find('modeLabel') as any).setPosition(cx, y);
    y += 34;
    this.modeBtns.mindi.setPosition(cx - 110, y);
    this.modeBtns.double.setPosition(cx + 110, y);

    y += portrait ? 64 : 54;
    (find('playersLabel') as any).setPosition(cx, y);
    y += 34;
    const startX = cx - 2 * 128;
    for (let n = 2; n <= 6; n++) this.playerBtns[n].setPosition(startX + (n - 2) * 128, y);

    y += portrait ? 58 : 50;
    (find('diffLabel') as any).setPosition(cx, y);
    y += 34;
    this.diffBtns.learner.setPosition(cx - 110, y);
    this.diffBtns.expert.setPosition(cx + 110, y);

    y += portrait ? 56 : 48;
    (find('betLabel') as any).setPosition(cx - 90, y);
    (find('betText') as any).setPosition(cx + 130, y);
    y += 30;
    (find('betSlider') as any).setPosition(cx, y);

    y += portrait ? 60 : 50;
    (find('play') as any).setPosition(cx, y);
    y += 60;
    (find('settings') as any).setPosition(cx, y);
  }
}

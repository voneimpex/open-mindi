import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { AppSettings } from '../settings/Settings';
import { cardBack, tableSkin } from '../skins/skins';
import { drawTableBackground, makeButton } from '../view/widgets';
import { CardView, CARD_H, CARD_W } from '../view/CardView';
import { computeSeats, SeatSlot } from '../view/TableLayout';
import {
  Card,
  GameEngine,
  Move,
  PlayableCard,
  SUIT_SYMBOL,
  SUIT_NAME,
  countMindis,
  isMindi
} from '../../engine';
import { Bot, createBot } from '../../ai';
import { applyDelta, loadWallet, recommendedBet, saveWallet, settleGame } from '../economy/Wallet';

const TEAM_COLORS = ['#ffd24a', '#7fd0ff'];

export type GameSceneData = AppSettings & { bet?: number };

export class GameScene extends Phaser.Scene {
  private settings!: AppSettings;
  private engine!: GameEngine;
  private bots: (Bot | null)[] = [];
  private seats: SeatSlot[] = [];

  private bg!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;

  // view registries
  private pileTops: (CardView | null)[][] = [];
  private pileBadges: Phaser.GameObjects.Text[][] = [];
  private pileStacks: Phaser.GameObjects.Graphics[][] = [];
  private handViews: CardView[] = []; // human hand
  private trickViews = new Map<number, CardView>();
  private hud: {
    name: Phaser.GameObjects.Text;
    stats: Phaser.GameObjects.Text;
    turn: Phaser.GameObjects.Graphics;
  }[] = [];
  private trumpText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private cardScale = 0.7;
  private busy = false;
  private bet = 0;

  constructor() {
    super('Game');
  }

  init(data: GameSceneData): void {
    this.settings = data;
    const wallet = loadWallet();
    this.bet = Math.min(data.bet ?? recommendedBet(wallet.balance), wallet.balance);
  }

  create(): void {
    this.bg = this.add.graphics();
    this.overlay = this.add.graphics().setDepth(900);

    this.startRound();

    this.trumpText = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(50);
    this.statusText = this.add.text(0, 0, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#e9f5ef'
    }).setOrigin(0.5).setDepth(50);

    const menuBtn = makeButton(this, 0, 0, '‹ Menu', () => this.scene.start('Home'), { w: 120, h: 40 });
    menuBtn.setDepth(60).setName('menu');

    this.scale.on('resize', this.layout, this);
    this.layout();

    audio.playMusic('game');
    audio.unlock();
    this.time.delayedCall(500, () => this.nextTurn());
  }

  shutdown(): void {
    this.scale.off('resize', this.layout, this);
  }

  // ---- round setup -------------------------------------------------------

  private startRound(): void {
    const { mode, players, difficulty } = this.settings;
    this.engine = new GameEngine({ mode, players });
    this.bots = this.engine.state.playerList.map((p) =>
      p.isHuman ? null : createBot(difficulty, this.engine.config)
    );

    // build view registries
    this.pileTops = [];
    this.pileBadges = [];
    this.pileStacks = [];
    this.handViews = [];
    this.hud = [];
    this.trickViews.clear();

    const back = cardBack(this.settings.cardBack);

    for (const player of this.engine.state.playerList) {
      const seat = player.seat;
      this.pileTops[seat] = [];
      this.pileBadges[seat] = [];
      this.pileStacks[seat] = [];

      player.piles.forEach((pile, pi) => {
        const stack = this.add.graphics();
        this.pileStacks[seat][pi] = stack;
        const topCard = pile.cards[pile.cards.length - 1] ?? null;
        const view = topCard ? new CardView(this, topCard, back).setFaceUp(true) : null;
        this.pileTops[seat][pi] = view;
        const badge = this.add
          .text(0, 0, '', { fontFamily: 'system-ui', fontSize: '16px', color: '#ffffff', backgroundColor: '#00000088' })
          .setOrigin(0.5)
          .setPadding(4, 2, 4, 2);
        this.pileBadges[seat][pi] = badge;
      });

      // hands
      if (player.isHuman) {
        this.handViews = player.hand.map((c) => new CardView(this, c, back).setFaceUp(true));
      }

      // HUD
      const teamColor = this.engine.state.teams ? TEAM_COLORS[player.team] : '#ffffff';
      const name = this.add.text(0, 0, player.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        color: teamColor,
        fontStyle: 'bold'
      }).setOrigin(0.5);
      name.setData('baseColor', teamColor);
      const stats = this.add.text(0, 0, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#dceee6'
      }).setOrigin(0.5);
      const turn = this.add.graphics();
      this.hud[seat] = { name, stats, turn };
    }
    this.updateHud();
  }

  // ---- layout ------------------------------------------------------------

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    drawTableBackground(this, this.bg, tableSkin(this.settings.table), w, h);

    const players = this.engine.state.players;
    this.seats = computeSeats(w, h, players);

    // Scale so the bots' pile rows fit across the top arc.
    const k = Math.max(1, players - 1);
    const lay = this.engine.state.layout;
    const scaleW = (w * 0.96) / (k * lay.piles * CARD_W * 1.18);
    const cs = Phaser.Math.Clamp(Math.min(scaleW, 0.72), 0.3, 0.72);
    this.cardScale = cs;
    const cw = CARD_W * cs;
    const ch = CARD_H * cs;

    const cx = w / 2;

    const headFont = Phaser.Math.Clamp(Math.round(w / 24), 15, 26);
    const statFont = Phaser.Math.Clamp(Math.round(w / 36), 12, 18);
    let headerBottom = 56;
    if (this.trumpText) {
      const tr = this.engine.state.trump;
      this.trumpText
        .setFontSize(headFont)
        .setText(`Trump  ${SUIT_SYMBOL[tr]} ${SUIT_NAME[tr]}`)
        .setOrigin(0.5, 0)
        .setPosition(cx, 6)
        .setDepth(60);
      this.trumpText.setColor(tr === 'H' || tr === 'D' ? '#ff8a8a' : '#ffffff');
      this.statusText.setFontSize(statFont).setOrigin(0.5, 0).setPosition(cx, 8 + headFont + 2).setDepth(60);
      headerBottom = 8 + headFont + 2 + statFont + 8;
    }
    (this.children.getByName('menu') as Phaser.GameObjects.Container)?.setPosition(64, 26);

    const back = cardBack(this.settings.cardBack);
    const pileGap = cw + Math.max(4, 6 * cs);

    for (let seat = 0; seat < players; seat++) {
      const slot = this.seats[seat];
      const isHuman = seat === 0;
      const piles = this.pileTops[seat];
      const rowW = (piles.length - 1) * pileGap;

      let pileCX = slot.x;
      let pileCY = slot.y;

      if (isHuman) {
        const handY = h - ch * 0.6 - 8;
        pileCY = handY - ch - 14; // piles sit just above the hand
        pileCX = cx;
        const n = Math.max(1, this.handViews.length);
        const hgap = Math.min(cw * 0.94, (w * 0.94) / n);
        const totalW = (this.handViews.length - 1) * hgap;
        this.handViews.forEach((v, i) =>
          v.setScale(cs).setPosition(cx - totalW / 2 + i * hgap, handY).setDepth(30 + i)
        );
      }

      // Keep the pile row on screen and below the header (label sits above it).
      pileCX = Phaser.Math.Clamp(pileCX, rowW / 2 + cw / 2 + 4, w - rowW / 2 - cw / 2 - 4);
      const minPileCY = headerBottom + 38 + ch / 2; // room for the 2-line label
      pileCY = Phaser.Math.Clamp(pileCY, minPileCY, h - ch / 2 - 4);

      piles.forEach((view, pi) => {
        const px = pileCX - rowW / 2 + pi * pileGap;
        const py = pileCY;
        const depth = this.engine.pileDepth(seat, pi);
        const stack = this.pileStacks[seat][pi];
        stack.clear();
        for (let d = Math.min(depth, 3); d > 0; d--) {
          stack.fillStyle(back.color, 0.9);
          stack.lineStyle(1, 0x000000, 0.3);
          const ox = px + d * 1.5;
          const oy = py - d * 1.5;
          stack.fillRoundedRect(ox - cw / 2, oy - ch / 2, cw, ch, 6);
          stack.strokeRoundedRect(ox - cw / 2, oy - ch / 2, cw, ch, 6);
        }
        if (view) view.setScale(cs).setPosition(px, py).setDepth(10);
        const badge = this.pileBadges[seat][pi];
        if (depth > 0) {
          badge.setText(`${depth}`).setPosition(px - cw / 2 + 3, py - ch / 2 + 3).setVisible(true).setDepth(22);
        } else {
          badge.setVisible(false);
        }
      });

      // HUD: human in the bottom-left corner, bots above their pile row.
      const hud = this.hud[seat];
      if (isHuman) {
        hud.name.setOrigin(0, 0.5).setPosition(14, h - 44).setDepth(40);
        hud.stats.setOrigin(0, 0.5).setPosition(14, h - 24).setDepth(40);
      } else {
        hud.name.setOrigin(0.5, 0.5).setPosition(slot.x, pileCY - ch / 2 - 22).setDepth(40);
        hud.stats.setOrigin(0.5, 0.5).setPosition(slot.x, pileCY - ch / 2 - 6).setDepth(40);
      }
    }

    // Trick cards cluster around the center.
    for (const [uid, view] of this.trickViews) {
      const seat = this.findTrickSeat(uid);
      if (seat != null) {
        const slot = this.seats[seat];
        view.setScale(cs).setPosition(slot.trickX, slot.trickY).setDepth(100);
      }
    }
    this.updateHud();
  }

  private findTrickSeat(uid: number): number | null {
    for (const p of this.engine.state.trick.plays) if (p.card.uid === uid) return p.seat;
    return null;
  }

  // ---- HUD ---------------------------------------------------------------

  private updateHud(): void {
    if (!this.hud.length) return;
    const st = this.engine.state;
    for (const player of st.playerList) {
      const mindis = countMindis(player.captured);
      const tricks = st.tricksWon[player.seat];
      const isTurn = st.turnSeat === player.seat && st.phase === 'playing';
      const hud = this.hud[player.seat];
      const hand = player.hand.length;
      hud.stats.setText(`✋${hand}  🏆${tricks}  ⑩${mindis}`);
      // Highlight whose turn it is by brightening the name.
      hud.name.setColor(isTurn ? '#ffe066' : hud.name.getData('baseColor'));
      hud.turn.clear();
    }
    if (this.statusText) {
      const turnName = st.playerList[st.turnSeat]?.name ?? '';
      this.statusText.setText(st.phase === 'playing' ? `${turnName} to play` : '');
    }
  }

  // ---- turn loop ---------------------------------------------------------

  private nextTurn(): void {
    if (this.engine.state.phase !== 'playing') {
      if (this.engine.state.phase === 'round-over') this.showRoundOver();
      return;
    }
    if (this.busy) return; // a move or animation is already in flight
    this.updateHud();
    if (this.engine.isHumansTurn()) {
      this.enableHumanInput();
    } else {
      const seat = this.engine.state.turnSeat;
      const bot = this.bots[seat]!;
      this.disableHumanInput();
      // Lock during the bot's "thinking" pause so nothing schedules a second
      // move for this seat; re-verify the turn when the timer fires.
      this.busy = true;
      this.time.delayedCall(550, () => {
        this.busy = false;
        if (this.engine.state.phase === 'playing' && this.engine.state.turnSeat === seat) {
          this.applyMove(bot.chooseMove(this.engine.state, seat));
        }
      });
    }
  }

  private enableHumanInput(): void {
    const legal = this.engine.legalMoves(0);
    const legalUids = new Set(legal.map((m) => m.card.uid));
    const bySource = new Map<number, PlayableCard>();
    for (const m of legal) bySource.set(m.card.uid, m);

    // hand cards
    for (const v of this.handViews) {
      const ok = v.card && legalUids.has(v.card.uid);
      v.setHighlight(!!ok);
      v.disableInteractive();
      if (ok) {
        v.setInteractive(new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H), Phaser.Geom.Rectangle.Contains);
        v.once('pointerdown', () => this.humanPlay(bySource.get(v.card!.uid)!));
      }
    }
    // pile tops (seat 0)
    this.pileTops[0].forEach((v) => {
      if (!v || !v.card) return;
      const ok = legalUids.has(v.card.uid);
      v.setHighlight(ok);
      v.disableInteractive();
      if (ok) {
        v.setInteractive(new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H), Phaser.Geom.Rectangle.Contains);
        v.once('pointerdown', () => this.humanPlay(bySource.get(v.card!.uid)!));
      }
    });
  }

  private disableHumanInput(): void {
    for (const v of this.handViews) {
      v.setHighlight(false);
      v.disableInteractive();
    }
    this.pileTops[0].forEach((v) => {
      if (v) {
        v.setHighlight(false);
        v.disableInteractive();
      }
    });
  }

  private humanPlay(pc: PlayableCard): void {
    if (this.busy) return;
    const move: Move =
      pc.source.type === 'hand'
        ? { seat: 0, source: { type: 'hand' }, handIndex: pc.source.handIndex, card: pc.card }
        : { seat: 0, source: { type: 'pile', pileIndex: pc.source.pileIndex }, card: pc.card };
    this.disableHumanInput();
    this.applyMove(move);
  }

  // ---- applying a move with animation ------------------------------------

  private applyMove(move: Move): void {
    // Ignore stale / out-of-turn moves (e.g. a late timer or double tap) so a
    // rejected play can never throw and leave the table soft-locked.
    if (this.engine.state.phase !== 'playing' || move.seat !== this.engine.state.turnSeat) {
      return;
    }
    this.busy = true;
    const seat = move.seat;
    const slot = this.seats[seat];

    // Resolve the moving CardView (before engine mutates piles/hands).
    let view: CardView;
    if (move.source.type === 'pile') {
      view = this.pileTops[seat][move.source.pileIndex]!;
      this.pileTops[seat][move.source.pileIndex] = null; // detach; reveal handled below
    } else if (seat === 0) {
      const idx = this.handViews.findIndex((v) => v.card?.uid === move.card.uid);
      view = this.handViews.splice(idx, 1)[0];
    } else {
      // bot hand card: spawn a face-down card at the bot's hand position
      view = new CardView(this, move.card, cardBack(this.settings.cardBack)).setFaceUp(false);
      view.setScale(this.cardScale * 0.62).setPosition(slot.x, slot.y);
    }

    const result = this.engine.play(move);
    view.setHighlight(false).disableInteractive().setDepth(100);
    this.trickViews.set(move.card.uid, view);
    audio.playCard();

    // animate to trick slot, flipping bot cards face up
    this.tweens.add({
      targets: view,
      x: slot.trickX,
      y: slot.trickY,
      scale: this.cardScale,
      duration: 260,
      ease: 'Cubic.easeOut'
    });
    view.setFaceUp(true);

    // reveal newly exposed pile card
    if (move.source.type === 'pile') {
      this.revealPile(seat, move.source.pileIndex, result.revealed);
    } else if (seat === 0) {
      this.layout(); // reflow the human hand after a card leaves it
    }
    this.updateHud();

    if (result.trickComplete) {
      this.time.delayedCall(700, () => this.resolveTrick(result.trickWinnerSeat!, result.roundOver));
    } else {
      this.busy = false;
      this.time.delayedCall(250, () => this.nextTurn());
    }
  }

  private revealPile(seat: number, pi: number, card: Card | null): void {
    const back = cardBack(this.settings.cardBack);
    if (card) {
      const v = new CardView(this, card, back).setFaceUp(true).setScale(this.cardScale);
      this.pileTops[seat][pi] = v;
    } else {
      this.pileTops[seat][pi] = null;
    }
    this.layout();
  }

  private resolveTrick(winnerSeat: number, roundOver: boolean): void {
    const slot = this.seats[winnerSeat];
    const hadMindi = [...this.trickViews.values()].some((v) => v.card && isMindi(v.card));
    const cards = [...this.trickViews.values()];
    this.trickViews.clear();

    cards.forEach((v, i) => {
      this.tweens.add({
        targets: v,
        x: slot.x,
        y: slot.y,
        scale: this.cardScale * 0.4,
        alpha: 0.0,
        duration: 380,
        delay: i * 40,
        ease: 'Cubic.easeIn',
        onComplete: () => v.destroy()
      });
    });

    if (hadMindi) audio.captureMindi();
    else audio.winTrick();

    this.time.delayedCall(450, () => {
      this.updateHud();
      this.busy = false;
      if (roundOver) this.showRoundOver();
      else this.nextTurn();
    });
  }

  // ---- round over --------------------------------------------------------

  private showRoundOver(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const result = this.engine.score();
    this.overlay.clear();
    this.overlay.fillStyle(0x000000, 0.72);
    this.overlay.fillRect(0, 0, w, h);

    // Settle the bet into the prize fund and update the wallet.
    const settle = settleGame(result, this.bet, 0);
    let wallet = applyDelta(loadWallet(), settle.net);
    saveWallet(wallet);

    const cont = this.add.container(w / 2, h / 2).setDepth(950);
    const sideName = (id: number): string => {
      const side = result.sides.find((s) => s.id === id)!;
      const names = side.seats.map((s) => this.engine.state.playerList[s].name).join(' & ');
      return result.byTeam ? `Team ${id + 1} (${names})` : names;
    };

    const lines: string[] = [];
    for (const s of result.sides) {
      const bonus = s.trickBonus ? ' +1 hands' : '';
      lines.push(`${sideName(s.id)} — ${s.points} pts  (${s.mindis} tens${bonus}, ${s.tricks} tricks)`);
    }
    lines.push('');
    const winNames = result.winners.map(sideName).join(', ');
    if (result.whitewash) lines.push(`🏆 ${winNames} swept all the tens!`);
    else if (result.winners.length > 1) lines.push(`🤝 Tie — prize split: ${winNames}`);
    else lines.push(`🏆 Winner: ${winNames}`);

    const title = this.add.text(0, -h * 0.26, 'Round Over', {
      fontFamily: 'Georgia, serif', fontSize: '42px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5);
    const body = this.add.text(0, -h * 0.08, lines.join('\n'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ffffff', align: 'center', lineSpacing: 8
    }).setOrigin(0.5);
    cont.add([title, body]);

    // Coins outcome
    const fmt = (n: number) => n.toLocaleString();
    const outcome = settle.won
      ? `${settle.shared ? 'Shared win' : 'You won'}  +${fmt(settle.payout - this.bet)} coins`
      : `You lost  −${fmt(this.bet)} coins`;
    const coinLine = `Bet ${fmt(this.bet)} • Prize fund ${fmt(settle.pot)}`;
    const coins = this.add.text(0, h * 0.16, `${coinLine}\n${outcome}\n💰 Balance: ${fmt(wallet.balance)}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '22px',
      color: settle.won ? '#9cf2cf' : '#ff9a9a',
      align: 'center',
      lineSpacing: 6,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    cont.add(coins);

    const again = makeButton(this, -130, h * 0.34, 'Play Again', () => {
      cont.destroy();
      this.overlay.clear();
      const bet = Math.min(this.bet, loadWallet().balance);
      this.scene.restart({ ...this.settings, bet });
    }, { w: 220, h: 60, active: true });
    const menu = makeButton(this, 130, h * 0.34, 'Main Menu', () => this.scene.start('Home'), { w: 220, h: 60 });
    cont.add([again, menu]);
  }
}

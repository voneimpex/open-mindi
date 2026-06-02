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

const TEAM_COLORS = ['#ffd24a', '#7fd0ff'];

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
  private botHandGfx: Phaser.GameObjects.Container[] = [];
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

  constructor() {
    super('Game');
  }

  init(data: AppSettings): void {
    this.settings = data;
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
    this.botHandGfx = [];
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
        this.handViews = player.hand.map((c) => {
          const v = new CardView(this, c, back).setFaceUp(true);
          return v;
        });
      } else {
        const cont = this.add.container(0, 0);
        this.botHandGfx[seat] = cont;
      }

      // HUD
      const teamColor = this.engine.state.teams ? TEAM_COLORS[player.team] : '#ffffff';
      const name = this.add.text(0, 0, player.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: teamColor,
        fontStyle: 'bold'
      }).setOrigin(0.5);
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

    this.cardScale = Phaser.Math.Clamp(Math.min(w, h) / (players <= 3 ? 820 : 1080), 0.4, 0.85);
    const cs = this.cardScale;
    const cw = CARD_W * cs;

    const cx = w / 2;
    const cy = h / 2;

    if (this.trumpText) {
      const tr = this.engine.state.trump;
      this.trumpText.setText(`Trump: ${SUIT_SYMBOL[tr]} ${SUIT_NAME[tr]}`).setPosition(cx, cy - 18);
      this.trumpText.setColor(tr === 'H' || tr === 'D' ? '#ff8a8a' : '#ffffff');
      this.statusText.setPosition(cx, cy + 14);
    }
    (this.children.getByName('menu') as Phaser.GameObjects.Container)?.setPosition(70, 30);

    for (let seat = 0; seat < players; seat++) {
      const slot = this.seats[seat];
      const topHalf = slot.y < cy;
      const isHuman = seat === 0;
      const handScale = isHuman ? cs * 1.05 : cs * 0.62;

      // piles row centered at slot, nudged toward center
      const nx = (cx - slot.x);
      const ny = (cy - slot.y);
      const nlen = Math.hypot(nx, ny) || 1;
      const inward = { x: nx / nlen, y: ny / nlen };

      const piles = this.pileTops[seat];
      const pileGap = cw + 8 * cs;
      const rowW = (piles.length - 1) * pileGap;
      const pileCY = slot.y + inward.y * (CARD_H * cs * 0.35);
      const pileCX = slot.x + inward.x * (CARD_H * cs * 0.15);

      piles.forEach((view, pi) => {
        const px = pileCX - rowW / 2 + pi * pileGap;
        const py = pileCY;
        const stack = this.pileStacks[seat][pi];
        const depth = this.engine.pileDepth(seat, pi);
        stack.clear();
        // draw faint stacked backs to convey depth
        const back = cardBack(this.settings.cardBack);
        for (let d = Math.min(depth, 4); d > 0; d--) {
          stack.fillStyle(back.color, 0.85);
          stack.lineStyle(1, 0x000000, 0.3);
          const ox = px + d * 2;
          const oy = py - d * 2;
          stack.fillRoundedRect(ox - cw / 2, oy - (CARD_H * cs) / 2, cw, CARD_H * cs, 8);
          stack.strokeRoundedRect(ox - cw / 2, oy - (CARD_H * cs) / 2, cw, CARD_H * cs, 8);
        }
        if (view) view.setScale(cs).setPosition(px, py).setDepth(10);
        const badge = this.pileBadges[seat][pi];
        if (depth > 0) {
          badge.setText(`${depth}`).setPosition(px - cw / 2 + 2, py - (CARD_H * cs) / 2 + 2).setVisible(true).setDepth(20);
        } else {
          badge.setVisible(false);
        }
      });

      // hand
      if (isHuman) {
        const n = this.handViews.length;
        const hw = CARD_W * handScale;
        const gap = Math.min(hw + 6, (w * 0.92) / Math.max(1, n));
        const totalW = (n - 1) * gap;
        const hy = h - (CARD_H * handScale) / 2 - 12;
        this.handViews.forEach((v, i) => {
          v.setScale(handScale).setPosition(cx - totalW / 2 + i * gap, hy).setDepth(30);
        });
      } else {
        this.layoutBotHand(seat, slot, topHalf, handScale);
      }

      // HUD text near the seat (outside the piles)
      const hud = this.hud[seat];
      const labelY = slot.y - inward.y * (CARD_H * cs * 0.55) - 14;
      const labelX = slot.x - inward.x * (CARD_H * cs * 0.2);
      hud.name.setPosition(labelX, labelY).setDepth(40);
      hud.stats.setPosition(labelX, labelY + 18).setDepth(40);
    }

    // reposition any trick cards
    for (const [uid, view] of this.trickViews) {
      const seat = this.findTrickSeat(uid);
      if (seat != null) {
        const slot = this.seats[seat];
        view.setScale(cs).setPosition(slot.trickX, slot.trickY);
      }
    }
    this.updateHud();
  }

  private layoutBotHand(seat: number, slot: SeatSlot, _topHalf: boolean, handScale: number): void {
    const cont = this.botHandGfx[seat];
    if (!cont) return;
    cont.removeAll(true);
    const count = this.engine.state.playerList[seat].hand.length;
    const back = cardBack(this.settings.cardBack);
    const cw = CARD_W * handScale;
    const fan = Math.min(count, 6);
    const gap = 10;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const dirx = Math.sign(cx - slot.x) || 0;
    void dirx;
    const baseX = slot.x;
    const baseY = slot.y + (slot.y < cy ? -(CARD_H * handScale) / 2 - 18 : (CARD_H * handScale) / 2 + 18);
    for (let i = 0; i < fan; i++) {
      const g = this.add.graphics();
      const ox = baseX - ((fan - 1) * gap) / 2 + i * gap;
      g.fillStyle(back.color, 1);
      g.lineStyle(1, back.accent, 0.8);
      g.fillRoundedRect(ox - cw / 2, baseY - (CARD_H * handScale) / 2, cw, CARD_H * handScale, 6);
      g.strokeRoundedRect(ox - cw / 2, baseY - (CARD_H * handScale) / 2, cw, CARD_H * handScale, 6);
      cont.add(g);
    }
    const label = this.add.text(baseX, baseY, `${count}`, {
      fontFamily: 'system-ui', fontSize: '14px', color: '#ffffff', backgroundColor: '#00000088'
    }).setOrigin(0.5).setPadding(3, 1, 3, 1);
    cont.add(label);
    cont.setDepth(25);
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
      hud.stats.setText(`🂡${tricks}  •  ⑩×${mindis}`);
      hud.turn.clear();
      if (isTurn) {
        hud.turn.fillStyle(0xffe066, 0.9);
        hud.turn.fillCircle(hud.name.x - hud.name.width / 2 - 12, hud.name.y, 5);
      }
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
    this.updateHud();
    if (this.engine.isHumansTurn()) {
      this.enableHumanInput();
    } else {
      const seat = this.engine.state.turnSeat;
      const bot = this.bots[seat]!;
      this.disableHumanInput();
      this.time.delayedCall(550, () => {
        const move = bot.chooseMove(this.engine.state, seat);
        this.applyMove(move);
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
    } else if (seat !== 0) {
      this.layoutBotHand(seat, slot, slot.y < this.scale.height / 2, this.cardScale * 0.62);
    } else {
      this.layout(); // reflow human hand
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

    const cont = this.add.container(w / 2, h / 2).setDepth(950);
    const lines: string[] = [];
    if (result.byTeam) {
      for (const t of result.perTeam) {
        const seats = t.seats.map((s) => this.engine.state.playerList[s].name).join(' & ');
        lines.push(`Team ${t.team + 1} (${seats}):  ${t.mindis} tens, ${t.tricks} tricks`);
      }
      const winNames = result.winners
        .map((tid) => `Team ${tid + 1}`)
        .join(', ');
      lines.push('');
      lines.push(result.whitewash ? `🏆 ${winNames} sweep all the tens!` : `🏆 Winner: ${winNames}`);
    } else {
      for (const s of result.perSeat) {
        lines.push(`${this.engine.state.playerList[s.seat].name}:  ${s.mindis} tens, ${s.tricks} tricks`);
      }
      const winNames = result.winners.map((sid) => this.engine.state.playerList[sid].name).join(', ');
      lines.push('');
      lines.push(result.whitewash ? `🏆 ${winNames} swept all the tens!` : `🏆 Winner: ${winNames}`);
    }

    const title = this.add.text(0, -h * 0.22, 'Round Over', {
      fontFamily: 'Georgia, serif', fontSize: '44px', color: '#ffd24a', fontStyle: 'bold'
    }).setOrigin(0.5);
    const body = this.add.text(0, -h * 0.05, lines.join('\n'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffffff', align: 'center', lineSpacing: 8
    }).setOrigin(0.5);
    cont.add([title, body]);

    const again = makeButton(this, -130, h * 0.28, 'Play Again', () => {
      cont.destroy();
      this.overlay.clear();
      this.scene.restart(this.settings);
    }, { w: 220, h: 60, active: true });
    const menu = makeButton(this, 130, h * 0.28, 'Main Menu', () => this.scene.start('Home'), { w: 220, h: 60 });
    cont.add([again, menu]);
  }
}

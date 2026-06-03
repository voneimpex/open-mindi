import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { AppSettings } from '../settings/Settings';
import { cardBack, tableSkin } from '../skins/skins';
import { CardView, CARD_H, CARD_W } from '../view/CardView';
import { computeSeats, SeatSlot } from '../view/TableLayout';
import { avatarDisc, coverBackground, drawPanel, fancyButton, FancyButton, goldText, THEME } from '../view/theme';
import { ART } from './BootScene';
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
  __bgImg?: Phaser.GameObjects.Image;
  private felt!: Phaser.GameObjects.Graphics;
  private headerPill!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;

  // view registries
  private pileTops: (CardView | null)[][] = [];
  private pileBadges: Phaser.GameObjects.Text[][] = [];
  private pileStacks: Phaser.GameObjects.Graphics[][] = [];
  private handViews: CardView[] = []; // human hand
  private legalViews: { view: CardView; pc: PlayableCard }[] = [];
  private trickViews = new Map<number, CardView>();
  private hud: {
    plate: Phaser.GameObjects.Graphics;
    avatar: Phaser.GameObjects.Container;
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
    this.felt = this.add.graphics();
    this.headerPill = this.add.graphics().setDepth(49);
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
      color: THEME.textDim
    }).setOrigin(0.5).setDepth(50);

    const menuBtn = fancyButton(this, 0, 0, '‹ Menu', () => this.scene.start('Home'), { w: 116, h: 40, variant: 'primary', size: 16 });
    menuBtn.setDepth(60).setName('menu');

    this.input.on('pointerdown', this.onPointerDown, this);
    this.scale.on('resize', this.layout, this);
    this.layout();

    audio.playMusic('game');
    audio.unlock();
    this.time.delayedCall(400, () => this.nextTurn());
  }

  shutdown(): void {
    this.input.off('pointerdown', this.onPointerDown, this);
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

      // HUD nameplate: avatar disc + name + stats on a small panel.
      const teamColor = this.engine.state.teams ? TEAM_COLORS[player.team] : (player.isHuman ? '#ffd24a' : '#7fd0ff');
      const ring = Phaser.Display.Color.HexStringToColor(teamColor).color;
      const plate = this.add.graphics();
      const initial = player.isHuman ? 'Y' : player.name.slice(-1);
      const avKey = player.isHuman ? ART.avatarYou : ART.avatarBot(seat);
      const avatar = avatarDisc(this, 0, 0, 16, initial, ring, avKey);
      const name = this.add.text(0, 0, player.name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: teamColor,
        fontStyle: 'bold'
      }).setOrigin(0, 0.5);
      name.setData('baseColor', teamColor);
      const stats = this.add.text(0, 0, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#dceee6'
      }).setOrigin(0, 0.5);
      const turn = this.add.graphics();
      this.hud[seat] = { plate, avatar, name, stats, turn };
    }
    this.updateHud();
  }

  /** Position a seat's nameplate (avatar + name + stats) centred at (x, y). */
  private layoutPlate(seat: number, x: number, y: number): void {
    const hud = this.hud[seat];
    const pw = 156;
    const ph = 40;
    hud.plate.clear();
    hud.plate.fillStyle(0x081024, 0.82);
    hud.plate.lineStyle(2, THEME.panelBorder, 0.7);
    hud.plate.fillRoundedRect(x - pw / 2, y - ph / 2, pw, ph, 12);
    hud.plate.strokeRoundedRect(x - pw / 2, y - ph / 2, pw, ph, 12);
    hud.plate.setDepth(38);
    hud.avatar.setPosition(x - pw / 2 + 22, y).setDepth(40);
    hud.name.setPosition(x - pw / 2 + 44, y - 9).setDepth(40);
    hud.stats.setPosition(x - pw / 2 + 44, y + 9).setDepth(40);
  }

  // ---- layout ------------------------------------------------------------

  /** Deep-blue surround + a felt oval table with a rail, using the table skin.
   *  A custom `table-bg` image (if provided) replaces the whole drawing. */
  private drawTable(w: number, h: number): void {
    if (coverBackground(this, this, this.bg, ART.tableBg, w, h)) {
      this.felt.clear();
      return;
    }
    const skin = tableSkin(this.settings.table);
    const g = this.felt;
    g.clear();
    const cx = w / 2;
    const cy = h * 0.5;
    const rx = Math.min(w * 0.47, 900);
    const ry = Math.min(h * 0.46, 560);
    // wooden / dark rail
    g.fillStyle(skin.rail, 1);
    g.fillEllipse(cx, cy, rx * 2 + 26, ry * 2 + 26);
    g.lineStyle(3, 0x000000, 0.35);
    g.strokeEllipse(cx, cy, rx * 2 + 26, ry * 2 + 26);
    // felt with a soft radial gradient (concentric ellipses)
    const steps = 14;
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(skin.feltEdge),
        Phaser.Display.Color.ValueToColor(skin.feltCenter),
        steps,
        i
      );
      g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
      g.fillEllipse(cx, cy, rx * 2 * t + rx * 0.12, ry * 2 * t + ry * 0.12);
    }
    // inner highlight ring
    g.lineStyle(2, 0xffffff, 0.08);
    g.strokeEllipse(cx, cy, rx * 1.7, ry * 1.7);
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.drawTable(w, h);

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

    const headFont = Phaser.Math.Clamp(Math.round(w / 26), 15, 24);
    const statFont = Phaser.Math.Clamp(Math.round(w / 40), 12, 17);
    let headerBottom = 56;
    if (this.trumpText) {
      const tr = this.engine.state.trump;
      this.trumpText
        .setFontSize(headFont)
        .setText(`TRUMP  ${SUIT_SYMBOL[tr]} ${SUIT_NAME[tr]}`)
        .setOrigin(0.5, 0)
        .setPosition(cx, 8)
        .setDepth(60);
      this.trumpText.setColor(tr === 'H' || tr === 'D' ? '#ff9a9a' : '#ffffff');
      this.statusText.setFontSize(statFont).setOrigin(0.5, 0).setPosition(cx, 10 + headFont + 2).setDepth(60);
      headerBottom = 10 + headFont + 2 + statFont + 10;
      // header pill behind the trump text
      const pw = Math.max(this.trumpText.width, this.statusText.width) + 44;
      this.headerPill.clear();
      this.headerPill.fillStyle(0x081024, 0.8);
      this.headerPill.lineStyle(2, THEME.panelBorder, 0.7);
      this.headerPill.fillRoundedRect(cx - pw / 2, 2, pw, headerBottom - 4, 14);
      this.headerPill.strokeRoundedRect(cx - pw / 2, 2, pw, headerBottom - 4, 14);
    }
    (this.children.getByName('menu') as FancyButton)?.setPosition(70, 28);

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
      const minPileCY = headerBottom + 60 + ch / 2; // room for the nameplate above the pile
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

      // Nameplate: human bottom-left, bots above their pile row.
      if (isHuman) this.layoutPlate(seat, 92, h - 30);
      else this.layoutPlate(seat, slot.x, pileCY - ch / 2 - 26);
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
      const hands = st.tricksWon[player.seat];
      const isTurn = st.turnSeat === player.seat && st.phase === 'playing';
      const hud = this.hud[player.seat];
      hud.stats.setText(`Mindi ${mindis}  ·  Hands ${hands}`);
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
      this.time.delayedCall(350, () => {
        this.busy = false;
        if (this.engine.state.phase === 'playing' && this.engine.state.turnSeat === seat) {
          this.applyMove(bot.chooseMove(this.engine.state, seat));
        }
      });
    }
  }

  private enableHumanInput(): void {
    const legal = this.engine.legalMoves(0);
    const byUid = new Map<number, PlayableCard>();
    for (const m of legal) byUid.set(m.card.uid, m);

    this.legalViews = [];
    for (const v of this.handViews) {
      const pc = v.card ? byUid.get(v.card.uid) : undefined;
      v.setHighlight(!!pc);
      if (pc) this.legalViews.push({ view: v, pc });
    }
    this.pileTops[0].forEach((v) => {
      if (!v || !v.card) return;
      const pc = byUid.get(v.card.uid);
      v.setHighlight(!!pc);
      if (pc) this.legalViews.push({ view: v, pc });
    });
  }

  private disableHumanInput(): void {
    this.legalViews = [];
    for (const v of this.handViews) v.setHighlight(false);
    this.pileTops[0].forEach((v) => v && v.setHighlight(false));
  }

  /**
   * Global pointer handler. We hit-test the currently-legal cards against the
   * pointer's world position using each card's on-screen bounds (which already
   * account for scale and position). This is far more robust than per-object
   * interactive hit areas, so the whole visible card is clickable — not just
   * its centre — and overlapping cards resolve to the top-most one.
   */
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.busy || this.engine.state.phase !== 'playing' || !this.engine.isHumansTurn()) return;
    if (!this.legalViews.length) return;
    const x = pointer.worldX;
    const y = pointer.worldY;
    const pad = 6; // a little slack so near-misses still register
    const hits = this.legalViews.filter(({ view }) => {
      const b = view.getBounds();
      return x >= b.x - pad && x <= b.right + pad && y >= b.y - pad && y <= b.bottom + pad;
    });
    if (!hits.length) return;
    hits.sort((a, b) => b.view.depth - a.view.depth); // top-most wins
    this.humanPlay(hits[0].pc);
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
      this.time.delayedCall(600, () => this.resolveTrick(result.trickWinnerSeat!, result.roundOver));
    } else {
      this.busy = false;
      this.time.delayedCall(150, () => this.nextTurn());
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

    this.time.delayedCall(380, () => {
      this.updateHud();
      this.busy = false;
      if (roundOver) this.showRoundOver();
      else this.nextTurn();
    });
  }

  // ---- round over --------------------------------------------------------

  /** Confetti rain + coins flying to the wallet on a win. */
  private celebrate(whitewash: boolean): void {
    audio.win();
    const w = this.scale.width;
    const h = this.scale.height;
    const colors = [0xffd24a, 0x2bb673, 0x3f86ff, 0xff6a6a, 0xffffff, 0x9b5cff];
    const n = whitewash ? 110 : 64;
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(0, w);
      const rect = this.add
        .rectangle(x, -20, Phaser.Math.Between(6, 12), Phaser.Math.Between(8, 16), colors[i % colors.length])
        .setDepth(980)
        .setAngle(Phaser.Math.Between(0, 360));
      this.tweens.add({
        targets: rect,
        y: h + 40,
        x: x + Phaser.Math.Between(-90, 90),
        angle: rect.angle + Phaser.Math.Between(180, 540),
        duration: Phaser.Math.Between(1500, 2800),
        delay: Phaser.Math.Between(0, 700),
        ease: 'Cubic.easeIn',
        onComplete: () => rect.destroy()
      });
    }
    // coins fly from the centre toward the wallet (top-right corner)
    for (let i = 0; i < 14; i++) {
      const coin = this.add.circle(w / 2, h * 0.5, 11, 0xffd24a).setStrokeStyle(2, 0xe8a200).setDepth(985);
      this.tweens.add({
        targets: coin,
        x: w - 170,
        y: 30,
        scale: 0.4,
        duration: Phaser.Math.Between(550, 950),
        delay: 350 + i * 60,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          coin.destroy();
          audio.coin();
        }
      });
    }
  }

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

    if (settle.won) this.celebrate(result.whitewash);
    else audio.lose();

    const cont = this.add.container(w / 2, h / 2).setDepth(950);
    const sideName = (id: number): string => {
      const side = result.sides.find((s) => s.id === id)!;
      const names = side.seats.map((s) => this.engine.state.playerList[s].name).join(' & ');
      return result.byTeam ? `Team ${id + 1} (${names})` : names;
    };

    const lines: string[] = [];
    for (const s of result.sides) {
      const bonus = s.trickBonus ? '  +1 most hands' : '';
      const pts = s.points === 1 ? '1 point' : `${s.points} points`;
      lines.push(`${sideName(s.id)} — ${pts}  (${s.mindis} mindi${bonus})`);
    }
    lines.push('');
    const winNames = result.winners.map(sideName).join(', ');
    if (result.whitewash) lines.push(`🏆 ${winNames} swept all the mindis!`);
    else if (result.winners.length > 1) lines.push(`🤝 Tie — prize split: ${winNames}`);
    else lines.push(`🏆 Winner: ${winNames}`);

    const panelW = Phaser.Math.Clamp(Math.min(w * 0.8, 760), 380, 760);
    const panelH = Phaser.Math.Clamp(Math.min(h * 0.86, 470), 300, 470);
    const pg = this.add.graphics();
    drawPanel(pg, panelW, panelH, { radius: 22, glow: true });
    cont.add(pg);

    const title = goldText(this, 0, -panelH / 2 + 40, 'ROUND OVER', 38);
    const body = this.add.text(0, -panelH * 0.08, lines.join('\n'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '19px', color: '#ffffff', align: 'center', lineSpacing: 7
    }).setOrigin(0.5);
    cont.add([title, body]);

    // Coins outcome
    const fmt = (n: number) => n.toLocaleString();
    const outcome = settle.won
      ? `${settle.shared ? 'Shared win' : 'You won'}  +${fmt(settle.payout - this.bet)}`
      : `You lost  −${fmt(this.bet)}`;
    const coins = this.add.text(0, panelH * 0.2, `Bet ${fmt(this.bet)}  ·  Prize fund ${fmt(settle.pot)}\n${outcome} coins   💰 ${fmt(wallet.balance)}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '19px',
      color: settle.won ? '#9cf2cf' : '#ff9a9a',
      align: 'center',
      lineSpacing: 5,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    cont.add(coins);

    const again = fancyButton(this, -120, panelH / 2 - 46, '▶ Play Again', () => {
      cont.destroy();
      this.overlay.clear();
      const bet = Math.min(this.bet, loadWallet().balance);
      this.scene.restart({ ...this.settings, bet });
    }, { w: 210, h: 58, variant: 'green', size: 20, selected: true });
    const menu = fancyButton(this, 120, panelH / 2 - 46, 'Main Menu', () => this.scene.start('Home'), {
      w: 210, h: 58, variant: 'primary', size: 20
    });
    cont.add([again, menu]);
  }
}

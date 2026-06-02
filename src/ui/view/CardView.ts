/** A single card rendered procedurally (no image assets required). */

import Phaser from 'phaser';
import { Card, RANK_LABEL, SUIT_IS_RED, SUIT_SYMBOL } from '../../engine';
import { CardBackSkin } from '../skins/skins';

export const CARD_W = 92;
export const CARD_H = 128;
const RADIUS = 12;

export class CardView extends Phaser.GameObjects.Container {
  card: Card | null;
  private gfx: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private faceUp = true;
  private back: CardBackSkin;
  private highlight = false;

  constructor(scene: Phaser.Scene, card: Card | null, back: CardBackSkin) {
    super(scene, 0, 0);
    this.card = card;
    this.back = back;
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    this.setSize(CARD_W, CARD_H);
    this.redraw();
    scene.add.existing(this);
  }

  setFaceUp(up: boolean): this {
    this.faceUp = up;
    this.redraw();
    return this;
  }

  setBackSkin(back: CardBackSkin): this {
    this.back = back;
    if (!this.faceUp) this.redraw();
    return this;
  }

  setHighlight(on: boolean): this {
    this.highlight = on;
    this.redraw();
    return this;
  }

  setCard(card: Card | null): this {
    this.card = card;
    this.redraw();
    return this;
  }

  private clearTexts(): void {
    for (const t of this.texts) t.destroy();
    this.texts = [];
  }

  private redraw(): void {
    const g = this.gfx;
    g.clear();
    this.clearTexts();
    const hw = CARD_W / 2;
    const hh = CARD_H / 2;

    if (this.faceUp && this.card) {
      g.fillStyle(0xffffff, 1);
      g.lineStyle(this.highlight ? 4 : 1.5, this.highlight ? 0xffe066 : 0xcccccc, 1);
      g.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, RADIUS);
      g.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, RADIUS);

      const red = SUIT_IS_RED[this.card.suit];
      const color = red ? '#c1121f' : '#1d1d1d';
      const rank = RANK_LABEL[this.card.rank];
      const sym = SUIT_SYMBOL[this.card.suit];
      const isMindi = this.card.rank === 10;

      this.addText(-hw + 10, -hh + 8, `${rank}\n${sym}`, color, 22, 0, 0);
      this.addText(hw - 10, hh - 8, `${rank}\n${sym}`, color, 22, 1, 1);
      this.addText(0, 0, sym, color, isMindi ? 52 : 46, 0.5, 0.5);

      if (isMindi) {
        // Mark the valuable card (mindi) with a small gold pip.
        g.fillStyle(0xffd24a, 1);
        g.fillCircle(hw - 16, -hh + 16, 7);
      }
    } else {
      // Card back from the chosen skin.
      g.fillStyle(this.back.color, 1);
      g.lineStyle(2, 0xffffff, 0.85);
      g.fillRoundedRect(-hw, -hh, CARD_W, CARD_H, RADIUS);
      g.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, RADIUS);
      g.lineStyle(2, this.back.accent, 0.9);
      g.strokeRoundedRect(-hw + 10, -hh + 10, CARD_W - 20, CARD_H - 20, RADIUS - 4);
      // simple diamond lattice
      g.lineStyle(1, this.back.accent, 0.5);
      for (let i = -hw + 10; i < hw - 10; i += 14) {
        g.lineBetween(i, -hh + 10, i + 24, hh - 10);
        g.lineBetween(i, hh - 10, i + 24, -hh + 10);
      }
      if (this.highlight) {
        g.lineStyle(4, 0xffe066, 1);
        g.strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, RADIUS);
      }
    }
  }

  private addText(
    x: number,
    y: number,
    s: string,
    color: string,
    size: number,
    ox: number,
    oy: number
  ): void {
    const t = this.scene.add
      .text(x, y, s, {
        fontFamily: 'Georgia, serif',
        fontSize: `${size}px`,
        color,
        align: 'center',
        lineSpacing: -6,
        fontStyle: 'bold'
      })
      .setOrigin(ox, oy);
    this.add(t);
    this.texts.push(t);
  }
}

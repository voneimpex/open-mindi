/**
 * Premium UI toolkit: dark-casino theme colours plus helpers for gradient
 * backgrounds, glossy panels, glowing buttons, gold title text, coin badges and
 * avatar discs. Everything is drawn procedurally so the game looks polished with
 * no art, while leaving obvious seams for real AI-generated images later
 * (swap a panel/background fill for an Image with the same bounds).
 */

import Phaser from 'phaser';

export const THEME = {
  bgTop: 0x0b1640,
  bgMid: 0x16306a,
  bgBottom: 0x070d24,
  glow: 0x2a5bd0,
  panelTop: 0x1c3c84,
  panelBottom: 0x0c1c46,
  panelBorder: 0x4f8bff,
  panelBevel: 0x8fc0ff,
  gold: '#ffd24a',
  goldTop: '#fff3bf',
  goldBot: '#e08a00',
  textDim: '#bcd0ff',
  primary: { top: 0x3f86ff, bottom: 0x0e3fae, border: 0x9cc4ff },
  green: { top: 0x5ce07a, bottom: 0x1c9a46, border: 0xb6f7c6 },
  gold2: { top: 0xffd874, bottom: 0xd98a00, border: 0xffe9a8 },
  danger: { top: 0xff6a6a, bottom: 0xab1f1f, border: 0xffb3b3 }
};

/** Deep-blue vertical gradient with a soft central glow and edge vignette. */
export function drawBackground(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  g.clear();
  // vertical two-tone (renders identically on Canvas + WebGL)
  g.fillStyle(THEME.bgBottom, 1);
  g.fillRect(0, 0, w, h);
  const bands = 24;
  for (let i = 0; i < bands; i++) {
    const t = i / bands;
    const col = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(THEME.bgTop),
      Phaser.Display.Color.ValueToColor(THEME.bgBottom),
      bands,
      i
    );
    g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
    g.fillRect(0, (h * t) | 0, w, Math.ceil(h / bands) + 1);
  }
  // central glow
  const steps = 10;
  for (let i = steps; i >= 1; i--) {
    const t = i / steps;
    const col = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(THEME.bgMid),
      Phaser.Display.Color.ValueToColor(THEME.glow),
      steps,
      i
    );
    g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 0.06);
    g.fillEllipse(w / 2, h * 0.42, w * 0.9 * t, h * 0.6 * t);
  }
}

/** A glossy rounded panel centred at (x,y). Returns the graphics object. */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { radius?: number; selected?: boolean; glow?: boolean } = {}
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setPosition(x, y);
  drawPanel(g, w, h, opts);
  return g;
}

export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  opts: { radius?: number; selected?: boolean; glow?: boolean } = {}
): void {
  const r = opts.radius ?? 16;
  const hw = w / 2;
  const hh = h / 2;
  g.clear();
  if (opts.glow || opts.selected) {
    const c = opts.selected ? 0xffd24a : THEME.glow;
    for (let i = 3; i >= 1; i--) {
      g.lineStyle(i * 4, c, 0.12);
      g.strokeRoundedRect(-hw - i * 2, -hh - i * 2, w + i * 4, h + i * 4, r + i * 2);
    }
  }
  g.fillStyle(THEME.panelBottom, 1);
  g.fillRoundedRect(-hw, -hh, w, h, r);
  g.fillStyle(THEME.panelTop, 1);
  g.fillRoundedRect(-hw, -hh, w, Math.min(h * 0.55, h - r), r);
  // top bevel highlight
  g.lineStyle(2, THEME.panelBevel, 0.5);
  g.beginPath();
  g.moveTo(-hw + r, -hh + 1);
  g.lineTo(hw - r, -hh + 1);
  g.strokePath();
  g.lineStyle(2.5, opts.selected ? 0xffd24a : THEME.panelBorder, opts.selected ? 1 : 0.8);
  g.strokeRoundedRect(-hw, -hh, w, h, r);
}

/** Big gold gradient title text. */
export function goldText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  font = 'Georgia, "Times New Roman", serif'
): Phaser.GameObjects.Text {
  const t = scene.add
    .text(x, y, text, { fontFamily: font, fontSize: `${size}px`, fontStyle: 'bold' })
    .setOrigin(0.5);
  try {
    const grad = t.context.createLinearGradient(0, 0, 0, t.height);
    grad.addColorStop(0, THEME.goldTop);
    grad.addColorStop(0.5, THEME.gold);
    grad.addColorStop(1, THEME.goldBot);
    t.setFill(grad);
  } catch {
    t.setColor(THEME.gold);
  }
  t.setStroke('#241600', Math.max(3, size * 0.08));
  t.setShadow(0, Math.max(2, size * 0.06), 'rgba(0,0,0,0.55)', size * 0.12, true, true);
  return t;
}

export interface FancyButton extends Phaser.GameObjects.Container {
  setLabel(s: string): void;
  setSelected(on: boolean): void;
  setEnabled(on: boolean): void;
  setSize2(w: number, h: number): FancyButton;
}

type Variant = keyof Pick<typeof THEME, 'primary' | 'green' | 'gold2' | 'danger'>;

/** A glossy, glowing button with a bevel. */
export function fancyButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: { w?: number; h?: number; variant?: Variant; size?: number; selected?: boolean } = {}
): FancyButton {
  let w = opts.w ?? 220;
  let h = opts.h ?? 60;
  const variant = THEME[opts.variant ?? 'primary'];
  const c = scene.add.container(x, y) as FancyButton;
  const g = scene.add.graphics();
  const txt = scene.add
    .text(0, 0, label, {
      fontFamily: 'system-ui, "Segoe UI", sans-serif',
      fontSize: `${opts.size ?? 22}px`,
      color: '#ffffff',
      fontStyle: 'bold'
    })
    .setOrigin(0.5);
  txt.setShadow(0, 2, 'rgba(0,0,0,0.5)', 3);
  c.add([g, txt]);

  let enabled = true;
  let selected = !!opts.selected;
  let hover = false;

  const draw = () => {
    const hw = w / 2;
    const hh = h / 2;
    g.clear();
    if (selected || hover) {
      g.lineStyle(8, selected ? 0xffd24a : variant.border, 0.18);
      g.strokeRoundedRect(-hw - 3, -hh - 3, w + 6, h + 6, 16);
    }
    const top = enabled ? variant.top : 0x4a5266;
    const bot = enabled ? variant.bottom : 0x262a35;
    // two-tone fill: darker base + brighter upper band (Canvas + WebGL safe)
    g.fillStyle(bot, 1);
    g.fillRoundedRect(-hw, -hh, w, h, 14);
    g.fillStyle(top, 1);
    g.fillRoundedRect(-hw, -hh, w, Math.min(h * 0.58, h - 10), 12);
    // gloss highlight on the top
    g.fillStyle(0xffffff, enabled ? 0.22 : 0.06);
    g.fillRoundedRect(-hw + 4, -hh + 3, w - 8, h * 0.34, 10);
    g.lineStyle(2.5, selected ? 0xffd24a : variant.border, enabled ? 1 : 0.5);
    g.strokeRoundedRect(-hw, -hh, w, h, 14);
    txt.setAlpha(enabled ? 1 : 0.7);
  };
  draw();

  c.setSize(w, h);
  c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  c.on('pointerover', () => {
    hover = true;
    draw();
  });
  c.on('pointerout', () => {
    hover = false;
    draw();
  });
  c.on('pointerdown', () => {
    if (enabled) onClick();
  });
  c.setLabel = (s) => txt.setText(s);
  c.setSelected = (on) => {
    selected = on;
    draw();
  };
  c.setEnabled = (on) => {
    enabled = on;
    draw();
  };
  c.setSize2 = (nw, nh) => {
    w = nw;
    h = nh;
    c.setSize(w, h);
    const hit = c.input?.hitArea as Phaser.Geom.Rectangle | undefined;
    if (hit) hit.setTo(-w / 2, -h / 2, w, h);
    draw();
    return c;
  };
  return c;
}

/** A coin chip + amount, e.g. for the wallet bar. Origin is left-centre. */
export function coinBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  amount: number,
  opts: { plus?: () => void } = {}
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const pillW = 150;
  const g = scene.add.graphics();
  g.fillStyle(0x081633, 0.85);
  g.lineStyle(2, THEME.panelBorder, 0.8);
  g.fillRoundedRect(0, -18, pillW, 36, 18);
  g.strokeRoundedRect(0, -18, pillW, 36, 18);
  // coin
  g.fillStyle(0xe8a200, 1);
  g.fillCircle(20, 0, 13);
  g.fillStyle(0xffd874, 1);
  g.fillCircle(20, 0, 9);
  const dollar = scene.add.text(20, 0, '₵', { fontFamily: 'Georgia', fontSize: '14px', color: '#7a4d00', fontStyle: 'bold' }).setOrigin(0.5);
  const amt = scene.add
    .text(40, 0, amount.toLocaleString(), { fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#ffe9a8', fontStyle: 'bold' })
    .setOrigin(0, 0.5);
  c.add([g, dollar, amt]);
  c.setData('amt', amt);
  if (opts.plus) {
    const plus = fancyButton(scene, pillW + 16, 0, '+', opts.plus, { w: 30, h: 30, variant: 'green', size: 20 });
    c.add(plus);
  }
  return c;
}

export function setCoinBadge(c: Phaser.GameObjects.Container, amount: number): void {
  (c.getData('amt') as Phaser.GameObjects.Text)?.setText(amount.toLocaleString());
}

/** An avatar disc with a coloured ring and an initial. */
export function avatarDisc(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  initial: string,
  ringColor: number
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(ringColor, 1);
  g.fillCircle(0, 0, radius + 3);
  g.fillGradientStyle(0x35508f, 0x35508f, 0x142b55, 0x142b55, 1);
  g.fillCircle(0, 0, radius);
  const t = scene.add
    .text(0, 0, initial, { fontFamily: 'Georgia, serif', fontSize: `${radius}px`, color: '#dce8ff', fontStyle: 'bold' })
    .setOrigin(0.5);
  c.add([g, t]);
  return c;
}

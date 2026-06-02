/** Small reusable UI helpers (buttons, panels, table background). */

import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { TableSkin } from '../skins/skins';

export interface Button extends Phaser.GameObjects.Container {
  setLabel(s: string): void;
  setActive2(active: boolean): void;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: { w?: number; h?: number; fill?: number; active?: boolean } = {}
): Button {
  const w = opts.w ?? 220;
  const h = opts.h ?? 56;
  const c = scene.add.container(x, y) as Button;
  const g = scene.add.graphics();
  const txt = scene.add
    .text(0, 0, label, { fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffffff', fontStyle: 'bold' })
    .setOrigin(0.5);
  c.add([g, txt]);

  const draw = (active: boolean, hover = false) => {
    g.clear();
    const fill = active ? opts.fill ?? 0xffb703 : hover ? 0x2c6b52 : 0x174c39;
    g.fillStyle(fill, 1);
    g.lineStyle(2, 0xffffff, 0.25);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    txt.setColor(active ? '#1a1a1a' : '#ffffff');
  };
  draw(!!opts.active);

  c.setSize(w, h);
  c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  let active = !!opts.active;
  c.on('pointerover', () => draw(active, true));
  c.on('pointerout', () => draw(active, false));
  c.on('pointerdown', () => {
    audio.unlock();
    audio.button();
    onClick();
  });
  c.setLabel = (s: string) => txt.setText(s);
  c.setActive2 = (a: boolean) => {
    active = a;
    draw(a);
  };
  return c;
}

export function drawTableBackground(
  _scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  skin: TableSkin,
  width: number,
  height: number
): void {
  g.clear();
  // rail
  g.fillStyle(skin.rail, 1);
  g.fillRect(0, 0, width, height);
  // felt oval
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.46;
  const ry = height * 0.46;
  // approximate radial gradient with concentric ellipses
  const steps = 16;
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const col = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(skin.feltEdge),
      Phaser.Display.Color.ValueToColor(skin.feltCenter),
      steps,
      i
    );
    const c = Phaser.Display.Color.GetColor(col.r, col.g, col.b);
    g.fillStyle(c, 1);
    g.fillEllipse(cx, cy, rx * 2 * t + rx * 0.1, ry * 2 * t + ry * 0.1);
  }
}

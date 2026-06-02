/**
 * Seat geometry. The human (seat 0) sits at the bottom; the bots are spread on
 * an arc across the top half of the table, which keeps the center clear for the
 * trick pile and keeps every station away from the middle text. Recomputed on
 * resize so rotating the device just re-lays things out.
 */

export type SeatSide = 'bottom' | 'top';

export interface SeatSlot {
  /** Anchor for the seat's pile row (its visual center). */
  x: number;
  y: number;
  side: SeatSide;
  /** Where this seat's card lands in the center trick pile. */
  trickX: number;
  trickY: number;
}

export function computeSeats(width: number, height: number, players: number): SeatSlot[] {
  const cx = width / 2;
  const cy = height / 2;
  const slots: SeatSlot[] = [];

  // Trick pile sits just below the middle (trump text goes above the middle).
  const trickCx = cx;
  const trickCy = cy + height * 0.04;
  const trickR = Math.min(width, height) * 0.11;

  // Human at the bottom.
  const humanY = height * 0.82;
  slots[0] = {
    x: cx,
    y: humanY,
    side: 'bottom',
    trickX: trickCx,
    trickY: trickCy + trickR
  };

  // Bots across a top arc, from middle-left, over the top, to middle-right.
  const k = players - 1;
  const rx = width * 0.37;
  const ry = height * 0.28;
  const arcCy = height * 0.40;
  for (let j = 0; j < k; j++) {
    const a = (Math.PI * (j + 0.5)) / k; // 0 (left) .. PI (right)
    const x = cx - Math.cos(a) * rx;
    const y = arcCy - Math.sin(a) * ry;
    const dx = x - trickCx;
    const dy = y - trickCy;
    const len = Math.hypot(dx, dy) || 1;
    slots[j + 1] = {
      x,
      y,
      side: 'top',
      trickX: trickCx + (dx / len) * trickR,
      trickY: trickCy + (dy / len) * trickR
    };
  }
  return slots;
}

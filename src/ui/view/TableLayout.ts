/**
 * Computes seat positions around an oval table. The human (seat 0) always sits
 * at the bottom; bots are distributed around the rest of the oval. Recomputed
 * on resize so rotating the device re-lays out the table naturally.
 */

export interface SeatSlot {
  /** Anchor point for the seat's hand/piles (center of that seat's area). */
  x: number;
  y: number;
  /** Angle (radians) pointing from table center toward the seat — used to
   *  orient labels and the direction cards travel when played. */
  angle: number;
  /** A point a bit toward the table center, where this seat's trick card lands. */
  trickX: number;
  trickY: number;
}

export function computeSeats(
  width: number,
  height: number,
  players: number
): SeatSlot[] {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.40;
  const ry = height * 0.40;
  const trx = width * 0.16;
  const trY = height * 0.16;

  const slots: SeatSlot[] = [];
  // Seat 0 at the bottom (angle = +90deg = Math.PI/2), others spread evenly
  // going clockwise so play order reads left-to-right across the top.
  for (let i = 0; i < players; i++) {
    const angle = Math.PI / 2 + (i * 2 * Math.PI) / players;
    slots.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
      angle,
      trickX: cx + Math.cos(angle) * trx,
      trickY: cy + Math.sin(angle) * trY
    });
  }
  return slots;
}

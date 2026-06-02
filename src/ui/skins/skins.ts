/**
 * Skin registry for card backs and table/environment themes.
 *
 * Themes are defined as data so new ones can be added easily, and so a real
 * art pipeline can later supply a `texture` (image key) instead of the
 * procedural `draw`/colour fields used by default. To ship custom art, drop
 * files in /public/skins and register them here with a `texture` key.
 */

export interface CardBackSkin {
  id: string;
  name: string;
  /** Base colour of the card back. */
  color: number;
  /** Accent colour for the procedural pattern. */
  accent: number;
  /** Optional loaded image texture key (overrides procedural drawing). */
  texture?: string;
}

export interface TableSkin {
  id: string;
  name: string;
  /** Two colours for a radial felt gradient (center, edge). */
  feltCenter: number;
  feltEdge: number;
  /** Rail / surround colour. */
  rail: number;
  /** Optional background image texture key (an "environment"). */
  texture?: string;
}

export const CARD_BACKS: CardBackSkin[] = [
  { id: 'classic-art', name: 'Classic Art', color: 0x7a1f2b, accent: 0xffd76b, texture: 'card-back-art' },
  { id: 'classic-blue', name: 'Classic Blue', color: 0x1a3a8f, accent: 0x9fb8ff },
  { id: 'royal-red', name: 'Royal Red', color: 0x8f1a2a, accent: 0xffb3bd },
  { id: 'emerald', name: 'Emerald', color: 0x0f6b4a, accent: 0x9cf2cf },
  { id: 'midnight', name: 'Midnight', color: 0x14161f, accent: 0x6c7cff },
  { id: 'gold-leaf', name: 'Gold Leaf', color: 0x3a2e0f, accent: 0xffd76b }
];

export const TABLES: TableSkin[] = [
  { id: 'green-felt', name: 'Green Felt', feltCenter: 0x1d7a52, feltEdge: 0x0b3d2e, rail: 0x4a2c14 },
  { id: 'blue-velvet', name: 'Blue Velvet', feltCenter: 0x1f5a8f, feltEdge: 0x0b2540, rail: 0x2a2a2a },
  { id: 'crimson', name: 'Crimson Lounge', feltCenter: 0x8f2330, feltEdge: 0x3d0b14, rail: 0x1a1a1a },
  { id: 'midnight-club', name: 'Midnight Club', feltCenter: 0x2a2f45, feltEdge: 0x0c0e16, rail: 0x40310f },
  { id: 'sand-dune', name: 'Sand Dune', feltCenter: 0xb8915a, feltEdge: 0x6b502c, rail: 0x3a2a14 }
];

export function cardBack(id: string): CardBackSkin {
  return CARD_BACKS.find((s) => s.id === id) ?? CARD_BACKS[0];
}

export function tableSkin(id: string): TableSkin {
  return TABLES.find((s) => s.id === id) ?? TABLES[0];
}

// Copies the single-file build output to game.html at the repo root so it can
// be downloaded and double-clicked. Run via `npm run build:single`.
import { copyFileSync, statSync } from 'node:fs';

const src = 'dist-single/index.html';
const dest = 'game.html';
copyFileSync(src, dest);
const kb = (statSync(dest).size / 1024).toFixed(0);
console.log(`\n✓ Wrote ${dest} (${kb} KB) — download & open it in any browser.`);

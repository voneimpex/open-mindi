// Produces download/Open-Mindi.html — ONE self-contained file with the whole
// game inlined: Phaser, the real card art, and the music. Double-click it in any
// browser to play, fully offline. Run via `npm run build:single`.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const built = readFileSync('dist-single/index.html', 'utf8');

// Build a { path -> data: URI } map the game's assetUrl() reads at runtime.
const assets = {};
const b64 = (file) => readFileSync(file).toString('base64');

// Card faces + back (keyed by bare filename, e.g. "ace_of_spades.png").
for (const f of readdirSync('public/cards')) {
  if (f.endsWith('.png')) assets[f] = `data:image/png;base64,${b64(join('public/cards', f))}`;
}
// Music (keyed as the game requests it, e.g. "audio/home.mp3").
for (const f of ['home.mp3', 'game.mp3']) {
  const p = join('public/audio', f);
  try {
    assets[`audio/${f}`] = `data:audio/mpeg;base64,${b64(p)}`;
  } catch {
    /* music is optional — falls back to generative audio */
  }
}

const inject = `<script>window.__MINDI_ASSETS=${JSON.stringify(assets)}</script>\n`;
const html = built.replace('<body>', `<body>\n${inject}`);

mkdirSync('download', { recursive: true });
writeFileSync('download/Open-Mindi.html', html);
writeFileSync(
  'download/README.txt',
  [
    'Open Mindi — offline game',
    '',
    'HOW TO PLAY:',
    '  Double-click "Open-Mindi.html". It opens in your web browser and runs',
    '  completely offline — no internet, no install, nothing else needed.',
    '',
    '  Best played with the browser window wide (landscape).',
    '',
    'This single file contains the whole game: code, card art and music.',
    'You only need this one file.'
  ].join('\n')
);

const mb = (statSync('download/Open-Mindi.html').size / 1048576).toFixed(1);
const n = Object.keys(assets).length;
console.log(`\n✓ download/Open-Mindi.html (${mb} MB, ${n} assets inlined) — double-click to play offline.`);

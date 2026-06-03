# Custom Art & Audio

## Drop-in images (no code needed)

Put these files in `/public` and they appear automatically on next load. If a
file is missing, the game falls back to its built-in procedural look. Avatar
images are auto-cropped to circles, so square art is fine.

| What | File | Recommended size |
|------|------|------------------|
| Home background | `public/ui/home-bg.png` | 2048×1024 (landscape) |
| Table background (felt + rail) | `public/ui/table-bg.png` | 2048×1024 |
| Logo (replaces gold title) | `public/ui/logo.png` | 1024×256, transparent |
| Your avatar | `public/avatars/you.png` | 256×256 |
| Bot avatars | `public/avatars/bot1.png` … `bot5.png` | 256×256 each |
| Card back | `public/skins/<name>-back.png` | 184×256 (see skins below) |

Tip for AI generation: *"landscape mobile card-game UI, deep blue and gold
casino theme, transparent PNG"*, and keep one consistent style across all files.

---


The game runs with **zero binary assets** — cards, table felt and music are all
generated procedurally. To replace them with real art/audio, follow this guide.

## Card backs & tables (skins)

Skins are registered in [`src/ui/skins/skins.ts`](../../src/ui/skins/skins.ts).
Each entry currently uses colours for procedural drawing. To use an image:

1. Drop the image in `public/skins/` (e.g. `public/skins/dragon-back.png`).
2. Preload it in `BootScene.preload()` with `this.load.image('dragon-back', 'skins/dragon-back.png')`.
3. Add a skin entry with the `texture: 'dragon-back'` field.
4. Extend `CardView`/`drawTableBackground` to blit the texture when `texture` is set.

Recommended sizes: card backs **184×256px**, table backgrounds **2048×1536px**.

## Music & sound effects

`src/ui/audio/AudioManager.ts` synthesises two looping tracks (`home`, `game`)
plus SFX. To use real audio files:

1. Drop tracks in `public/audio/` (e.g. `home.mp3`, `game.mp3`).
2. In `BootScene.create()` call:
   ```ts
   await audio.loadTrack('home', 'audio/home.mp3');
   await audio.loadTrack('game', 'audio/game.mp3');
   ```
   Once loaded, `playMusic()` uses the file instead of the generative track.

## App icons (PWA / Play Store)

Add `public/icon-192.png` and `public/icon-512.png` (referenced by
`public/manifest.webmanifest`). For the Android build, supply launcher icons
through Android Studio after `npx cap add android`.

# Changelog — Open Mindi 📖

All notable changes to the game, newest first.

## [Unreleased]

### Fixed
- **Major layout fix for phones in landscape.** The table and home screen now
  scale to the *available height*, not just width. On short, wide screens
  (a phone held sideways with the browser bar showing) cards no longer overlap
  each other or the players, and the **PLAY** button is always fully visible.
  - Game table redesigned into three clean vertical bands: **bots** (top),
    the **trick** (centre), and **your cards** (bottom).
  - Card size is now chosen to fit both width and height, so nothing collides.
  - Home screen rebuilt with a reserved footer and a proper top bar — the daily
    bonus pill no longer overlaps the coin balance, and labels sit inside the panel.

### Added
- **Installable app (PWA).** Added app icons, a service worker (offline play),
  and an **⤓ Install App** button on the home screen so you can play full-screen
  without the browser bar. iOS shows "Add to Home Screen" guidance.
- **Single-file build.** `npm run build:single` produces a self-contained
  **`game.html`** you can download and double-click to run anywhere — no server,
  no install. (Uses procedural cards + generative audio when run standalone.)

## [0.1.0] — Initial

### Added
- Open Mindi & Double Mindi modes, 2–6 players, teams for 4/6.
- Learner / Expert bots, coin economy with bets, daily bonus and prize fund.
- Premium blue-and-gold casino UI, table/card skins, music & sound.
- Win/lose effects: confetti and flying coins on a win, win/lose jingles.
- Drop-in custom art (backgrounds, logo, avatars) via files in `public/`.
- Public-domain card faces with a procedural fallback.

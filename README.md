# Open Mindi 🃏

A mobile-first **Mendikot-style trick-taking card game** for **2–6 players vs
bots**. Built with TypeScript + Phaser 3, packaged for the Play Store with
Capacitor. Supports both portrait and landscape — rotating the phone re-lays
out the table around the seats.

> **Goal:** capture as many **tens (mindis)** as you can. The side with the most
> captured tens wins the round; tricks won break ties. Capture *all* the tens
> for a **whitewash**.

---

## Game modes

| Mode | Description |
|------|-------------|
| **Open Mindi** | The standard game with one ten ("mindi") per suit. |
| **Open Double Mindi** | Four extra tens are added, so there are twice as many points on the table — and duplicate tens (top card wins on a tie). |

"Open" means the piles are dealt face-down in front of each player with only the
**top card visible to everyone**; you also hold a small **private hand**. On
your turn you may play any of your private hand cards *or* the visible top card
of any of your piles. When you play a pile's top card, the card beneath it is
revealed. A small badge shows how many cards remain hidden under each pile.

## Players & teams

| Players | Style |
|---------|-------|
| 2, 3, 5 | Individual — every player for themselves |
| 4, 6 | **Teams** — odd seats vs even seats; tens and tricks are pooled per team |

## Rules summary

- The player to the **dealer's left** leads first.
- You **must follow the led suit** if you can reach a card of it (in hand or as
  a visible pile top). Otherwise you may play anything, including a trump.
- **Ranking** (high → low): A K Q J **10** 9 8 7 6 5 4 3 2. The ten is the
  valuable point card but is *not* the highest rank.
- A random **trump** suit is chosen each deal and shown openly. A trump beats
  any non-trump; a higher trump beats a lower one.
- The highest relevant card wins the trick and **captures all its cards**; the
  winner leads the next trick.
- In two-deck games (6 players / double mindi) two identical cards can appear —
  the one played **later (on top)** wins the tie.
- Each captured **ten** is shown beside the winner so everyone can track points.

## Bot difficulty

| Level | How it thinks |
|-------|----------------|
| **Learner** | Reasons only from what it can see *right now*: its own cards, every player's visible pile tops, and the current trick. No memory of played cards, no void inference. |
| **Expert** | Full card counting — tracks which cards are gone, infers which players are void in which suits, counts outstanding trumps and tens, knows when a card is a guaranteed winner, wins ten-tricks safely, avoids wasting high cards, feeds partners points, and pulls trumps when leading. |

---

## Deck composition (validated)

Every configuration is arithmetically verified in
[`tests/engine.test.ts`](tests/engine.test.ts) so that
`deck size == players × (piles×perPile + hand)`.

### Open Mindi

| Players | Deck changes | Cards | Layout per player |
|--------:|--------------|------:|-------------------|
| 2 | remove all 2s & 3s | 44 | 4 piles × 4 + 6 hand = 22 |
| 3 | remove 2♠ | 51 | 3 piles × 4 + 5 hand = 17 |
| 4 | full deck | 52 | 3 piles × 3 + 4 hand = 13 |
| 5 | remove 2♠, 2♥ | 50 | 3 piles × 2 + 4 hand = 10 |
| 6 | **2 decks**, remove one 2♠ & one 2♥ | 102 | 3 piles × 4 + 5 hand = 17 |

### Open Double Mindi (+4 tens)

| Players | Deck changes | Cards | Layout per player |
|--------:|--------------|------:|-------------------|
| 2 | remove all 2s,3s,4s; +4 tens | 44 | 4 × 4 + 6 = 22 |
| 3 | remove all 2s & 3♠; +4 tens | 51 | 3 × 4 + 5 = 17 |
| 4 | remove all 2s; +4 tens | 52 | 3 × 3 + 4 = 13 |
| 5 | remove all 2s & 3♠,3♥; +4 tens | 50 | 3 × 2 + 4 = 10 |
| 6 | **2 decks** +4 tens, remove both 2♠,2♥,3♠ | 102 | 3 × 4 + 5 = 17 |

> Where the original design notes were ambiguous (the 6-player removal set and
> the double-mindi variants), the removal set was chosen to match the intent
> *and* make the totals come out exactly. These are easy to tweak in
> [`src/engine/config.ts`](src/engine/config.ts) — the test suite will flag any
> change that breaks the math.

---

## Project structure

```
src/
  engine/        Pure, framework-free game logic (fully unit-tested)
    cards.ts       suits, ranks, deck building, RNG/shuffle
    config.ts      per-(mode, player-count) deck & layout table
    state.ts       game state types, pile/hand helpers
    rules.ts       legal moves, trick resolution, scoring
    game.ts        GameEngine: deal + drive play
  ai/            Bots
    learner.ts     visible-info-only strategy
    expert.ts      card-counting strategy
    analysis.ts    counting / void inference / "is this a boss card"
  ui/            Phaser presentation
    scenes/        Boot, Home, Settings, Game
    view/          CardView, TableLayout, widgets
    audio/         generative music + SFX (AudioManager)
    skins/         card-back & table themes
    settings/      persisted preferences
tests/           Vitest engine + AI tests
assets/manifest/ how to add real art & audio
```

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # run the engine/AI test suite
npm run build        # production web build into dist/
```

## Build for the Play Store (Android)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npm run build
npx cap add android
npm run cap:sync
npm run cap:open     # build the signed AAB in Android Studio
```

See [`capacitor.config.ts`](capacitor.config.ts) and
[`assets/manifest/README.md`](assets/manifest/README.md) for details.

## Customization

- **Card backs & tables:** pick in-game under *Skins & Audio*; add new ones in
  [`src/ui/skins/skins.ts`](src/ui/skins/skins.ts).
- **Music & SFX:** generative by default; drop real files in `public/audio/`
  (see the asset manifest).

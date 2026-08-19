# FUSE — design notes

A one-thumb, physics-free score-attack puzzle for Android, playable on desktop.
Deliberately in the Tetris / 2048 lane: discrete rules, seeded randomness,
deterministic resolution, one verb.

## Rules

Board is 5 x 6. A cell is empty, holds a **charge**, or holds **rubble**.
A charge is a single number 1–6: its **fuse**.

Each turn, in order:

1. **Detonate.** The player taps one charge. The blast spreads outward through
   charges that touch it (orthogonally), one wave at a time. The tapped charge's
   fuse is its **blast reach** — a fuse of 5 carries five waves, a fuse of 1
   only kills itself. Everything caught is cleared.
2. **Score.** `sum of the fuses caught x waves²`.
3. **Decay.** Every surviving charge loses 1 from its fuse. Any charge that
   reaches 0 becomes **rubble**, which is permanent, blocks the blast, and never
   clears.
4. **Drop.** New charges are placed in random empty cells. If there is not enough
   room for the whole batch, the run is over.

Escalation is a pure function of turn count and is printed on the status strip,
so a player can always read why it got harder:

| | |
|---|---|
| Spawn rate | `min(5, 3 + turn/25)` |
| Fuse ceiling | `max(3, 6 - turn/18)` |
| Fuse floor | `ceiling - 2`, min 1 |

## Why these rules

Three of them were chosen against simulation, not intuition. The engine is a
pure reducer over a seeded RNG, so ~2000 runs per strategy take under a second
and design questions get answered instead of argued.

**Fuse = blast reach.** The first draft let a blast spread through an entire
connected cluster with no limit. A competent player then cleared most of the
board every turn, nothing ever decayed to rubble, and **1167 of 2000 runs never
ended.** No death spiral, no pressure. Capping reach at the initiator's fuse
fixed it — every run now terminates — and it makes decay cost you *reach* as
well as points, so the charge that can do the most damage is always the one
running out fastest. That is the game.

**Squared wave multiplier.** With a linear multiplier, firing the best available
move immediately dominated every patient strategy at every threshold tested —
holding was strictly punished, so the central "spend now or build" decision did
not exist. Squaring makes a deep chain worth enough to justify letting charges
decay while a cluster grows: patience overtakes greed by ~7%. Verified by sweeping
exponents 1 / 1.5 / 2 / 2.5 against greedy and five patience thresholds.

**Forced tap, no pass button.** A pass action was tested and gives patience a
bigger edge (~15%), but spending your cheapest charge already *is* a pass and it
costs something, which is the better version of the decision. It also keeps the
game to exactly one verb.

## Measured balance

2000 seeded runs per strategy, current rules:

| Strategy | median | p90 | max | median turns |
|---|---|---|---|---|
| Random tap | 2278 | 3772 | 5876 | 31 |
| Greedy (best move each turn) | 6180 | 7024 | 11090 | 57 |

Skill gradient is 2.7x random → greedy, every run terminates, and a good run is
50–60 turns — roughly a 1–3 minute session.

## The technique the game never tells you

Wave count is the multiplier, and wave count depends on *where* in a cluster you
tap. Tapping the tip of a six-charge snake gives six waves; tapping its middle
gives three. Same charges, 4x the score. This is discoverable, never explained
in-game, and is the skill ceiling the design hangs on.

## Known tuning knobs

- Rubble is currently permanent. A recovery rule (clearing it with a chain of
  depth >= 3) would soften the death spiral — untested.
- A charge hitting 0 turns to rubble silently rather than detonating hostile.
  A hostile blast would be more chaotic but much harder to read.
- Board is 5x6. Larger boards make deep chains easier and lengthen runs.
- Spawn positions are uniform over empty cells. Biasing them toward existing
  clusters would raise chain depth.

## Presentation

The look is demolition-crew instrumentation: a machined bezel with registration
ticks, a blueprint plate under the charges, and stamped numerals on bevelled
plates. Two rules keep it from becoming decoration:

- **Cold chrome, warm danger.** Cyan is reserved for the interface (score,
  cursor, readouts); every warm hue belongs to the heat ramp or to a hazard
  signal. The two never trade places, so warmth on screen always means time
  running out.
- **Structure encodes state.** The hazard chevron band across the bezel is dark
  until free space drops to 6 cells, then it lights and crawls. Charges at fuse
  1 and 2 pulse — fast and slow respectively — so urgency reads as motion for
  players who won't parse six shades of a heat ramp. The ramp itself is data:
  the numeral is always the primary channel, colour is redundant backup.

Blasts throw a shockwave ring and debris from every charge caught, wave by wave,
with a screen shake scaled to chain depth. A chain of 4+ waves swaps the score
plate from cyan to amber, so a jackpot looks different, not just bigger.

## Audio

Synthesised at runtime through Web Audio — no sample files, so the soundtrack
costs zero download bytes and nothing is decoded at startup. Nodes are built per
hit and garbage collected.

Each wave of a chain fires its own hit, and the pitch climbs a minor pentatonic
scale as the blast travels. A deep chain therefore *resolves into a phrase*
rather than just getting louder — the reward for depth is audible before you
read the number. Rubble forming is a dull low-passed thud, deliberately
unpleasant. The context is created lazily on the first tap, because mobile
browsers refuse to start one outside a user gesture.

Audio can be muted from the masthead and the preference persists.

## Build

`prototype/index.html` is standalone — no build step, no dependencies, opens
from the filesystem. The rules engine at the top of the script block is pure and
has no DOM knowledge, so it lifts out unchanged into the shipping app and can be
tested headlessly. Rendering is DOM with CSS transitions plus a canvas particle layer whose
requestAnimationFrame loop is **started by a detonation and stops itself when
the last particle dies** — there is no standing render loop. The one thing that
does animate continuously is the pulse on fuse-1 and fuse-2 charges, which is a
compositor-driven opacity animation on a handful of cells. Everything honours
`prefers-reduced-motion`, which also suppresses particles entirely.

Intended packaging: PWA for browser, Capacitor for the Android APK, Tauri for
desktop.

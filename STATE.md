# TURBODOS — State Snapshot (2026-08-19)

Resume point after a ~5-week gap. Last code commit: 2026-07-26.
Updated 2026-08-19 after cutting the v0.3.3 release.

## Where things stand

| | |
|---|---|
| Version in source | **0.3.3** (`package.json`, `tauri.conf.json`) |
| Latest **published** GitHub release | **v0.3.3** (published 2026-08-19, marked Latest) |
| Latest **built** installer | `TURBODOS_0.3.3_x64-setup.exe`, built 2026-07-14 — now attached to the v0.3.3 release |
| Repo | github.com/CrossplayGaming/TurboDOS (PUBLIC) — `main` clean, **0 ahead / 0 behind** origin |
| Pack host | github.com/CrossplayGaming/dosdeck-packs (PUBLIC), release `v1`, **54 assets** |
| Library | **50 seeded games**, **50 of them in `PACK_GAMES`** (every seeded game pulls from the hosted pack) |
| Code size | ~11.2k lines: `src/db.js` 3149, `src-tauri/src/lib.rs` 2917, `src/main.js` 2697, rest small |
| App data | `%APPDATA%\com.dosdeck.app` (identifier never renamed from the DOSDECK days) |

**Shipped 2026-08-19.** The Build-engine mouselook work is now public; installing from
GitHub gets 0.3.3. Note the `v0.3.0` tag is misleading — it points at the *same* commit
(`17bc98f`) as `v0.3.3`, because the repo was pushed to GitHub after all the 0.3.3 work
had already been committed. Only the attached installer distinguishes them.

## What landed in the 0.3.1–0.3.3 window (released 2026-08-19)

- `05305cd` / `7cbad31` — Build-engine games (Duke3D, Shadow Warrior) routed through a
  bundled `BMOUSE.EXE` external mouse driver; CFG writer sets `ControllerType = 3` +
  `ExternalFilename = "BMOUSE.EXE"` when the driver is present, falls back to 1 when not.
  (`src-tauri/src/lib.rs:125-160`)
- `5e61a8e` — in-app exit button.
- `1194113` (0.3.2) — side-panel controls moved next to Play, freelook note added;
  installer keeps the exe on reinstall.
- `6186cc4` (0.3.3) — Build CFG writer preserves game-specific keydefs it doesn't emit
  itself (Shadow Warrior was losing bindings). (`src-tauri/src/lib.rs:295-315`)
- `17bc98f` — `secrets.rs.example` so a fresh clone builds (`secrets.rs` is gitignored).

## Architecture, in one breath

Tauri 2 + vanilla JS/Vite frontend, SQLite via `plugin-sql`. 26 Tauri commands cover
launching DOSBox, art/scraping, controller polling (gilrs thread → synthetic keys),
music, and the games-folder download/extract pipeline. DB migrations are **keyed flags in
a `meta` table** (36 of them), not a numbered schema version — each fix inserts its own
`key='..._v1'` sentinel so it runs once per install.

## Open threads / next actions

1. ~~Ship 0.3.3.~~ **Done 2026-08-19** —
   https://github.com/CrossplayGaming/TurboDOS/releases/tag/v0.3.3
2. **`HANDOFF.md` is badly stale** (dated 2026-06-23). It still calls the app DOSDECK and
   says "6 pre-seeded games" when there are 50. Its *Known Issues* and *Critical Technical
   Details* sections are still largely accurate and worth keeping; the inventory sections
   are not. Either rewrite or delete.
3. **Retrofit QA pass never done for TurboDOS** — it's one of the 3 projects left in the
   portfolio sweep (with WolfDoom and TURBOSTEIN). No build-blueprint, no code-audit.
4. **Carried-over known issues** (from HANDOFF.md, all still unfixed in the source):
   - `downloadArt` builds the art path as `` `${dir}art` `` with no separator —
     likely a real path bug (`src/launcher.js`).
   - No guard against double-clicking Play launching two DOSBox instances.
   - `verified` never auto-flips when a game runs successfully.
   - Controller button capture missing from the wizard (keyboard only).
   - `dosbox_config` exists per-game in the DB but has no UI editor.
5. **Phase 2 (eXoDOS bulk import, ~2000 games) still untouched** — Phase 1 target was
   50–150 games and engine formalization; we're at 50.

## Working-tree cleanup (done 2026-08-19)

- `.claude/launch.json` reverted; its stray `budget` entry was ported to
  `F:\BudgetCalendar\.claude\launch.json`, which previously had no `.claude` dir.
- `KeenLauncherkeen13porthelpwin.png` moved to `F:\KeenLauncher\`.
- Root `TURBODOS_0.3.0_x64-setup.exe` deleted — superseded local build; the shipped 0.3.0
  installer survives on the GitHub release and in `bundle/nsis/`.
- `launch-app.bat - Shortcut.lnk` **kept** (it's your dev-launcher shortcut) and
  gitignored, along with `*_x64-setup.exe`.

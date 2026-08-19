# TURBODOS — Developer Handoff

**Rewritten 2026-08-19** against the code at `9a7fd04` (v0.3.3). The previous version of
this file dated from 2026-06-23, still called the app DOSDECK, and described a 6-game
library. If you find a claim here that the code contradicts, trust the code and fix this
file — see [STATE.md](STATE.md) for the current project checkpoint.

---

## What This Is

TURBODOS is a Windows desktop DOS game launcher — **Tauri 2** (Rust backend) with a
Vite/vanilla-JS frontend and a retro CRT-styled UI. The central design goal is being
**controls-first**: every game carries named control schemes that the launcher writes into
DOSBox (and, where needed, into the game's own config format) at launch, so the player
never edits a config file. Secondary goal: games install themselves — most of the library
downloads on demand from a hosted pack rather than requiring the user to source files.

Project lives at **`F:\TurboDOS`**. Never open it from the old OneDrive path.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (`src-tauri/`) |
| Backend logic | Rust — effectively all of it in `src-tauri/src/lib.rs` (~2.9k lines) |
| Frontend | Vanilla JS + CSS, no framework (`src/`, ~8.2k lines) |
| Database | SQLite via `tauri-plugin-sql` — `dosdeck.db` in `%APPDATA%\com.dosdeck.app\` |
| DOS emulator | DOSBox Staging, bundled at `src-tauri/dosbox/` and shipped via `bundle.resources` |
| Controller input | XInput (`winapi`) primary; `gilrs` on the legacy profile path |
| Key/mouse injection | `winapi` `SendInput` |
| Archive extraction | `zip` + `sevenz-rust` |
| Metadata / art | SteamGridDB (primary) and ScreenScraper.fr v2 |

**Build commands** (from the repo root):

```bash
npm run dev
```

```bash
npm run build
```

Both pin `--target x86_64-pc-windows-msvc`. Use these rather than `npm run tauri dev` /
`tauri build` directly — without the target flag Rust rebuilds everything into a different
target directory from scratch. `launch-app.bat` wraps `npm run dev` and frees port 1420
first if a stale Vite instance is holding it. For a Rust-only typecheck, `cargo check` from
`src-tauri/`.

`withGlobalTauri: true` is set in `tauri.conf.json` so the frontend can reach
`window.__TAURI__`; a lot of the JS branches on `typeof window.__TAURI__ === 'undefined'`
to stay runnable in a plain browser preview.

---

## Directory Structure

```
F:\TurboDOS\
├── src/
│   ├── main.js        # all UI logic — single-page app, screen router, every render* fn
│   ├── db.js          # seed catalog (50 games), pack table, schema, ~36 migrations, stores
│   ├── launcher.js    # Tauri bridge: launch, controller capture, scrape, art
│   ├── nav.js         # couch navigation — geometric focus cursor for keyboard + gamepad
│   ├── sfx.js         # synthesized PC-speaker UI blips + optional looping menu music
│   ├── splash.js      # fake BIOS POST boot splash + shutdown card
│   ├── mascot.js      # asset-driven pixel mascot that reacts to app events
│   └── style.css      # CRT theme
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs              # ALL Rust backend logic (26 commands + mappers + writers)
│   │   ├── main.rs             # entry point, calls dosdeck_lib::run()
│   │   ├── secrets.rs          # GITIGNORED — real API keys
│   │   └── secrets.rs.example  # committed template so fresh clones build
│   ├── dosbox/                 # bundled DOSBox Staging (exe + DLLs + docs)
│   ├── capabilities/default.json
│   ├── icons/                  # generated from icon-source.png via `npx tauri icon`
│   └── Cargo.toml
├── docs/
│   ├── PACK_STATUS.md   # per-game confirm-then-pack tracker (complete as of 2026-07-01)
│   ├── PACK_RECIPE.md   # how to build and upload a game pack
│   ├── ASSET_PROMPTS.md
│   └── ui-prototype.html  # the approved design system
├── GAMES/               # optional local drop-in folder (see caveat below)
├── STATE.md             # project checkpoint / resume doc
└── HANDOFF.md           # this file
```

> **Caveat:** `GAMES/HOW_TO_ADD_GAMES.txt` still says "DOSDECK"/"DOSDeck" throughout —
> leftover from the 0.3.0 rename. It's user-facing. Worth fixing.

---

## Data Model

```sql
games (id, title, genre_tag, subtype, description, art_path, dosbox_config,
       install_path, executable, engine, episodes, setup_exe, controller_bindings,
       verified, source_type, download_url, buy_url, folder_name)
schemes         (id, game_id, name, input_style, source, always_run)
bindings        (id, scheme_id, action, input, dosbox_event, sort_order)
genre_templates (id, genre_tag, subtype, action_list, default_modern_kb, default_controller)
meta            (key, value)
```

- **`input`** — friendly display name (`"W"`, `"LMB"`, `"LStick Up"`, `"RT"`, `"Btn_A"`).
- **`dosbox_event`** — DOSBox event name (`"key_up"`, `"mouse_left"`, `"key_lctrl"`).
- **`engine`** — `doom` | `build` | `wolf3d` | `generic`. Drives the whole launch path.
  Empty on older user-added rows, in which case the backend re-detects (see below).
- **`episodes`** — JSON; per-episode launch entries for multi-episode games.
- **`controller_bindings`** — JSON blob `{ bindings, fpsMode, sensitivity }`, the modern
  per-game controller config. Distinct from `schemes`/`bindings`, which are keyboard/mouse.
- **`source_type`** — `copied` vs downloaded; `download_url` points at the hosted pack.

### Migrations — read this before adding one

There is **no numbered schema version**. Migrations are **keyed sentinel rows in `meta`**:
each one checks `SELECT value FROM meta WHERE key='<name>_v1'`, does its work if absent,
then inserts the key. There are ~36 of them in `db.js`, mostly data fixes (repointing a
game at a leaner download, correcting an exe name, replacing a seeded control scheme).
Column additions are separate: bare `ALTER TABLE ... ADD COLUMN` calls wrapped in
`try/catch` so they are safe to re-run.

**To add a migration:** pick a fresh `meta` key, follow the existing block pattern, and
never mutate an old block — existing installs have already recorded its key and will not
re-run it.

---

## Content Pipeline

The library ships as **50 seeded games** (`SEED_GAMES` in `db.js`), and all 50 are listed
in `PACK_GAMES`, meaning each resolves its `download_url` to a hosted zip under:

```
https://github.com/CrossplayGaming/dosdeck-packs/releases/download/v1/<file>.zip
```

`dosdeck-packs` is a **separate public repo** from TurboDOS, used purely as asset hosting
(54 assets on the `v1` release: 50 game packs, an art pack, and earlier extras).

A game becomes a pack only after it is confirmed to actually run — sound and controls — in
a real build. That gate exists because folders can look complete on disk while carrying a
subtly broken config; Shadow Warrior was the case that taught it. `docs/PACK_STATUS.md`
tracks the per-game state and `docs/PACK_RECIPE.md` has the packing steps.

**Do not add entries to `SEED_GAMES` without explicit approval** — the library is curated
deliberately.

Beyond packs, `scan_games_folder` picks up user-dropped folders from the GAMES directory
(defaults under app data, relocatable via `set_games_folder`), and
`download_and_extract_game` handles fetch + unzip/un-7z into `GAMES/<folder_name>/`.

---

## The Launch Pipeline

`launch_game` in `lib.rs` is the heart of the app. Signature:

```rust
launch_game(app, install_path, executable, engine, dosbox_config, bindings,
            always_run, controller_profile, ctrl_bindings, fps_mode, fps_sensitivity)
```

Order of operations:

1. **Resolve the engine.** The stored `engine` column wins. If it is empty, fall back to
   detection: `is_build_engine()` (presence of `DUKE3D.GRP` / `BLOOD.RFF` / `SW.GRP` in the
   install dir) → `is_doom_engine()` (exe name against a fixed list: `doom.exe`,
   `doom1.exe`, `doomsw.exe`, `doom2.exe`, `heretic.exe`, `hexen.exe`, `strife.exe`,
   `plutonia.exe`, `tnt.exe`, `final.exe`) → otherwise `generic`.
2. **Write the mapper** to `%TEMP%\turbodos\mapper.map`.
3. **Per-engine config injection** (below).
4. **Start a controller thread** if there is anything to map or FPS mode is on.
5. **Spawn DOSBox detached** with `-conf`, then return to the UI immediately. A monitor
   thread waits on the child and signals the controller thread to stop when it exits.

### Per-engine handling

**`generic`** — full mapper remapping. Also patches `CONFIG.ROT`'s `AutoRun` flag on every
launch when present (Rise of the Triad), taking care to patch only the first `AutoRun`
entry — the on/off flag — and not the second, which is a key scan code.

**`doom`** — DOOM reads the mouse through INT 33h directly, bypassing the DOSBox mapper
entirely, so the only way to configure it is DOOM's own config format. The launcher writes
`game.cfg` to the temp dir, mounts that dir as `T:`, and launches
`DOOM.EXE -config t:\game.cfg`. That config sets `use_mouse 1`, `mouseb_fire 0`,
`mouseb_strafe 1`, `mouseb_forward -1`, `novert 1`, `mouse_sensitivity 5`. With always-run
on it adds `always_run 1` and `joyb_speed 29` — a deliberately out-of-range joystick button
index that forces DOOM to treat run as permanently on.

**`build`** (Duke3D, Blood, Shadow Warrior) — these install their own INT 9h handler and
read raw scan codes from port 60h, so mapper remapping actively conflicts with them. The
launcher therefore writes an **identity mapper** (defaults, no remaps) and instead injects
a `[KeyDefinitions]` block into the game's own CFG via `write_duke3d_key_defs()`.

Two hard-won rules live in that writer:

- **Never overwrite the whole CFG.** An earlier hardcoded template used wrong device
  numbers (`FXDevice=5` = General MIDI, `BlasterType=6` = AWE32) and crashed sound init.
  The game's own setup owns the sound config; we only inject key definitions.
- **Preserve unknown keydefs.** The writer collects existing `[KeyDefinitions]` lines it
  does not emit itself and re-appends them (`lib.rs:295-315`), because Shadow Warrior was
  silently losing bindings on every launch before 0.3.3.

Mouse freelook for Build games goes through a bundled **`BMOUSE.EXE`** external mouse
driver. When that file is present in the install dir the writer sets `ControllerType = 3`
("keyboard and external") plus `ExternalFilename = "BMOUSE.EXE"`; when it is absent it
falls back to `1` (keyboard + internal mouse turning). See `lib.rs:125-160`.

**`wolf3d`** (Wolfenstein 3D, Blake Stone) — mostly generic, but see the fire-button
remapping note under Controller Support.

---

## Controller Support

There are **two** controller paths. Read `lib.rs:1418-1442` to see which one fires.

**Modern path — `run_xinput_mapper`.** Used when the game has per-game `ctrl_bindings`
(the `controller_bindings` JSON column) or when FPS mode is on. Polls XInput directly via
`winapi` and synthesizes keyboard/mouse events with `SendInput`. This is what new work
should target.

**Legacy path — `run_controller_mapper`.** Used when a game has no `ctrl_bindings` and
instead relies on the older `controller_profile` (a calibration blob in `localStorage`,
built in the Settings screen). Polls through `gilrs` and maps via `parse_ctrl_input`.

**Why synthesize keys at all:** DOSBox Staging's built-in joystick mapper (`jaxis`
bindings) does not reliably work with XInput pads on Windows — SDL2's raw joystick axis
numbering differs from the GameController API, and DOSBox's init order can prevent binding.
Injecting OS-level input bypasses DOSBox entirely and works with any pad, which is the same
trick Steam Input uses.

**FPS mouse mode.** When `fps_mode` is set, the right stick drives synthetic *mouse* motion
rather than keys, through an accelerating curve: `v * v.abs() * sensitivity * 20.0`
(`lib.rs:1100`, `lib.rs:1245`). This is what makes stick-based freelook feel usable.

**Fire-button special case.** A controller "Fire" bound to `mouse_left` does not deliver
reliably through `SendInput` into this DOSBox build, so it gets remapped onto a keyboard
key per engine: Build games → `key_g` (whose CFG maps Fire to `"Ctrl" "G"`), Wolf3D-engine
games → `key_lctrl` (already the engine default, so no config change needed).

**Thread lifecycle.** The mapper thread blocks in a poll loop until its
`stop: Arc<AtomicBool>` is set. A global `CTRL_STOP` holds the current stop flag so
launching a second game shuts down the previous thread. On exit every held VK is explicitly
released with `KEYEVENTF_KEYUP` — skip that and you get stuck keys.

**Deadzone** defaults to `0.25`, overridable per-axis via `axis_*_threshold`.

---

## Frontend

`main.js` is a single-page app with a `state` object (`{ screen, games, filter, detail,
wizard, ... }`) and a screen router. Render functions, in file order:

| Function | What it draws |
|---|---|
| `renderShell` | app frame, rail, status bar |
| `renderGuide` / `renderAbout` | in-app help and credits |
| `renderLibrary` / `renderGameGrid` | filterable, searchable, sortable grid |
| `renderSidePanel` / `renderSideEmpty` | selected-game panel with Play + controls |
| `renderDetail` | full game screen |
| `renderOriginalControls` | editor for the game's authentic control scheme |
| `renderControllerSetup` | per-game controller bindings, FPS mode, sensitivity |
| `renderEpisodeEditor` | multi-episode launch entries |
| `renderWizard` | 2-step control-scheme wizard (genre → assign keys) |
| `renderAddGame` | manual add w/ file picker + auto-split path |
| `renderSettings` | CRT toggle, audio, credentials, controller calibration, games folder, reset |

Supporting modules:

- **`nav.js`** — one virtual cursor driven by both keyboard and gamepad. Movement is
  *geometric* (nearest focusable in the pressed direction) so every screen works without
  per-screen wiring; activation synthesizes a real click, so existing handlers just work.
- **`sfx.js`** — UI blips are synthesized square waves (no asset files). Menu music is an
  optional user-supplied file at `public/audio/menu-theme.mp3`. Both independently
  toggleable and persisted.
- **`splash.js`** — BIOS POST boot overlay that hangs on the real init work (DB, first-run
  art pack) so it doubles as an honest progress cover; plus a shutdown card. Both skippable.
- **`mascot.js`** — asset-driven pixel buddy. Drop files into `public/mascot/` named by
  state (`idle.webm`, `launch.png`, `react-fps.gif`); whatever exists is used, missing
  states are skipped, and no `idle` asset means no mascot at all.
- **`launcher.js`** — the Tauri bridge: `launchGame`, `launchDosboxShell`,
  `controllerSnapshot`, `captureControllerInput`, `captureBrowserGamepadInput`,
  `scrapeMetadata`, `downloadArt`, `loadArtAsUrl`, `invalidateArtCache`. Art blob URLs are
  cached in a module-level `Map` for the session.

**Art display** goes through Rust (`download_and_save_art`, `load_art_file`) rather than
`<img src="C:\...">`, which Tauri's security model forbids. Bytes come back as a
`Uint8Array` → `Blob` → `URL.createObjectURL`.

---

## Tauri Commands (26)

**Launch & process**
`launch_game` · `launch_dosbox_shell` · `toggle_fullscreen` · `exit_app`

**Library & install**
`reset_library` · `flatten_install_dir` · `get_games_folder` · `get_default_games_folder` ·
`set_games_folder` · `scan_games_folder` · `open_games_folder` · `delete_game_folder` ·
`download_and_extract_game`

**Art & metadata**
`scrape_game_metadata` · `save_art_file` · `load_art_file` · `copy_local_art` ·
`download_and_save_art` · `install_art_pack`

**Controller**
`controller_snapshot` · `capture_controller_input` · `send_controller_keys`

**Audio**
`list_music_files` · `open_music_folder` · `save_music_file` · `load_music_file`

### Capabilities

```json
["core:default", "shell:allow-open", "fs:default", "fs:allow-mkdir",
 "fs:allow-read-file", "fs:allow-write-file", "dialog:default",
 "sql:default", "sql:allow-load", "sql:allow-execute", "sql:allow-select"]
```

All four `sql:*` permissions are required. With only `sql:default`, SQLite **silently**
falls back to in-memory storage — data vanishes on restart with no error shown.

---

## Known Issues / Limitations

Verified against the current code on 2026-08-19.

1. **`verified` never auto-flips.** It is set to `1` only when the user saves an Original
   control scheme (`main.js:1585`). Actually running a game successfully does not mark it
   Tuned.
2. **`dosbox_config` has no UI editor.** The per-game column exists and is honored at
   launch (Ken's Labyrinth uses it to pin CPU cycles), but it can only be set from a
   migration or by hand.
3. **Controller capture is calibration-only.** Settings has a working capture flow that
   builds a `controller_profile`, but the *scheme wizard* still captures keyboard only —
   you cannot press a gamepad button to assign it there.
4. **Mapper still emits unused `jaxis`/`jbutton` entries.** Harmless, since the injection
   threads handle controllers, but dead weight that could be skipped when building the
   mapper string.
5. **DOOM mouse Y-axis cannot be fully disabled.** `novert 1` kills forward/back on the Y
   axis but the axis still exists. Vanilla-DOSBox limitation, accepted.
6. **Wolf3D "Modern WASD" scheme is unverified.** It maps W/S/A/D to `key_w/s/a/d` directly
   rather than remapping the engine's movement events, and Wolf3D defaults to arrow keys.
7. **No scraper cache or rate-limit handling.** Every scrape hits the API live.
8. **Some seeded `executable` values do not match the real exe** in the extracted folder
   (Wacky Wheels, Raptor, Blake Stone, One Must Fall, Solar Winds). Runtime auto-detect
   papers over it; the DB rows are still wrong. Flagged per-row in `docs/PACK_STATUS.md`.

**Fixed since the old handoff** (do not go hunting for these): the `downloadArt` path-join
bug — art now downloads through Rust, no JS string concatenation; and the double-launch
race — `main.js:1308` has a reentrancy guard that refuses Play while DOSBox is running.

---

## Not Yet Built

1. Controller button capture inside the scheme wizard (see Known Issue 3).
2. Per-game tuned control schemes for the remaining shooters — only DOOM has a full
   Original / Modern WASD / Controller set.
3. Import/export of control schemes between users.
4. **Phase 2: eXoDOS bulk import (~2000 games).** Phase 1 targeted 50–150 games plus engine
   formalization; the library is at 50, the floor of that range.
5. No retrofit QA pass has been run on this project (no build-blueprint, no code-audit).

---

## Gotchas

**Mapper files are a complete replacement, not a merge.** If a key event is not listed it
gets *no* binding. During development this silently broke the Enter key in DOOM menus
because only remapped keys were being written. `build_mapper()` therefore always emits the
full default table (60+ keys → SDL2 scancodes) and overlays user remaps on top.
Format: `key_up "key 82 0 0"`, `mouse_left "mouse 0 0 0"`.

**Paths passed into the DOSBox conf must use forward slashes.** Backslash escaping in the
conf format previously produced `\\` where `\` or `/` was meant.

**Crate type must stay `["rlib", "staticlib"]`.** `cdylib` was removed because it triggered
a Windows DLL export-ordinal limit error during build.

**Temp dir is `%TEMP%\turbodos`** (renamed from `dosdeck` in 0.3.0).

---

## Naming Legacy — do not "fix" these

The 0.3.0 rename deliberately left the internal identifiers alone. Changing any of them
breaks existing installs or live credentials:

| Identifier | Why it stays |
|---|---|
| `com.dosdeck.app` | bundle identifier — existing users' `%APPDATA%` lives here |
| `sqlite:dosdeck.db` | the database filename in that directory |
| `dosdeck` / `dosdeck_lib` | Rust crate + lib names; not user-visible, renaming forces a `main.rs` change and full rebuild |
| `dosdeck-packs` repo URLs | the live pack host for every seeded game |
| ScreenScraper `devid=dosdeck` | registered API credential |

---

## Rust Dependencies

```toml
tauri = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-shell = { version = "2" }
tauri-plugin-fs = { version = "2" }
tauri-plugin-dialog = { version = "2" }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
urlencoding = "2"
dirs = "5"
gilrs = "0.10"
zip = "0.6"
sevenz-rust = "0.6"

[target.'cfg(windows)'.dependencies]
winapi = { version = "0.3", features = ["winuser", "xinput"] }
```

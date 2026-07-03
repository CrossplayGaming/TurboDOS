# DOSDECK — Developer Handoff Document

## What This Is

DOSDECK is a Windows desktop DOS game launcher built with **Tauri 2** (Rust backend + Vite/Vanilla JS frontend). Its central design goal is being **controls-first**: every game has named control schemes that the launcher configures automatically, so players never have to touch DOSBox config files. It has a retro CRT-inspired UI.

The project directory is `C:\Users\cross\OneDrive\Documents\DOSDeck`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (`src-tauri/`) |
| Backend logic | Rust (`src-tauri/src/lib.rs`) |
| Frontend | Vanilla JS + CSS (`src/`) |
| Database | SQLite via `tauri-plugin-sql` (`dosdeck.db` in `%APPDATA%\com.dosdeck.app\`) |
| DOS emulator | DOSBox Staging 0.82.2 (bundled at `src-tauri/dosbox/dosbox.exe`) |
| Controller input | `gilrs` Rust crate (XInput/DirectInput) |
| Key injection | `winapi` Rust crate (`SendInput`) |
| Art scraping | ScreenScraper.fr API v2 |

**Build commands:**
```
npm run tauri dev     # development with hot reload
npm run tauri build   # production build
cargo check           # Rust-only type check (run from src-tauri/)
```

**Key requirement:** `withGlobalTauri: true` must be set in `vite.config.js` so the frontend can access `window.__TAURI__`.

---

## Directory Structure

```
DOSDeck/
├── src/
│   ├── main.js          # All UI logic (single-page app, no framework)
│   ├── db.js            # Database layer: seed data, SQLite store, in-memory fallback
│   ├── launcher.js      # Tauri bridge: launchGame, scrapeMetadata, downloadArt, loadArtAsUrl
│   └── style.css        # CRT-themed styles
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs       # ALL Rust backend logic
│   │   └── main.rs      # Entry point (just calls lib::run())
│   ├── dosbox/
│   │   └── dosbox.exe   # Bundled DOSBox Staging 0.82.2
│   ├── capabilities/
│   │   └── default.json # Tauri permission grants
│   └── Cargo.toml
└── HANDOFF.md           # This file
```

---

## What Is Fully Working

### 1. Game Library
- Grid view of all games with box art (when scraped) or genre icon placeholder
- Filter by genre (FPS, Adventure, Platform, Shooter, RPG, Strategy)
- Search by title
- Sort by title / "Tuned first" / genre
- Each tile shows verified ("✓ Tuned") or unverified ("⚡ Set up") badge

### 2. Game Detail Screen
- Shows box art (full cover image from ScreenScraper), title, genre, description
- Control scheme tabs — switch between multiple schemes for the same game
- Binding preview list (action → key)
- **Always-run toggle** (DOOM-engine games only — see below)
- Play button, Edit Controls button, Edit Path button, Scrape Info button
- Inline path display

### 3. Launching Games
- Generates a DOSBox `.conf` file on the fly (written to `%TEMP%\dosdeck\game.conf`)
- Generates a complete DOSBox **mapper file** (`%TEMP%\dosdeck\mapper.map`) that remaps all keys from the active control scheme
- Spawns DOSBox detached (non-blocking) then returns to the UI
- DOSBox config includes: `[sdl] fullscreen=true output=texture capture_mouse=onstart`, `[joystick] joysticktype=auto timed=true`, `[cpu] cycles=auto`

### 4. Keyboard Control Schemes
- DOSBox mapper file is a **complete replacement** (not a merge) — every keyboard event is explicitly listed or it gets no binding
- The mapper starts from a full default table (all 60+ keys → their SDL2 scancodes) then overlays user remaps
- Remapping format: `key_up "key 82 0 0"` (event name → SDL2 scancode)
- Mouse buttons are also explicitly listed in the mapper: `mouse_left "mouse 0 0 0"` etc.

### 5. DOOM-Engine Special Handling
The following executables are detected as DOOM-engine: `doom.exe, doom1.exe, doomsw.exe, doom2.exe, heretic.exe, hexen.exe, strife.exe, plutonia.exe, tnt.exe, final.exe`

When launching a DOOM-engine game:
- A `game.cfg` file is written to the temp dir with DOOM's `DEFAULT.CFG` format
- A second DOS drive `T:` is mounted pointing to the temp dir
- DOOM is launched as: `DOOM.EXE -config t:\game.cfg`
- This `game.cfg` sets: `use_mouse 1`, `mouseb_fire 0`, `mouseb_strafe 1`, `mouseb_forward -1`, `novert 1` (disables vertical mouse movement), `mouse_sensitivity 5`
- **Always-run**: if enabled, the config also adds `always_run 1` and `joyb_speed 29` (an out-of-range joystick button index forces DOOM to treat run as always-on)
- Mouse X-axis turning works via DOOM's INT 33h mouse handler (not the DOSBox mapper)
- The always-run toggle is per-scheme, shown only for DOOM-engine games, stored in the `schemes.always_run` column

### 6. Seeded Control Schemes for DOOM (Shareware)

**"Original 1993"** (`input_style: "original"`)
- Arrow keys for movement/turning, Ctrl=fire, Space=use, Alt+arrow=strafe

**"Modern WASD"** (`input_style: "modern-kb"`, `always_run: 1`)
- W/S = forward/back (mapped to up/down arrows in DOSBox)
- A/D = strafe left/right (mapped to comma/period — DOOM's strafe keys)
- LMB = fire (via DOOM mouse config, not mapper)
- E = use/open (mapped to space)
- Shift = run, WheelUp/Down = weapon cycle

**"Controller"** (`input_style: "controller"`, `always_run: 1`)
- Left stick = WASD equivalent (forward/back/strafe)
- Right stick X = turn left/right only
- RT = fire, Btn_A = use, LB = run, RB = next weapon, DPad_Down = prev weapon, Select = map (Tab), Start = Esc

### 7. Controller Support (Gamepad)
This was the most complex piece and was solved with a **custom in-process controller-to-keyboard mapper** built in Rust:

**How it works:**
1. When `launch_game` is called and any binding has a controller input (LStick Up, RT, Btn_A, etc.), a background thread is started
2. The thread polls controller events via `gilrs` at ~120Hz
3. On stick/button events, it synthesizes Windows keyboard events using `winapi::SendInput`
4. DOSBox sees these as real keyboard events — identical to what Steam Input does for the Steam Controller
5. A second monitor thread watches the DOSBox process; when DOSBox exits, it sets a stop flag that shuts down the controller thread
6. On exit, all held keys are explicitly released (prevents stuck keys)
7. Only one controller thread runs at a time — launching a second game stops the previous thread

**Why this approach was necessary:** DOSBox Staging's built-in joystick mapper (`jaxis` bindings in the mapper file) does not reliably work with XInput controllers (like 8BitDo in X mode) on Windows. The axis numbering presented by SDL2's raw joystick API differs from the GameController API, and DOSBox's initialization order can prevent proper binding. The gilrs + SendInput approach bypasses DOSBox entirely and works with any XInput or DirectInput controller.

**Input name → gilrs mapping:**
- `LStick Up/Down/Left/Right` → `Axis::LeftStickY/LeftStickX` (neg/pos)
- `RStick Left/Right/Up/Down` → `Axis::RightStickX/RightStickY` (neg/pos)
- `RT` / `LT` → `Button::RightTrigger2` / `Button::LeftTrigger2`
- `LB` / `RB` → `Button::LeftTrigger` / `Button::RightTrigger`
- `Btn_A/B/X/Y` → `Button::South/East/West/North`
- `Select/Back/View` → `Button::Select`
- `Start/Menu` → `Button::Start`
- `DPad_Up/Down/Left/Right` → `Button::DPadUp/Down/Left/Right`
- `LS`/`RS` → `Button::LeftThumb`/`Button::RightThumb`

**dosbox_event → Windows VK code table** is in `dosbox_event_to_vk()` in `lib.rs`. Covers all arrows, modifiers, letters, numbers, punctuation, function keys.

**Deadzone:** 0.25 (25%). Analog sticks below this threshold do not register. Adjustable via the `DEADZONE` constant in `run_controller_mapper()`.

### 8. Metadata Scraping (ScreenScraper)
- `scrape_game_metadata` Tauri command searches ScreenScraper.fr using `recherche=TITLE` (text search, not ROM filename)
- Returns: description (English synopsis), art_url (box-2D image URL), genre
- Credentials (username/password) are stored in `localStorage` as `ss_user` / `ss_pass` and sent to the API
- Falls back to a built-in catalog (descriptions only, no art) when credentials are absent
- API errors are returned as `{ source: "ss_error", error: "..." }` for visibility in the UI
- Art is downloaded via `fetch()` in JS, saved to `%APPDATA%\com.dosdeck.app\art\{gameId}.{ext}` using the fs plugin

### 9. Art Display
- Art files are read back using `readFile` (Tauri fs plugin) → `Uint8Array` → `Blob` → `URL.createObjectURL`
- This is required because Tauri's security model doesn't allow `<img src="C:\...">` for arbitrary file paths
- Blob URLs are cached in memory on the game object as `_artUrl`
- Art shows as a cover image on both the library grid tile and the detail screen

### 10. Add Game Flow
- Browse button uses `@tauri-apps/plugin-dialog` to open a file picker (`.exe`, `.com`, `.bat`)
- Auto-split: paste full path like `C:\Games\DOOM\DOOM.EXE`, click Auto-split, it separates folder and executable
- On title blur, automatically scrapes ScreenScraper for description/genre
- On save, attempts art download in the background (non-blocking)

### 11. Control Scheme Wizard
- Step 1: Pick genre (shows genre cards)
- Step 2: Assign controls — click a key slot, press a physical key, it captures and displays the friendly name
- Saves as a new scheme with `input_style: "modern-kb"`
- Currently keyboard-only (no controller capture in wizard)

### 12. Settings Screen
- CRT scanlines toggle (CSS class on body)
- ScreenScraper credentials (username/password → localStorage)
- "Test DOSBox" button launches a bare DOSBox shell to verify the bundled executable works
- "Reset library" invokes `reset_library` Tauri command which deletes `dosdeck.db` (reseeds on next launch)

---

## Database Schema

```sql
games (id, title, genre_tag, subtype, description, art_path, dosbox_config, install_path, executable, verified, source_type)
schemes (id, game_id, name, input_style, source, always_run)
bindings (id, scheme_id, action, input, dosbox_event, sort_order)
genre_templates (id, genre_tag, subtype, action_list, default_modern_kb, default_controller)
meta (key, value)   -- used for seeded flag
```

**`input`** = friendly display name ("W", "LMB", "LStick Up", "RT", "Btn_A")
**`dosbox_event`** = DOSBox event name ("key_up", "mouse_left", "key_lctrl", "key_comma")

The `input` field drives both the DOSBox mapper (for keyboard/mouse schemes) and the gilrs controller thread (for controller schemes). The `dosbox_event` field drives what action is triggered in DOSBox.

**Migrations run on every startup:**
- `ALTER TABLE schemes ADD COLUMN always_run INTEGER DEFAULT 0` (try/catch — safe to run repeatedly)
- `UPDATE schemes SET always_run=1 WHERE name='Modern WASD' AND game_id IN (DOOM-engine games)`
- Migration to replace old placeholder DOOM Controller bindings (`joy_leftstick` etc.) with correct per-axis bindings

---

## Tauri Commands

| Command | Description |
|---|---|
| `launch_game(install_path, executable, dosbox_config, bindings, always_run)` | Builds conf+mapper, starts controller thread if needed, spawns DOSBox |
| `launch_dosbox_shell()` | Opens a bare DOSBox prompt (for testing) |
| `reset_library()` | Deletes `dosdeck.db` |
| `scrape_game_metadata(title, screenscraper_user, screenscraper_pass)` | Fetches from ScreenScraper or built-in catalog |

**Capabilities** (`src-tauri/capabilities/default.json`):
```json
["core:default", "shell:allow-open", "fs:default", "fs:allow-mkdir",
 "fs:allow-read-file", "fs:allow-write-file", "dialog:default",
 "sql:default", "sql:allow-load", "sql:allow-execute", "sql:allow-select"]
```
All four SQL permissions are required — `sql:default` alone silently falls back to in-memory storage.

---

## Known Issues / Limitations

1. **DOSBox mapper jaxis entries** — The mapper file still generates `jaxis`/`jbutton` entries for controller inputs, but these are never actually used (the gilrs thread handles controller input instead). They're harmless but could be cleaned up by skipping controller-type inputs when building the mapper string.

2. **Mouse Y-axis in DOOM** — DOOM's vertical mouse movement cannot be disabled in vanilla DOSBox without a source port. The `novert 1` setting in game.cfg disables forward/back movement on the Y axis but the axis itself still exists. This is a known DOOM limitation and the user has accepted it.

3. **Controller wizard** — The control scheme wizard (Step 2) only captures keyboard input. Controller button capture (press a gamepad button to assign it) is not yet implemented.

4. **Wolfenstein 3D WASD scheme** — The seeded Modern WASD scheme for Wolf3D maps W/S/A/D to `key_w/s/a/d` directly rather than remapping them to movement events. Wolf3D uses arrow keys for movement by default, so this scheme may not work without also remapping the movement events. Needs verification.

5. **ScreenScraper rate limiting** — The API has per-day request limits for free accounts. No retry/cache logic is implemented.

6. **Art directory path on Windows** — `downloadArt` in `launcher.js` builds the path as `` `${dir}art` `` (no separator). On Windows this produces `C:\Users\...\AppData\Roaming\com.dosdeck.app\art` — works because `appDataDir()` already ends without a trailing slash and the string concatenation produces `...appart` if there's no slash. **This is likely a bug** — should be `${dir}\\art` or use a path join utility.

7. **Always-run toggle not shown for controller scheme** — The always-run toggle correctly reads `activeScheme.always_run` but both the DOOM Controller and Modern WASD schemes seed with `always_run: 1`. The toggle will show for either scheme on DOOM-engine games, which is correct behavior.

---

## What Is Not Yet Built (Planned Features)

Based on the project goals, the following features were planned but not yet implemented:

1. **Per-game controller scheme accuracy for other DOS shooters** — Wolf3D, Duke Nukem 3D, Heretic, Hexen, Blake Stone each need their own tuned control schemes. Only DOOM (Shareware) has all three schemes (Original / Modern WASD / Controller).

2. **Controller button capture in wizard** — Step 2 of the control scheme wizard should let users press a gamepad button to assign it, not just keyboard keys.

3. **Multiple DOSBox instance guard** — If the user clicks Play twice quickly, two DOSBox instances launch. Should detect if DOSBox is already running and prevent a second launch.

4. **Verified status auto-update** — When the user successfully runs a game, `verified` should flip to `1`. Currently it only gets set manually via the wizard save.

5. **Custom DOSBox config per game** — The `dosbox_config` field on games exists in the DB but the UI has no editor for it. Intended for advanced users to add custom `[sblaster]`, `[cpu]`, etc. sections per game.

6. **Import/export of control schemes** — Share scheme files between users.

7. **UI sound effects** — The Settings toggle exists but the audio isn't implemented.

8. **Scraper cache** — No caching of scrape results. Every scrape hits the API live.

---

## Critical Technical Details for the Next Developer

### DOSBox Mapper File Format
The mapper file is a **complete replacement** of all DOSBox bindings. If a key event is not listed, it gets no binding. This caused the Enter key to stop working in DOOM menus during development because only remapped keys were being written. The fix is to always emit the full default table (60+ keys) and overlay user remaps on top.

Format: `event_name "binding_type args"`
- Keyboard: `key_up "key 82 0 0"` (event → SDL2 scancode, 0, 0)
- Mouse: `mouse_left "mouse 0 0 0"` (event → button index, 0, 0)
- Controller (in mapper file, currently unused): `key_up "jaxis 0 1 0 0"` (event → joystick, axis, direction, 0)

### DOOM Mouse Fix
DOOM reads mouse via INT 33h directly, bypassing the DOSBox mapper. The only way to configure it is via DOOM's own `DEFAULT.CFG`. We inject this by:
1. Writing `game.cfg` to `%TEMP%\dosdeck\`
2. Mounting that dir as `T:` in DOSBox
3. Launching DOOM as `DOOM.EXE -config t:\game.cfg`

The `-config` flag overrides DOOM's config file path. Without this, DOOM reads `DEFAULT.CFG` from the game directory, which may have mouse disabled.

### Path Handling (Critical)
All paths passed to DOSBox config must use **forward slashes** (`replace('\\', '/')`). DOSBox on Windows accepts both, but backslash-escaping in the conf file format caused a bug where `\\` was being written instead of `\` or `/`. Current code uses `replace('\\', "/")` consistently.

### Crate Type
`src-tauri/Cargo.toml` must have:
```toml
[lib]
crate-type = ["rlib", "staticlib"]
```
`cdylib` was removed because it caused a Windows DLL export ordinal limit error during build. `rlib + staticlib` is the correct pair for Tauri 2 on Windows.

### SQL Permissions
All four of these must be in `capabilities/default.json` or SQLite silently falls back to in-memory (data is lost on restart with no error):
```
"sql:default", "sql:allow-load", "sql:allow-execute", "sql:allow-select"
```

### Controller Thread Lifecycle
- `run_controller_mapper()` blocks its thread in a poll loop
- It exits when `stop: Arc<AtomicBool>` is set to true
- The DOSBox monitor thread (which waits on `child.wait()`) sets the flag when DOSBox exits
- The global `CTRL_STOP: OnceLock<Mutex<Option<Arc<AtomicBool>>>>` holds the current stop flag so that launching a new game while DOSBox is running stops the previous controller thread
- On exit, all held VK codes are explicitly released via `SendInput` with `KEYEVENTF_KEYUP`

---

## Rust Dependencies (`src-tauri/Cargo.toml`)

```toml
tauri = { version = "2" }
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

[target.'cfg(windows)'.dependencies]
winapi = { version = "0.3", features = ["winuser"] }
```

---

## JS Module Responsibilities

**`src/db.js`**
- `SEED_GAMES` — 6 pre-seeded games
- `SEED_SCHEMES` — control schemes for DOOM (3) and Wolf3D (2) and Keen (1)
- `SEED_TEMPLATES` — genre action templates (FPS, adventure, platform, shooter, RPG, strategy)
- `createMemStore()` — in-memory fallback for browser preview (no Tauri)
- `createSqlStore()` — real SQLite store with schema creation and migrations
- Exported `db` object with: `getGames`, `getGame`, `addGame`, `updateGame`, `getSchemes`, `addScheme`, `updateScheme`, `getBindings`, `addBinding`, `updateBinding`, `deleteBindings`, `getGenreTemplate`, `getAllGenreTemplates`

**`src/launcher.js`**
- `launchGame(game, scheme, bindings, opts)` — invokes `launch_game` Tauri command
- `launchDosboxShell()` — invokes `launch_dosbox_shell`
- `scrapeMetadata(title)` — invokes `scrape_game_metadata` with localStorage credentials
- `downloadArt(url, gameId)` — fetches art URL, saves to app data dir, returns path
- `loadArtAsUrl(artPath)` — reads file bytes, returns blob URL for use in `<img src>`

**`src/main.js`**
- Single-page app with screens: `library`, `detail`, `wizard`, `add`, `settings`
- State object: `{ screen, games, filter, detail, wizard }`
- `loadLibrary()` — fetches all games, resolves art blob URLs
- `renderGameGrid()` — renders tiles with art or genre placeholder
- `openDetail(gameId)` — loads game, schemes, bindings, art; renders detail screen
- `renderDetail()` — full detail screen including always-run toggle (DOOM only)
- `playGame()` — calls `launchGame` with active scheme and bindings
- `scrapeForGame(game)` — calls scrape, shows diagnostics, downloads art, updates DB
- `openEditPath(game)` — modal for setting install_path + executable
- `openWizard(gameId)` — 2-step wizard for creating control schemes
- `renderSettings()` — settings screen with CRT toggle, SS credentials, DOSBox test, DB reset

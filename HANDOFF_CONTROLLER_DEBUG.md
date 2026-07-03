# DOSDeck Controller Debug Handoff

Date: 2026-06-23

## Current User-Visible State

Controller calibration now completes and recognizes all requested inputs.

In DOOM gameplay:
- Left stick forward/back works.
- Left stick left/right still does not strafe.
- Right trigger no longer turns the player, which is fixed.
- Right stick turns left/right, but earlier reports said it sometimes behaved as if up/down was involved. Latest code guards against `RightStickY` being used for turn left/right, but this should be retested.
- Face/menu buttons (`A`, `B`, `X`, `Start`, likely `Back/Select`) are still unresponsive in game.

The user is almost out of credits and wants this picked up from here.

## Important Files

- `src-tauri/src/lib.rs`
  - Rust/Tauri launch code, DOSBox mapper generation, controller mapper thread, controller calibration command.
- `src/main.js`
  - Settings UI and controller calibration UI.
- `src/launcher.js`
  - JS launch bridge, browser Gamepad fallback mapper, calls Tauri commands.
- `src/db.js`
  - Seed controller schemes and startup migration/reset of core controller schemes.

## Major Changes Already Made

### Artwork

Artwork scraping/download was previously fixed:
- `src/launcher.js`
  - `downloadArt()` fetches image bytes and invokes Rust `save_art_file`.
  - `loadArtAsUrl()` invokes Rust `load_art_file`.
- `src-tauri/src/lib.rs`
  - Added `cmd_art::{save_art_file, load_art_file}`.
- `src/main.js`
  - After scraping, reloads art URL and rerenders.

No recent user complaints about artwork after these changes.

### Controller Calibration

Added/changed:
- `cmd_controller::controller_snapshot()`
- `cmd_controller::capture_controller_input(duration_ms)`
- Settings UI now has:
  - `Start calibration`
  - `Capture input`
  - `Reset profile`
- Calibration steps:
  - `lstickup`
  - `lstickdown`
  - `lstickleft`
  - `lstickright`
  - `rstickleft`
  - `rstickright`
  - `rt`
  - `btn_a`
  - `btn_b`
  - `btn_x`
  - `start`
  - `select`
- Calibration saves to `localStorage.controller_profile`.

Calibration is now step-aware in `src/main.js`:
- Left stick steps only accept `LeftStickX` / `LeftStickY` with stronger min values.
- Right stick left/right only accept `RightStickX`.
- RT accepts `RightTrigger2`, `RightZ`, and `RightStickY`, because this controller reports the right trigger as `RightStickY -1.00`.
- Face/menu button steps currently accept any pressed button, instead of assuming Xbox names like `South`.

Saved axis tokens can include thresholds, e.g.:

```text
axis:RightStickX:neg:0.048
```

Rust parses both old and new formats:

```text
axis:<Axis>:<neg|pos>
axis:<Axis>:<neg|pos>:<threshold>
button:<Button>
```

### Removed Dangerous XInput Attempt

An unsafe direct XInput polling attempt caused a native crash:

```text
STATUS_STACK_BUFFER_OVERRUN
```

That path was removed.

`Cargo.toml` should only have:

```toml
[target.'cfg(windows)'.dependencies]
winapi = { version = "0.3", features = ["winuser"] }
```

Do not reintroduce raw XInput without great care.

### Browser Gamepad Fallback

`src/launcher.js` includes a browser Gamepad API fallback:
- `captureBrowserGamepadInput()`
- `startWebGamepadMapper()`
- `send_controller_keys` Tauri command sends key up/down events.

Important: browser mapper currently only starts if the saved calibration profile contains `webaxis` or `webbutton` tokens. Most current calibration seems to save Rust/Gilrs tokens like `axis:...` or `button:...`, so browser mapper probably is not involved in current failures.

## Controller Runtime Mapper Notes

`src-tauri/src/lib.rs` has:
- `PhysicalInput`
  - `AxisNeg(gilrs::Axis, f32)`
  - `AxisPos(gilrs::Axis, f32)`
  - `Button(gilrs::Button)`
- `CtrlInput(Vec<PhysicalInput>)`
- `CtrlMapping { ctrl_input, vks }`

`parse_ctrl_input(input, profile)` now:
- Normalizes the binding input name.
- Looks up saved profile entries by normalized key, including saved keys like `btn_a` vs runtime lookup `btna`.
- Filters stale/incorrect axis tokens:
  - `rstickleft` / `rstickright` only allow `RightStickX`.
  - `lstickleft` / `lstickright` only allow `LeftStickX` or `DPadX`.
  - `lstickup` / `lstickdown` only allow `LeftStickY`.

Fallback mappings still exist if no saved profile entry is found.

## DOOM Controller Scheme Changes

In `src/db.js`, DOOM controller scheme was migrated toward modern controls:

- Left stick up/down:
  - `key_up`
  - `key_down`
- Left stick left/right:
  - Primary: `key_lalt+key_left` / `key_lalt+key_right`
  - Also added fallback duplicate bindings:
    - `key_comma`
    - `key_period`
- Right stick left/right:
  - `key_left`
  - `key_right`
- RT:
  - `key_lctrl`
- A:
  - `key_space+key_enter`
- Select:
  - `key_tab`
- Start:
  - `key_esc`

The duplicate strafe bindings were added in:
- Seed `SEED_SCHEMES`
- `resetCoreControllerScheme("DOOM (Shareware)", ...)`
- Older DOOM migration block near the bottom of `src/db.js`

Despite this, user reports left stick side movement still does not strafe.

## Verification Commands Last Run

These passed after the last edits:

```powershell
cd src-tauri
cargo check
```

```powershell
npm.cmd run build:vite -- --configLoader runner
```

## Current Main Unresolved Problems

### 1. Left Stick Side Movement Does Not Strafe in DOOM

Known facts:
- Left stick forward/back works, so the Rust controller mapper thread is running.
- Left stick left/right calibration completes.
- DOOM scheme now has duplicate strafe attempts:
  - `key_lalt+key_left/right`
  - `key_comma/period`
- Still no strafing in game.

Likely next debugging steps:

1. Inspect actual DB bindings at runtime.
   - The startup migration may not be replacing existing DOOM controller bindings as expected, or there may be another selected scheme.
   - Add a temporary debug dump of bindings passed to `launch_game()` or show selected scheme bindings in the UI.

2. Confirm `launchGame()` passes all duplicate `LStick Left` / `LStick Right` bindings to Rust.
   - In `src/launcher.js`, log or display the `bindings` array before invoke.

3. Confirm `CtrlMapping` contains both strafe mappings.
   - In `launch_game`, after building `ctrl_mappings`, temporarily print action/input/event/vks.

4. Consider that duplicate mappings with the same physical input may conflict because `held` is keyed by VK only.
   - Example: `LStick Left` sends `Alt+Left` and comma simultaneously.
   - This should still produce some behavior, but if Doom ignores it or key ordering matters, it may fail.

5. Try only comma/period OR only Alt+Arrow, not both.
   - Latest code sends both. That was a diagnostic bet, not proven correct.
   - If the selected DOOM config remapped strafe keys, the correct keys may differ.

### 2. Face/Menu Buttons Still Unresponsive

Known facts:
- Calibration recognizes all requested inputs.
- Face/menu button steps accept any physical button.
- Runtime profile lookup was fixed to normalize saved keys like `btn_a`.
- Still unresponsive in game.

Likely next debugging steps:

1. Check the saved profile in Settings readout.
   - Need to know exact tokens for `btn_a`, `btn_b`, `btn_x`, `start`, `select`.
   - Example desired:
     - `btn_a: button:South`
     - or whatever the controller emits.

2. Confirm `parse_button()` recognizes those names.
   - It currently recognizes:
     - `South`
     - `East`
     - `West`
     - `North`
     - `LeftTrigger`
     - `LeftTrigger2`
     - `RightTrigger`
     - `RightTrigger2`
     - `Select`
     - `Start`
     - DPad directions
     - thumb clicks
   - If calibration saved something else, `parse_profile_token()` will drop it silently.

3. Add visible warning in profile summary for tokens that cannot be parsed.

4. Inspect `CtrlMapping` generation:
   - It uses `dosbox_event_combo_to_vks()`.
   - `key_space+key_enter` should become both VKs.
   - `key_esc`, `key_tab` should work.
   - If mapping is built but buttons do nothing, the button pressed check may not match current Gilrs button state.

5. Potential issue: `ButtonPressed` capture returns immediately and may capture a button event name that is not stable in `gamepad.is_pressed()` polling.
   - Need compare event name vs polling snapshot during/after press.

### 3. Right Stick Axis Confusion

Known facts:
- Right stick now turns left/right.
- User said right stick turns by pressing up/down, but latest code prevents saved `rstickleft/right` profile entries using `RightStickY`.
- If it still happens, the saved profile or fallback may still be wrong.

Likely next debugging:
- Show saved profile tokens.
- If `rstickleft/right` are not `RightStickX`, force calibration reset.
- Add UI validation that refuses to save `rstickleft/right` unless token includes `RightStickX`.

## Suggested Next Best Move

Add a “Controller Debug Dump” button in Settings that prints:

1. Saved `controller_profile`.
2. Current selected game/scheme bindings for DOOM Controller.
3. The physical tokens parsed for each binding.
4. The resulting VKs for each binding.
5. Live snapshot while pressing each control:
   - axes values
   - button pressed/value states

This would likely reveal whether the issue is:
- DB scheme not updated,
- profile tokens not parsed,
- button names not recognized,
- axis signs wrong,
- or DOSBox not accepting the emitted keys.

## Useful Code Locations

### `src-tauri/src/lib.rs`

Look at:
- `parse_profile_token`
- `normalized_ctrl_name`
- `parse_ctrl_input`
- `dosbox_event_combo_to_vks`
- `physical_input_pressed`
- `ctrl_input_pressed`
- `run_controller_mapper`
- `cmd_launch::launch_game`
- `cmd_controller::capture_controller_input`
- `cmd_controller::send_controller_keys`

### `src/main.js`

Look at:
- `calSteps`
- `controllerProfileSummary`
- `describeCaptureResult`
- `parseCaptureToken`
- `tokenMatchesStep`
- `refineCaptureForStep`
- capture button handler

### `src/db.js`

Look at:
- DOOM `Controller` seed scheme near top.
- `resetCoreControllerScheme`.
- `resetCoreControllerScheme("DOOM (Shareware)", ...)`.
- older DOOM migration block near bottom.

## Caution

Do not re-add direct XInput through `winapi::um::xinput` the way it was attempted before. It crashed the app natively with `STATUS_STACK_BUFFER_OVERRUN`.

Keep changes small and verify with:

```powershell
cd src-tauri
cargo check
```

```powershell
npm.cmd run build:vite -- --configLoader runner
```


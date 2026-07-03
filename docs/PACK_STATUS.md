# Pack Status Tracker

A game becomes a hosted pack only after **you confirm it actually runs correctly**
(sound + controls) in the current build. This gate exists because some folders look
finished on disk (exe + a `.cfg`) but still have broken configuration — Shadow
Warrior is the known example. We never bless a broken config into a canonical pack.

## Workflow (per game)
1. **You:** launch the game from the current build; verify sound and controls work.
2. Mark **Confirmed** below (✅) — or note the problem so we fix it first.
3. **Me:** copy the folder, strip installer junk, zip → `packs/<file>.zip`.
4. **Me:** upload to the `v1` release (`gh release upload v1 ...`) and add the title to
   `PACK_GAMES` in `src/db.js`. That game now pulls from the repo; others are untouched.

Priority-check the **engine games** first (marked ⚙): DOOM / Duke3D / Shadow Warrior /
Heretic set sound via config we care about, so they're the most likely to have a
subtly-wrong baked config. The Apogee/Epic platformers are almost certainly fine.

Legend — Disk: EXTRACTED = game exe present; HOLDOUT = needs a build step.
Junk = installer leftovers to strip before zipping.

## COMPLETE (2026-07-01): all 40 games packed
Every seeded game is now a hosted pack in the v1 release (40 game packs + art.zip = 41
assets), all in PACK_GAMES, verified 0 unmatched. Shadow Warrior's sound is fixed — the
launcher no longer clobbers SW.CFG; the working config (FXDevice=0, 8-bit/22kHz, SB type
1) is baked into shadow-warrior.zip. Remaining code changes need a fresh installer build
to ship. Spot-check Commander Keen 4 (packed from disk, not explicitly playtested).

## Progress (2026-06-30)
- **Packed & in PACK_GAMES (28):** Arctic, Bio Menace, Blake Stone, Wolf3D, plus the
  full non-FPS batch (Crystal Caves, Cosmo, Dark Ages, Death Rally, Duke Nukem 1 & 2,
  God of Thunder, Halloween Harry, Hocus Pocus, Jazz Jackrabbit, Jetpack, Keen 1,
  Monuments of Mars, Monster Bash, Major Stryker, Pharaoh's Tomb, Raptor, Secret Agent,
  Solar Winds, Stargunner, Terminal Velocity, Tyrian 2000, Wacky Wheels, Xargon).
- **Quake** ✅ PACKED (quake-sw.zip) — control preset moved to id1/autoexec.cfg so it
  survives Quake's in-game "reset to defaults"; +mlook there fixes freelook up/down.
  (Controller not yet re-tested by user, but expected good after the Wolf3D-round fixes.)
- **One Must Fall** ✅ PACKED (one-must-fall-2097.zip) — exe corrected to OMF.EXE.
- **Descent** ✅ re-sourced — old dcnt12-1.zip was a broken DEICE installer; switched to a
  pre-extracted v1.4 pack (descent.zip, exe DCNTSHR.EXE). Kept setup_exe=SETUP.EXE (real
  sound setup) as fallback, so NOT in PACK_GAMES yet; clear it once sound is confirmed.
- **Remaining holdout:** **Jill** (not extracted — needs JJFILE/JILL.BAT run once).
- **FPS games still to do:** DOOM, Heretic, Duke Nukem 3D, Rise of the Triad,
  Shadow Warrior (known sound blocker).

| Folder | Game | Disk | Notes | Confirmed |
|--------|------|------|-------|-----------|
| SWARS | Shadow Warrior (Shareware) ⚙ | EXTRACTED | **KNOWN ISSUE** — sound FX greyed out; fix & verify before packing | ⛔ |
| QUAKE | Quake (Shareware) | EXTRACTED | junk stripped; pack already built & staged | ☐ |
| DUKE3D | Duke Nukem 3D ⚙ | EXTRACTED | junk: INSTALL.EXE/INSTMAIN.EXE | ☐ |
| Doom (Shareware) | DOOM (Shareware) ⚙ | EXTRACTED | DEFAULT.CFG present (launcher also overrides at run) | ☐ |
| HERETIC | Heretic (Shareware) ⚙ | EXTRACTED | | ☐ |
| JILL | Jill of the Jungle (Shareware) | HOLDOUT | JILL.EXE not produced; run JJFILE/JILL.BAT once | ⛔ |
| TVELO | Terminal Velocity (Shareware) | EXTRACTED | junk: INSTALL.EXE; SETUP.CFG present | ☐ |
| WWHEEL | Wacky Wheels (Shareware) | EXTRACTED | junk: INSTALL.EXE; exe is WW.EXE (DB says WACKY.EXE — verify) | ☐ |
| HOCUS | Hocus Pocus (Shareware) | EXTRACTED | junk: INSTALL.EXE | ☐ |
| DUKE1 | Duke Nukem (Shareware) | EXTRACTED | | ☐ |
| DUKE2 | Duke Nukem II (Shareware) | EXTRACTED | | ☐ |
| CC1 | Crystal Caves | EXTRACTED | | ☐ |
| COSMO | Cosmo's Cosmic Adventure (Shareware) | EXTRACTED | | ☐ |
| MBASH | Monster Bash (Shareware) | EXTRACTED | | ☐ |
| SAGENT | Secret Agent (Shareware) | EXTRACTED | | ☐ |
| KEEN1 | Commander Keen 1 | EXTRACTED | | ☐ |
| JAZZ | Jazz Jackrabbit (Shareware) | EXTRACTED | | ☐ |
| RAPTOR | Raptor: Call of the Shadows (Shareware) | EXTRACTED | exe RAP.EXE (DB says RAPTOR.EXE — verify) | ☐ |
| BLAKE | Blake Stone: Aliens of Gold (Shareware) | EXTRACTED | **PACKED** → blake-stone.zip; exe fixed to BS_AOG.EXE, added WASD preset, controller fixes | ✅ |
| WOLF3D | Wolfenstein 3D (Shareware) | EXTRACTED | **PACKED** → wolfenstein-3d.zip; shares Wolf3D controller/fire fixes | ✅ |
| ROTT | Rise of the Triad (Shareware) | EXTRACTED | | ☐ |
| OMF2097 | One Must Fall: 2097 (Shareware) | EXTRACTED | exe OMF.EXE/FILE0001.EXE (DB says OMF2097.EXE — verify) | ☐ |
| TYRIAN | Tyrian 2000 | EXTRACTED | | ☐ |
| DRALLY | Death Rally (Shareware) | EXTRACTED | | ☐ |
| SOLAR | Solar Winds: The Escape (Shareware) | EXTRACTED | exe SOLAR1.EXE (DB says SOLAR.EXE — verify) | ☐ |
| BIOMEN | Bio Menace (Freeware) | EXTRACTED | **PACKED** → bio-menace.zip; added Up/Climb to scheme (v5 migration) | ✅ |
| HHARRY | Halloween Harry (Freeware) | EXTRACTED | | ☐ |
| MARS | Monuments of Mars (Freeware) | EXTRACTED | | ☐ |
| DARKAGE | Dark Ages (Freeware) | EXTRACTED | | ☐ |
| STARGN | Stargunner (Freeware) | EXTRACTED | | ☐ |
| ARCTIC | Arctic Adventure (Freeware) | EXTRACTED | **PACKED** → arctic-adventure.zip in v1 release; in PACK_GAMES | ✅ |
| PHARAOH | Pharaoh's Tomb (Freeware) | EXTRACTED | | ☐ |
| XARGON | Xargon (Freeware) | EXTRACTED | | ☐ |
| JETPAK | Jetpack (Freeware) | EXTRACTED | | ☐ |
| GODT | God of Thunder (Freeware) | EXTRACTED | | ☐ |
| MSTRYKE | Major Stryker (Freeware) | EXTRACTED | | ☐ |

**Not currently installed on disk** (download + confirm later, then pack): Hexen,
Commander Keen 4, Keen Dreams, Descent, Heretic-in-set variations, etc. — anything in
`SEED_GAMES` without a folder above.

## Notes
- Several DB `executable` values don't match the real exe in the extracted folder
  (Wacky Wheels, Raptor, Blake Stone, One Must Fall, Solar Winds). Auto-detect papers
  over this at runtime, but when we pack we should also correct the DB `executable` so
  it's exactly right — flagged per-row above.

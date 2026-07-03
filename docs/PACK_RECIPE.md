# DOSDeck Optimized Pack Recipe

A "pack" is a zip of a DOS game that is **already decompressed** and **already
sound/control-configured for modern DOSBox**, so DOSDeck can download → extract →
run with zero manual steps. Packs exist for games that are only distributed as DOS
installers (DEICE / `INSTALL.EXE` / `.SHR` blobs) and therefore have no clean
pre-extracted source online.

Currently packaged (see `PACK_GAMES` in `src/db.js`):

| Game | Pack file | Executable | Why a pack |
|------|-----------|------------|-----------|
| Quake (Shareware) | `quake-sw.zip` | `QUAKE.EXE` | `quake106.zip` = deice + `resource.1` installer |
| Descent (Shareware) | `descent-sw.zip` | `DESCENT.EXE` | `dcnt12-1.zip` = `INSTALL.EXE` + `.SOW` |
| Wacky Wheels (Shareware) | `wacky-wheels.zip` | `WACKY.EXE` | `1wacky.zip` = `INSTALL.EXE` + `.SHR` |
| Jill of the Jungle (Shareware) | `jill.zip` | `JILL.EXE` | `jill.zip` = split `JJFILE0/1.EXE` installer |
| Duke Nukem 3D | `duke3d-sw.zip` | `DUKE3D.EXE` | shareware zip nests game beside `INSTALL.EXE`/`TV/`/`SUPPORT/` |

## Pack layout requirements

- **Game files at the zip root** (or inside a single wrapper folder — DOSDeck's
  extractor strips one wrapper level automatically). No `dosbox.exe`, no `.conf`,
  no installer leftovers (`DEICE.EXE`, `INSTALL.*`, `*.SHR`, `RESOURCE.*`).
- **Executable named exactly** as the `executable` column above, so
  `scan_games_folder`'s exe-detection matches on first try.
- **Config pre-baked** for DOSBox's defaults (Sound Blaster 16, base `220`, IRQ `7`,
  DMA `1`, high DMA `5`) — this is what DOSDeck's generated `dosbox.conf` provides
  (`build_dosbox_conf` in `src-tauri/src/lib.rs`).

## Building a pack (one-time, per game)

You need real DOSBox (or DOSBox-Staging) on a workstation.

1. **Get the game decompressed.** Mount the original installer archive and run it
   to a clean folder, e.g.:
   ```
   dosbox -c "mount c .\\build" -c "mount d .\\original_zip_contents" -c "c:" -c "d:\\INSTALL.EXE"
   ```
   For DEICE/`install.bat` games, just run `install.bat`; accept the default target.
   Confirm the game's real executable (e.g. `QUAKE.EXE`) now exists in `build\`.
2. **Run the game's setup utility once** and configure audio:
   - Sound/Digital device: **Sound Blaster 16** (or Pro), **Port 220, IRQ 7, DMA 1**.
   - Music device: **Sound Blaster** / General MIDI as the title allows.
   - Save & exit. Verify a config file was written (e.g. `config.cfg`, `SETUP.CFG`,
     `DUKE3D.CFG`, `JILL1.CFG`). Launch once to confirm sound works.
3. **Strip junk** from `build\`: delete installer remnants (`*.SHR`, `RESOURCE.*`,
   `DEICE.EXE`, `INSTALL.*`, `*.SOW`), order forms, network-only tools you don't need.
   Keep the exe, game data, and the config file.
4. **Zip the contents of `build\`** (files at root, not the `build` folder itself):
   ```
   cd build && zip -r ..\\quake-sw.zip . && cd ..
   ```
5. **Smoke-test through DOSDeck** before publishing: temporarily set the game's
   `download_url` to a local file/URL, download in-app, confirm it launches with
   sound and no setup prompt.

## Publishing

Recommended host: **GitHub Releases** (free, permanent direct URLs, no download
quota, no virus-scan interstitial — unlike Google Drive).

1. Create a repo, e.g. `dosdeck-packs`.
2. Make a release (tag `v1`) and upload the pack zips as release assets.
3. The asset URL is `https://github.com/<you>/dosdeck-packs/releases/download/v1/<file>`.
4. Set `PACK_BASE` in `src/db.js` to `https://github.com/<you>/dosdeck-packs/releases/download/v1`.
5. Rebuild. On launch, fresh installs seed pack URLs and existing users are migrated
   automatically (download_url overwrite + setup_exe clear in the migration block).

To add a future pack: build the zip, add a row to `PACK_GAMES`, upload, ship.

## Legality

Only package **shareware** (Quake/Descent/Duke/Wacky Wheels shareware episodes,
Jill ep.1) and **freeware** titles — all of which permit free redistribution. Never
package commercial full games.

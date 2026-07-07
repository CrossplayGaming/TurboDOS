import { initDb, db } from './db.js';
import { blip, initMusic, sfxOn, musicOn, setSfx, setMusic, musicNext, musicPrev, musicToggle, musicStop, musicPlaying, currentTrack, shuffleOn, setShuffle, seedBundledMusicIfNeeded, restoreOriginalTracks, audioSuspend, audioResume } from './sfx.js';
import { initNav, setGameRunning } from './nav.js';
import { initMascot, homeMascot, mascotReact, mascotHold, mascotClearHold, mascotSay, mascotLaunchQuip, mascotChoiceQuip, mascotSelect, mascotOn, setMascot } from './mascot.js';
import { startBootSplash, showShutdownSplash } from './splash.js';

const DOOM_ENGINE_EXES = ['doom.exe','doom1.exe','doomsw.exe','doom2.exe','heretic.exe','hexen.exe','strife.exe','plutonia.exe','tnt.exe','final.exe'];
const BUILD_ENGINE_EXES = ['duke3d.exe'];
const GENERIC_ALWAYS_RUN_EXES = ['rott.exe'];
function isDoomEngine(game) {
  return DOOM_ENGINE_EXES.includes((game.executable || '').toLowerCase());
}
function supportsAlwaysRun(game) {
  const exe = (game.executable || '').toLowerCase();
  return DOOM_ENGINE_EXES.includes(exe) || BUILD_ENGINE_EXES.includes(exe) || GENERIC_ALWAYS_RUN_EXES.includes(exe);
}

// ─── State ───
const state = {
  screen: 'library',         // library | detail | wizard | add | settings
  games: [],
  filter: { genre: null, source: null, search: '', sort: 'title' },
  detail: { game: null, schemes: [], activeSchemeId: null, bindings: [] },
  wizard: { gameId: null, bindings: [], captureIndex: null },
  origControls: { game: null, rows: [], captureIndex: null },
  episodeEditor: { game: null, rows: [] },
  controllerSetup: { game: null, rows: [], fpsMouse: false, sensitivity: 5, capturing: null },
};

// ─── F11 fullscreen toggle ───
if (typeof window.__TAURI__ !== 'undefined') {
  document.addEventListener('keydown', async (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('toggle_fullscreen');
    }
  });
}

// ─── Boot ───
document.addEventListener('DOMContentLoaded', async () => {
  // BIOS boot splash — shown immediately and held over init (incl. first-run
  // art-pack download), so it doubles as an honest "loading" cover.
  const splash = startBootSplash({
    version: APP_VERSION,
    lastPlayed: localStorage.getItem('last_played') || '',
  });
  try {
    await initDb();
  } catch (e) {
    console.error('initDb failed:', e);
    document.body.innerHTML = `<div style="color:#37d6ff;font-family:monospace;padding:40px;white-space:pre-wrap">TURBODOS boot error:\n${e}\n\nCheck the Tauri dev console (Ctrl+Shift+I).</div>`;
    return;
  }
  renderShell();
  await seedBundledMusicIfNeeded();   // merge bundled tracks into the one user folder (first run)
  initMusic();
  initNav();
  initMascot();
  // Resume app audio + controller navigation when DOSBox exits.
  if (typeof window.__TAURI__ !== 'undefined') {
    import('@tauri-apps/api/event').then(({ listen }) =>
      listen('game-exited', () => {
        setGameRunning(false);
        gameSessionActive = false;
        audioResume();
        mascotReact('greet');   // welcome back from the game
        mascotSay('Welcome back. Miss me?');
      })
    ).catch(() => {});
  }
  // Shutdown splash: intercept the window close, show a brief retro power-off
  // card (skippable), then actually exit. Guarded so it only runs once.
  if (typeof window.__TAURI__ !== 'undefined') {
    import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const appWindow = getCurrentWindow();
      let closing = false;
      // Hard-exit via Rust (std::process::exit). window close()/destroy() proved
      // unreliable here — a lingering background thread kept the app alive and the
      // window "repopulated". A process exit is final and can't be undone.
      const hardExit = async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('exit_app');
        } catch {
          try { appWindow.destroy(); } catch { /* nothing left to try */ }
        }
      };
      // Keep this callback SYNCHRONOUS so preventDefault() registers during the event;
      // run the async goodbye separately.
      await appWindow.onCloseRequested((event) => {
        if (closing) return;
        closing = true;
        event.preventDefault();
        const failsafe = setTimeout(hardExit, 2500);   // never let the splash trap us
        (async () => {
          // Skip the goodbye card if a game (DOSBox) is still running — just exit.
          try { if (!gameSessionActive) await showShutdownSplash(); } catch { /* exiting anyway */ }
          finally { clearTimeout(failsafe); hardExit(); }
        })();
      });
    }).catch(() => {});
  }
  // Retro UI blips, one delegated listener — only the interactions that deserve a beep.
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.nav-btn, .rail-item, .scheme-tab, .game-tile, .toggle-slider, .nav-icon');
    if (!t) return;
    if (t.classList.contains('game-tile')) blip.select();
    else if (t.classList.contains('toggle-slider') || t.classList.contains('nav-icon')) blip.toggle();
    else blip.nav();
  });
  // Make the library screen visible so the first-run art-pack loading message shows.
  document.getElementById('library-screen').classList.add('active');
  // First run: grab the whole cover-art pack in one download so the library appears fully
  // illustrated, instead of dozens of slow per-game scrapes. No-op once art is populated.
  await installArtPackIfNeeded();
  await loadLibrary();
  await splash.finish(state.allGames?.length ?? 0);   // fade the BIOS splash into the ready library
  showScreen('library');
  scanGamesFolder().catch(e => toast('Scan error: ' + e));
  autoScrapeUnscraped();
});

// ─── Shell ───
const APP_VERSION = '0.3.1';

function renderShell() {
  // CRT scanlines are OFF by default; the settings toggle persists the choice.
  const scanlinesOn = localStorage.getItem('crt_scanlines') === 'on';
  document.body.classList.toggle('no-crt', !scanlinesOn);

  document.getElementById('app').innerHTML = `
    <div id="crt-bezel"></div>
    <nav id="nav">
      <span class="logo"><span class="word turbo">TURBO</span><span class="word dos">DOS</span></span>
      <button class="nav-btn active" data-screen="library">💾 Library</button>
      <button class="nav-btn" data-screen="add">🕹 Add Game</button>
      <button class="nav-btn" data-screen="settings">⚙ Settings</button>
      <button class="nav-btn" data-screen="guide">📖 Guide</button>
      <button class="nav-btn" data-screen="about">ℹ About</button>
      <span class="nav-spacer"></span>
      <span class="track-name" id="track-name" title=""></span>
      <div class="audio-cluster">
        <button class="nav-icon ${sfxOn() ? 'on' : ''}" id="sfx-nav-toggle" title="UI sound effects">${sfxOn() ? '🔊' : '🔇'}</button>
        <button class="nav-icon on" id="music-prev" title="Previous track">⏮</button>
        <button class="nav-icon on" id="music-playpause" title="Play / pause">${musicPlaying() ? '⏸' : '▶'}</button>
        <button class="nav-icon on" id="music-stop" title="Stop">⏹</button>
        <button class="nav-icon on" id="music-next" title="Next track">⏭</button>
        <button class="nav-icon ${shuffleOn() ? 'on' : ''}" id="music-shuffle" title="Shuffle tracks">🔀</button>
      </div>
      <div class="mhz"><div class="num">66</div><div class="lbl"><span class="power-led"></span>MHZ&nbsp;TURBO</div></div>
      <button class="nav-exit" id="app-exit" title="Exit TURBODOS">⏻</button>
    </nav>
    <div id="screens">
      <div class="screen" id="library-screen"></div>
      <div class="screen" id="detail-screen"></div>
      <div class="screen" id="wizard-screen"></div>
      <div class="screen" id="original-controls-screen"></div>
      <div class="screen" id="episode-editor-screen"></div>
      <div class="screen" id="controller-setup-screen"></div>
      <div class="screen" id="add-screen"></div>
      <div class="screen" id="settings-screen"></div>
      <div class="screen" id="guide-screen"></div>
      <div class="screen" id="about-screen"></div>
    </div>
    <div id="statusbar"></div>
    <div id="toast"></div>
  `;

  document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.screen;
      if (s === 'library') loadLibrary().then(() => showScreen('library'));
      else showScreen(s);
    });
  });

  const sfxBtn = document.getElementById('sfx-nav-toggle');
  sfxBtn.addEventListener('click', () => {
    const on = !sfxOn();
    setSfx(on);
    sfxBtn.textContent = on ? '🔊' : '🔇';
    sfxBtn.classList.toggle('on', on);
  });
  const playPauseBtn = document.getElementById('music-playpause');
  playPauseBtn.addEventListener('click', () => {
    const playing = musicToggle();
    renderTrackName(currentTrack());
    if (playing) mascotReact('dance');
  });
  document.getElementById('music-stop').addEventListener('click', () => {
    musicStop();
    renderTrackName('');
  });
  document.getElementById('music-prev').addEventListener('click', () => musicPrev());
  document.getElementById('music-next').addEventListener('click', () => { musicNext(); renderTrackName(currentTrack()); });
  // Keep the ▶/⏸ icon in sync with actual playback (autoplay, pause on game launch, etc.)
  const renderMusicState = (playing) => {
    const b = document.getElementById('music-playpause');
    if (b) { b.textContent = playing ? '⏸' : '▶'; b.title = playing ? 'Pause' : 'Play'; }
  };
  window.addEventListener('music-state', (e) => renderMusicState(!!e.detail?.playing));
  renderMusicState(musicPlaying());
  const shuffleBtn = document.getElementById('music-shuffle');
  shuffleBtn.addEventListener('click', () => {
    const on = !shuffleOn();
    setShuffle(on);
    shuffleBtn.classList.toggle('on', on);
    blip.toggle();
  });

  // "Now playing" readout — shows the current track name while music is on.
  const renderTrackName = (title) => {
    const el = document.getElementById('track-name');
    if (!el) return;
    const show = musicOn() && title;
    el.textContent = show ? `♪ ${title}` : '';
    el.title = show ? title : '';
    el.classList.toggle('show', !!show);
  };
  window.addEventListener('music-track', (e) => renderTrackName(e.detail?.title));
  renderTrackName(currentTrack());

  // Exit button — the window is borderless + fullscreen (no title-bar X), so this is
  // the primary way out. Route through the window's close() so the existing
  // onCloseRequested handler runs the shutdown splash then hard-exits via Rust.
  const exitBtn = document.getElementById('app-exit');
  if (exitBtn) {
    exitBtn.addEventListener('click', async () => {
      blip.toggle();
      if (typeof window.__TAURI__ !== 'undefined') {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().close();
        } catch {
          try { const { invoke } = await import('@tauri-apps/api/core'); await invoke('exit_app'); } catch { /* no exit path left */ }
        }
      } else {
        console.log('[TURBODOS] Exit clicked (simulated — no Tauri host)');
      }
    });
  }

  updateStatusBar();
}

function updateStatusBar() {
  const el = document.getElementById('statusbar');
  if (!el) return;
  const all = state.allGames || state.games;
  const found = state.games.length;
  const installed = all.filter(g => g.install_path).length;
  const last = (localStorage.getItem('last_played') || '—').toUpperCase();
  el.innerHTML = `
    <span><span class="k">C:\\&gt;</span> <span class="green">${found} GAME${found === 1 ? '' : 'S'} FOUND</span><span class="cursor"></span></span>
    <span class="k">INSTALLED: <span class="cyan">${installed}</span></span>
    <span class="k">LAST PLAYED: <span class="amber">${last}</span></span>
    <span class="k" style="margin-left:auto">v${APP_VERSION}</span>
  `;
}

// ─── Screen switching ───
function showScreen(name) {
  state.screen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`${name}-screen`).classList.add('active');

  document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === name);
  });

  if (name === 'library')  renderLibrary();
  if (name === 'add')      renderAddGame();
  if (name === 'settings') renderSettings();
  if (name === 'guide')    renderGuide();
  if (name === 'about')    renderAbout();
}

// ─── Guide / How-to ───
function renderGuide() {
  const el = document.getElementById('guide-screen');
  el.innerHTML = `
    <div class="frame about-frame">
      <div class="frame-title">Guide</div>
      <div class="about-body">
        <p class="about-tag">How TURBODOS works — and how to add your own games.</p>

        <h3>The basics</h3>
        <ul class="about-feats">
          <li><b>Browse</b> — use the left rail to filter by genre, search, or sort. Click a game to see it in the <b>Game Info</b> panel on the right.</li>
          <li><b>Play</b> — hit <b>▶ Play Game</b> in that panel. That's it.</li>
          <li><b>Badges</b> — <b>✓ Tuned</b> means it's verified working with correct controls; <b>⚡ Set up</b> means it isn't verified yet and may need a tweak.</li>
          <li><b>Controls</b> — each game has schemes: <b>Original</b> (the game's real defaults), <b>Modern WASD</b> (remapped for WASD + mouse where it fits), and <b>Custom</b> (your own). Pick one under the game's Controls.</li>
        </ul>

        <h3>Adding your own games — two ways</h3>
        <p>Which one you use depends on <i>where the game lives</i>:</p>
        <ul class="about-feats">
          <li><b>1. Point to an existing install (Steam, GOG, anywhere)</b> — use the <b>🕹 Add Game</b> tab. Browse to the game's <b>.exe</b> (or <b>.bat</b>), give it a title/genre, and Add to library. Nothing is copied — TURBODOS just launches it in place. Best for DOS games you already installed via Steam/GOG or that live in some folder on your PC.</li>
          <li><b>2. Drop a game folder into the GAMES folder</b> — on the Library screen, click <b>📂 Open GAMES Folder</b>, drop the game's <b>whole folder</b> (with its files/exe) inside, then relaunch the app. TURBODOS auto-detects it. Best for loose/portable DOS game folders.</li>
          <li><b>Change Install Folder</b> — sets where <i>downloaded</i> games get installed, if you want them somewhere other than the default.</li>
        </ul>

        <h3>Getting a stubborn game running</h3>
        <p>Old DOS games vary — these are the tools in <b>⚙ Manage</b> (and the side panel) for when Play doesn't work first try:</p>
        <ul class="about-feats">
          <li><b>⚙ Fix Exe</b> — tells the app <i>exactly which file</i> launches the game. Use it when Play runs the wrong thing (or nothing), to point at a Steam/GOG install, or when a game launches via a <b>.bat</b> instead of an .exe.</li>
          <li><b>Run Setup</b> — some DOS games need a one-time <b>sound/config setup</b> (e.g. SETUP.EXE) before they'll play with audio. Run it once, choose Sound Blaster, then Play.</li>
          <li><b>Run Installer</b> — a few shareware games ship as an <b>installer</b> (INSTALL.EXE) that has to unpack the game first. Run it once, then Fix Exe to the unpacked game.</li>
          <li><b>⬇ Download Shareware</b> — for the built-in library, grabs a pre-configured copy so there's no setup at all — just Play.</li>
          <li><b>🎮 Controller</b> — map a gamepad to the game, with full couch navigation of the app itself.</li>
        </ul>

        <h3>Handy to know</h3>
        <ul class="about-feats">
          <li><b>F11</b> toggles fullscreen. A <b>gamepad</b> (or arrow keys) navigates the whole UI.</li>
          <li><b>Your own music</b> — Settings → Audio → Open folder. Drop tracks in; the top-bar transport plays them.</li>
          <li><b>CRT scanlines, the mascot, and sound effects</b> can all be toggled in Settings.</li>
        </ul>

        <p style="margin-top:18px;color:var(--text-dim)">Adding your own games is the newest feature — if something's off, the <b>Fix Exe</b> and <b>Run Setup/Installer</b> buttons cover almost every case.</p>
      </div>
    </div>`;
}

// ─── About ───
function renderAbout() {
  const el = document.getElementById('about-screen');
  el.innerHTML = `
    <div class="frame about-frame">
      <div class="frame-title">About TURBODOS</div>
      <div class="about-body">
        <div class="logo about-logo"><span class="word turbo">TURBO</span><span class="word dos">DOS</span></div>
        <p class="about-tag">A one-click launcher for the golden age of DOS gaming.</p>

        <h3>What it is</h3>
        <p>TURBODOS is a curated front-end for classic MS-DOS games — a riveted-metal
        command center that finds, installs, configures, and launches the shareware
        and freeware classics for you. No DOSBox tinkering, no CONFIG.SYS, no sound-card
        guesswork. Pick a game, hit play.</p>

        <h3>What makes it different</h3>
        <ul class="about-feats">
          <li><b>Zero-setup installs</b> — games download pre-configured and just run; sound and controls are set up automatically.</li>
          <li><b>Real control mapping</b> — every game ships with its authentic original key layout, remappable schemes, and full <b>controller support</b> for couch play.</li>
          <li><b>Keyboard & gamepad navigation</b> — drive the whole UI from the couch, no mouse required.</li>
          <li><b>A living launcher</b> — a pixel-art buddy reacts to what you do, with a period-correct BIOS boot, PC-speaker blips, and a dark, gritty menu soundtrack.</li>
          <li><b>Your library, your way</b> — add your own games and your own music; everything lives in one tidy place.</li>
        </ul>

        <h3>Built for the love of it</h3>
        <p>TURBODOS is a passion project celebrating the era that started it all —
        made to be the friendliest possible on-ramp back to the games that defined PC gaming.</p>

        <div class="about-footer">
          <span class="about-ver">vTURBODOS ${APP_VERSION}</span>
          <a class="about-yt" id="about-youtube" href="https://youtube.com/crossplaygamingtv" target="_blank" rel="noreferrer">▶ youtube.com/crossplaygamingtv</a>
        </div>
      </div>
    </div>`;

  // In the Tauri shell, open the channel in the system browser instead of the webview.
  el.querySelector('#about-youtube')?.addEventListener('click', async (e) => {
    if (typeof window.__TAURI__ === 'undefined') return;   // dev: let the anchor work
    e.preventDefault();
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open('https://youtube.com/crossplaygamingtv');
    } catch { /* no opener available */ }
  });
}

// ─── Games Folder Auto-scan ───

// Maps normalized folder names to canonical DB titles for known/seeded games.
const FOLDER_TITLE_MAP = {
  'doom':                   'DOOM (Shareware)',
  'doom1':                  'DOOM (Shareware)',
  'dooms':                  'DOOM (Shareware)',
  'wolf3d':                 'Wolfenstein 3D (Shareware)',
  'wolfenstein3d':          'Wolfenstein 3D (Shareware)',
  'keen1':                  'Commander Keen 1',
  'commanderkeen1':         'Commander Keen 1',
  'duke3d':                 'Duke Nukem 3D',
  'dukenukum3d':            'Duke Nukem 3D',
  'monkey':                 'The Secret of Monkey Island',
  'monkeyisland':           'The Secret of Monkey Island',
  'secretofmonkeyisland':   'The Secret of Monkey Island',
  'tyrian':                 'Tyrian 2000',
  'tyrian2000':             'Tyrian 2000',
  'crystalcaves':           'Crystal Caves',
  'crystalcaves1':          'Crystal Caves',
  'cc1':                    'Crystal Caves',
  'duke1':                  'Duke Nukem (Shareware)',
  'dukenukum':              'Duke Nukem (Shareware)',
  'dukenukum1':             'Duke Nukem (Shareware)',
  'dukenukemshareware':     'Duke Nukem (Shareware)',
  'duke2':                  'Duke Nukem II (Shareware)',
  'dukenukemii':            'Duke Nukem II (Shareware)',
  'dukenukumii':            'Duke Nukem II (Shareware)',
  'heretic':                'Heretic (Shareware)',
  'hereticsw':              'Heretic (Shareware)',
  'hereticdos':             'Heretic (Shareware)',
};

function normFolder(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function scanGamesFolder() {
  if (typeof window.__TAURI__ === 'undefined') return;
  const { invoke } = await import('@tauri-apps/api/core');
  let found;
  try { found = await invoke('scan_games_folder'); } catch { return; }

  const existing = await db.getGames({});
  const byTitle = new Map(existing.map(g => [g.title.toLowerCase(), g]));
  const matchedIds = new Set();
  let addedCount = 0;

  const { scrapeMetadata, downloadArt } = await import('./launcher.js');

  for (const f of (found || [])) {
    const norm = normFolder(f.folder_name);
    // Match priority: folder_name field on DB record → FOLDER_TITLE_MAP → title fuzzy
    let match = existing.find(g => g.folder_name && normFolder(g.folder_name) === norm);
    if (!match) {
      const canonicalTitle = FOLDER_TITLE_MAP[norm];
      match = canonicalTitle
        ? byTitle.get(canonicalTitle.toLowerCase())
        : existing.find(g => normFolder(g.title) === norm);
    }

    if (match) {
      matchedIds.add(match.id);
      // For seeded games, trust the configured executable — don't let find_best_exe overwrite it.
      // For user-added (copied) games, always take the scanned executable.
      const useScannedExe = match.source_type === 'copied' || !match.executable;
      const newExe = useScannedExe ? f.executable : match.executable;
      if (match.install_path !== f.install_path || match.executable !== newExe) {
        await db.updateGame(match.id, { install_path: f.install_path, executable: newExe });
      }
    } else {
      const { id } = await db.addGame({ title: f.title, executable: f.executable, install_path: f.install_path, verified: 0 });
      matchedIds.add(id);
      addedCount++;
      await inheritSchemesFromSeed(id, f.executable);
      try {
        const meta = await scrapeMetadata(f.title);
        const updates = {};
        if (meta?.description) updates.description = meta.description;
        if (meta?.genre) updates.genre_tag = meta.genre;
        if (meta?.art_url) {
          const artPath = await downloadArt(meta.art_url, id);
          if (artPath) updates.art_path = artPath;
        }
        if (Object.keys(updates).length) await db.updateGame(id, updates);
      } catch { /* non-fatal */ }
    }
  }

  // For unmatched games: clear the install path so the game stays in the library
  // but shows as uninstalled (download / fix path options appear). Never auto-delete —
  // external installs (GOG, Steam) live outside the GAMES folder and will never be
  // found by this scan. Users remove games explicitly via Remove from Library.
  for (const g of existing) {
    if (!matchedIds.has(g.id) && g.install_path) {
      await db.updateGame(g.id, { install_path: '', executable: '' });
    }
  }

  await loadLibrary();
  renderLibrary();
  if (addedCount > 0) toast(`${addedCount} new game${addedCount > 1 ? 's' : ''} added from GAMES folder`);
}

// ─── Library ───
async function loadLibrary() {
  state.games = await db.getGames(state.filter);
  // Unfiltered set for category counts + installed total in the status bar
  state.allGames = await db.getGames({});
  if (typeof window.__TAURI__ !== 'undefined') {
    const { loadArtAsUrl } = await import('./launcher.js');
    // Resolve all art in parallel — cache hits return instantly, misses load concurrently
    await Promise.all(state.games.map(async g => {
      if (g.art_path) g._artUrl = await loadArtAsUrl(g.art_path);
    }));
  }
  updateStatusBar();
}

function renderLibrary() {
  const el = document.getElementById('library-screen');
  const all = state.allGames || state.games;
  const counts = {};
  for (const g of all) counts[g.genre_tag] = (counts[g.genre_tag] || 0) + 1;
  const included = all.filter(g => g.source_type !== 'copied').length;
  const mine = all.length - included;
  const cats = [
    { key: '',          label: 'All Games', icon: '💾', count: all.length },
    { key: 'fps',       label: 'FPS',       icon: '🔫', count: counts.fps || 0 },
    { key: 'platform',  label: 'Platform',  icon: '🏃', count: counts.platform || 0 },
    { key: 'shooter',   label: 'Shooter',   icon: '🚀', count: counts.shooter || 0 },
    { key: 'adventure', label: 'Adventure', icon: '🗺️', count: counts.adventure || 0 },
    { key: 'racing',    label: 'Racing',    icon: '🏎️', count: counts.racing || 0 },
    { key: 'fighting',  label: 'Fighting',  icon: '🥊', count: counts.fighting || 0 },
    { key: 'action',    label: 'Action',    icon: '💥', count: counts.action || 0 },
    { key: 'rpg',       label: 'RPG',       icon: '⚔️', count: counts.rpg || 0 },
  ].filter(c => c.key === '' || c.count > 0);

  el.innerHTML = `
    <div id="lib-layout">
      <aside id="lib-rail" class="frame">
        <div class="frame-title">Categories</div>
        <div class="rail-search">
          <div style="padding:4px 2px 2px">
            <input id="search-input" type="text" placeholder="Search games…" value="${state.filter.search}">
          </div>
          <div style="padding:6px 2px 2px">
            <select class="sort-select" id="sort-select">
              <option value="title" ${state.filter.sort === 'title' ? 'selected' : ''}>A–Z</option>
              <option value="verified" ${state.filter.sort === 'verified' ? 'selected' : ''}>Tuned first</option>
              <option value="genre" ${state.filter.sort === 'genre' ? 'selected' : ''}>Genre</option>
            </select>
          </div>
        </div>
        <div class="rail-scroll">
          ${cats.map(c => `
            <div class="rail-item ${!state.filter.source && (state.filter.genre || '') === c.key ? 'active' : ''}" data-genre="${c.key}" data-source="">
              <span>${c.icon} ${c.label}</span><span class="count">${c.count}</span>
            </div>`).join('')}
          <div class="rail-section-gap"></div>
          <div class="rail-item ${state.filter.source === 'included' ? 'active' : ''}" data-genre="" data-source="included">
            <span>📦 TurboDOS</span><span class="count">${included}</span>
          </div>
          <div class="rail-item ${state.filter.source === 'user' ? 'active' : ''}" data-genre="" data-source="user">
            <span>📁 My Games</span><span class="count">${mine}</span>
          </div>
        </div>
        <div class="rail-actions">
          <button class="btn-secondary" id="open-games-folder-btn" style="font-size:15px">📂 Open GAMES Folder</button>
          <button class="btn-secondary" id="change-games-folder-btn" style="font-size:15px">📁 Change Install Folder</button>
        </div>
        <div id="mascot-dock"></div>
      </aside>
      <section id="lib-center">
        <div id="game-grid">${renderGameGrid()}</div>
      </section>
      <aside id="lib-side" class="frame">
        <div class="frame-title">Game Info</div>
        <div class="side-scroll" id="side-content"></div>
      </aside>
    </div>
  `;

  homeMascot();   // re-attach the persistent mascot node into the freshly-rendered rail dock

  // NOTE: use loadLibrary() (not db.getGames directly) after any filter change so each
  // game's _artUrl is resolved before we render — otherwise the grid shows no artwork
  // until the game objects are re-hydrated elsewhere.
  el.querySelector('#search-input').addEventListener('input', async (e) => {
    state.filter.search = e.target.value;
    await loadLibrary();
    el.querySelector('#game-grid').innerHTML = renderGameGrid();
    bindTileHandlers();
    if (state.filter.search.length >= 3 && state.games.length === 0) mascotSay("Nothing? Even I'm stumped.");
  });

  el.querySelectorAll('.rail-item').forEach(item => {
    item.addEventListener('click', async () => {
      state.filter.genre  = item.dataset.genre  || null;
      state.filter.source = item.dataset.source || null;
      if (item.dataset.genre) mascotSelect(item.dataset.genre);   // genre reaction on category pick
      await loadLibrary();
      renderLibrary();
    });
  });

  el.querySelector('#sort-select').addEventListener('change', async (e) => {
    state.filter.sort = e.target.value;
    await loadLibrary();
    el.querySelector('#game-grid').innerHTML = renderGameGrid();
    bindTileHandlers();
  });

  el.querySelector('#open-games-folder-btn')?.addEventListener('click', async () => {
    if (typeof window.__TAURI__ === 'undefined') return;
    const { invoke } = await import('@tauri-apps/api/core');
    invoke('open_games_folder').catch(() => {});
  });

  el.querySelector('#change-games-folder-btn')?.addEventListener('click', async () => {
    if (typeof window.__TAURI__ === 'undefined') return;
    const { invoke } = await import('@tauri-apps/api/core');
    const { open } = await import('@tauri-apps/plugin-dialog');
    const current = await invoke('get_games_folder').catch(() => '');
    const selected = await open({
      title: 'Choose a folder for installed games',
      directory: true,
      defaultPath: current || undefined,
    });
    if (!selected) return;
    const newPath = typeof selected === 'string' ? selected : selected.path;
    if (!confirm(
      `Games will now be installed to:\n${newPath}\n\n` +
      `Games already installed elsewhere will keep working from their current location, ` +
      `but won't show up in this new folder. Continue?`
    )) return;
    try {
      await invoke('set_games_folder', { path: newPath });
      toast('Games install folder updated.');
    } catch (e) {
      toast(`Couldn't set folder: ${e}`);
    }
  });

  bindTileHandlers();

  // Restore the side panel selection if the game is still visible
  if (state.selectedGameId && state.games.some(g => g.id === state.selectedGameId)) {
    selectGame(state.selectedGameId);
  } else {
    state.selectedGameId = null;
    renderSideEmpty();
  }
}

function bindTileHandlers() {
  document.querySelectorAll('#game-grid .game-tile').forEach(tile => {
    tile.classList.toggle('selected', parseInt(tile.dataset.id) === state.selectedGameId);
    tile.addEventListener('click', () => selectGame(parseInt(tile.dataset.id)));
    tile.addEventListener('dblclick', () => openDetail(parseInt(tile.dataset.id)));
  });
}

// ─── Side detail panel (library screen) ───
function renderSideEmpty() {
  const c = document.getElementById('side-content');
  if (c) c.innerHTML = `
    <div class="side-empty">
      <span class="pixel-icon">?</span>
      <p>Select a game<br>to view details</p>
    </div>`;
}

async function selectGame(gameId) {
  state.selectedGameId = gameId;
  const game = await db.getGame(gameId);
  if (!game) return;
  const rawSchemes = await db.getSchemes(gameId);
  const schemeOrder = s => s.input_style === 'original' ? 0 : s.name === 'Modern WASD' ? 1 : 2;
  const schemes = rawSchemes.sort((a, b) => schemeOrder(a) - schemeOrder(b));
  const activeId = schemes[0]?.id || null;
  const bindings = activeId ? await db.getBindings(activeId) : [];

  let artUrl = null;
  if (game.art_path && typeof window.__TAURI__ !== 'undefined') {
    const { loadArtAsUrl } = await import('./launcher.js');
    artUrl = await loadArtAsUrl(game.art_path);
  }

  // Same state contract as openDetail — playGame() reads state.detail directly.
  state.detail = { game, schemes, activeSchemeId: activeId, bindings, artUrl };
  mascotSelect(game.genre_tag);       // genre-specific reaction animation
  mascotChoiceQuip(game.genre_tag);   // occasional thought-bubble reaction to your pick

  document.querySelectorAll('#game-grid .game-tile').forEach(t =>
    t.classList.toggle('selected', parseInt(t.dataset.id) === gameId));
  renderSidePanel();
}

function renderSidePanel() {
  const c = document.getElementById('side-content');
  if (!c) return;
  const { game, schemes, activeSchemeId, bindings, artUrl } = state.detail;
  if (!game) { renderSideEmpty(); return; }

  const eps = game.episodes ? (() => { try { return JSON.parse(game.episodes); } catch { return null; } })() : null;
  const playArea = (() => {
    if (eps && eps.length > 1) {
      return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        ${eps.map(ep => `<button class="btn-play episode-play-btn" data-exe="${ep.exe}" ${!game.install_path ? 'disabled' : ''} style="font-size:8px;padding:10px 10px 8px">▶ ${ep.label}</button>`).join('')}
      </div>`;
    }
    const soloExe = eps && eps.length === 1 ? eps[0].exe : '';
    return `<button class="btn-play" id="side-play-btn" ${soloExe ? `data-exe="${soloExe}"` : ''} ${!game.install_path ? 'disabled' : ''} style="width:100%;margin-bottom:10px">▶ Play Game</button>`;
  })();

  c.innerHTML = `
    <div class="side-title">${game.title}</div>
    <div style="margin-bottom:8px;display:flex;gap:8px;align-items:center">
      <span class="status-badge ${game.verified ? 'tuned' : 'setup'}">${game.verified ? '✓ Tuned' : '⚡ Set up'}</span>
      <span style="font-size:15px;color:var(--text-dim);text-transform:uppercase">${game.genre_tag || ''}</span>
    </div>
    ${playArea}
    ${!game.install_path && game.download_url ? `<button class="btn-secondary" id="download-btn" style="width:100%;margin-bottom:8px;color:var(--green);border-color:var(--green-dim)">⬇ Download Shareware</button>` : ''}
    ${!game.install_path && !game.download_url && !game.buy_url ? `<div style="font-size:16px;color:var(--amber);margin-bottom:8px">📁 Drop this game's folder into the GAMES folder, then relaunch.</div>` : ''}
    ${game.buy_url ? `<button class="btn-secondary" id="side-buy-btn" style="width:100%;margin-bottom:8px">🛒 Buy Full Version</button>` : ''}
    <div style="display:flex;gap:8px;margin-bottom:10px">
      ${game.install_path ? `<button class="btn-wizard" id="side-ctrl-btn" style="flex:1;justify-content:center">🎮 Controller</button>` : ''}
      <button class="btn-wizard" id="side-manage-btn" style="flex:1;justify-content:center">⚙ Manage</button>
    </div>
    ${artUrl
      ? `<img class="side-art" src="${artUrl}" alt="${game.title} cover">`
      : `<div class="side-art-placeholder">${genreIcon(game.genre_tag)}</div>`}
    <div class="side-desc" style="display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden">${game.description || ''}</div>
    ${schemes.length ? `
      <div class="control-section-label">Controls</div>
      <div class="scheme-tabs">
        ${schemes.map(s => `<button class="scheme-tab ${s.id === activeSchemeId ? 'active' : ''}" data-scheme="${s.id}">${s.name}</button>`).join('')}
      </div>
      <div class="binding-preview" style="max-height:150px">
        ${bindings.slice(0, 8).map(b => `<div class="binding-row"><span class="binding-action">${b.action}</span><span class="binding-key">${b.input}</span></div>`).join('')}
        ${bindings.length > 8 ? `<div class="binding-row"><span class="binding-action">+${bindings.length - 8} more — see ⚙ Manage</span></div>` : ''}
      </div>` : ''}
  `;

  c.querySelectorAll('.scheme-tab').forEach(t => t.addEventListener('click', async () => {
    state.detail.activeSchemeId = parseInt(t.dataset.scheme);
    state.detail.bindings = await db.getBindings(state.detail.activeSchemeId);
    renderSidePanel();
  }));
  c.querySelector('#side-play-btn')?.addEventListener('click', (e) => {
    const exe = e.currentTarget.dataset.exe;
    playGame(exe ? { exeOverride: exe } : {});
  });
  c.querySelectorAll('.episode-play-btn').forEach(b =>
    b.addEventListener('click', () => playGame({ exeOverride: b.dataset.exe })));
  c.querySelector('#download-btn')?.addEventListener('click', () => downloadShareware(state.detail.game));
  c.querySelector('#side-buy-btn')?.addEventListener('click', async () => {
    if (!game.buy_url) return;
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(game.buy_url);
    } catch { window.open(game.buy_url, '_blank'); }
  });
  c.querySelector('#side-ctrl-btn')?.addEventListener('click', () => openControllerSetup(state.detail.game));
  c.querySelector('#side-manage-btn')?.addEventListener('click', () => openDetail(game.id));
}

function sortedGames() {
  const games = [...state.games];
  if (state.filter.sort === 'title') games.sort((a,b) => a.title.localeCompare(b.title));
  if (state.filter.sort === 'verified') games.sort((a,b) => b.verified - a.verified);
  if (state.filter.sort === 'genre') games.sort((a,b) => (a.genre_tag||'').localeCompare(b.genre_tag||''));
  return games;
}

function genreColor(genre) {
  const map = { fps: '#cc2200', adventure: '#5a3a82', shooter: '#226600', platform: '#cc6600', rpg: '#003399', strategy: '#996600' };
  return map[genre] || '#444';
}

function renderGameGrid() {
  const games = sortedGames();
  if (!games.length) return `<div class="empty-state"><div class="pixel-icon">📂</div><p>No games found. Add one!</p></div>`;
  return games.map(g => `
    <button class="game-tile" data-id="${g.id}" data-genre="${g.genre_tag || ''}">
      ${g._artUrl
        ? `<img src="${g._artUrl}" class="tile-art-img" alt="${g.title}" style="width:100%;aspect-ratio:3/4;object-fit:cover;display:block">`
        : `<div class="tile-art-placeholder" style="background: linear-gradient(160deg, #1a0030 0%, #0a0010 100%);">
            <span style="font-size:32px">${genreIcon(g.genre_tag)}</span>
            <span>${(g.genre_tag || 'GAME').toUpperCase()}</span>
          </div>`
      }
      <div class="tile-info">
        <div class="tile-title">${g.title}</div>
        <span class="status-badge ${g.verified ? 'tuned' : 'setup'}">${g.verified ? '✓ Tuned' : '⚡ Set up'}</span>
      </div>
    </button>
  `).join('');
}

function genreIcon(genre) {
  const icons = { fps: '🔫', adventure: '🗺️', platform: '🎮', shooter: '🚀', rpg: '⚔️', strategy: '♟️' };
  return icons[genre] || '🎯';
}

// ─── Game Detail ───
async function openDetail(gameId) {
  const game = await db.getGame(gameId);
  if (!game) return;
  const rawSchemes = await db.getSchemes(gameId);
  const schemeOrder = s => s.input_style === 'original' ? 0 : s.name === 'Modern WASD' ? 1 : 2;
  const schemes = rawSchemes.sort((a, b) => schemeOrder(a) - schemeOrder(b));
  const activeId = schemes[0]?.id || null;
  const bindings = activeId ? await db.getBindings(activeId) : [];

  let artUrl = null;
  if (game.art_path) {
    const { loadArtAsUrl } = await import('./launcher.js');
    artUrl = await loadArtAsUrl(game.art_path);
  }

  state.detail = { game, schemes, activeSchemeId: activeId, bindings, artUrl };
  renderDetail();
  showScreen('detail');
}

async function selectScheme(schemeId) {
  state.detail.activeSchemeId = schemeId;
  state.detail.bindings = await db.getBindings(schemeId);
  renderDetail();
}

function renderDetail() {
  const { game, schemes, activeSchemeId, bindings } = state.detail;
  const el = document.getElementById('detail-screen');
  const color = genreColor(game.genre_tag);

  el.innerHTML = `
    <button class="detail-back" id="back-btn">← Library</button>
    <div class="detail-layout">
      <div class="detail-art-wrap">
        ${state.detail.artUrl
          ? `<img src="${state.detail.artUrl}" class="detail-art-img" alt="${game.title} cover" style="width:100%;border-radius:4px;border-top:4px solid ${color};display:block;object-fit:cover">`
          : `<div class="detail-art-placeholder" style="border-top: 4px solid ${color}; background: linear-gradient(160deg, #1a0030 0%, #0a0010 100%);">
              <span style="font-size:52px">${genreIcon(game.genre_tag)}</span>
              <span style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim)">${(game.genre_tag||'').toUpperCase()}</span>
            </div>`
        }
      </div>
      <div class="detail-info">
        <div class="detail-title">${game.title}</div>
        <div class="detail-genre-label">${game.genre_tag || 'Unknown'} ${game.subtype ? '· ' + game.subtype : ''}</div>
        <p class="detail-desc">${game.description || ''}</p>

        ${schemes.length ? `
          <div class="control-section-label">Control scheme</div>
          <div class="scheme-tabs">
            ${schemes.map(s =>
              `<button class="scheme-tab ${s.id === activeSchemeId ? 'active' : ''}" data-scheme="${s.id}">${s.name}</button>`
            ).join('')}
          </div>
          ${supportsAlwaysRun(game) && activeSchemeId ? (() => {
            const activeScheme = schemes.find(s => s.id === activeSchemeId);
            const on = activeScheme?.always_run ? true : false;
            return `<div style="display:flex;align-items:center;gap:10px;margin:8px 0 4px">
              <span style="font-size:12px;color:var(--text-secondary)">Always run</span>
              <label class="toggle" style="margin:0">
                <input type="checkbox" id="always-run-toggle" ${on ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
              <span style="font-size:11px;color:var(--text-dim)">${on ? 'On' : 'Off'}</span>
            </div>`;
          })() : ''}
          <div class="binding-preview">
            ${bindings.length ? bindings.map(b => `
              <div class="binding-row">
                <span class="binding-action">${b.action}</span>
                <span class="binding-key">${b.input || '—'}</span>
              </div>
            `).join('') : '<div style="color:var(--text-dim);font-size:12px;padding:8px">No bindings yet.</div>'}
          </div>
        ` : ''}

        ${(() => {
          const eps = game.episodes ? (() => { try { return JSON.parse(game.episodes); } catch { return null; } })() : null;
          // Only show per-episode buttons when there's genuinely more than one episode.
          // A single (or zero) episode collapses to one PLAY button below.
          if (eps && eps.length > 1) {
            return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
              ${eps.map(ep => `<button class="btn-play episode-play-btn" data-exe="${ep.exe}" ${!game.install_path ? 'disabled' : ''} style="font-size:12px;padding:8px 14px">▶ ${ep.label}</button>`).join('')}
            </div>`;
          }
          return '';
        })()}
        <div class="detail-actions">
          ${(() => {
            const eps = game.episodes ? (() => { try { return JSON.parse(game.episodes); } catch { return null; } })() : null;
            if (!eps || eps.length <= 1) {
              // Single episode → PLAY launches that episode's exe; zero → default executable.
              const soloExe = eps && eps.length === 1 ? eps[0].exe : '';
              return `<button class="btn-play" id="play-btn" ${soloExe ? `data-exe="${soloExe}"` : ''} ${!game.install_path ? 'disabled' : ''}>▶ PLAY</button>`;
            }
            return '';
          })()}
          <button class="btn-wizard" id="wizard-btn">⌨️ Customize Controls</button>
          <button class="btn-wizard" id="orig-controls-btn" style="font-size:11px;padding:7px 12px">📋 Enter Original Controls</button>
          ${game.install_path ? `<button class="btn-wizard" id="controller-setup-btn" style="font-size:11px;padding:7px 12px">🎮 Controller</button>` : ''}
          ${(() => {
            const activeScheme = schemes.find(s => s.id === activeSchemeId);
            return activeScheme?.name === 'Custom Controls' && bindings.length
              ? `<button class="btn-secondary" id="clear-custom-btn" style="padding:6px 12px;font-size:11px;color:var(--amber);border-color:var(--amber)">✕ Clear Custom</button>`
              : '';
          })()}
        </div>
        ${!game.install_path ? `
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            ${game.download_url ? `<button class="btn-secondary" id="download-btn" style="padding:6px 14px;font-size:12px;background:var(--green);color:#000;border-color:var(--green)">⬇ Download Shareware</button>` : ''}
            ${game.buy_url ? `<button class="btn-secondary" id="buy-btn" style="padding:6px 14px;font-size:12px">🛒 Buy Full Version</button>` : ''}
            ${!game.download_url && !game.buy_url ? `<div style="font-size:11px;color:var(--amber)">📁 Drop this game's folder into the GAMES folder, then relaunch the app.</div>` : ''}
          </div>
        ` : ''}
        ${game.buy_url && game.install_path ? `<div style="margin-top:8px"><button class="btn-secondary" id="buy-btn" style="padding:5px 12px;font-size:11px">🛒 Buy Full Version</button></div>` : ''}
        ${!game.verified ? '<div style="margin-top:4px;font-size:10px;color:var(--text-dim)">⚡ Controls not yet verified.</div>' : ''}
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.07)">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${game.source_type === 'copied' && !schemes.find(s => s.input_style === 'original')
              ? `<button class="btn-secondary" id="import-controls-btn" style="padding:4px 10px;font-size:10px;color:var(--green);border-color:var(--green)">⬇ Import Controls</button>`
              : ''}
            <button class="btn-secondary" id="scrape-btn" style="padding:4px 10px;font-size:10px">🔍 Scrape</button>
            <button class="btn-secondary" id="custom-art-btn" style="padding:4px 10px;font-size:10px">🖼 Custom Art</button>
            <button class="btn-secondary" id="fix-exe-btn" style="padding:4px 10px;font-size:10px">⚙ Fix Exe</button>
            ${game.install_path ? `<button class="btn-secondary" id="edit-episodes-btn" style="padding:4px 10px;font-size:10px">🎬 Edit Episodes</button>` : ''}
            ${game.install_path ? `<button class="btn-secondary" id="run-setup-btn" style="padding:4px 10px;font-size:10px">${game.setup_exe ? `⚙ Run ${game.setup_exe}` : '⚙ Run Setup'}</button>` : ''}
            ${game.install_path ? `<button class="btn-secondary" id="remove-files-btn" style="padding:4px 10px;font-size:10px;color:var(--amber);border-color:var(--amber)">🗑 Remove Files</button>` : ''}
            ${(game.install_path || game.source_type === 'copied') ? `<button class="btn-secondary" id="remove-library-btn" style="padding:4px 10px;font-size:10px;color:#e05555;border-color:#e05555">✕ Remove from Library</button>` : ''}
          </div>
          ${game.install_path ? `<div style="margin-top:4px;font-size:10px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📁 ${game.install_path}\\${game.executable}</div>` : ''}
          ${game.install_path ? `<div style="margin-top:2px;font-size:10px;color:var(--text-dim)">🎬 Edit Episodes / ⚙ Run Setup — if applicable</div>` : ''}
        </div>
        <div id="scrape-result" style="display:none;margin-top:6px;font-size:11px;color:var(--green)"></div>
      </div>
    </div>
  `;

  el.querySelector('#back-btn').addEventListener('click', async () => {
    await loadLibrary();
    showScreen('library');
  });
  el.querySelectorAll('.scheme-tab').forEach(tab => {
    tab.addEventListener('click', () => selectScheme(parseInt(tab.dataset.scheme)));
  });
  el.querySelector('#always-run-toggle')?.addEventListener('change', async (e) => {
    const val = e.target.checked ? 1 : 0;
    await db.updateScheme(state.detail.activeSchemeId, { always_run: val });
    const scheme = state.detail.schemes.find(s => s.id === state.detail.activeSchemeId);
    if (scheme) scheme.always_run = val;
    e.target.nextElementSibling.nextElementSibling.textContent = val ? 'On' : 'Off';
  });
  el.querySelector('#play-btn')?.addEventListener('click', (e) => {
    const exe = e.currentTarget.dataset.exe;
    playGame(exe ? { exeOverride: exe } : {});
  });
  el.querySelectorAll('.episode-play-btn').forEach(btn => {
    btn.addEventListener('click', () => playGame({ exeOverride: btn.dataset.exe }));
  });
  el.querySelector('#wizard-btn').addEventListener('click', () => openWizard(game.id));
  el.querySelector('#clear-custom-btn')?.addEventListener('click', async () => {
    if (!confirm(`Clear all custom controls for ${game.title}?`)) return;
    await db.deleteBindings(state.detail.activeSchemeId);
    state.detail.bindings = [];
    renderDetail();
    toast('Custom controls cleared.');
  });
  el.querySelector('#orig-controls-btn').addEventListener('click', () => openOriginalControls(game));
  el.querySelector('#controller-setup-btn')?.addEventListener('click', () => openControllerSetup(game));
  el.querySelector('#import-controls-btn')?.addEventListener('click', async () => {
    const inherited = await inheritSchemesFromSeed(game.id, game.executable);
    if (inherited) {
      toast(`✓ Controls imported from matching game.`);
      await openDetail(game.id);
    } else {
      toast('No matching seeded game found for ' + game.executable);
    }
  });
  el.querySelector('#scrape-btn').addEventListener('click', () => scrapeForGame(game));
  el.querySelector('#custom-art-btn').addEventListener('click', () => pickCustomArt(game));
  el.querySelector('#fix-exe-btn').addEventListener('click', () => fixExePath(game));
  el.querySelector('#edit-episodes-btn')?.addEventListener('click', () => openEpisodeEditor(game));
  el.querySelector('#run-setup-btn')?.addEventListener('click', () => runSetup(game));
  el.querySelector('#download-btn')?.addEventListener('click', () => downloadShareware(game));
  el.querySelector('#remove-files-btn')?.addEventListener('click', () => removeGameFiles(game));
  el.querySelector('#remove-library-btn')?.addEventListener('click', () => removeFromLibrary(game));
  el.querySelector('#buy-btn')?.addEventListener('click', async () => {
    if (!game.buy_url) return;
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(game.buy_url);
    } catch { window.open(game.buy_url, '_blank'); }
  });
}

async function scrapeForGame(game) {
  const resultEl = document.getElementById('scrape-result');
  const btn = document.getElementById('scrape-btn');
  if (!resultEl || !btn) return;
  btn.disabled = true;
  btn.textContent = '🔍 Scraping…';
  resultEl.style.display = 'block';
  resultEl.style.color = 'var(--text-dim)';
  resultEl.textContent = 'Scraping…';
  try {
    const { scrapeMetadata, downloadArt, loadArtAsUrl } = await import('./launcher.js');
    const meta = await scrapeMetadata(game.title);

    if (!meta) { resultEl.textContent = '✗ No response from scraper'; return; }

    // If ScreenScraper returned an error, show it prominently
    if (meta.source === 'ss_error') {
      resultEl.style.color = 'var(--amber)';
      resultEl.textContent = `ScreenScraper error: ${meta.error}`;
      return;
    }

    // Show diagnostic
    const diagLines = [
      `source: ${meta.source}`,
      `description: ${meta.description ? meta.description.substring(0,60)+'…' : '(none)'}`,
      `art_url: ${meta.art_url || '(none)'}`,
      `genre: ${meta.genre || '(none)'}`,
    ];
    resultEl.innerHTML = diagLines.map(l => `<div>${l}</div>`).join('');

    const updates = {};
    if (meta.description && !game.description) updates.description = meta.description;
    if (meta.genre && !game.genre_tag) updates.genre_tag = meta.genre;

    if (meta.art_url) {
      btn.textContent = '🖼 Downloading art…';
      resultEl.innerHTML += '<div>Downloading art…</div>';
      const { invalidateArtCache } = await import('./launcher.js');
      const artPath = await downloadArt(meta.art_url, game.id);
      if (artPath) {
        invalidateArtCache(game.art_path);
        updates.art_path = artPath;
        resultEl.innerHTML += `<div style="color:var(--green)">✓ Art saved: ${artPath}</div>`;
      } else {
        resultEl.innerHTML += '<div style="color:var(--amber)">✗ Art download failed</div>';
      }
    }

    if (Object.keys(updates).length) {
      await db.updateGame(game.id, updates);
      Object.assign(game, updates);
      if (updates.art_path) {
        state.detail.artUrl = await loadArtAsUrl(updates.art_path);
      }
      resultEl.style.color = 'var(--green)';
      renderDetail();
    }
  } catch (e) {
    resultEl.style.color = 'var(--amber)';
    resultEl.textContent = `Error: ${e}`;
    console.error('scrapeForGame error:', e);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 Scrape info';
  }
}

// First-run cover art: download the whole art pack in ONE request and map each cover to
// its game by title slug. Replaces dozens of slow per-game scrapes on a fresh install.
// User-added games and any misses (e.g. games not in the pack) still scrape live via
// autoScrapeUnscraped() through SteamGridDB — that path is untouched.
async function installArtPackIfNeeded() {
  if (typeof window.__TAURI__ === 'undefined') return;
  const slug = t => (t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let seeded;
  try {
    const games = await db.getGames();
    seeded = games.filter(g => g.source_type !== 'copied');
  } catch { return; }
  const withArt = seeded.filter(g => g.art_path);
  // Only on a fresh-ish install (most covers still missing). Once populated, skip entirely.
  if (!seeded.length || withArt.length >= seeded.length * 0.5) return;
  const lib = document.getElementById('library-screen');
  if (lib) lib.innerHTML = `<div style="padding:64px 24px;text-align:center;color:var(--text-dim);font-family:monospace;line-height:1.8">Setting up your library…<br><span style="font-size:12px">Downloading cover art (one-time, a few seconds).</span></div>`;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const url = 'https://github.com/CrossplayGaming/dosdeck-packs/releases/download/v1/art.zip';
    const entries = await invoke('install_art_pack', { url });
    const byKey = new Map((entries || []).map(e => [e.key, e.path]));
    for (const g of seeded) {
      if (g.art_path) continue;
      const p = byKey.get(slug(g.title));
      if (p) await db.updateGame(g.id, { art_path: p });
    }
  } catch (e) { console.warn('art pack install failed:', e); }
}

async function autoScrapeUnscraped() {
  // Silently scrape art for any seeded game that has an install_path but no art yet
  try {
    const games = await db.getGames();
    const needsArt = games.filter(g => !g.art_path && g.source_type !== 'copied');
    if (!needsArt.length) return;
    const { scrapeMetadata, downloadArt, loadArtAsUrl } = await import('./launcher.js');
    for (const game of needsArt) {
      try {
        const meta = await scrapeMetadata(game.title);
        if (!meta || !meta.art_url) continue;
        const artPath = await downloadArt(meta.art_url, game.id);
        if (artPath) {
          await db.updateGame(game.id, { art_path: artPath, description: meta.description || game.description });
          const g = state.games.find(g => g.id === game.id);
          if (g) { g.art_path = artPath; g._artUrl = await loadArtAsUrl(artPath); }
        }
      } catch { /* skip individual failures silently */ }
    }
    renderLibrary();
  } catch { /* silent */ }
}

async function pickCustomArt(game) {
  if (typeof window.__TAURI__ === 'undefined') return;
  const resultEl = document.getElementById('scrape-result');
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      title: 'Choose cover art',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
      multiple: false,
    });
    if (!selected) return;
    const filePath = typeof selected === 'string' ? selected : selected.path;
    if (!filePath) return;

    const { invoke } = await import('@tauri-apps/api/core');
    const { loadArtAsUrl, invalidateArtCache } = await import('./launcher.js');
    const artPath = await invoke('copy_local_art', { srcPath: filePath, gameId: Number(game.id) });
    invalidateArtCache(game.art_path);
    await db.updateGame(game.id, { art_path: artPath });
    game.art_path = artPath;
    state.detail.artUrl = await loadArtAsUrl(artPath);
    const g = state.games.find(g => g.id === game.id);
    if (g) { g.art_path = artPath; g._artUrl = state.detail.artUrl; }
    renderDetail();
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.style.color = 'var(--green)';
      resultEl.textContent = '✓ Custom art saved.';
    }
  } catch (e) {
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.style.color = 'var(--amber)';
      resultEl.textContent = `Art error: ${e}`;
    }
  }
}

async function fixExePath(game) {
  if (typeof window.__TAURI__ === 'undefined') return;
  const resultEl = document.getElementById('scrape-result');
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      title: 'Select the game executable',
      filters: [{ name: 'Executables', extensions: ['exe', 'com', 'bat'] }],
      defaultPath: game.install_path || undefined,
      multiple: false,
    });
    if (!selected) return;
    const filePath = typeof selected === 'string' ? selected : selected.path;
    if (!filePath) return;

    // Derive install_path and executable from the selected file
    const sep = filePath.includes('\\') ? '\\' : '/';
    const lastSep = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
    const dir = filePath.substring(0, lastSep);
    const exe = filePath.substring(lastSep + 1).toUpperCase();

    const updates = { executable: exe };
    // If the game has no install_path yet, set it from the selected file's directory
    if (!game.install_path && dir) updates.install_path = dir;

    await db.updateGame(game.id, updates);
    Object.assign(game, updates);
    const g = state.games.find(g => g.id === game.id);
    if (g) Object.assign(g, updates);
    renderDetail();
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.style.color = 'var(--green)';
      resultEl.textContent = `✓ Executable set to ${exe}`;
    }
  } catch (e) {
    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.style.color = 'var(--amber)';
      resultEl.textContent = `Exe fix error: ${e}`;
    }
  }
}

async function removeGameFiles(game) {
  if (!game.install_path) return;
  const folderName = game.folder_name || game.install_path.split(/[\\/]/).pop();
  if (!confirm(`Remove the files for "${game.title}" from the GAMES folder?\n\nThe game will stay in your library so you can re-download or add files later.`)) return;
  try {
    if (typeof window.__TAURI__ !== 'undefined') {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_game_folder', { folderName });
    }
    await db.updateGame(game.id, { install_path: '', executable: '' });
    game.install_path = '';
    game.executable = '';
    toast(`Files removed. "${game.title}" kept in library.`);
    await loadLibrary();
    renderLibrary();
    openDetail(game.id);
  } catch (e) {
    toast('Remove failed: ' + e);
  }
}

async function removeFromLibrary(game) {
  const hasFiles = !!game.install_path;
  const isSeeded = game.source_type !== 'copied';
  let msg = `Remove "${game.title}" from your library?`;
  if (hasFiles) msg += '\n\nAlso delete the files from the GAMES folder?';
  if (isSeeded) msg += '\n\n(You can get it back by re-launching the app — it will reappear as a downloadable title.)';

  const confirmed = confirm(msg);
  if (!confirmed) return;

  const deleteFiles = hasFiles && confirm(`Delete the files from the GAMES folder too?`);

  try {
    if (deleteFiles && typeof window.__TAURI__ !== 'undefined') {
      const folderName = game.folder_name || game.install_path.split(/[\\/]/).pop();
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_game_folder', { folderName });
    }
    if (game.source_type !== 'copied') {
      await db.markSeededGameRemoved(game.title);
    }
    await db.deleteGame(game.id);
    toast(`"${game.title}" removed from library.`);
    await loadLibrary();
    showScreen('library');
    renderLibrary();
  } catch (e) {
    toast('Remove failed: ' + e);
  }
}

async function downloadShareware(game) {
  const btn = document.getElementById('download-btn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⬇ Downloading…';
  toast('Downloading ' + game.title + '…');
  mascotHold('working');
  mascotSay('Fetching the good stuff…');
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const installPath = await invoke('download_and_extract_game', { url: game.download_url, folderName: game.folder_name || game.title });
    // Directly set install_path from the returned path — don't depend on scan matching
    if (installPath) {
      await db.updateGame(game.id, { install_path: installPath });
      game.install_path = installPath;
      const g = state.games.find(g => g.id === game.id);
      if (g) g.install_path = installPath;
    }
    toast('Download complete!');
    mascotClearHold();
    mascotReact('celebrate');
    mascotSay('Nailed it. Fresh bytes.');
    btn.textContent = '✓ Downloaded';
    // Scan so executable is detected and set — download only sets install_path
    await scanGamesFolder();
    // Reload game state so setup_exe and executable are current
    const refreshed = state.games.find(g => g.id === game.id);
    if (refreshed) Object.assign(game, refreshed);
    if (state.screen === 'library') {
      // Downloaded from the side panel — refresh grid + panel in place
      await loadLibrary();
      renderLibrary();
    } else {
      showScreen('detail');
      renderDetail();
    }
    // SW requires running SETUP.EXE once before launch — trigger it automatically
    if (game.executable?.toLowerCase() === 'sw.exe' && game.setup_exe) {
      toast('One-time setup required. Complete the setup and exit when done.', 5000);
      await runSetup(game);
    }
  } catch (e) {
    toast('Download failed: ' + e);
    mascotClearHold();
    mascotReact('error');
    btn.disabled = false;
    btn.textContent = '⬇ Download Shareware';
  }
}

// Resolve dosbox_event for any binding that is missing one, using the game's
// Original scheme as the source of truth. Fixes schemes saved before the wizard
// was corrected to populate dosbox_event.
async function enrichBindings(gameId, bindings) {
  if (bindings.length && bindings.every(b => b.dosbox_event)) return bindings;
  const schemes = await db.getSchemes(gameId);
  const src = schemes.find(s => s.input_style === 'original') || schemes.find(s => s.source === 'core');
  if (!src) return bindings;
  const srcBindings = await db.getBindings(src.id);
  const eventMap = Object.fromEntries(srcBindings.map(b => [b.action, b.dosbox_event]));
  return bindings.map(b => ({ ...b, dosbox_event: b.dosbox_event || eventMap[b.action] || '' }));
}

let gameSessionActive = false;

async function playGame(opts = {}) {
  // Reentrancy guard: while DOSBox is running (or launching), Play does nothing —
  // prevents duplicate instances from double-clicks or stray injected inputs.
  if (gameSessionActive && typeof window.__TAURI__ !== 'undefined') {
    toast('A game is already running — quit it first.');
    return;
  }
  const { game, activeSchemeId, bindings } = state.detail;
  if (!game.install_path || !game.executable) {
    toast('Game not installed — download it or use ⚙ Fix Exe to point to an existing install.');
    return;
  }
  const { launchGame } = await import('./launcher.js');
  const scheme = state.detail.schemes.find(s => s.id === activeSchemeId);
  const enriched = await enrichBindings(game.id, bindings);

  // Controller: load per-game bindings saved by the controller setup screen.
  const ctrlRaw = game.controller_bindings ? (() => { try { return JSON.parse(game.controller_bindings); } catch { return null; } })() : null;
  const ctrlBindings = ctrlRaw?.bindings ?? null;
  const fpsModeActive = ctrlRaw?.fpsMode ?? false;
  const fpsSensitivity = ctrlRaw?.sensitivity ?? 5.0;

  // When ctrl_bindings are set, the Rust side needs dosbox_events for each action.
  // The active scheme may be "Custom Controls" with no bindings, so always merge in
  // the Original scheme so the event_map lookup has coverage.
  let bindingsForLaunch = enriched;
  if (ctrlBindings) {
    const allSchemes = await db.getSchemes(game.id);
    const origScheme = allSchemes.find(s => s.input_style === 'original');
    if (origScheme) {
      const origBindings = await db.getBindings(origScheme.id);
      const coveredActions = new Set(enriched.map(b => b.action));
      bindingsForLaunch = [...enriched, ...origBindings.filter(b => !coveredActions.has(b.action))];
    }
  }

  toast(`Launching ${game.title}…`);
  // Claim the session up front so the reentrancy guard blocks double-launches
  // during the pre-launch animation beat below.
  const isTauri = typeof window.__TAURI__ !== 'undefined';
  if (isTauri) {
    gameSessionActive = true;
    audioSuspend();   // silence menu music the instant we commit to launching
  }
  // Fire the launch cheer + quip BEFORE handing off to DOSBox, then give it a
  // beat to play while the app still has focus (DOSBox steals focus instantly).
  blip.confirm();
  mascotReact('launch');
  mascotLaunchQuip(game.genre_tag);
  try {
    if (isTauri) await new Promise(r => setTimeout(r, 1200));
    const result = await launchGame(game, scheme || {}, bindingsForLaunch, {
      alwaysRun: !!(scheme?.always_run),
      exeOverride: opts.exeOverride,
      ctrlBindings,
      fpsMode: fpsModeActive,
      fpsSensitivity,
    });
    if (result?.simulated) {
      toast(`[Preview] Launching ${game.title}…`);
      gameSessionActive = false;   // preview/browser: no real session to guard
    } else {
      // Silence app audio + suspend controller UI-nav while the game runs;
      // the Rust 'game-exited' event restores both when DOSBox closes.
      audioSuspend();
      setGameRunning(true);
      // gameSessionActive already true
    }
    localStorage.setItem('last_played', game.title);
    updateStatusBar();
  } catch (e) {
    blip.error();
    mascotReact('error');
    gameSessionActive = false;
    setGameRunning(false);
    audioResume();   // launch failed — bring the menu music back
    toast(`Launch error: ${e}`);
  }
}

// ─── Mapping Wizard ───
const GENRES = [
  { tag: 'fps',       label: 'FPS',       icon: '🔫' },
  { tag: 'adventure', label: 'Adventure',  icon: '🗺️' },
  { tag: 'platform',  label: 'Platform',   icon: '🎮' },
  { tag: 'shooter',   label: 'Shooter',    icon: '🚀' },
  { tag: 'rpg',       label: 'RPG',        icon: '⚔️' },
  { tag: 'strategy',  label: 'Strategy',   icon: '♟️' },
];

async function openWizard(gameId) {
  const game = await db.getGame(gameId);
  const gameSchemes = await db.getSchemes(gameId);
  const srcScheme = gameSchemes.find(s => s.input_style === 'original')
                 || gameSchemes.find(s => s.source === 'core')
                 || gameSchemes[0];
  const srcBindings = srcScheme ? await db.getBindings(srcScheme.id) : [];

  const customScheme = gameSchemes.find(s => s.name === 'Custom Controls');
  const customBindings = customScheme ? await db.getBindings(customScheme.id) : [];
  const customMap = Object.fromEntries(customBindings.map(b => [b.action, b.input]));

  state.wizard = {
    gameId,
    game,
    bindings: srcBindings.map((b, i) => ({
      action: b.action,
      input: customMap[b.action] || '',
      dosbox_event: b.dosbox_event,
      originalInput: b.input || '',
      order: i,
    })),
    captureIndex: null,
  };
  renderWizard();
  showScreen('wizard');
}

async function wizardNext() {
  await saveWizard();
}

// ─── Original Controls Entry ───────────────────────────────────────────────

function keyToDosboxEvent(key) {
  const map = {
    'Up': 'key_up', 'Down': 'key_down', 'Left': 'key_left', 'Right': 'key_right',
    'Ctrl': 'key_lctrl', 'Alt': 'key_lalt', 'Shift': 'key_lshift',
    'Space': 'key_space', 'Enter': 'key_enter', 'Esc': 'key_esc',
    'Tab': 'key_tab', 'Bksp': 'key_backspace',
    'PgUp': 'key_pgup', 'PgDn': 'key_pgdn', 'Home': 'key_home', 'End': 'key_end',
    'Insert': 'key_ins', 'Delete': 'key_del',
    'F1': 'key_f1', 'F2': 'key_f2', 'F3': 'key_f3', 'F4': 'key_f4',
    'F5': 'key_f5', 'F6': 'key_f6', 'F7': 'key_f7', 'F8': 'key_f8',
    'F9': 'key_f9', 'F10': 'key_f10', 'F11': 'key_f11', 'F12': 'key_f12',
  };
  if (map[key]) return map[key];
  if (key.length === 1) return `key_${key.toLowerCase()}`;
  return '';
}

async function openOriginalControls(game) {
  // Pre-populate from existing Original scheme if present
  const schemes = await db.getSchemes(game.id);
  const origScheme = schemes.find(s => s.input_style === 'original');
  let rows = [];
  if (origScheme) {
    const bindings = await db.getBindings(origScheme.id);
    rows = bindings.map(b => ({ action: b.action, input: b.input, dosbox_event: b.dosbox_event }));
  }
  if (!rows.length) rows = [{ action: '', input: '', dosbox_event: '' }];
  state.origControls = { game, rows, captureIndex: null };
  renderOriginalControls();
  showScreen('original-controls');
}

function renderOriginalControls() {
  const { game, rows, captureIndex } = state.origControls;
  const el = document.getElementById('original-controls-screen');
  el.innerHTML = `
    <button class="detail-back" id="oc-back">← Back to ${game.title}</button>
    <div class="wizard-header">
      <div class="wizard-title">ENTER ORIGINAL CONTROLS</div>
      <div class="wizard-subtitle">${game.title}</div>
    </div>
    <p style="font-size:12px;color:var(--text-secondary);margin:0 0 14px">
      Record the original key bindings exactly as they appear in the game.
      Click a key slot then press a key <em>or</em> click a mouse button (LMB/RMB/MMB). When complete, saving will mark this game as <strong style="color:var(--green)">Tuned</strong>.
    </p>
    <div class="binding-list" id="oc-list">
      ${rows.map((r, i) => `
        <div class="binding-assign-row ${captureIndex === i ? 'capturing' : ''}" data-index="${i}">
          <input class="oc-action-input form-input" data-index="${i}" placeholder="Action (e.g. Jump)" value="${r.action}" style="flex:1;min-width:0;font-size:12px;padding:6px 8px">
          <button class="binding-assign-key ${captureIndex === i ? 'capturing' : ''}" data-index="${i}" style="min-width:90px">
            ${captureIndex === i ? '[ key or click ]' : (r.input || '—')}
          </button>
          <button class="oc-remove" data-index="${i}" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:16px;padding:0 6px" title="Remove row">×</button>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-secondary" id="oc-add">+ Add Action</button>
      <button class="btn-play" id="oc-save" style="padding:8px 20px">💾 Save & Mark Tuned</button>
    </div>
  `;

  el.querySelectorAll('.oc-action-input').forEach(inp => {
    inp.addEventListener('change', e => {
      state.origControls.rows[+e.target.dataset.index].action = e.target.value;
    });
    inp.addEventListener('input', e => {
      state.origControls.rows[+e.target.dataset.index].action = e.target.value;
    });
  });

  el.querySelectorAll('.binding-assign-key').forEach(btn => {
    btn.addEventListener('click', () => startOrigCapture(+btn.dataset.index));
  });

  el.querySelectorAll('.oc-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      state.origControls.rows.splice(+btn.dataset.index, 1);
      if (!state.origControls.rows.length) state.origControls.rows = [{ action: '', input: '', dosbox_event: '' }];
      renderOriginalControls();
    });
  });

  el.querySelector('#oc-add').addEventListener('click', () => {
    state.origControls.rows.push({ action: '', input: '', dosbox_event: '' });
    renderOriginalControls();
  });

  el.querySelector('#oc-back').addEventListener('click', async () => {
    await openDetail(state.origControls.game.id);
  });

  el.querySelector('#oc-save').addEventListener('click', () => saveOriginalControls());
}

function startOrigCapture(index) {
  state.origControls.captureIndex = index;
  renderOriginalControls();

  const finish = (input, dosbox_event) => {
    state.origControls.rows[index].input = input;
    state.origControls.rows[index].dosbox_event = dosbox_event;
    state.origControls.captureIndex = null;
    document.removeEventListener('keydown', keyHandler);
    document.removeEventListener('mousedown', mouseHandler);
    renderOriginalControls();
  };

  const cancel = () => {
    state.origControls.captureIndex = null;
    document.removeEventListener('keydown', keyHandler);
    document.removeEventListener('mousedown', mouseHandler);
    renderOriginalControls();
  };

  const keyHandler = (e) => {
    e.preventDefault();
    if (e.key === 'Escape') { cancel(); return; }
    const key = friendlyKey(e);
    finish(key, keyToDosboxEvent(key));
  };

  const mouseHandler = (e) => {
    // Ignore clicks on UI elements (back button, save, etc.) — only capture
    // if the target is the capturing key slot itself or the screen background.
    const slot = document.querySelector(`.binding-assign-key[data-index="${index}"]`);
    if (slot && !slot.contains(e.target) && e.target.closest('button, input, select')) return;
    e.preventDefault();
    e.stopPropagation();
    const MAP = { 0: ['LMB', 'mouse_left'], 1: ['MMB', 'mouse_middle'], 2: ['RMB', 'mouse_right'] };
    const [input, dosbox_event] = MAP[e.button] ?? ['LMB', 'mouse_left'];
    finish(input, dosbox_event);
  };

  document.addEventListener('keydown', keyHandler);
  document.addEventListener('mousedown', mouseHandler);
}

async function saveOriginalControls() {
  const { game, rows } = state.origControls;
  const filled = rows.filter(r => r.action.trim() && r.input);
  if (!filled.length) { toast('Add at least one binding first.'); return; }

  const schemes = await db.getSchemes(game.id);
  let origScheme = schemes.find(s => s.input_style === 'original');
  if (origScheme) {
    await db.deleteBindings(origScheme.id);
  } else {
    origScheme = await db.addScheme({ game_id: game.id, name: 'Original', input_style: 'original', source: 'user' });
  }
  for (let i = 0; i < filled.length; i++) {
    const r = filled[i];
    await db.addBinding({ scheme_id: origScheme.id, action: r.action, input: r.input, dosbox_event: r.dosbox_event, order: i + 1 });
  }
  await db.updateGame(game.id, { verified: 1 });
  game.verified = 1;
  const g = state.games.find(g => g.id === game.id);
  if (g) g.verified = 1;
  toast(`✓ Original controls saved. ${game.title} is now Tuned.`);
  await openDetail(game.id);
}

// ─── Controller Setup ──────────────────────────────────────────────────────

const FPS_ENGINES = ['doom', 'wolf3d', 'build'];

async function openControllerSetup(game) {
  // Load saved controller_bindings for this game
  const saved = game.controller_bindings ? (() => { try { return JSON.parse(game.controller_bindings); } catch { return null; } })() : null;
  // Load the active scheme's bindings to know which actions to map
  const schemes = await db.getSchemes(game.id);
  const isFps = FPS_ENGINES.includes(game.engine);

  // Pick the scheme to map over: for FPS use Modern WASD if present, else Original
  let sourceScheme = schemes.find(s => s.name === 'Modern WASD' && s.input_style !== 'original')
    || schemes.find(s => s.input_style === 'original')
    || schemes[0];
  const schemeBindings = sourceScheme ? await db.getBindings(sourceScheme.id) : [];

  // Build rows: one per action, pre-populated from saved bindings
  const savedMap = Object.fromEntries((saved?.bindings || []).map(b => [b.action, b.ctrl]));
  const rows = schemeBindings.map(b => ({ action: b.action, ctrl: savedMap[b.action] || null }));

  state.controllerSetup = {
    game,
    rows,
    fpsMouse: isFps ? (saved?.fpsMode ?? true) : false,
    sensitivity: saved?.sensitivity ?? 5,
    capturing: null,
  };
  renderControllerSetup();
  showScreen('controller-setup');
}

function renderControllerSetup() {
  const { game, rows, fpsMouse, sensitivity, capturing } = state.controllerSetup;
  const isFps = FPS_ENGINES.includes(game.engine);
  const el = document.getElementById('controller-setup-screen');
  if (!el) return;

  el.innerHTML = `
    <button class="detail-back" id="ctrl-back-btn">← Back</button>
    <div style="padding:20px;max-width:600px;margin:0 auto">
      <div style="font-family:var(--font-pixel);font-size:11px;color:var(--purple);margin-bottom:12px">🎮 CONTROLLER SETUP — ${game.title.toUpperCase()}</div>

      ${isFps ? `
        <div style="background:rgba(155,93,229,0.1);border:1px solid rgba(155,93,229,0.3);border-radius:6px;padding:12px;margin-bottom:16px">
          <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">FPS Mode</div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <label class="toggle" style="margin:0">
              <input type="checkbox" id="fps-mouse-toggle" ${fpsMouse ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
            <span style="font-size:12px;color:var(--text-secondary)">Right stick = mouse look</span>
          </div>
          ${fpsMouse ? `
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:11px;color:var(--text-dim);min-width:80px">Sensitivity: ${sensitivity}</span>
              <input type="range" id="sensitivity-slider" min="1" max="10" value="${sensitivity}" style="flex:1">
            </div>
          ` : ''}
        </div>
      ` : ''}

      <div style="font-size:11px;color:var(--text-dim);margin-bottom:10px">
        Press a button on your controller to assign it to each action. Left stick = WASD/arrows by default for FPS games.
      </div>

      <div id="ctrl-binding-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
        ${rows.map((row, i) => `
          <div class="binding-row" style="display:flex;align-items:center;gap:10px;padding:8px;background:rgba(255,255,255,0.04);border-radius:4px">
            <span class="binding-action" style="flex:1;min-width:120px">${row.action}</span>
            <button class="btn-secondary ctrl-capture-btn ${capturing === i ? 'active' : ''}"
              data-index="${i}"
              style="padding:4px 12px;font-size:11px;min-width:130px;${row.ctrl ? '' : 'color:var(--text-dim)'}">
              ${capturing === i ? '⏳ Press button…' : row.ctrl ? ctrlTokenLabel(row.ctrl) : '— unassigned —'}
            </button>
            ${row.ctrl ? `<button class="ctrl-clear-btn btn-secondary" data-index="${i}" style="padding:4px 8px;font-size:10px;color:var(--amber);border-color:var(--amber)">✕</button>` : ''}
          </div>
        `).join('')}
      </div>

      <div style="display:flex;gap:8px">
        <button class="btn-play" id="ctrl-save-btn" style="flex:1">✓ Save</button>
        <button class="btn-secondary" id="ctrl-clear-all-btn" style="padding:8px 14px;font-size:11px;color:var(--amber);border-color:var(--amber)">Clear All</button>
      </div>
    </div>
  `;

  el.querySelector('#ctrl-back-btn').addEventListener('click', () => {
    state.controllerSetup.capturing = null;
    showScreen('detail');
    renderDetail();
  });

  el.querySelector('#fps-mouse-toggle')?.addEventListener('change', e => {
    state.controllerSetup.fpsMouse = e.target.checked;
    renderControllerSetup();
  });

  el.querySelector('#sensitivity-slider')?.addEventListener('input', e => {
    state.controllerSetup.sensitivity = Number(e.target.value);
    renderControllerSetup();
  });

  el.querySelectorAll('.ctrl-capture-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = +btn.dataset.index;
      if (state.controllerSetup.capturing === index) {
        state.controllerSetup.capturing = null;
        renderControllerSetup();
        return;
      }
      state.controllerSetup.capturing = index;
      renderControllerSetup();

      const { captureControllerInput, captureBrowserGamepadInput } = await import('./launcher.js');
      let token = null;
      try {
        const res = await captureControllerInput(1400);
        token = res?.token || null;
      } catch {}
      if (!token) {
        const res2 = await captureBrowserGamepadInput(2000);
        token = res2?.token || null;
      }
      if (state.controllerSetup.capturing !== index) return; // user cancelled
      state.controllerSetup.capturing = null;
      if (token) {
        state.controllerSetup.rows[index].ctrl = token;
      }
      renderControllerSetup();
    });
  });

  el.querySelectorAll('.ctrl-clear-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.controllerSetup.rows[+btn.dataset.index].ctrl = null;
      renderControllerSetup();
    });
  });

  el.querySelector('#ctrl-clear-all-btn').addEventListener('click', () => {
    state.controllerSetup.rows.forEach(r => r.ctrl = null);
    renderControllerSetup();
  });

  el.querySelector('#ctrl-save-btn').addEventListener('click', async () => {
    const { game, rows, fpsMouse, sensitivity } = state.controllerSetup;
    const bindings = rows.filter(r => r.ctrl).map(r => ({ action: r.action, ctrl: r.ctrl }));
    const payload = JSON.stringify({ bindings, fpsMode: fpsMouse, sensitivity });
    await db.updateGame(game.id, { controller_bindings: payload });
    // Update local game object so playGame picks it up immediately
    game.controller_bindings = payload;
    toast('✓ Controller bindings saved.');
    showScreen('detail');
    renderDetail();
  });
}

function ctrlTokenLabel(token) {
  if (!token) return '—';
  const parts = token.split(':');
  if (parts[0] === 'button') return `Button ${parts[1]}`;
  if (parts[0] === 'axis') return `${parts[1]} ${parts[3] === 'neg' ? '−' : '+'}`;
  if (parts[0] === 'webbutton') return `Pad btn ${parts[2]}`;
  if (parts[0] === 'webaxis') return `Pad axis ${parts[2]} ${parts[3]}`;
  return token;
}

// ─── Episode Editor ────────────────────────────────────────────────────────

function openEpisodeEditor(game) {
  let rows = [];
  if (game.episodes) {
    try { rows = JSON.parse(game.episodes).map(ep => ({ ...ep })); } catch {}
  }
  if (!rows.length) rows = [{ label: 'Episode 1', exe: game.executable || '' }];
  state.episodeEditor = { game, rows };
  renderEpisodeEditor();
  showScreen('episode-editor');
}

function renderEpisodeEditor() {
  const { game, rows } = state.episodeEditor;
  const el = document.getElementById('episode-editor-screen');
  el.innerHTML = `
    <button class="detail-back" id="ep-back">← Back to ${game.title}</button>
    <div class="wizard-header">
      <div class="wizard-title">EDIT EPISODES</div>
      <div class="wizard-subtitle">${game.title}</div>
    </div>
    <p style="font-size:12px;color:var(--text-secondary);margin:0 0 14px">
      Set the label and executable for each episode. Click <strong>Browse</strong> to pick the EXE file directly from the game folder.
    </p>
    <div class="binding-list" id="ep-list">
      ${rows.map((r, i) => `
        <div class="binding-assign-row" style="gap:8px;align-items:center" data-index="${i}">
          <input class="ep-label-input form-input" data-index="${i}" placeholder="Episode label" value="${r.label || ''}" style="width:120px;flex-shrink:0;font-size:12px;padding:6px 8px">
          <input class="ep-exe-input form-input" data-index="${i}" placeholder="EXE filename" value="${r.exe || ''}" style="flex:1;min-width:0;font-size:12px;padding:6px 8px;font-family:monospace">
          <button class="btn-secondary ep-browse-btn" data-index="${i}" style="padding:4px 10px;font-size:11px;white-space:nowrap">Browse…</button>
          <button class="ep-remove-btn" data-index="${i}" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:16px;padding:0 4px" title="Remove">×</button>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn-secondary" id="ep-add">+ Add Episode</button>
      <button class="btn-play" id="ep-save" style="padding:8px 20px">💾 Save Episodes</button>
    </div>
  `;

  el.querySelectorAll('.ep-label-input').forEach(inp => {
    inp.addEventListener('input', e => { state.episodeEditor.rows[+e.target.dataset.index].label = e.target.value; });
  });
  el.querySelectorAll('.ep-exe-input').forEach(inp => {
    inp.addEventListener('input', e => { state.episodeEditor.rows[+e.target.dataset.index].exe = e.target.value.toUpperCase(); e.target.value = e.target.value.toUpperCase(); });
  });

  el.querySelectorAll('.ep-browse-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (typeof window.__TAURI__ === 'undefined') return;
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        title: 'Select episode executable',
        filters: [{ name: 'Executables', extensions: ['exe', 'com', 'bat'] }],
        defaultPath: game.install_path || undefined,
        multiple: false,
      });
      if (!selected) return;
      const filePath = typeof selected === 'string' ? selected : selected.path;
      if (!filePath) return;
      const lastSep = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
      const exe = filePath.substring(lastSep + 1).toUpperCase();
      const i = +btn.dataset.index;
      state.episodeEditor.rows[i].exe = exe;
      // If install_path not set yet, derive it from the picked file's directory
      if (!game.install_path) {
        const dir = filePath.substring(0, lastSep);
        await db.updateGame(game.id, { install_path: dir });
        game.install_path = dir;
      }
      renderEpisodeEditor();
    });
  });

  el.querySelectorAll('.ep-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.episodeEditor.rows.splice(+btn.dataset.index, 1);
      if (!state.episodeEditor.rows.length) state.episodeEditor.rows = [{ label: 'Episode 1', exe: '' }];
      renderEpisodeEditor();
    });
  });

  el.querySelector('#ep-add').addEventListener('click', () => {
    const n = state.episodeEditor.rows.length + 1;
    state.episodeEditor.rows.push({ label: `Episode ${n}`, exe: '' });
    renderEpisodeEditor();
  });

  el.querySelector('#ep-back').addEventListener('click', () => openDetail(game.id));

  el.querySelector('#ep-save').addEventListener('click', async () => {
    const filled = state.episodeEditor.rows.filter(r => r.exe.trim());
    if (!filled.length) { toast('Add at least one episode with an exe.'); return; }
    // One episode is not really "episodes" — store null so the detail shows a single PLAY
    // button (and the >1 rule stays consistent for user-added multi-episode games).
    const episodesJson = filled.length > 1
      ? JSON.stringify(filled.map(r => ({ label: r.label || r.exe, exe: r.exe.trim().toUpperCase() })))
      : null;
    const firstExe = filled[0].exe.trim().toUpperCase();
    await db.updateGame(game.id, { episodes: episodesJson, executable: firstExe });
    game.episodes = episodesJson;
    game.executable = firstExe;
    const g = state.games.find(g => g.id === game.id);
    if (g) { g.episodes = episodesJson; g.executable = firstExe; }
    toast('Episodes saved.');
    await openDetail(game.id);
  });
}

async function saveWizard() {
  const w = state.wizard;
  const schemes = await db.getSchemes(w.gameId);
  let customScheme = schemes.find(s => s.name === 'Custom Controls');
  if (!customScheme) {
    customScheme = await db.addScheme({ game_id: w.gameId, name: 'Custom Controls', input_style: 'custom', source: 'core' });
  }
  await db.deleteBindings(customScheme.id);
  for (const b of w.bindings) {
    const effectiveInput = b.input || b.originalInput || '';
    if (effectiveInput) {
      await db.addBinding({ scheme_id: customScheme.id, action: b.action, input: effectiveInput, dosbox_event: b.dosbox_event || '', order: b.order });
    }
  }
  toast('Custom controls saved!');
  await openDetail(w.gameId);
  await selectScheme(customScheme.id);
}

function renderWizard() {
  const el = document.getElementById('wizard-screen');
  const w = state.wizard;

  el.innerHTML = `
    <button class="detail-back" id="wiz-back">← Back</button>
    <div class="wizard-header">
      <div class="wizard-title">CUSTOMIZE CONTROLS</div>
      <div class="wizard-subtitle">${w.game?.title || 'Game'}</div>
    </div>

    ${w.bindings.length ? `
      <p style="font-size:12px;color:var(--text-secondary);margin:0 0 14px">
        Click a key slot then press the key you want. Dimmed keys are the originals — leave them to keep as-is.
      </p>
      <div class="binding-list">
        ${w.bindings.map((b, i) => `
          <div class="binding-assign-row ${w.captureIndex === i ? 'capturing' : ''}">
            <div class="binding-assign-action">${b.action}</div>
            <button class="binding-assign-key ${w.captureIndex === i ? 'capturing' : ''}" data-index="${i}">
              ${w.captureIndex === i
                ? '[ press key ]'
                : b.input
                  ? b.input
                  : `<span style="opacity:0.4">${b.originalInput || '—'}</span>`
              }
            </button>
            ${b.input ? `<button class="binding-clear-single" data-index="${i}" title="Reset to original" style="font-size:10px;color:var(--text-dim);background:none;border:none;cursor:pointer;padding:0 6px;line-height:1">✕</button>` : ''}
          </div>
        `).join('')}
      </div>
    ` : `
      <div style="color:var(--text-dim);font-size:12px;padding:20px 0">
        No original controls found for this game. An Original scheme is required before customizing.
      </div>
    `}

    <div class="wizard-actions">
      <button class="btn-secondary" id="wiz-cancel">Cancel</button>
      <button class="btn-primary" id="wiz-save" ${!w.bindings.length ? 'disabled' : ''}>Save controls</button>
    </div>
  `;

  el.querySelector('#wiz-back').addEventListener('click', () => openDetail(w.gameId));
  el.querySelector('#wiz-cancel').addEventListener('click', () => openDetail(w.gameId));
  el.querySelector('#wiz-save')?.addEventListener('click', wizardNext);

  el.querySelectorAll('.binding-assign-key').forEach((btn, i) => {
    btn.addEventListener('click', () => startCapture(i));
  });

  el.querySelectorAll('.binding-clear-single').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const i = parseInt(btn.dataset.index);
      state.wizard.bindings[i].input = '';
      state.wizard.captureIndex = null;
      renderWizard();
    });
  });
}

function startCapture(index) {
  state.wizard.captureIndex = index;
  renderWizard();

  const handler = (e) => {
    e.preventDefault();
    const key = friendlyKey(e);
    state.wizard.bindings[index].input = key;
    state.wizard.captureIndex = null;
    document.removeEventListener('keydown', handler);
    renderWizard();
  };
  document.addEventListener('keydown', handler);
}

function friendlyKey(e) {
  const specials = {
    ' ': 'Space', 'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right',
    'Control': 'Ctrl', 'Shift': 'Shift', 'Alt': 'Alt', 'Enter': 'Enter', 'Escape': 'Esc',
    'Backspace': 'Bksp', 'Tab': 'Tab',
    'Delete': 'Delete', 'Insert': 'Insert', 'Home': 'Home', 'End': 'End',
    'PageUp': 'PgUp', 'PageDown': 'PgDn',
    'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4',
    'F5': 'F5', 'F6': 'F6', 'F7': 'F7', 'F8': 'F8',
    'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12',
  };
  const parts = [];
  if (e.ctrlKey && e.key !== 'Control')  parts.push('Ctrl');
  if (e.shiftKey && e.key !== 'Shift')   parts.push('Shift');
  if (e.altKey && e.key !== 'Alt')       parts.push('Alt');
  const k = specials[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  if (!parts.includes(k)) parts.push(k);
  return parts.join('+');
}

async function runSetup(game) {
  let setupExe = game.setup_exe;

  if (!setupExe) {
    // No setup exe configured — open file picker to find it
    if (typeof window.__TAURI__ === 'undefined') return;
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      title: 'Select setup executable',
      filters: [{ name: 'Executables', extensions: ['exe', 'com', 'bat'] }],
      defaultPath: game.install_path || undefined,
      multiple: false,
    });
    if (!selected) return;
    const filePath = typeof selected === 'string' ? selected : selected.path;
    if (!filePath) return;
    const lastSep = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
    setupExe = filePath.substring(lastSep + 1).toUpperCase();
    await db.updateGame(game.id, { setup_exe: setupExe });
    game.setup_exe = setupExe;
    const g = state.games.find(g => g.id === game.id);
    if (g) g.setup_exe = setupExe;
    renderDetail();
  }

  const { launchGame } = await import('./launcher.js');
  const scheme = state.detail.schemes.find(s => s.id === state.detail.activeSchemeId);
  toast(`Launching ${setupExe}… Click the DOSBox window to interact. Use Ctrl+F4 to swap disks when prompted.`, 6000);
  try {
    await launchGame(game, scheme || {}, [], { exeOverride: setupExe });
    // After installer exits, flatten any subfolder (e.g. INSTALL.EXE created C:\SW\ inside SWARS\)
    if (game.install_path && typeof window.__TAURI__ !== 'undefined') {
      const { invoke } = await import('@tauri-apps/api/core');
      const flattened = await invoke('flatten_install_dir', { installPath: game.install_path }).catch(() => false);
      if (flattened) toast('Setup complete — game files moved to install folder.');
    }
    await scanGamesFolder();
  } catch (e) {
    toast(`Setup error: ${e}`);
  }
}

// ─── Scheme Inheritance ────────────────────────────────────────────────────
// When a user adds a game whose executable matches a seeded entry, copy that
// entry's engine, verified flag, and all non-Custom control schemes over.

async function inheritSchemesFromSeed(gameId, executable) {
  if (!executable) return false;
  const exeLower = executable.toLowerCase();
  const allGames = await db.getGames({});
  const seedGame = allGames.find(g =>
    g.id !== gameId &&
    g.source_type !== 'copied' &&
    (g.executable || '').toLowerCase() === exeLower
  );
  if (!seedGame) return false;

  const seedSchemes = await db.getSchemes(seedGame.id);
  const mySchemes   = await db.getSchemes(gameId);
  const myNames     = new Set(mySchemes.map(s => s.name));

  for (const scheme of seedSchemes) {
    if (scheme.name === 'Custom Controls') continue;
    if (myNames.has(scheme.name)) continue;
    const newScheme = await db.addScheme({
      game_id: gameId, name: scheme.name,
      input_style: scheme.input_style, source: 'core', always_run: scheme.always_run,
    });
    const bindings = await db.getBindings(scheme.id);
    for (const b of bindings) {
      await db.addBinding({ scheme_id: newScheme.id, action: b.action, input: b.input, dosbox_event: b.dosbox_event, order: b.sort_order || 0 });
    }
  }

  // Ensure Custom Controls scheme exists
  if (!myNames.has('Custom Controls')) {
    await db.addScheme({ game_id: gameId, name: 'Custom Controls', input_style: 'custom', source: 'core', always_run: 0 });
  }

  await db.updateGame(gameId, { engine: seedGame.engine || '', verified: seedGame.verified || 0 });
  return true;
}

// ─── Add Game ───
function renderAddGame() {
  const el = document.getElementById('add-screen');
  el.innerHTML = `
    <div class="add-title">ADD GAME</div>

    <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:6px;padding:14px;margin-bottom:20px">
      <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Quick add — browse to executable</div>
      <div class="form-path-row">
        <input class="form-input" id="ag-path" placeholder="C:\\Games\\DOOM\\DOOM.EXE">
        <button class="btn-browse" id="ag-browse">Browse…</button>
      </div>
      <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
        <button class="btn-secondary" id="ag-autosplit" style="font-size:11px;padding:5px 10px">Auto-split path</button>
        <span style="font-size:11px;color:var(--text-dim)">Paste full path above (e.g. <code style="color:var(--amber)">C:\Games\DOOM\DOOM.EXE</code>) then click.</span>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Title</label>
      <input class="form-input" id="ag-title" placeholder="e.g. Raptor: Call of the Shadows">
    </div>
    <div class="form-group">
      <label class="form-label">Genre</label>
      <select class="form-select" id="ag-genre">
        <option value="">— Select genre —</option>
        ${GENRES.map(g => `<option value="${g.tag}">${g.label}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea class="form-input" id="ag-desc" rows="3" placeholder="Short description" style="resize:vertical"></textarea>
    </div>

    <div id="scrape-status" style="display:none;font-size:12px;color:var(--amber);margin-bottom:12px">🔍 Looking up metadata…</div>

    <button class="btn-primary" id="ag-save">Add to library</button>
  `;

  const pathInput = el.querySelector('#ag-path');
  const titleInput = el.querySelector('#ag-title');
  const genreSelect = el.querySelector('#ag-genre');
  const descInput = el.querySelector('#ag-desc');
  const scrapeStatus = el.querySelector('#scrape-status');

  // Auto-split full path into folder + stores internally; also fills title
  el.querySelector('#ag-autosplit').addEventListener('click', () => {
    const full = pathInput.value.trim();
    if (!full) { toast('Paste a full path first'); return; }
    const lastSlash = Math.max(full.lastIndexOf('\\'), full.lastIndexOf('/'));
    if (lastSlash > 0 && !titleInput.value) {
      const exeName = full.substring(lastSlash + 1).replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
      titleInput.value = exeName.replace(/\b\w/g, c => c.toUpperCase());
      titleInput.dispatchEvent(new Event('blur')); // trigger scrape
    } else if (lastSlash <= 0) {
      toast('No folder separator found — is this a full path?');
    }
  });

  // Auto-fill title from exe filename when path is typed
  pathInput.addEventListener('change', () => {
    const p = pathInput.value.trim();
    if (p && !titleInput.value) {
      const filename = p.split(/[/\\]/).pop().replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
      titleInput.value = filename.replace(/\b\w/g, c => c.toUpperCase());
    }
  });

  // Scrape when title loses focus
  titleInput.addEventListener('blur', async () => {
    const title = titleInput.value.trim();
    if (!title || descInput.value.trim()) return;
    scrapeStatus.style.display = 'block';
    try {
      const { scrapeMetadata } = await import('./launcher.js');
      const meta = await scrapeMetadata(title);
      if (meta) {
        if (meta.description && !descInput.value) descInput.value = meta.description;
        if (meta.genre && !genreSelect.value) genreSelect.value = meta.genre;
      }
    } finally {
      scrapeStatus.style.display = 'none';
    }
  });

  el.querySelector('#ag-browse').addEventListener('click', async () => {
    if (typeof window.__TAURI__ === 'undefined') {
      toast('File picker available in the desktop app');
      return;
    }
    const { open } = await import('@tauri-apps/plugin-dialog');
    const path = await open({
      title: 'Select DOS Game Executable',
      filters: [{ name: 'DOS Executable', extensions: ['exe','com','bat'] }],
    });
    if (!path) return;
    pathInput.value = path;
    // Auto-fill title from filename
    if (!titleInput.value) {
      const filename = path.split(/[/\\]/).pop().replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
      titleInput.value = filename.replace(/\b\w/g, c => c.toUpperCase());
    }
    // Auto-scrape
    const title = titleInput.value.trim();
    if (title) {
      scrapeStatus.style.display = 'block';
      try {
        const { scrapeMetadata, downloadArt } = await import('./launcher.js');
        const meta = await scrapeMetadata(title);
        if (meta) {
          if (meta.description) descInput.value = meta.description;
          if (meta.genre) genreSelect.value = meta.genre;
        }
      } finally {
        scrapeStatus.style.display = 'none';
      }
    }
  });

  el.querySelector('#ag-save').addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const genre = genreSelect.value;
    const desc  = descInput.value.trim();
    const path  = pathInput.value.trim();
    if (!title) { toast('Enter a game title'); return; }
    const exe = path ? path.split(/[/\\]/).pop() : '';
    const dir = path ? path.replace(/[/\\][^/\\]*$/, '') : '';
    const game = await db.addGame({
      title, genre_tag: genre, subtype: '', description: desc,
      art_path: null, dosbox_config: '', install_path: dir,
      executable: exe, verified: 0, source_type: 'copied',
    });
    const inherited = await inheritSchemesFromSeed(game.id, exe);
    // Try to get and save art in background
    if (typeof window.__TAURI__ !== 'undefined') {
      import('./launcher.js').then(async ({ scrapeMetadata, downloadArt }) => {
        const meta = await scrapeMetadata(title);
        if (meta?.art_url) {
          const artPath = await downloadArt(meta.art_url, game.id);
          if (artPath) await db.updateGame(game.id, { art_path: artPath });
        }
      });
    }
    toast(inherited ? `"${title}" added — controls inherited from matching game.` : `"${title}" added to library`);
    state.games = await db.getGames(state.filter);
    showScreen('library');
  });
}

// ─── Settings ───
function renderSettings() {
  const crtOn = !document.body.classList.contains('no-crt');
  const el = document.getElementById('settings-screen');
  el.innerHTML = `
    <div class="settings-title">SETTINGS</div>
    <div class="settings-section">
      <div class="settings-section-title">Display</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">CRT scanlines</div>
          <div class="setting-desc">Adds a subtle scanline and vignette overlay</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="crt-toggle" ${crtOn ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Mascot</div>
          <div class="setting-desc">The pixel buddy who reacts to launches, downloads and errors</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="mascot-toggle" ${mascotOn() ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">Audio</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">UI sound effects</div>
          <div class="setting-desc">PC-speaker blips on launch and confirm</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="sfx-toggle" ${sfxOn() ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Menu music</div>
          <div class="setting-desc">Looping FM-synth theme while browsing the library</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="music-toggle" ${musicOn() ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Music folder</div>
          <div class="setting-desc">All menu music lives in one folder — the built-in tracks plus any of your own (mp3/ogg/wav/flac). Remove any you don't want; the rest play in sequence.</div>
        </div>
        <button class="btn-secondary" id="music-folder-btn" style="padding:6px 14px;white-space:nowrap">📁 Open folder</button>
      </div>
      <div class="setting-row" style="margin-top:8px">
        <div>
          <div class="setting-label">Restore original tracks</div>
          <div class="setting-desc">Re-adds the built-in TURBODOS menu tracks to your music folder if you've removed them</div>
        </div>
        <button class="btn-secondary" id="restore-music-btn" style="padding:6px 14px;color:var(--green);border-color:var(--green);white-space:nowrap">Restore</button>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">Library</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Restore included games</div>
          <div class="setting-desc">Re-adds any included games you've removed back to the library</div>
        </div>
        <button class="btn-secondary" id="restore-seeded-btn" style="padding:6px 14px;color:var(--green);border-color:var(--green)">Restore</button>
      </div>
      <div class="setting-row" style="margin-top:8px">
        <div>
          <div class="setting-label">Reset all library data</div>
          <div class="setting-desc">Deletes everything — all games, schemes and bindings — and reseeds defaults on next launch</div>
        </div>
        <button class="btn-secondary" id="reset-db-btn" style="padding:6px 14px;color:var(--amber)">Reset…</button>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">DOSBox</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Test DOSBox</div>
          <div class="setting-desc">Opens a bare DOS prompt — confirms DOSBox is working</div>
        </div>
        <button class="btn-secondary" id="test-dosbox-btn" style="padding:6px 14px">Launch shell</button>
      </div>
      <div class="setting-row" style="margin-top:4px">
        <div>
          <div class="setting-label">DOSBox path</div>
          <div class="setting-desc" id="dosbox-path-display" style="font-size:11px;color:var(--text-dim);word-break:break-all">Checking…</div>
        </div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">Controller</div>
      <div style="font-size:11px;color:var(--text-dim)">
        Controller support is set up per game — open a game and use the <strong style="color:var(--text-secondary)">🎮 Controller</strong> button to map your pad for that title.
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">Artwork & Metadata</div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:12px">
        <strong style="color:var(--text-secondary)">SteamGridDB</strong> (recommended) — free API key at
        <span style="color:var(--amber)">steamgriddb.com/profile/preferences/api</span> after signing up.
        Provides high-quality box art for most DOS games.
      </div>
      <div class="setting-row" style="flex-direction:column;align-items:flex-start;gap:8px">
        <div class="form-group" style="width:100%;margin:0">
          <label class="form-label">SteamGridDB API Key</label>
          <input class="form-input" id="sgdb-key" placeholder="Paste your API key here" value="${localStorage.getItem('sgdb_key') || ''}">
        </div>
        <button class="btn-secondary" id="ss-save-btn" style="padding:6px 16px">Save</button>
        <div id="ss-save-status" style="font-size:11px;color:var(--green);display:none">✓ Saved</div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:4px;border-top:1px solid var(--border);padding-top:8px;width:100%">
          <strong style="color:var(--text-secondary)">ScreenScraper</strong> (fallback) — free account at
          <span style="color:var(--amber)">screenscraper.fr</span>
        </div>
        <div class="form-group" style="width:100%;margin:0">
          <label class="form-label">Username</label>
          <input class="form-input" id="ss-user" placeholder="ScreenScraper username" value="${localStorage.getItem('ss_user') || ''}">
        </div>
        <div class="form-group" style="width:100%;margin:0">
          <label class="form-label">Password</label>
          <input class="form-input" type="password" id="ss-pass" placeholder="ScreenScraper password" value="${localStorage.getItem('ss_pass') || ''}">
        </div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title">About</div>
      <div class="setting-row">
        <div class="setting-label">TURBODOS</div>
        <div style="font-size:12px;color:var(--text-dim)">v${APP_VERSION}</div>
      </div>
    </div>
  `;

  el.querySelector('#sfx-toggle')?.addEventListener('change', (e) => {
    setSfx(e.target.checked);
    const nb = document.getElementById('sfx-nav-toggle');
    if (nb) { nb.textContent = e.target.checked ? '🔊' : '🔇'; nb.classList.toggle('on', e.target.checked); }
  });
  el.querySelector('#music-toggle')?.addEventListener('change', (e) => {
    setMusic(e.target.checked);   // nav ▶/⏸ icon updates via the music-state event
  });
  el.querySelector('#music-folder-btn')?.addEventListener('click', async () => {
    if (typeof window.__TAURI__ === 'undefined') return;
    const { invoke } = await import('@tauri-apps/api/core');
    invoke('open_music_folder').catch(() => {});
    toast('Drop music files here (mp3/ogg/wav/flac) — they join the menu playlist. Remove any you like.', 6000);
  });
  el.querySelector('#restore-music-btn')?.addEventListener('click', async () => {
    if (typeof window.__TAURI__ === 'undefined') { toast('Only available in the installed app.'); return; }
    const btn = el.querySelector('#restore-music-btn');
    btn.disabled = true; btn.textContent = 'Restoring…';
    try {
      const added = await restoreOriginalTracks();
      toast(added > 0 ? `Restored ${added} original track${added > 1 ? 's' : ''}.` : 'All original tracks are already in your folder.');
    } catch (e) {
      toast('Restore failed: ' + e);
    }
    btn.disabled = false; btn.textContent = 'Restore';
  });
  el.querySelector('#mascot-toggle')?.addEventListener('change', (e) => {
    setMascot(e.target.checked);
  });
  el.querySelector('#crt-toggle').addEventListener('change', (e) => {
    document.body.classList.toggle('no-crt', !e.target.checked);
    localStorage.setItem('crt_scanlines', e.target.checked ? 'on' : 'off');
  });

  el.querySelector('#ss-save-btn').addEventListener('click', () => {
    const sgdbKey = el.querySelector('#sgdb-key').value.trim();
    const user = el.querySelector('#ss-user').value.trim();
    const pass = el.querySelector('#ss-pass').value.trim();
    if (sgdbKey) localStorage.setItem('sgdb_key', sgdbKey); else localStorage.removeItem('sgdb_key');
    if (user) localStorage.setItem('ss_user', user); else localStorage.removeItem('ss_user');
    if (pass) localStorage.setItem('ss_pass', pass); else localStorage.removeItem('ss_pass');
    const status = el.querySelector('#ss-save-status');
    status.style.display = 'block';
    setTimeout(() => { status.style.display = 'none'; }, 2000);
  });

  el.querySelector('#restore-seeded-btn').addEventListener('click', async () => {
    await db.restoreAllSeededGames();
    await loadLibrary();
    toast('Included games restored.');
  });

  el.querySelector('#reset-db-btn').addEventListener('click', async () => {
    if (!confirm('Delete all library data and reseed defaults? This cannot be undone.')) return;
    if (typeof window.__TAURI__ !== 'undefined') {
      // Drop and recreate the DB by deleting the file via fs plugin
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('reset_library');
        toast('Library reset — restart the app to reseed');
      } catch {
        toast('Restart the app after deleting: %APPDATA%\\com.dosdeck.app\\dosdeck.db');
      }
    } else {
      // In-memory: just reload
      location.reload();
    }
  });

  el.querySelector('#test-dosbox-btn').addEventListener('click', async () => {
    const btn = el.querySelector('#test-dosbox-btn');
    btn.disabled = true;
    btn.textContent = 'Launching…';
    try {
      const { launchDosboxShell } = await import('./launcher.js');
      const result = await launchDosboxShell();
      if (result?.simulated) {
        toast('Preview mode — DOSBox would open here');
      } else {
        toast('DOSBox launched! Check your taskbar.');
      }
    } catch (e) {
      toast(`Error: ${e}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Launch shell';
    }
  });

  const calSteps = [
    { key: 'lstickup', label: 'Left stick up', axis: 'LeftStickY', min: 0.18, floor: 0.16 },
    { key: 'lstickdown', label: 'Left stick down', axis: 'LeftStickY', min: 0.18, floor: 0.16 },
    { key: 'lstickleft', label: 'Left stick left', axis: 'LeftStickX', min: 0.18, floor: 0.16 },
    { key: 'lstickright', label: 'Left stick right', axis: 'LeftStickX', min: 0.18, floor: 0.16 },
    { key: 'rstickleft', label: 'Right stick left', axis: 'RightStickX', min: 0.15, floor: 0.12 },
    { key: 'rstickright', label: 'Right stick right', axis: 'RightStickX', min: 0.15, floor: 0.12 },
    { key: 'rt', label: 'Right trigger', buttons: ['RightTrigger2'], axes: ['RightZ', 'RightStickY'], min: 0.12, floor: 0.1 },
    { key: 'btn_a', label: 'A button', anyButton: true },
    { key: 'btn_b', label: 'B button', anyButton: true },
    { key: 'btn_x', label: 'X button', anyButton: true },
    { key: 'start', label: 'Start button', anyButton: true },
    { key: 'select', label: 'Select / Back button', anyButton: true },
  ];
  let calIndex = -1;
  let calProfile = {};

  function controllerProfileSummary() {
    const saved = JSON.parse(localStorage.getItem('controller_profile') || '{}');
    const lines = Object.entries(saved).map(([key, tokens]) => `${key}: ${tokens.join(', ')}`);
    return lines.length ? lines.join('\n') : 'No saved controller profile.';
  }

  function showCalibrationStep() {
    const stepEl = el.querySelector('#controller-cal-step');
    const out = el.querySelector('#controller-readout');
    if (calIndex < 0) {
      stepEl.textContent = '';
      out.textContent = controllerProfileSummary();
      return;
    }
    if (calIndex >= calSteps.length) {
      localStorage.setItem('controller_profile', JSON.stringify(calProfile));
      stepEl.textContent = 'Calibration saved.';
      out.textContent = controllerProfileSummary();
      el.querySelector('#controller-capture-btn').disabled = true;
      calIndex = -1;
      return;
    }
    stepEl.textContent = `Next: click Capture, then move/press ${calSteps[calIndex].label}`;
    out.textContent = controllerProfileSummary();
  }

  function detectControllerInput(snapshot) {
    const pad = snapshot.gamepads?.[0];
    if (!pad) return null;

    const button = pad.buttons
      .filter(b => b.pressed || b.value > 0.35)
      .sort((a, b) => (b.value || (b.pressed ? 1 : 0)) - (a.value || (a.pressed ? 1 : 0)))[0];
    if (button) return `button:${button.button}`;

    const axis = pad.axes
      .filter(a => Math.abs(a.value) > 0.35)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
    if (axis) return `axis:${axis.axis}:${axis.value < 0 ? 'neg' : 'pos'}`;

    return null;
  }

  function describeCaptureResult(result) {
    const lines = [];
    if (result?.token) {
      lines.push(`Saved: ${result.token}`);
    }

    const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
    if (candidates.length) {
      lines.push('Strongest signals heard:');
      lines.push(...candidates.map(item => {
        const value = Number(item.value || 0);
        return `${item.kind || 'input'} ${item.name || ''} ${value.toFixed(2)} -> ${item.token || ''}`.trim();
      }));
    }

    const events = Array.isArray(result?.events) ? result.events.slice(-8) : [];
    if (!candidates.length && events.length) {
      lines.push('Recent movement heard:');
      lines.push(...events.map(item => {
        const value = Number(item.value || 0);
        return `${item.kind || 'input'} ${item.name || ''} ${value.toFixed(2)}`.trim();
      }));
    }

    return lines.join('\n');
  }

  function axisThreshold(value, floor = 0.035) {
    return Math.min(0.25, Math.max(floor, Math.abs(Number(value || 0)) * 0.6));
  }

  function parseCaptureToken(token) {
    const parts = String(token || '').split(':');
    if (parts[0] === 'axis' && parts.length >= 4) {
      return { type: 'axis', axis: parts[1], dir: parts[2], threshold: Number(parts[3]) };
    }
    if (parts[0] === 'axis' && parts.length >= 3) {
      return { type: 'axis', axis: parts[1], dir: parts[2] };
    }
    if (parts[0] === 'button' && parts.length >= 2) {
      return { type: 'button', button: parts[1] };
    }
    if (parts[0] === 'webaxis' && parts.length >= 5) {
      return { type: 'webaxis', pad: parts[1], axis: parts[2], dir: parts[3], threshold: Number(parts[4]) };
    }
    if (parts[0] === 'webbutton' && parts.length >= 3) {
      return { type: 'webbutton', pad: parts[1], button: parts[2] };
    }
    return null;
  }

  function tokenMatchesStep(parsed, step) {
    if (!parsed) return false;
    if (parsed.type === 'axis') {
      if (step.axis) return parsed.axis === step.axis;
      return Array.isArray(step.axes) && step.axes.includes(parsed.axis);
    }
    if (parsed.type === 'button') {
      if (step.anyButton) return true;
      return Array.isArray(step.buttons) && step.buttons.includes(parsed.button);
    }
    if (parsed.type === 'webaxis') {
      return step.axis || step.axes;
    }
    if (parsed.type === 'webbutton') {
      return step.anyButton || Array.isArray(step.buttons);
    }
    return false;
  }

  function refineCaptureForStep(result, step) {
    const options = [
      ...(result?.token ? [{ ...result, token: result.token }] : []),
      ...(Array.isArray(result?.candidates) ? result.candidates : []),
    ];

    for (const item of options) {
      const parsed = parseCaptureToken(item.token);
      const value = Math.abs(Number(item.value || result?.value || 0));
      if (!tokenMatchesStep(parsed, step)) continue;
      if ((parsed.type === 'axis' || parsed.type === 'webaxis') && value < (step.min || 0.045)) continue;
      if ((parsed.type === 'button' || parsed.type === 'webbutton') && value < 0.35 && item.value !== undefined) continue;

      if (parsed.type === 'axis') {
        return {
          ...result,
          token: `axis:${parsed.axis}:${parsed.dir}:${axisThreshold(value, step.floor).toFixed(3)}`,
          value,
        };
      }
      if (parsed.type === 'webaxis') {
        return {
          ...result,
          token: `webaxis:${parsed.pad}:${parsed.axis}:${parsed.dir}:${axisThreshold(value, step.floor).toFixed(3)}`,
          value,
        };
      }
      return { ...result, token: item.token, value: item.value ?? result?.value };
    }

    return { ...result, token: null };
  }

  el.querySelector('#controller-calibrate-btn').addEventListener('click', () => {
    calProfile = {};
    calIndex = 0;
    el.querySelector('#controller-capture-btn').disabled = false;
    showCalibrationStep();
  });

  el.querySelector('#controller-capture-btn').addEventListener('click', async () => {
    const out = el.querySelector('#controller-readout');
    const captureBtn = el.querySelector('#controller-capture-btn');
    captureBtn.disabled = true;
    out.textContent = `Listening for ${calSteps[calIndex].label}...`;
    try {
      const { captureControllerInput, captureBrowserGamepadInput } = await import('./launcher.js');
      let result = await captureControllerInput(3000);
      if (!result?.token) {
        const browserResult = await captureBrowserGamepadInput(3000);
        if (browserResult?.token) {
          result = browserResult;
        } else {
          result = {
            ...result,
            candidates: [
              ...(Array.isArray(result?.candidates) ? result.candidates : []),
              ...(Array.isArray(browserResult?.candidates) ? browserResult.candidates : []),
            ],
            error: result?.error || browserResult?.error,
          };
        }
      }
      const step = calSteps[calIndex];
      result = refineCaptureForStep(result, step);
      const token = result?.token;
      if (!token) {
        const detail = describeCaptureResult(result);
        out.textContent = detail
          ? `That input did not match ${step.label} strongly enough.\n${detail}`
          : `No active ${step.label} input detected. Click Capture, then move/press only that control while it is listening.`;
        captureBtn.disabled = false;
        return;
      }
      calProfile[step.key] = [token];
      const detail = describeCaptureResult(result);
      calIndex += 1;
      showCalibrationStep();
      if (detail) out.textContent = `${detail}\n\n${controllerProfileSummary()}`;
    } catch (e) {
      out.textContent = `Error: ${e}`;
    } finally {
      if (calIndex >= 0) captureBtn.disabled = false;
    }
  });

  el.querySelector('#controller-reset-btn').addEventListener('click', () => {
    localStorage.removeItem('controller_profile');
    calIndex = -1;
    calProfile = {};
    el.querySelector('#controller-capture-btn').disabled = true;
    showCalibrationStep();
  });

  showCalibrationStep();

  // Show resolved DOSBox path via a simple invoke check
  if (typeof window.__TAURI__ !== 'undefined') {
    import('./launcher.js').then(async ({ launchDosboxShell }) => {
      // Just show expected path — same logic as Rust dosbox_exe()
      const display = el.querySelector('#dosbox-path-display');
      if (display) display.textContent = 'src-tauri\\dosbox\\dosbox.exe (bundled)';
    });
  } else {
    const display = el.querySelector('#dosbox-path-display');
    if (display) display.textContent = 'src-tauri\\dosbox\\dosbox.exe (bundled)';
  }
}

// ─── Toast ───
function toast(msg, duration = 2600) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ─── TURBODOS retro audio ───────────────────────────────────────────────
// UI sound effects are synthesized square waves (authentic PC-speaker style —
// no asset files). Menu music is a looping track the user drops in at
// public/audio/menu-theme.mp3 (served at /audio/menu-theme.mp3 in dev+build).
// Both are independently toggleable and persisted.

let ctx = null;
let musicEl = null;
let musicMissing = false;

export const sfxOn     = () => (localStorage.getItem('sfx_on')   ?? 'on') === 'on';
export const musicOn   = () => (localStorage.getItem('music_on') ?? 'on') === 'on';
export const shuffleOn = () => localStorage.getItem('music_shuffle') === 'on';
export function setShuffle(on) { localStorage.setItem('music_shuffle', on ? 'on' : 'off'); }

export function setSfx(on) {
  localStorage.setItem('sfx_on', on ? 'on' : 'off');
}

export function setMusic(on) {
  localStorage.setItem('music_on', on ? 'on' : 'off');
  if (on) {
    initMusic();
    if (!suspended) musicEl?.play().catch(() => {});
  } else {
    musicEl?.pause();
    announce('');
  }
  try { window.dispatchEvent(new CustomEvent('music-state', { detail: { playing: !!(musicEl && !musicEl.paused) && !suspended } })); } catch { /* no DOM */ }
}

// Game-session ducking: silence the app while DOSBox runs, restore afterwards.
// Doesn't touch the user's music_on preference.
let suspended = false;
export function audioSuspend() {
  suspended = true;
  musicEl?.pause();
}
export function audioResume() {
  suspended = false;
  if (musicOn()) {
    initMusic();
    musicEl?.play().catch(() => {});
  }
}
export const audioSuspended = () => suspended;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

// One square-wave beep. delay lets us sequence little arpeggios.
function tone(freq, dur = 0.045, delay = 0, vol = 0.045) {
  try {
    const a = ac();
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* audio unavailable — stay silent */ }
}

const sfxLive = () => sfxOn() && !suspended;
export const blip = {
  nav:     () => { if (sfxLive()) tone(392, 0.04); },                                   // moving around
  select:  () => { if (sfxLive()) tone(660, 0.035); },                                  // picking a game
  toggle:  () => { if (sfxLive()) tone(330, 0.05); },                                   // switches
  confirm: () => { if (sfxOn()) { tone(523, 0.05); tone(659, 0.05, 0.06); tone(784, 0.07, 0.12); } }, // launch!
  error:   () => { if (sfxLive()) { tone(220, 0.09); tone(147, 0.12, 0.09); } },        // failure
};

// Menu music, two sources with one behavior (named tracks, looping):
//   1. USER FOLDER (wins if non-empty): %APPDATA%/com.dosdeck.app/music/ — any
//      mp3/ogg/wav/flac/m4a the user drops in; the TRACK NAME is the filename.
//      The 📁 nav button opens this folder; a rescan runs when the window
//      regains focus, so new files start playing without a restart.
//   2. BUNDLED: listed in /audio/manifest.json (an array of "Name.mp3" strings
//      or { file, title } objects). Files that exist play, in manifest order;
//      the track name is the title (or the filename without extension).
//   Legacy fallback: /audio/menu-theme*.mp3 if no manifest is present.
const LEGACY_CANDIDATES = [
  '/audio/menu-theme.mp3', '/audio/menu-theme-1.mp3', '/audio/menu-theme-2.mp3',
  '/audio/menu-theme-3.mp3', '/audio/menu-theme-4.mp3',
];
let playlist = null;     // [{ url|path, title }]
let trackIdx = -1;
let currentTitle = '';
const blobCache = new Map();   // path -> object URL

// Track name = file's base name, minus extension and any leading "NN " ordering
// prefix (e.g. "02 Interrupt Vector.mp3" → "Interrupt Vector"). A title that
// legitimately starts with a number ("640K of Dread") is left intact — the prefix
// must be followed by a space/separator.
function titleOf(nameOrPath) {
  const base = String(nameOrPath).split(/[\\/]/).pop() || '';
  let name; try { name = decodeURIComponent(base); } catch { name = base; }
  return name.replace(/\.[^.]+$/, '').replace(/^\d{1,3}[ .)\-_]\s*/, '').trim();
}

// The currently-playing track name (empty when nothing is playing). UI reads this
// and the 'music-track' event to show a "now playing" readout.
export const currentTrack = () => currentTitle;
function announce(title) {
  currentTitle = title || '';
  try { window.dispatchEvent(new CustomEvent('music-track', { detail: { title: currentTitle } })); } catch { /* no DOM */ }
}

// Read the bundled manifest and keep only files that actually exist.
async function bundledFromManifest() {
  let entries;
  try {
    const r = await fetch('/audio/manifest.json', { cache: 'no-cache' });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (!r.ok || !ct.includes('json')) return null;   // missing → vite serves index.html
    entries = await r.json();
  } catch { return null; }
  if (!Array.isArray(entries) || !entries.length) return null;
  const norm = entries.map(e => typeof e === 'string'
    ? { file: e, title: titleOf(e) }
    : { file: e.file, title: e.title || titleOf(e.file || '') });
  const checked = await Promise.all(norm.map(async ({ file, title }) => {
    if (!file) return null;
    const url = `/audio/${encodeURIComponent(file)}`;
    try {
      const hr = await fetch(url, { method: 'HEAD' });
      const hct = (hr.headers.get('content-type') || '').toLowerCase();
      return (hr.ok && !hct.includes('text/html')) ? { url, title } : null;
    } catch { return null; }
  }));
  return checked.filter(Boolean);   // manifest order preserved
}

async function discoverTracks(force = false) {
  if (playlist && !force) return playlist;
  let found = [];
  if (typeof window.__TAURI__ !== 'undefined') {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const files = await invoke('list_music_files');
      found = files.map(path => ({ path, title: titleOf(path) }));
      found.sort((a, b) => a.title.localeCompare(b.title));
    } catch { /* fall through to bundled */ }
  }
  if (!found.length) {
    const manifest = await bundledFromManifest();
    if (manifest && manifest.length) {
      found = manifest;
    } else {
      await Promise.all(LEGACY_CANDIDATES.map(url =>
        fetch(url, { method: 'HEAD' })
          .then(r => {
            const ct = (r.headers.get('content-type') || '').toLowerCase();
            if (r.ok && !ct.includes('text/html')) found.push({ url, title: titleOf(url) });
          })
          .catch(() => {})
      ));
      found.sort((a, b) => a.title.localeCompare(b.title));
    }
  }
  playlist = found;
  return playlist;
}

// Next track index — sequential, or random (no immediate repeat) when shuffle is on.
function nextIndex() {
  if (shuffleOn() && playlist && playlist.length > 1) {
    let n; do { n = Math.floor(Math.random() * playlist.length); } while (n === trackIdx);
    return n;
  }
  return trackIdx + 1;
}

// ── One-folder merge: bundled tracks are copied into the user music folder so
// everything lives in one place the user can prune. The bundled copies (in
// public/audio, also in the repo) stay as the master for the Restore button. ──
async function bundledManifestNames() {
  try {
    const r = await fetch('/audio/manifest.json', { cache: 'no-cache' });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (!r.ok || !ct.includes('json')) return [];
    const arr = await r.json();
    return Array.isArray(arr) ? arr.map(e => typeof e === 'string' ? e : e?.file).filter(Boolean) : [];
  } catch { return []; }
}

async function copyBundledToFolder(name) {
  const r = await fetch(`/audio/${encodeURIComponent(name)}`);
  const ct = (r.headers.get('content-type') || '').toLowerCase();
  if (!r.ok || ct.includes('text/html')) return false;   // bundled file not present
  const bytes = Array.from(new Uint8Array(await r.arrayBuffer()));
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('save_music_file', { name, bytes });
  return true;
}

async function folderBaseNames() {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return (await invoke('list_music_files')).map(p => p.split(/[\\/]/).pop());
  } catch { return []; }
}

// Copy any bundled tracks not already in the folder. Returns how many were added.
async function copyMissingBundled() {
  const have = await folderBaseNames();
  const names = await bundledManifestNames();
  let added = 0;
  for (const name of names) {
    if (have.includes(name)) continue;
    if (await copyBundledToFolder(name).catch(() => false)) added++;
  }
  return added;
}

// First-run only: seed the folder with the bundled tracks (idempotent flag).
export async function seedBundledMusicIfNeeded() {
  if (typeof window.__TAURI__ === 'undefined') return;
  if (localStorage.getItem('music_seeded_v1') === 'done') return;
  try { await copyMissingBundled(); localStorage.setItem('music_seeded_v1', 'done'); }
  catch { /* retry next launch */ }
}

// Settings button: re-add any missing original tracks, then refresh the playlist.
export async function restoreOriginalTracks() {
  if (typeof window.__TAURI__ === 'undefined') return 0;
  const added = await copyMissingBundled();
  playlist = null;
  musicMissing = false;
  await discoverTracks(true);
  if (musicOn() && !suspended) { if (!musicEl) startPlayback(); else if (musicEl.paused) playIndex(0); }
  return added;
}

async function srcFor(track) {
  if (track.url) return track.url;
  if (!blobCache.has(track.path)) {
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = await invoke('load_music_file', { path: track.path });
    const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' });
    blobCache.set(track.path, URL.createObjectURL(blob));
  }
  return blobCache.get(track.path);
}

async function playIndex(i) {
  if (!playlist || !playlist.length || !musicEl) return;
  trackIdx = ((i % playlist.length) + playlist.length) % playlist.length;
  try {
    musicEl.loop = playlist.length === 1;
    musicEl.src = await srcFor(playlist[trackIdx]);
    announce(playlist[trackIdx].title);
    musicEl.play().catch(() => {});
  } catch {
    // unreadable file — drop it and move on
    playlist.splice(trackIdx, 1);
    if (playlist.length) playIndex(trackIdx);
  }
}

async function startPlayback() {
  const tracks = await discoverTracks();
  if (!tracks.length) { musicMissing = true; return; }
  if (!musicEl) {
    musicEl = new Audio();
    musicEl.volume = 0.35;
    musicEl.addEventListener('ended', () => {
      if (musicOn() && !suspended) playIndex(nextIndex());
    });
    musicEl.addEventListener('play', emitState);
    musicEl.addEventListener('pause', emitState);
    musicEl.addEventListener('error', () => {
      if (!playlist || !playlist.length) { musicMissing = true; return; }
      playlist.splice(trackIdx, 1);
      if (playlist.length && musicOn()) playIndex(trackIdx);
    });
  }
  await playIndex(0);
  if (musicEl.paused) {
    // Autoplay blocked until first user gesture — start on the first click.
    const kick = () => {
      if (musicOn() && !suspended) musicEl?.play().catch(() => {});
      document.removeEventListener('pointerdown', kick);
    };
    document.addEventListener('pointerdown', kick);
  }
}

export function musicNext() {
  if (musicOn() && musicEl) playIndex(nextIndex());
}

export function musicPrev() {
  if (!musicEl || !musicOn()) return;
  // Standard player behavior: restart current track if a few seconds in,
  // otherwise step back to the previous track in sequence.
  if (musicEl.currentTime > 5 || !playlist || playlist.length < 2) {
    musicEl.currentTime = 0;
    musicEl.play().catch(() => {});
    return;
  }
  playIndex(trackIdx - 1);
}

// ── Play / pause / stop transport ───────────────────────────────────────────
// The play/pause icon tracks ACTUAL playback (handles autoplay-blocked state).
export const musicPlaying = () => !!(musicEl && !musicEl.paused) && !suspended;
function emitState() {
  try { window.dispatchEvent(new CustomEvent('music-state', { detail: { playing: musicPlaying() } })); } catch { /* no DOM */ }
}
export function musicToggle() {
  if (musicPlaying()) { setMusic(false); return false; }
  setMusic(true);   // called from a click, so autoplay is allowed
  return true;
}
export function musicStop() {
  setMusic(false);
  if (musicEl) { try { musicEl.currentTime = 0; } catch { /* ignore */ } }
  trackIdx = -1;     // next Play starts from the top of the playlist
  announce('');
  emitState();
}

// Rescan the user folder when the app regains focus (e.g. after dropping files
// in via the 📁 button). Only restarts playback if nothing is playing.
async function rescanOnFocus() {
  if (!musicOn() || suspended) return;
  const before = (playlist || []).map(t => t.path || t.url).join('|');
  const now = await discoverTracks(true);
  const after = now.map(t => t.path || t.url).join('|');
  if (after && after !== before) {
    musicMissing = false;
    if (!musicEl || musicEl.paused || musicEl.ended) {
      if (!musicEl) { startPlayback(); } else { playIndex(0); }
    }
  }
}

export function initMusic() {
  if (musicEl || musicMissing) return musicEl;
  window.addEventListener('focus', () => { rescanOnFocus(); });
  if (musicOn()) startPlayback();
  return musicEl;
}

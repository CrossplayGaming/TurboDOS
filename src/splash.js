// ─── TURBODOS splash screens ────────────────────────────────────────────────
// Two retro full-screen overlays:
//   • BIOS boot   — fake POST sequence shown on launch while the app initializes.
//   • Shutdown    — brief "safe to power off" card shown on quit.
// Both are skippable with any key / click. The boot splash hangs on the real
// init work (DB, first-run art pack) so it doubles as an honest progress cover.

import { mascotReact } from './mascot.js';
import { blip } from './sfx.js';

const MIN_BOOT_MS = 1900;   // don't flash by too fast even if init is instant
const FADE_MS     = 420;

// ── BIOS boot splash ─────────────────────────────────────────────────────────
// Returns a controller; call .finish(gameCount) once the library is ready.
export function startBootSplash({ version = '0.0.0', lastPlayed = '' } = {}) {
  const startedAt = Date.now();
  let finished = false, skipped = false;

  const el = document.createElement('div');
  el.id = 'boot-splash';
  el.className = 'splash';
  el.innerHTML = `
    <div class="splash-inner">
      <pre class="boot-head">TURBODOS BIOS v${version}
Copyright (C) CrossplayGaming</pre>
      <pre class="boot-body"></pre>
      <div class="boot-bar"><span class="boot-bar-fill"></span><span class="boot-bar-pct">0%</span></div>
      <div class="boot-foot">${lastPlayed ? `LAST BOOT: ${String(lastPlayed).toUpperCase()}` : 'FIRST BOOT'}</div>
      <div class="splash-skip">PRESS ANY KEY TO SKIP</div>
    </div>`;
  document.body.appendChild(el);

  const body   = el.querySelector('.boot-body');
  const fill   = el.querySelector('.boot-bar-fill');
  const pctEl  = el.querySelector('.boot-bar-pct');

  // Scripted POST lines. `count:true` marks the line that waits for the real
  // game total; it shows spinning dots until finish() supplies the number.
  const lines = [
    { text: 'Memory Test: 640K OK' },
    { text: 'Detecting game library', count: true },
    { text: 'Initializing DOSBox-Staging... OK' },
    { text: 'Loading TURBODOS...' },
  ];
  let li = 0;
  const rendered = [];
  let countIdx = -1, gameCount = null;

  const paint = () => { body.textContent = rendered.join('\n'); };

  const dotTimer = setInterval(() => {
    if (countIdx < 0 || gameCount !== null) return;
    const base = 'Detecting game library';
    const dots = '.'.repeat(1 + (Math.floor(Date.now() / 250) % 6));
    rendered[countIdx] = base + dots;
    paint();
  }, 120);

  const stepTimer = setInterval(() => {
    if (li >= lines.length) { clearInterval(stepTimer); return; }
    const line = lines[li];
    if (line.count) { countIdx = rendered.length; rendered.push('Detecting game library...'); }
    else rendered.push(line.text);
    paint();
    if (!skipped) blip.nav();
    li++;
  }, 300);

  // Progress bar creeps to 92% then waits for finish() to complete it.
  let pct = 0;
  const barTimer = setInterval(() => {
    if (pct < 92) { pct += 4; fill.style.width = pct + '%'; pctEl.textContent = pct + '%'; }
  }, 70);

  const teardown = () => {
    clearInterval(dotTimer); clearInterval(stepTimer); clearInterval(barTimer);
    el.classList.add('fade');
    mascotReact('greet');
    setTimeout(() => el.remove(), FADE_MS);
  };

  const skip = () => {
    if (finished) return;
    skipped = true; finished = true;
    document.removeEventListener('keydown', skip, true);
    document.removeEventListener('pointerdown', skip, true);
    teardown();
  };
  document.addEventListener('keydown', skip, true);
  document.addEventListener('pointerdown', skip, true);

  return {
    async finish(count) {
      if (finished) return;
      gameCount = (count ?? 0);
      // Reveal any not-yet-shown lines, then complete the count + bar.
      while (li < lines.length) {
        const line = lines[li];
        if (line.count) { countIdx = rendered.length; rendered.push(''); }
        else rendered.push(line.text);
        li++;
      }
      if (countIdx >= 0) rendered[countIdx] = `Detecting game library........ ${gameCount} FOUND`;
      clearInterval(dotTimer); clearInterval(stepTimer); clearInterval(barTimer);
      paint();
      fill.style.width = '100%'; pctEl.textContent = '100%';
      const wait = Math.max(0, MIN_BOOT_MS - (Date.now() - startedAt));
      await new Promise(r => setTimeout(r, Math.max(300, wait)));
      if (finished) return;   // user skipped during the wait
      finished = true;
      document.removeEventListener('keydown', skip, true);
      document.removeEventListener('pointerdown', skip, true);
      teardown();
    },
  };
}

// ── Shutdown splash ──────────────────────────────────────────────────────────
// Short "safe to power off" card. Resolves after ~1s or on any key/click.
// z-index sits just below the mascot so he waves goodbye over the top.
export function showShutdownSplash() {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.id = 'quit-splash';
    el.className = 'splash';
    el.innerHTML = `
      <div class="splash-inner">
        <pre class="boot-body">C:\\> Parking game library heads...
C:\\> Flushing save states...</pre>
        <div class="quit-safe">It is now safe to turn off your TURBODOS.</div>
      </div>`;
    document.body.appendChild(el);
    try { blip.toggle(); } catch { /* ignore */ }
    mascotReact('bye');

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', finish, true);
      document.removeEventListener('pointerdown', finish, true);
      el.remove();
      resolve();
    };
    document.addEventListener('keydown', finish, true);
    document.addEventListener('pointerdown', finish, true);
    setTimeout(finish, 1050);
  });
}

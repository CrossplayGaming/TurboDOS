// ─── TURBODOS couch navigation ─────────────────────────────────────────────
// One virtual cursor driven by two input sources:
//   keyboard : arrows / Enter / Escape
//   gamepad  : d-pad + left stick / A = confirm / B = back / Start = play
// Movement is geometric (nearest focusable control in the pressed direction),
// so every screen works without per-screen wiring. The cursor is a .nav-focus
// highlight; activation is a synthesized click, so all existing handlers and
// UI blips fire exactly as if the mouse was used.

import { blip } from './sfx.js';

const FOCUSABLE = 'button, .rail-item, .game-tile, .toggle-slider, input, select';
let current = null;
let gameRunning = false;

export function setGameRunning(on) { gameRunning = on; }

// Binding-capture screens must own ALL input while capturing — otherwise the
// stick/keys being recorded also steer the menu. Detected straight from the DOM:
// wizard & original-controls mark rows with .capturing, controller setup marks
// the armed slot with .ctrl-capture-btn.active.
function captureActive() {
  return !!document.querySelector('.capturing, .ctrl-capture-btn.active');
}

// ── candidates ──────────────────────────────────────────────────────────────
function isVisible(el) {
  if (el.disabled) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  // exclude elements inside inactive screens / hidden containers
  return el.offsetParent !== null || getComputedStyle(el).position === 'fixed';
}

function candidates() {
  return [...document.querySelectorAll(FOCUSABLE)].filter(isVisible);
}

function setCurrent(el) {
  if (current === el) return;
  document.querySelectorAll('.nav-focus').forEach(e => e.classList.remove('nav-focus'));
  current = el;
  if (el) {
    el.classList.add('nav-focus');
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function ensureCurrent() {
  if (current && document.contains(current) && isVisible(current)) return current;
  // sensible starting point: selected tile, else first tile, else first control
  const start = document.querySelector('#game-grid .game-tile.selected')
             || document.querySelector('#game-grid .game-tile')
             || candidates()[0]
             || null;
  setCurrent(start);
  return current;
}

// ── geometric movement ──────────────────────────────────────────────────────
function move(dir) {
  const from = ensureCurrent();
  if (!from) return;
  const fr = from.getBoundingClientRect();
  const fc = { x: fr.left + fr.width / 2, y: fr.top + fr.height / 2 };

  let best = null, bestScore = Infinity;
  for (const el of candidates()) {
    if (el === from) continue;
    const r = el.getBoundingClientRect();
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const dx = c.x - fc.x, dy = c.y - fc.y;
    let fwd, lat;
    if (dir === 'up')    { fwd = -dy; lat = Math.abs(dx); }
    if (dir === 'down')  { fwd =  dy; lat = Math.abs(dx); }
    if (dir === 'left')  { fwd = -dx; lat = Math.abs(dy); }
    if (dir === 'right') { fwd =  dx; lat = Math.abs(dy); }
    if (fwd <= 4) continue;                      // must actually be in that direction
    const score = fwd + lat * 2.5;               // prefer aligned over merely near
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) {
    setCurrent(best);
    blip.nav();
  }
}

// ── actions ─────────────────────────────────────────────────────────────────
function activate() {
  const el = ensureCurrent();
  if (!el) return;
  const tag = el.tagName;
  if (tag === 'INPUT' && el.type === 'text' || tag === 'SELECT' || (tag === 'INPUT' && !el.type) ) {
    el.focus();
    return;
  }
  if (tag === 'INPUT' && el.type === 'checkbox') { el.click(); return; }
  // A on an already-selected game tile = play it from the side panel
  if (el.classList.contains('game-tile') && el.classList.contains('selected')) {
    const play = document.getElementById('side-play-btn') || document.querySelector('#side-content .episode-play-btn');
    if (play && !play.disabled) { play.click(); return; }
  }
  el.click();
}

function back() {
  // typing in a field? Esc/B just leaves it
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA')) {
    ae.blur();
    return;
  }
  // screen-local back button first, else return to the library
  const backBtn = document.querySelector('.screen.active .detail-back')
               || document.querySelector('.screen.active [id$="-back"]');
  if (backBtn) { backBtn.click(); return; }
  const lib = document.querySelector('.nav-btn[data-screen="library"]');
  if (lib && !lib.classList.contains('active')) lib.click();
}

function playSelected() {
  const play = document.getElementById('side-play-btn') || document.querySelector('#side-content .episode-play-btn');
  if (play && !play.disabled) play.click();
}

// ── keyboard source ─────────────────────────────────────────────────────────
function onKey(e) {
  if (gameRunning) return;       // injected in-game keystrokes must not drive the menu
  if (captureActive()) return;   // a binding is being recorded — hands off entirely
  const ae = document.activeElement;
  const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT');
  if (typing) {
    if (e.key === 'Escape') { e.preventDefault(); ae.blur(); }
    return; // let arrows/Enter behave normally inside fields
  }
  switch (e.key) {
    case 'ArrowUp':    e.preventDefault(); move('up'); break;
    case 'ArrowDown':  e.preventDefault(); move('down'); break;
    case 'ArrowLeft':  e.preventDefault(); move('left'); break;
    case 'ArrowRight': e.preventDefault(); move('right'); break;
    case 'Enter':      e.preventDefault(); activate(); break;
    case 'Escape':     e.preventDefault(); back(); break;
  }
}

// ── gamepad source ──────────────────────────────────────────────────────────
// Poll with hold-repeat: first move immediate, then a delay, then steady repeat.
const REPEAT_DELAY = 380;
const REPEAT_RATE  = 140;
const held = {};   // action -> { since, lastFire }

function padActions(gp) {
  const acts = new Set();
  const b = gp.buttons, ax = gp.axes;
  if (b[12]?.pressed || (ax[1] ?? 0) < -0.5) acts.add('up');
  if (b[13]?.pressed || (ax[1] ?? 0) >  0.5) acts.add('down');
  if (b[14]?.pressed || (ax[0] ?? 0) < -0.5) acts.add('left');
  if (b[15]?.pressed || (ax[0] ?? 0) >  0.5) acts.add('right');
  if (b[0]?.pressed) acts.add('confirm');   // A
  if (b[1]?.pressed) acts.add('back');      // B
  if (b[9]?.pressed) acts.add('start');
  return acts;
}

function fire(action) {
  if (action === 'confirm') activate();
  else if (action === 'back') back();
  else if (action === 'start') playSelected();
  else move(action);
}

function pollPads() {
  if (gameRunning || document.hidden) { requestAnimationFrame(pollPads); return; }
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const acts = new Set();
  for (const gp of pads) if (gp && gp.connected) padActions(gp).forEach(a => acts.add(a));

  const now = performance.now();

  if (captureActive()) {
    // Binding capture owns the pad. Keep tracking what's held (without firing)
    // so the input that FINISHES the capture doesn't fire a UI action the
    // moment capture ends — it must be released and pressed again first.
    for (const a of acts) if (!held[a]) held[a] = { since: now, lastFire: now, swallow: true };
    for (const a of Object.keys(held)) if (!acts.has(a)) delete held[a];
    requestAnimationFrame(pollPads);
    return;
  }
  for (const a of acts) {
    const h = held[a];
    if (!h) {
      held[a] = { since: now, lastFire: now };
      fire(a);
    } else if (!h.swallow && ['up','down','left','right'].includes(a)) {
      // directions repeat while held; buttons fire once per press.
      // (swallowed inputs — held over from a binding capture — stay dead
      // until released and pressed fresh.)
      if (now - h.since > REPEAT_DELAY && now - h.lastFire > REPEAT_RATE) {
        h.lastFire = now;
        fire(a);
      }
    }
  }
  for (const a of Object.keys(held)) if (!acts.has(a)) delete held[a];
  requestAnimationFrame(pollPads);
}

// ── wiring ──────────────────────────────────────────────────────────────────
export function initNav() {
  document.addEventListener('keydown', onKey);
  // mouse and nav share one cursor: clicking something makes it current
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest(FOCUSABLE);
    if (el) setCurrent(el);
  });
  requestAnimationFrame(pollPads);
}

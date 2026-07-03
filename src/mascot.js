// ─── TURBODOS mascot ────────────────────────────────────────────────────────
// A pixel-art buddy who lives above the status bar and reacts to app events.
// Asset-driven: drop files into public/mascot/ named by state, e.g. idle.webm,
// launch.png, react-fps.gif. Whatever exists is used; missing states are skipped;
// no idle asset = mascot stays hidden. Formats (first found wins per state):
// webm (VP9+alpha, best for animation) · apng · png · gif.
//
// See public/mascot/README.txt for the full state list and production rules.

// ── the complete state vocabulary ────────────────────────────────────────────
const BASE_STATES = [
  'idle',        // default loop — REQUIRED for the mascot to appear
  'sleep',       // user idle 2+ min (loop)
  'greet',       // app start · clicked · returned from a game
  'launch',      // a game launches
  'working',     // download running (held loop until done)
  'celebrate',   // download finished
  'error',       // launch/download failed
  'dance',       // music switched on
  'select',      // a game was selected (generic; genre variants override it)
  'bye',         // app is quitting (shown on the shutdown splash)
];
// Ambient "fidgets" — occasionally interrupt idle for a beat, then resume idle.
const FIDGETS = ['idle-look', 'idle-stretch', 'idle-yawn', 'idle-scratch'];
// Genre-specific selection reactions — used instead of generic 'select' when the
// picked game's genre matches (react-fps, react-platform, …).
const GENRE_REACTS = [
  'react-fps', 'react-platform', 'react-shooter', 'react-racing',
  'react-fighting', 'react-action', 'react-adventure', 'react-rpg',
];
const STATES = [...BASE_STATES, ...FIDGETS, ...GENRE_REACTS];

const EXTS = ['webm', 'apng', 'png', 'gif'];
const ONESHOT_MS      = 2400;    // image reactions revert after this
const SLEEP_AFTER_MS  = 120000;  // fall asleep after 2 min without user input
const SELECT_THROTTLE = 3000;    // min gap between selection reactions
const FIDGET_MIN_MS   = 18000;   // earliest a fidget fires after settling into idle
const BUBBLE_MS       = 4600;    // how long a thought stays up
const BUBBLE_MIN_GAP  = 26000;   // min gap between spontaneous thoughts

// Spontaneous idle musings — keep them short (they wrap in a small bubble).
const THOUGHTS = [
  '640K is plenty.',
  'Turbo button: ON.',
  'I dream in 256 colors.',
  'Insert disk 2 of 14…',
  'High score? Classified.',
  'Do CRTs dream?',
  "Bet I'd win at ROTT.",
  'Smells like warm CRT.',
  'DOS or dosa? Hungry now.',
  'One more level…',
  'I memorize IRQ settings.',
  'Those Wolf3D skies…',
  'Mechanical keys only.',
  'Autoexec.bat is poetry.',
  'Someone say shareware?',
  'I miss modem handshakes.',
  "Where's the ANY key?",
  'Floppy disks were tidy.',
  'Save early, save often.',
  'config.sys, old friend.',
];
// Category 3 — helpful tips about actual app features.
const TIPS = [
  'Tip: F11 toggles fullscreen.',
  'Tip: Double-click a tile to Manage.',
  'Tip: Drop songs in the music folder.',
  'Tip: A gamepad steers the menus.',
  'Tip: Sort by "Tuned first".',
  'Tip: Add your own games too.',
  'Tip: Click me to say hi.',
  'Tip: CRT scanlines live in Settings.',
  'Tip: I nap after 2 idle minutes.',
  'Tip: Search jumps to any game.',
];
// Category 2 — quick reactions when you SELECT/highlight a game, by genre.
const SELECT_QUIPS = {
  fps:       ['Ooh, a shooter.', 'Trigger finger ready.'],
  shooter:   ['Bullets incoming.', 'Twitchy pick.'],
  platform:  ['Jumpy little pick.', 'Mind the gaps.'],
  racing:    ['Vroom.', 'Need for speed?'],
  fighting:  ['Round one?', 'Them’s fightin’ games.'],
  action:    ['Spicy choice.', 'Ooh, action.'],
  adventure: ['A quest, then.', 'Adventure calls.'],
  rpg:       ['Roll for it.', 'Long one, this.'],
  _default:  ['Good eye.', 'Nice pick.', 'Solid choice.'],
};
// Context-aware quips keyed by genre, used when you launch a game.
const LAUNCH_QUIPS = {
  fps:       ['Lock and load.', 'Mind the imps.', 'Rip and tear!'],
  shooter:   ['Dodge everything.', 'Bullet hell, here we go.'],
  platform:  ['Watch that first jump.', 'Grab the coins!'],
  racing:    ['Floor it.', 'Hold your line.'],
  fighting:  ['Down, forward, punch.', 'Flawless victory?'],
  action:    ["Go get 'em.", 'This is the fun part.'],
  adventure: ['Read everything twice.', 'Pick up that key.'],
  rpg:       ['Save often, hero.', 'Grind a little first.'],
  _default:  ['Have fun in there.', "Go get 'em.", "I'll hold the fort."],
};

const assets = {};
let root = null, imgEl = null, vidEl = null;
let bubbleEl = null, bubbleTimer = null, lastBubble = 0;
let current = null;
let revertTimer = null;
let holdState = null;
let lastActivity = Date.now();
let lastFidget = 0;
let lastSelect = 0;

export const mascotOn = () => (localStorage.getItem('mascot_on') ?? 'on') === 'on';
export function setMascot(on) {
  localStorage.setItem('mascot_on', on ? 'on' : 'off');
  if (root) root.style.display = on && assets.idle ? '' : 'none';
  if (on && !root) initMascot();
}

async function probeAssets() {
  await Promise.all(STATES.map(async state => {
    for (const ext of EXTS) {
      const url = `/mascot/${state}.${ext}`;
      try {
        const r = await fetch(url, { method: 'HEAD' });
        // vite dev server 200s missing files as text/html (SPA fallback) — reject those.
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        if (r.ok && !ct.includes('text/html')) { assets[state] = { url, video: ext === 'webm' }; return; }
      } catch { /* keep probing */ }
    }
  }));
}

function show(state, { loop = false, oneshot = false } = {}) {
  const a = assets[state];
  if (!a || !root) return false;
  current = state;
  clearTimeout(revertTimer);
  if (a.video) {
    imgEl.style.display = 'none';
    vidEl.style.display = '';
    vidEl.loop = loop;
    vidEl.src = a.url;
    vidEl.play().catch(() => {});
    vidEl.onended = oneshot ? () => revertToBase() : null;
  } else {
    vidEl.pause();
    vidEl.style.display = 'none';
    imgEl.style.display = '';
    imgEl.src = a.url;
    if (oneshot) revertTimer = setTimeout(revertToBase, ONESHOT_MS);
  }
  return true;
}

function revertToBase() {
  if (holdState && assets[holdState]) show(holdState, { loop: true });
  else show('idle', { loop: true });
}

/// One-shot reaction (launch, celebrate, error, greet, dance).
export function mascotReact(state) {
  if (!mascotOn() || !assets.idle || !assets[state]) return;
  show(state, { oneshot: true });
}

/// Held state (working) — persists until mascotClearHold().
export function mascotHold(state) {
  if (!mascotOn() || !assets.idle) return;
  holdState = assets[state] ? state : null;
  if (holdState) show(holdState, { loop: true });
}
export function mascotClearHold() {
  holdState = null;
  if (root && assets.idle) revertToBase();
}

/// Selection reaction — genre-specific pose if available, else generic 'select'.
/// Throttled and only fires from a settled idle so it never spams during browsing.
export function mascotSelect(genre) {
  if (!mascotOn() || !assets.idle) return;
  if (current !== 'idle' || holdState) return;
  const now = Date.now();
  if (now - lastSelect < SELECT_THROTTLE) return;
  const key = (genre && assets[`react-${genre}`]) ? `react-${genre}`
            : (assets.select ? 'select' : null);
  if (!key) return;
  lastSelect = now;
  show(key, { oneshot: true });
}

// ── Thought bubble ───────────────────────────────────────────────────────────
function ensureBubble() {
  if (bubbleEl || !root) return;
  bubbleEl = document.createElement('div');
  bubbleEl.className = 'mascot-bubble';
  root.appendChild(bubbleEl);
}
function hideBubble() { bubbleEl?.classList.remove('show'); }
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/// Show a thought in the bubble by his head. Independent of the pose animations.
export function mascotSay(text, ms = BUBBLE_MS) {
  if (!mascotOn() || !assets.idle || !root || current === 'sleep' || !text) return;
  ensureBubble();
  bubbleEl.textContent = text;
  bubbleEl.classList.remove('show');
  void bubbleEl.offsetWidth;      // restart the fade if one is mid-flight
  bubbleEl.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(hideBubble, ms);
  lastBubble = Date.now();
}

/// A launch quip tuned to the game's genre (falls back to a generic one).
export function mascotLaunchQuip(genre) {
  mascotSay(pick(LAUNCH_QUIPS[genre] || LAUNCH_QUIPS._default));
}

/// A reaction to selecting a game — throttled + probabilistic so browsing the
/// library doesn't spam the bubble.
let lastChoice = 0;
export function mascotChoiceQuip(genre) {
  if (Date.now() - lastChoice < 16000 || Math.random() > 0.5) return;
  lastChoice = Date.now();
  mascotSay(pick(SELECT_QUIPS[genre] || SELECT_QUIPS._default));
}

/// Re-attach the persistent mascot node into the rail's #mascot-dock. Called after
/// every library re-render (innerHTML rebuild detaches him) and once at init.
/// Falls back to a floating fixed position if the dock isn't in the DOM yet.
export function homeMascot() {
  if (!root) return;
  const dock = document.getElementById('mascot-dock');
  const host = dock || document.body;
  if (root.parentElement !== host) host.appendChild(root);
  root.classList.toggle('docked', !!dock);
  // Detaching pauses <video>; resume whatever should be showing.
  if (vidEl && vidEl.src && vidEl.style.display !== 'none') vidEl.play().catch(() => {});
}

export async function initMascot() {
  if (root) return;
  await probeAssets();
  if (!assets.idle) return;

  root = document.createElement('div');
  root.id = 'mascot';
  vidEl = document.createElement('video');
  vidEl.muted = true; vidEl.playsInline = true;
  imgEl = document.createElement('img'); imgEl.alt = '';
  root.append(vidEl, imgEl);
  // He lives docked in the rail's #mascot-dock (so his booth frame aligns with the
  // rail frame). The rail is rebuilt via innerHTML on every filter change, which
  // detaches this node — homeMascot() re-attaches the persistent node afterward.
  homeMascot();
  if (!mascotOn()) root.style.display = 'none';

  root.addEventListener('click', () => mascotReact('greet'));

  const wake = () => {
    lastActivity = Date.now();
    if (current === 'sleep') revertToBase();
  };
  document.addEventListener('pointerdown', wake);
  document.addEventListener('keydown', wake);

  // Ambient loop: handles sleeping and occasional idle fidgets.
  const fidgetsPresent = () => FIDGETS.filter(f => assets[f]);
  setInterval(() => {
    if (!mascotOn() || holdState || current !== 'idle') return;
    const idleFor = Date.now() - lastActivity;
    if (assets.sleep && idleFor > SLEEP_AFTER_MS) { hideBubble(); show('sleep', { loop: true }); return; }
    const fids = fidgetsPresent();
    if (fids.length && idleFor > FIDGET_MIN_MS && Date.now() - lastFidget > FIDGET_MIN_MS && Math.random() < 0.4) {
      lastFidget = Date.now();
      show(fids[Math.floor(Math.random() * fids.length)], { oneshot: true });
    }
  }, 6000);

  // Spontaneous thoughts — a random musing (humor) or app tip now and then.
  setInterval(() => {
    if (!mascotOn() || current === 'sleep') return;
    if (Date.now() - lastBubble < BUBBLE_MIN_GAP) return;
    if (Math.random() < 0.4) mascotSay(pick(Math.random() < 0.6 ? THOUGHTS : TIPS));
  }, 9000);

  if (assets.greet) show('greet', { oneshot: true });
  else show('idle', { loop: true });
}

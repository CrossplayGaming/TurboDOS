// Launcher — "hands" layer. Only file that talks to DOSBox.

let webMapperTimer = null;
let webMapperHeld = new Map();

function normalizeInputName(input) {
  return String(input || '').trim().toLowerCase().replaceAll(' ', '').replaceAll('_', '');
}

const WEB_DEFAULTS = {
  lstickup: [{ type: 'axis', axis: 1, dir: 'neg' }],
  lstickdown: [{ type: 'axis', axis: 1, dir: 'pos' }],
  lstickleft: [{ type: 'axis', axis: 0, dir: 'neg' }],
  lstickright: [{ type: 'axis', axis: 0, dir: 'pos' }],
  rstickup: [{ type: 'axis', axis: 3, dir: 'neg' }],
  rstickdown: [{ type: 'axis', axis: 3, dir: 'pos' }],
  rstickleft: [{ type: 'axis', axis: 2, dir: 'neg' }],
  rstickright: [{ type: 'axis', axis: 2, dir: 'pos' }],
  rt: [{ type: 'button', button: 7 }, { type: 'axis', axis: 5, dir: 'pos' }],
  lt: [{ type: 'button', button: 6 }, { type: 'axis', axis: 4, dir: 'pos' }],
  rb: [{ type: 'button', button: 5 }],
  lb: [{ type: 'button', button: 4 }],
  btna: [{ type: 'button', button: 0 }],
  btnb: [{ type: 'button', button: 1 }],
  btnx: [{ type: 'button', button: 2 }],
  btny: [{ type: 'button', button: 3 }],
  start: [{ type: 'button', button: 9 }],
  select: [{ type: 'button', button: 8 }],
  dpadup: [{ type: 'button', button: 12 }],
  dpaddown: [{ type: 'button', button: 13 }],
  dpadleft: [{ type: 'button', button: 14 }],
  dpadright: [{ type: 'button', button: 15 }],
};

function calibratedAxisThreshold(value) {
  return Math.min(0.25, Math.max(0.035, Math.abs(value) * 0.6));
}

function parseWebToken(token) {
  const parts = String(token || '').split(':');
  if (parts[0] === 'webaxis' && parts.length >= 4) {
    return {
      type: 'axis',
      pad: Number(parts[1]),
      axis: Number(parts[2]),
      dir: parts[3],
      threshold: Number(parts[4]) || 0.25,
    };
  }
  if (parts[0] === 'webbutton' && parts.length >= 3) {
    return { type: 'button', pad: Number(parts[1]), button: Number(parts[2]) };
  }
  return null;
}

function firstGamepad(pads = navigator.getGamepads?.() || []) {
  return Array.from(pads).find(pad => pad && pad.connected) || null;
}

function webControlPressed(control, pads) {
  const pad = Number.isFinite(control.pad) ? pads[control.pad] : firstGamepad(pads);
  if (!pad) return false;
  if (control.type === 'axis') {
    const value = pad.axes?.[control.axis] || 0;
    const threshold = Number(control.threshold) || 0.25;
    return control.dir === 'neg' ? value < -threshold : value > threshold;
  }
  if (control.type === 'button') {
    const button = pad.buttons?.[control.button];
    return Boolean(button?.pressed || button?.value > 0.35);
  }
  return false;
}

function webControlsForInput(input, controllerProfile, includeDefaults = true) {
  const key = normalizeInputName(input);
  const saved = controllerProfile?.[key]?.map(parseWebToken).filter(Boolean);
  if (saved?.length) return saved;
  return includeDefaults ? (WEB_DEFAULTS[key] || []) : [];
}

async function sendControllerKeys(dosboxEvent, pressed) {
  if (typeof window.__TAURI__ === 'undefined') return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('send_controller_keys', { dosboxEvent, pressed });
}

function stopWebGamepadMapper() {
  if (webMapperTimer) {
    clearInterval(webMapperTimer);
    webMapperTimer = null;
  }
  for (const [event, pressed] of webMapperHeld.entries()) {
    if (pressed) sendControllerKeys(event, false).catch(() => {});
  }
  webMapperHeld = new Map();
}

// Per-game ctrl_bindings web mapper. Tokens are webbutton/webaxis format (browser Gamepad API).
// ctrlBindings: [{action, ctrl}], lookupBindings: [{action, dosbox_event}]
function startCtrlBindingsWebMapper(ctrlBindings, lookupBindings) {
  stopWebGamepadMapper();
  if (!navigator.getGamepads) return;

  const eventMap = Object.fromEntries(lookupBindings.map(b => [b.action, b.dosbox_event]).filter(([, e]) => e));

  const mappings = ctrlBindings
    .map(cb => {
      const dosboxEvent = eventMap[cb.action];
      if (!dosboxEvent) return null;
      const control = parseWebToken(cb.ctrl);
      if (!control) return null;
      return { event: dosboxEvent, controls: [control] };
    })
    .filter(Boolean);

  if (!mappings.length) return;

  function startPolling() {
    if (webMapperTimer) return;
    webMapperTimer = setInterval(() => {
      const pads = navigator.getGamepads?.() || [];
      for (const mapping of mappings) {
        const pressed = mapping.controls.some(c => webControlPressed(c, pads));
        const wasPressed = webMapperHeld.get(mapping.event) || false;
        if (pressed !== wasPressed) {
          webMapperHeld.set(mapping.event, pressed);
          sendControllerKeys(mapping.event, pressed).catch(() => {});
        }
      }
    }, 16);
  }

  if (firstGamepad()) {
    startPolling();
  } else {
    const onConnect = () => { window.removeEventListener('gamepadconnected', onConnect); startPolling(); };
    window.addEventListener('gamepadconnected', onConnect);
  }
}

function startWebGamepadMapper(bindings, controllerProfile) {
  stopWebGamepadMapper();
  if (!navigator.getGamepads) return;

  const mappings = bindings
    .map(binding => {
      const event = binding.dosbox_event || '';
      if (!event) return null;
      // Use web profile tokens if calibrated; otherwise fall back to WEB_DEFAULTS buttons only.
      // Axes are intentionally excluded from the fallback — they are handled by the gilrs thread.
      let controls = webControlsForInput(binding.input, controllerProfile, false);
      if (!controls.length) {
        const key = normalizeInputName(binding.input);
        controls = (WEB_DEFAULTS[key] || []).filter(c => c.type === 'button');
      }
      return controls.length ? { event, controls } : null;
    })
    .filter(Boolean);

  if (!mappings.length) return;

  function startPolling() {
    if (webMapperTimer) return;
    webMapperTimer = setInterval(() => {
      const pads = navigator.getGamepads?.() || [];
      for (const mapping of mappings) {
        const pressed = mapping.controls.some(control => webControlPressed(control, pads));
        const wasPressed = webMapperHeld.get(mapping.event) || false;
        if (pressed !== wasPressed) {
          webMapperHeld.set(mapping.event, pressed);
          sendControllerKeys(mapping.event, pressed).catch(() => {});
        }
      }
    }, 16);
  }

  if (firstGamepad()) {
    startPolling();
  } else {
    const onConnect = () => {
      window.removeEventListener('gamepadconnected', onConnect);
      startPolling();
    };
    window.addEventListener('gamepadconnected', onConnect);
  }
}

export async function launchGame(game, scheme, bindings, opts = {}) {
  if (typeof window.__TAURI__ === 'undefined') {
    console.log('[TURBODOS] Simulated launch:', game.title, '/', scheme?.name);
    return { ok: true, simulated: true };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const controllerProfile = JSON.parse(localStorage.getItem('controller_profile') || 'null');
  const ctrlBindings = opts.ctrlBindings ?? null;
  const fpsModeActive = opts.fpsMode ?? false;
  const fpsSensitivity = opts.fpsSensitivity ?? 5.0;
  const result = await invoke('launch_game', {
    installPath: game.install_path || '',
    executable:  opts.exeOverride || game.executable || '',
    engine:      game.engine      || '',
    dosboxConfig: game.dosbox_config || '',
    bindings: bindings.map(b => ({
      action:       b.action,
      dosbox_event: b.dosbox_event || '',
      input:        b.input || '',
    })),
    alwaysRun: opts.alwaysRun ?? false,
    controllerProfile,
    ctrlBindings,
    fpsMode: fpsModeActive,
    fpsSensitivity,
  });

  // Per-game ctrl_bindings are handled by the Rust XInput mapper.
  // Stop any running JS mapper so they don't fight each other.
  if (ctrlBindings?.length) {
    stopWebGamepadMapper();
  } else {
    startWebGamepadMapper(bindings, controllerProfile);
  }
  return result;
}

export async function launchDosboxShell() {
  if (typeof window.__TAURI__ === 'undefined') {
    console.log('[TURBODOS] Simulated DOSBox shell launch');
    return { ok: true, simulated: true };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke('launch_dosbox_shell');
}

export async function controllerSnapshot() {
  if (typeof window.__TAURI__ === 'undefined') {
    return { gamepads: [] };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke('controller_snapshot');
}

export async function captureControllerInput(durationMs = 1400) {
  if (typeof window.__TAURI__ === 'undefined') {
    return { token: null };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke('capture_controller_input', { durationMs });
}

export async function captureBrowserGamepadInput(durationMs = 3000) {
  if (!navigator.getGamepads) {
    return { token: null, error: 'Browser gamepad input is unavailable.' };
  }

  const start = performance.now();
  const bestAxes = new Map();
  const bestButtons = new Map();

  while (performance.now() - start < durationMs) {
    const pads = navigator.getGamepads?.() || [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      pad.axes?.forEach((value, axis) => {
        const key = `${pad.index}:${axis}`;
        const current = bestAxes.get(key)?.value || 0;
        if (Math.abs(value) > Math.abs(current)) {
          bestAxes.set(key, { pad: pad.index, axis, value });
        }
      });
      pad.buttons?.forEach((button, index) => {
        const value = button?.value || (button?.pressed ? 1 : 0);
        const key = `${pad.index}:${index}`;
        const current = bestButtons.get(key)?.value || 0;
        if (value > current) {
          bestButtons.set(key, { pad: pad.index, button: index, value });
        }
      });
    }
    await new Promise(resolve => setTimeout(resolve, 16));
  }

  const candidates = [
    ...Array.from(bestAxes.values())
      .filter(item => Math.abs(item.value) > 0.02)
      .map(item => ({
        kind: 'axis',
        name: `Browser pad ${item.pad} axis ${item.axis}`,
        value: item.value,
        token: `webaxis:${item.pad}:${item.axis}:${item.value < 0 ? 'neg' : 'pos'}:${calibratedAxisThreshold(item.value).toFixed(3)}`,
        threshold: calibratedAxisThreshold(item.value),
      })),
    ...Array.from(bestButtons.values())
      .filter(item => item.value > 0.02)
      .map(item => ({
        kind: 'button',
        name: `Browser pad ${item.pad} button ${item.button}`,
        value: item.value,
        token: `webbutton:${item.pad}:${item.button}`,
      })),
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 8);

  const strongest = candidates[0];
  if (!strongest || Math.abs(strongest.value) < 0.045) {
    return { token: null, error: 'No browser gamepad input detected.', candidates };
  }
  return { ...strongest, candidates };
}

export async function scrapeMetadata(title) {
  if (typeof window.__TAURI__ === 'undefined') return null;
  const { invoke } = await import('@tauri-apps/api/core');
  const sgdbKey = localStorage.getItem('sgdb_key') || null;
  try {
    return await invoke('scrape_game_metadata', {
      title,
      steamgriddbKey: sgdbKey,
      screenscraper_user: localStorage.getItem('ss_user') || null,
      screenscraper_pass: localStorage.getItem('ss_pass') || null,
    });
  } catch (e) {
    return null;
  }
}

export async function downloadArt(url, gameId) {
  if (!url || typeof window.__TAURI__ === 'undefined') return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    // Download via Rust (reqwest) to avoid CORS restrictions from the WebView
    return await invoke('download_and_save_art', { url, gameId: Number(gameId) });
  } catch (e) {
    console.error('downloadArt failed:', e);
    return null;
  }
}

// Art URL cache — keyed by artPath, lives for the app session.
// Avoids re-reading from disk and re-creating blob URLs on every navigation.
const _artCache = new Map();

export async function loadArtAsUrl(artPath) {
  if (!artPath || typeof window.__TAURI__ === 'undefined') return null;
  if (_artCache.has(artPath)) return _artCache.get(artPath);
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = new Uint8Array(await invoke('load_art_file', { artPath }));
    const ext = artPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const url = URL.createObjectURL(new Blob([bytes], { type: ext }));
    _artCache.set(artPath, url);
    return url;
  } catch {
    return null;
  }
}

export function invalidateArtCache(artPath) {
  if (!artPath) return;
  const url = _artCache.get(artPath);
  if (url) URL.revokeObjectURL(url);
  _artCache.delete(artPath);
}
